import { defineConfig, devices } from '@playwright/test';
// load dotenv config based on the ENV variable, default .env if not set
const envFilename = process.env.TEST_ENV ? `./.env.${process.env.TEST_ENV}` : './.env'
require('dotenv').config({ path: envFilename })

// often required for proxies
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const projects = process.env.CI ? [
  { name: 'chromium', use: { args: ['--no-sandbox', '--disable-setuid-sandbox'], ...devices['Desktop Chrome'] }},
  { name: 'firefox', use: { args: ['--no-sandbox', '--disable-setuid-sandbox'], ...devices['Desktop Firefox'] }},
  { name: 'webkit', use: { ...devices['Desktop Safari'] }}
] :
[{ name: 'chromium', use: { args: ['--no-sandbox', '--disable-setuid-sandbox'], ...devices['Desktop Chrome'] }}]

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  /* Full suite timeout 10 minutes */
  globalTimeout: 10 * 60 * 1000,
  /* Individual test timeout 1 minute */
  timeout: 60 * 1000,
  /* Expect timeout */
  expect: { timeout: 10000 },
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 6 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list', { printSteps: true }],
    ['html', { open: 'never', outputFolder: 'html-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    //['allure-playwright'],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry', // this will record a full trace for the first retry only
    screenshot: 'only-on-failure',
    ignoreHttpsErrors: true,
    actionTimeout: 10000,
    navigationTimeout: 10000,
    launchOptions: {
      headless: process.env.HEADLESS !== 'false',
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
      devtools: process.env.DEVTOOLS === 'true',
      downloadsPath: './downloads',
    },
  },

  /* Configure projects for major browsers */
  projects: projects
    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  //],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
