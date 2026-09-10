import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

/**
 * Renders an HTML string to a PDF buffer using a serverless-compatible
 * Chromium build (@sparticuz/chromium + puppeteer-core — no system Chrome
 * required, sized to fit Vercel's function deployment limits).
 *
 * Flagged as the highest infra-risk piece of the build (cold-start size,
 * memory ceiling on lower Vercel tiers). If this proves unreliable in
 * practice, @react-pdf/renderer is the documented fallback.
 */
export async function exportPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

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
