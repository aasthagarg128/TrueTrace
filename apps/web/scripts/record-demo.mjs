// Records a short, full-screen walkthrough of TrueTrace using Playwright.
//
// Plain `playwright` (not @playwright/test) on purpose: this is a one-shot
// recording script, not a test suite, and driving the browser directly keeps
// the timing fully in our control -- which matters when the budget is "stay
// under two minutes" against a pipeline stage that runs in real time.
//
// Usage:
//   node scripts/record-demo.mjs
//
// Requires the app stack already running:
//   detector :8081, api :8080, web :3000  (see README "Run")
//
// Output: demo/truetrace-demo.webm (created fresh each run).

import { chromium } from "playwright";
import { mkdirSync, readdirSync, renameSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const OUT_DIR = join(process.cwd(), "demo");
const FINAL_NAME = "truetrace-demo.webm";
const VIEWPORT = { width: 1600, height: 900 };

function log(step) {
  console.log(`[demo] ${step}`);
}

async function main() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  const started = Date.now();
  const elapsed = () => ((Date.now() - started) / 1000).toFixed(1) + "s";

  try {
    // ---------------------------------------------------------- landing
    log("landing page");
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    await page.evaluate(() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }));
    await page.waitForTimeout(900);
    await page.evaluate(() => document.getElementById("privacy")?.scrollIntoView({ behavior: "smooth" }));
    await page.waitForTimeout(900);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await page.waitForTimeout(400);

    // -------------------------------------------------------- sign up
    log(`sign up (${elapsed()})`);
    await page.getByRole("link", { name: "Get started" }).first().click();
    await page.waitForURL(/\/signup/);
    await page.waitForTimeout(500);

    const handle = `demo-${Date.now().toString(36)}`;
    await page.fill("#username", handle);
    await page.fill("#password", "Correct-Horse-Battery-9");
    await page.fill("#confirm", "Correct-Horse-Battery-9");
    await page.click('label:has-text("Terms & Privacy") input[type="checkbox"]').catch(async () => {
      // fall back to the checkbox itself if the label-based selector misses
      await page.locator('input[type="checkbox"]').first().check();
    });
    await page.waitForTimeout(400);
    await page.click('button:has-text("Create account")');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    log(`dashboard reached (${elapsed()})`);
    await page.waitForTimeout(800);

    // ------------------------------------------------------- new case
    log("starting a case");
    await page.click('a:has-text("New case")');
    await page.waitForURL(/\/cases\/new/);
    await page.waitForTimeout(500);

    await page.fill("#url", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await page.waitForTimeout(300);
    await page.click('button:has-text("Start case"), button[type="submit"]');
    await page.waitForURL(/\/cases\/case-/, { timeout: 15000 });
    log(`case created (${elapsed()})`);

    // ------------------------------------------------- watch it run
    // Real pipeline, real time. Poll the page instead of sleeping a fixed
    // amount, so the recording is exactly as long as the work actually took.
    //
    // Budgeted generously: the "screening" stage calls Gemini for a plain-
    // language explanation, and on a slow or rate-limited response that call
    // runs its full configured timeout (measured: 30s) before falling back
    // to template text. Measured worst case end-to-end: 51s. This deadline
    // and the trimmed pauses elsewhere keep the whole recording under two
    // minutes even if that happens again.
    log("waiting for the pipeline to complete");
    const deadline = Date.now() + 75_000;
    while (Date.now() < deadline) {
      const stillBusy = await page
        .getByText(/Retrieving the content|Fingerprinting the file|Taking still frames|Running the automated check|Sealing the evidence record|Getting started/)
        .first()
        .isVisible()
        .catch(() => false);
      if (!stillBusy) break;
      await page.waitForTimeout(1000);
    }
    log(`pipeline settled (${elapsed()})`);
    await page.waitForTimeout(1000);

    // -------------------------------------------------------- report
    log("opening the report");
    const reportLink = page.locator('a:has-text("Open the report")');
    if (await reportLink.isVisible().catch(() => false)) {
      await reportLink.click();
    } else {
      await page.goto(page.url().replace(/\/$/, "") + "/report");
    }
    await page.waitForTimeout(800);
    await page.waitForSelector("pre", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(700);

    const downloadBtn = page.locator('button:has-text("Download")');
    if (await downloadBtn.isVisible().catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 5000 }).catch(() => null),
        downloadBtn.click(),
      ]);
      if (download) log("report downloaded");
    }
    await page.waitForTimeout(600);

    // ------------------------------------------------------- evidence
    const evidenceLink = page.locator('a:has-text("View evidence")');
    if (await evidenceLink.isVisible().catch(() => false)) {
      log("opening the evidence record");
      await evidenceLink.click();
      await page.waitForTimeout(1200);
    }

    // ------------------------------------------------------- back home
    log("back to the dashboard");
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  // Playwright names the file after an internal id; rename to something
  // predictable so the caller doesn't have to guess.
  const files = readdirSync(OUT_DIR).filter((f) => f.endsWith(".webm"));
  if (files.length === 0) throw new Error("no video was produced");
  const finalPath = join(OUT_DIR, FINAL_NAME);
  if (existsSync(finalPath)) rmSync(finalPath);
  renameSync(join(OUT_DIR, files[0]), finalPath);

  console.log(`\n[demo] wall-clock recording time: ${elapsed()}`);
  console.log(`[demo] saved: ${finalPath}`);
}

main().catch((err) => {
  console.error("[demo] failed:", err);
  process.exit(1);
});
