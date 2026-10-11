/* One-time, public-only v1 portfolio capture. No auth, cookies, workspace or write endpoints. */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const base = "https://ai-support-architect.lovable.app";
  const out = path.resolve("docs/screenshots");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1298, height: 1180 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });

  const route = async (url, expectedHeading) => {
    const response = await page.goto(base + url, { waitUntil: "networkidle", timeout: 60000 });
    if (!response || !response.ok()) throw new Error("Public route failed: " + url + " (" + response?.status() + ")");
    await page.locator("h1").first().waitFor({ timeout: 20000 });
    const heading = (await page.locator("h1").first().textContent()) || "";
    if (!heading.includes(expectedHeading)) throw new Error("Unexpected heading on " + url + ": " + heading);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
  };
  const shot = async (name) => {
    await page.screenshot({ path: path.join(out, name), animations: "disabled", fullPage: false });
  };
  const section = async (id, name) => {
    const el = page.locator("#" + id);
    await el.waitFor({ timeout: 15000 });
    await el.screenshot({ path: path.join(out, name), animations: "disabled" });
  };

  try {
    await route("/", "Northstar Cloud");
    await shot("01-overview.png");

    await route("/demo/workflows", "Workflow inventory");
    await shot("02-workflow-inventory.png");

    await route("/demo/workflows/password-reset", "Password reset");
    await shot("03-password-reset-assessment.png");

    await route("/demo/blueprint/password-reset", "Password reset");
    await shot("04-password-reset-blueprint.png");

    await route("/demo/roadmap", "Implementation roadmap");
    await shot("05-implementation-roadmap.png");

    await route("/demo/report", "Northstar Cloud");
    await shot("06-executive-report-summary.png");
    await section("priorities", "07-report-priorities.png");
    await section("risks", "08-report-controls.png");
    await section("dependencies", "09-report-dependencies-and-sequence.png");
    await section("sequence", "10-report-pilot-and-limitations.png");

    const readmePath = "README.md";
    let readme = fs.readFileSync(readmePath, "utf8");
    const oldText = "Ten final screenshots from the public synthetic demo are provided as a separate portfolio image pack. They have not yet been uploaded as binary repository assets, so this README deliberately does not contain broken image links. The live demo itself remains directly accessible.";
    const newText = [
      "### Captured public-demo screens",
      "",
      "| Overview | Implementation roadmap |",
      "| --- | --- |",
      "| [![Northstar synthetic overview](docs/screenshots/01-overview.png)](docs/screenshots/01-overview.png) | [![Phase-aware Now/Next/Later roadmap](docs/screenshots/05-implementation-roadmap.png)](docs/screenshots/05-implementation-roadmap.png) |",
      "",
      "| Password reset assessment | Executive report priorities |",
      "| --- | --- |",
      "| [![Deterministic password-reset recommendation](docs/screenshots/03-password-reset-assessment.png)](docs/screenshots/03-password-reset-assessment.png) | [![Executive Report Section E](docs/screenshots/07-report-priorities.png)](docs/screenshots/07-report-priorities.png) |",
      "",
      "More captures: [inventory](docs/screenshots/02-workflow-inventory.png), [Blueprint](docs/screenshots/04-password-reset-blueprint.png), [report overview](docs/screenshots/06-executive-report-summary.png), [safety controls](docs/screenshots/08-report-controls.png), [shared dependencies](docs/screenshots/09-report-dependencies-and-sequence.png), and [implementation sequence](docs/screenshots/10-report-pilot-and-limitations.png). These screenshots are generated from the public **synthetic** demo; they are visual evidence, not observed operational outcomes."
    ].join("\n");
    if (!readme.includes(oldText)) throw new Error("README screenshot placeholder changed; refusing blind edit");
    readme = readme.replace(oldText, newText);
    fs.writeFileSync(readmePath, readme);

    const manifest = "docs/screenshots/README.md";
    let m = fs.readFileSync(manifest, "utf8");
    const from = "The source PNG files are currently packaged separately in `ai-support-architect-v1-portfolio-screenshots.zip`, delivered to the project owner alongside this release work. **They are not yet hosted in this repository**, because the connected GitHub action cannot transfer these locally uploaded binary screenshots. Do not mistake this manifest for a hosted image gallery.";
    const to = "The PNG files listed above were produced by a one-time GitHub Actions browser capture of the published **synthetic** demo and are now hosted in this repository. An earlier manually provided ten-image screenshot pack is also available separately. These are public UI captures, not evidence of real customer automation or a signed deployment attestation.";
    if (!m.includes(from)) throw new Error("Screenshot manifest changed; refusing blind edit");
    m = m.replace(from, to);
    fs.writeFileSync(manifest, m);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
