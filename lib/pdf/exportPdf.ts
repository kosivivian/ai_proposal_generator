import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

// @sparticuz/chromium ships a Linux binary built for AWS Lambda/Vercel's
// serverless runtime — it does not run on a local Windows/macOS dev machine
// at all (spawn ENOENT). In serverless production, use that binary; locally,
// fall back to the full `puppeteer` package's own downloaded Chrome (a
// devDependency — never imported on the serverless path, so it's fine that
// it's dev-only).
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

async function resolveLaunchOptions() {
  if (IS_SERVERLESS) {
    return {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    };
  }

  const localPuppeteer = (await import("puppeteer")).default;
  return {
    executablePath: await localPuppeteer.executablePath(),
    headless: true,
  };
}

/**
 * Renders an HTML string to a PDF buffer.
 *
 * Flagged as the highest infra-risk piece of the build (cold-start size,
 * memory ceiling on lower Vercel tiers, and now this local/serverless
 * environment split). If this proves unreliable in practice,
 * @react-pdf/renderer is the documented fallback.
 */
export async function exportPdf(html: string): Promise<Buffer> {
  const launchOptions = await resolveLaunchOptions();
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    // Our HTML has no external resources (inline <style>, no images/fonts),
    // so "load" is sufficient — networkidle0/2 aren't valid for setContent.
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
