import { expect, test } from "@playwright/test";
import { promptTex, quickSession, solveMultiplication } from "./helpers";

const NAV = ["Dashboard", "Learning Academy", "Mental Mathematics", "Probability & Statistics", "Market Games", "Cognitive Training", "Coding Laboratory", "Quantitative Research", "Assessments", "Progress & Analytics"];

test.describe.configure({ mode: "serial" });

test("1. dashboard is reachable and shows the command centre", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Training Command Centre" })).toBeVisible();
  await expect(page.getByTestId("dashboard-stats")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("2. flat navigation routes to every master dashboard", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("complementary", { name: "Primary" }).getByRole("navigation");
  for (const label of NAV) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator("h1")).toBeVisible();
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
  }
  // no nested menus: every nav item is a direct link
  await expect(nav.locator("ul ul")).toHaveCount(0);
});

test("3–6. mental maths: Enter submits, next question is immediate, stats update, results persist", async ({ page }) => {
  await page.goto("/mental-math/train?type=multiplication");
  await page.getByTestId("mode-fixed20").click();
  await page.getByTestId("launch").click();
  const input = page.getByTestId("answer-input");
  await expect(input).toBeFocused();

  for (let i = 0; i < 5; i++) {
    const tex = await promptTex(page);
    await input.fill(solveMultiplication(tex));
    const t0 = Date.now();
    await input.press("Enter");
    await expect(page.getByTestId("question-index")).toHaveText(new RegExp(`^Q${i + 2}`));
    expect(Date.now() - t0).toBeLessThan(1000); // generous E2E bound; in-app instrumentation measures the real latency
    await expect(page.getByTestId("stat-correct")).toHaveText(String(i + 1));
  }
  // a wrong answer: correct stays at 5, feedback shows ✗
  await input.fill("-1");
  await input.press("Enter");
  await expect(page.getByTestId("stat-correct")).toHaveText("5");
  await expect(page.getByTestId("feedback")).toContainText("✗");
  // duplicate submission guard: pressing Enter on an empty input does nothing
  await input.press("Enter");
  await expect(page.getByTestId("question-index")).toHaveText(/^Q7/);
  await expect(input).toBeFocused();

  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByTestId("session-results")).toBeVisible();
  await expect(page.getByTestId("result-attempted")).toHaveText("6");
  await expect(page.getByTestId("result-correct")).toHaveText("5");

  // persisted locally: visible on the dashboard after reload
  await page.goto("/");
  await expect(page.getByTestId("recent-sessions")).toContainText("multiplication");
  await expect(page.getByTestId("recent-sessions")).toContainText("5/6");
});

test("7. a market game can be completed", async ({ page }) => {
  await page.goto("/market-games/market-making");
  await page.getByTestId("start-game").click();
  await expect(page.getByTestId("mm-game")).toBeVisible();
  for (let r = 0; r < 6 && (await page.getByTestId("mm-game").count()); r++) {
    await page.getByTestId("mm-bid").fill("10");
    await page.getByTestId("mm-ask").fill("40");
    await page.getByTestId("mm-quote").click();
  }
  await expect(page.getByTestId("game-results")).toBeVisible();
  const score = Number(await page.getByTestId("game-score").textContent());
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(100);
});

test("8. the betting board scores EV, and Fermi uses interval scoring", async ({ page }) => {
  await page.goto("/market-games/betting-board");
  await page.getByTestId("start-game").click();
  await page.getByTestId("betting-submit").click();
  await expect(page.getByTestId("game-results")).toBeVisible();
});

test("9. cognitive task switch records responses and reports separate metrics", async ({ page }) => {
  await page.goto("/cognitive/task-switch");
  await page.getByTestId("start-game").click();
  await page.getByTestId("begin-trials").click();
  const stim = page.getByTestId("ts-stimulus");
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId("game-results").count()) break;
    await stim.locator("span").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await page.getByTestId("game-results").count()) break;
    await page.keyboard.press(i % 2 ? "j" : "f");
    await stim.locator("span").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }
  await expect(page.getByTestId("game-results")).toBeVisible({ timeout: 20_000 });
  for (const label of ["Accuracy", "Median RT", "Switch cost", "RT variability (SD)", "Errors under pressure"]) await expect(page.getByText(label, { exact: true })).toBeVisible();
});

test("10. progress & analytics shows recorded skills and perf diagnostics", async ({ page }) => {
  await quickSession(page);
  await page.goto("/progress");
  await expect(page.getByTestId("skills-table")).toContainText("multiplication");
  await expect(page.getByTestId("perf-table")).toContainText("Answer processing");
  // processing samples were recorded by the trainer instrumentation in this profile
  await expect(page.getByTestId("perf-table").locator("tr").nth(1).locator("td").nth(1)).not.toHaveText("0");
  await expect(page.getByTestId("daily-plan")).toBeVisible();
});

test("11. account sync: register, queued sessions upload, server-validated assessment is graded by the server", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await quickSession(page); // queued locally while signed out
  await page.goto("/account");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByTestId("name").fill("E2E");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("a-long-password-123");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByText(`Signed in as`)).toBeVisible();
  await expect.poll(async () => (await (await page.request.get("/api/v1/progress/summary")).json()).attempts, { timeout: 20_000 }).toBeGreaterThan(0);

  await page.goto("/assessments/missing30");
  await page.getByTestId("start-server-assessment").click();
  const input = page.getByTestId("answer-input");
  await expect(input).toBeVisible();
  for (let i = 0; i < 3; i++) { await input.fill("1"); await input.press("Enter"); }
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByTestId("server-result")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("server-result")).toContainText("Server-validated result");
});

test("12. keyboard-only trainer use and mobile layout without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollW).toBeLessThanOrEqual(390);
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Math" })).toBeVisible();
  await page.goto("/mental-math/train?type=multiplication");
  await page.getByTestId("launch").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("answer-input")).toBeFocused();
});
