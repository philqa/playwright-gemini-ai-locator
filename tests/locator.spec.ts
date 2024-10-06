import fs from 'fs/promises';
import path from 'path';
import { test as base, expect } from '@playwright/test';
import { extendPageWithAILocator, PageWithAILocator, getCurrentAPIEndpoint  } from '../src/index';

const test = base.extend<{ page: PageWithAILocator }>({
  page: async ({ page }, use) => {
    await use(extendPageWithAILocator(page));
  },
});

test.describe('AI Locator Tests for phil.qa', () => {
  test.beforeAll(async () => {
      //await deleteAiSelectorCache();
    });
  test.beforeEach(async ({ page }) => {
    await page.goto('https://phil.qa');
  });

  test('Basic usage of aiLocator', async ({ page }) => {
    console.log(`Current API endpoint: ${getCurrentAPIEndpoint()}`);

    const siteTitle = await page.aiLocator('page header text');
    await expect(siteTitle).toBeVisible();
    await expect(siteTitle).toContainText('phil.qa');

    const profileTitle = await page.aiLocator('main content section title');
    await expect(profileTitle).toBeVisible();
    await expect(profileTitle).toContainText('Quality assured.');
  });

    test.skip('Basic usage of aiLocator using API key and REST API', async ({ page }) => {
        //TODO: replace with real API key from secrets
        process.env.GOOGLE_CLOUD_VERTEX_AI_API_KEY = '<SET_REAL_API_KEY_FROM_SECRETS';
        console.log(`Current API endpoint: ${getCurrentAPIEndpoint()}`);

        const siteTitle = await page.aiLocator('page header text');
        await expect(siteTitle).toBeVisible();
        await expect(siteTitle).toContainText('phil.qa');

        const profileTitle = await page.aiLocator('main content section title');
        await expect(profileTitle).toBeVisible();
        await expect(profileTitle).toContainText('Quality assured.');
    });

  test('Using aiLocatorAll to find multiple elements', async ({ page }) => {
    const menuItems = await page.aiLocatorAll('menu items in the navigation');
    expect(menuItems.length).toBeGreaterThan(0);

    const expectedMenuItems = ['Home', 'Blog', 'Archive', 'Projects', 'Search'];
    for (let i = 0; i < menuItems.length; i++) {
      await expect(menuItems[i]).toHaveText(expectedMenuItems[i]);
    }
  });

  test('Highlighting an element with highlightAILocator', async ({ page }) => {
    await page.highlightAILocator('profile image');
    // Visual inspection would be needed to confirm the highlight
    // For automated testing, we can check if the function executes without error
  });

  test('Using AI Locator with custom options', async ({ page }) => {
    const customOptions = {
      timeout: 10000,
      retries: 3
    };

    const profileContent = await page.aiLocator('profile content section', customOptions);
    await expect(profileContent).toBeVisible();
    await expect(profileContent).toContainText('Welcome, you\'ve discovered a blog');
  });

  test('Handling non-existent elements', async ({ page }) => {
    const options = { retries: 2 };
    await expect(async () => {
      await page.aiLocator('a button shaped like a blue giraffe with the text moo', options);
    }).rejects.toThrow('Failed to generate a valid selector');
  });

  test('Interacting with social links', async ({ page }) => {
    const githubLink = await page.aiLocator('GitHub a href link');
    await expect(githubLink).toHaveAttribute('href', 'https://github.com/philqa');

    const linkedinLink = await page.aiLocator('LinkedIn a href');
    await expect(linkedinLink).toHaveAttribute('href', 'https://linkedin.com/in/philliphicks');

    const stravaLink = await page.aiLocator('Strava anchor tag');
    await expect(stravaLink).toHaveAttribute('href', 'https://www.strava.com/athletes/philqa');
  });

  test('Testing theme switching buttons', async ({ page }) => {
    const defaultThemeBtn = await page.aiLocator('button for default theme');
    const classicThemeBtn = await page.aiLocator('button for classic theme');
    const darkThemeBtn = await page.aiLocator('button for dark theme');

    await expect(defaultThemeBtn).toBeVisible();
    await expect(classicThemeBtn).toBeVisible();
    await expect(darkThemeBtn).toBeVisible();
    // could test actual theme change with additional logic to check CSS changes
  });

  test('Verifying footer content', async ({ page }) => {
    const footerText = await page.aiLocator('footer text containing copyright and powered by information');
    await expect(footerText).toContainText('Phillip Hicks © 2024');
    await expect(footerText).toContainText('Powered by Hexo & Frame');
  });

  test('Testing search functionality', async ({ page }) => {
    const searchBtn = await page.aiLocator('search button in the navigation');
    await searchBtn.click();

    const searchInput = await page.aiLocator('search input field that appears after clicking search');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('test search query');
    const searchResultList = await page.aiLocatorAll('search result li tags');
    expect(searchResultList.length).toBe(6);
    expect(searchResultList[0]).toContainText('Fast and flexible UI testing using CodeceptJS and ng-apimock');
  });
});

async function deleteAiSelectorCache(): Promise<void> {
  const cacheFilePath = path.join(process.cwd(), 'ai-selector-cache.json');

  try {
    await fs.access(cacheFilePath);
    // File exists, attempt to delete it
    await fs.unlink(cacheFilePath);
    console.log('AI selector cache file deleted successfully.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, no action needed
      console.log('AI selector cache file does not exist. No deletion needed.');
    } else {
      // Some other error occurred
      console.error('Error while trying to delete AI selector cache file:', error);
    }
  }
}