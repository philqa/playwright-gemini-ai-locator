import { Page, Locator } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';

const auth = new GoogleAuth();

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface SelectorCache {
  [pageUrl: string]: {
    [description: string]: string;
  };
}

interface TokenCache {
  token: string;
  timestamp: number;
}

interface AILocatorOptions {
  timeout?: number;
  retries?: number;
  highlightDuration?: number;
}

let tokenCache: TokenCache | null = null;
const CACHE_FILE_PATH = path.join(process.cwd(), 'ai-selector-cache.json');

async function loadCache(): Promise<SelectorCache> {
  try {
    const data = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveCache(cache: SelectorCache): Promise<void> {
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
}

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getValidAccessToken(): Promise<string> {
  const currentTime = Date.now();
  if (!tokenCache || currentTime - tokenCache.timestamp > 59 * 60 * 1000) {
    const newToken = await auth.getAccessToken();
    tokenCache = {
      token: newToken,
      timestamp: currentTime
    };
  }
  return tokenCache.token;
}

async function queryGeminiAPI(prompt: string): Promise<string> {
    let url: string;
    let headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_REGION;
    const model = process.env.GOOGLE_CLOUD_VERTEX_AI_MODEL;
    let apiKey = process.env.GOOGLE_CLOUD_VERTEX_AI_API_KEY;
    // if not using an API key, use Google Auth access token
    if (apiKey) {
      // Use the ai-studio Gemini API key based endpoint (projectId not required, but currently no location support)
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    } else {
      // Use the google access token based endpoint (google cloud console Vertex AI approach without service account API key)
      url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
      const accessToken = await getValidAccessToken();
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
    });

    // Handle rate limiting by the API, should only happen if cache isn't used or is being regenerated
    if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '30') * 1000;
        console.log(`Rate limited by Gemini API, retrying after ${retryAfter}ms...`);
        await wait(retryAfter);
        throw new Error(`Gemini API request failed due to rate limiting.`);
    }

    if (!response.ok) {
        console.log(response);
        throw new Error(`Gemini API request failed: ${response.statusText}`);
    }

    const data: GeminiResponse = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
}

async function getAiSelector(page: Page, description: string, options: AILocatorOptions): Promise<string> {
  const cache = await loadCache();
  const pageUrl = page.url();

  const maxRetries = options?.retries || 3;
  let retries = 0;

  while (retries < maxRetries) {
    let selector: string | null = null;

    if (cache[pageUrl]?.[description] && retries === 0) {
      // Use cached selector on the first try
      selector = cache[pageUrl][description];
      console.log('Using cached selector:', selector);
    } else {
      // Query API for a new selector
      const prompt = "Given the following description of an element on a web page and the page HTML, provide a CSS selector"
      + " that would likely match this element. The selector should be as specific as possible while still being likely to"
      + " being likely to match the described element. If you cannot determine a suitable selector, respond with \"ERROR:"
      + " Unable to determine selector\" followed by a brief explanation. Only return the selector or the error message, no other text.:"
      + "Description: " + description + "\n"
      + "Page HTML: " + await page.content();

        try {
            const response = await queryGeminiAPI(prompt);

            if (response.startsWith("ERROR:")) {
                console.warn(`AI couldn't determine selector: ${response}`);
                retries++;
                continue;
            }

            selector = response;
            console.log('Retrieved new selector from AI:', selector);
        } catch (error) {
            console.error('Error querying AI API:', error);
            retries++;
            continue;
        }
    }

    if (selector) {
        // Check if the selector is valid and an element exists
        const elementExists = await page.$(selector) !== null;

        if (elementExists) {
          // Update cache with the successful selector
          if (!cache[pageUrl]) cache[pageUrl] = {};
          cache[pageUrl][description] = selector;
          await saveCache(cache);
          return selector;
        } else {
          console.warn(`Selector '${selector}' is invalid or no matching elements found. Retrying...`);
        }
    }

    retries++;
  }

  throw new Error(`Failed to generate a valid selector for description: ${description}`);
}

export interface PageWithAILocator extends Page {
    aiLocator(description: string, options?: AILocatorOptions): Promise<Locator>;
    aiLocatorAll(description: string, options?: AILocatorOptions): Promise<Locator[]>;
    highlightAILocator(description: string, options?: AILocatorOptions): Promise<void>;
}

export function extendPageWithAILocator(page: Page): PageWithAILocator {
    const extendedPage = page as PageWithAILocator;

    extendedPage.aiLocator = async function(description: string, options: AILocatorOptions = {}): Promise<Locator> {
        const selector = await getAiSelector(this, description, options);
        return this.locator(selector);
    };

    extendedPage.aiLocatorAll = async function(description: string, options: AILocatorOptions = {}): Promise<Locator[]> {
        const selector = await getAiSelector(this, description, options);
        return this.locator(selector).all();
    };

  extendedPage.highlightAILocator = async function(description: string, options: AILocatorOptions = {}): Promise<void> {
    const selector = await getAiSelector(this, description, options);
    await this.evaluate(([sel, dur]) => {
      return new Promise<void>((resolve) => {
        const element = document.querySelector(sel);
        if (element) {
          const originalOutline = element.style.outline;
          const originalZIndex = element.style.zIndex;
          element.style.outline = '3px solid red';
          element.style.zIndex = '10000';  // Ensure the element is on top
          setTimeout(() => {
            element.style.outline = originalOutline;
            element.style.zIndex = originalZIndex;
            resolve();
          }, dur);
        } else {
          resolve();
        }
      });
    }, [selector, options?.highlightDuration || 3000]);
  };

    return extendedPage;
}

// Add a function to check which API is being used
export function getCurrentAPIEndpoint(): string {
    return process.env.GOOGLE_CLOUD_VERTEX_AI_API_KEY
        ? "API key based endpoint (generativelanguage.googleapis.com)"
        : "Access token based endpoint (aiplatform.googleapis.com)";
}