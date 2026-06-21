import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1";
const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }]
  ],
  use: {
    baseURL,
    ...(vercelBypassSecret ? { extraHTTPHeaders: { "x-vercel-protection-bypass": vercelBypassSecret } } : {}),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000
        }
      }),
  // Cross-browser + mobile coverage. PR/deploy and the main nightly run
  // `--project=chromium` for fast, reliable feedback; the dedicated
  // cross-browser workflow runs every project (see .github/workflows).
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } }
  ]
});
