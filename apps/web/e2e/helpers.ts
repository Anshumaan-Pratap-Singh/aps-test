import type { Page } from "@playwright/test";

/** Read the TeX source of the current prompt from KaTeX's MathML annotation (no answers are exposed in the DOM). */
export async function promptTex(page: Page): Promise<string> {
  return (await page.locator('[data-testid="question-prompt"] annotation').first().textContent()) ?? "";
}

/** Solve "a \\times b = ?" prompts exactly. */
export function solveMultiplication(tex: string): string {
  const m = tex.match(/(\d+)\s*\\times\s*(\d+)/);
  if (!m) throw new Error(`unexpected prompt ${tex}`);
  return String(BigInt(m[1]!) * BigInt(m[2]!));
}

/** Run a short multiplication session (3 correct answers) so this browser profile has local history. */
export async function quickSession(page: Page) {
  await page.goto("/mental-math/train?type=multiplication");
  await page.getByTestId("mode-fixed20").click();
  await page.getByTestId("launch").click();
  const input = page.getByTestId("answer-input");
  for (let i = 0; i < 3; i++) {
    await input.fill(solveMultiplication(await promptTex(page)));
    await input.press("Enter");
    await page.getByTestId("question-index").filter({ hasText: new RegExp(`^Q${i + 2}`) }).waitFor();
  }
  await page.getByRole("button", { name: "End session" }).click();
  await page.getByTestId("session-results").waitFor();
}
