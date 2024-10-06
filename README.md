# Playwright AI Locator

This package provides an AI-powered locator for Playwright using the Gemini API.

## Installation

```bash
npm install playwright-ai-locator
```

## Usage

```typescript
import { test as base } from '@playwright/test';
import { extendPageWithAILocator, PageWithAILocator } from 'playwright-ai-locator';

const test = base.extend<{ page: PageWithAILocator }>({
  page: async ({ page }, use) => {
    await use(extendPageWithAILocator(page));
  },
});

test('Using AI Locator', async ({ page }) => {
  await page.goto('https://example.com');

  const header = await page.aiLocator('main heading at the top of the page');
  await expect(header).toBeVisible();
  await expect(header).toHaveText('Example Domain');
});
```

Make sure to set the environment variables:
`VERTEX_AI_API_KEY` and `GOOGLE_CLOUD_PROJECT_ID` before running your tests.

## License

MIT