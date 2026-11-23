import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Load local secrets (e.g. QASE_TESTOPS_API_TOKEN) from the git-ignored .env file.
// In CI the same variables come from GitHub Actions secrets.
if (existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ignore malformed .env; reporters below simply stay disabled
  }
}

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1";
const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// Qase reporting is on only when a token is present, so forks and local runs without
// a token keep working. In CI a shared run id (QASE_TESTOPS_RUN_ID) lets all shards
// report into one Qase test run.
const qaseEnabled = Boolean(process.env.QASE_TESTOPS_API_TOKEN) && process.env.QASE_MODE !== "off";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
    [
      "allure-playwright",
      {
        resultsDir: "allure-results",
        detail: true,
        suiteTitle: true,
        environmentInfo: {
          node: process.version,
          baseURL
        }
      }
    ],
    [
      "playwright-qase-reporter",
      {
        mode: qaseEnabled ? "testops" : "off",
        testops: {
          api: { token: process.env.QASE_TESTOPS_API_TOKEN },
          project: process.env.QASE_TESTOPS_PROJECT ?? "EPCI",
          uploadAttachments: true,
          run: {
            title: process.env.QASE_TESTOPS_RUN_TITLE ?? `Local run ${new Date().toISOString().slice(0, 16)}`,
            complete: !process.env.QASE_TESTOPS_RUN_ID
          }
        },
        framework: {
          markAsFlaky: true
        }
      }
    ]
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
