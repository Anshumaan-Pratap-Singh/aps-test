import { defineConfig, devices } from "@playwright/test";

const API_DIR = "../../services/api";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.APS_BASE_URL ?? "http://localhost:3000", trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } } },
  ],
  webServer: [
    { command: `cd ${API_DIR} && .venv/bin/uvicorn app.main:app --port 8000`, url: "http://localhost:8000/api/health", reuseExistingServer: true, timeout: 60_000 },
    { command: "npm run build && npm run start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 300_000 },
  ],
});
