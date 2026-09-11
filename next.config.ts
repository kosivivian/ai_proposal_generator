import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // puppeteer-core + @sparticuz/chromium ship a native binary — don't let
  // Next's bundler try to inline it.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "puppeteer"],
  // serverExternalPackages alone stops Next from bundling/transforming the
  // package's JS, but Vercel's output file tracing can still fail to pick
  // up the non-JS binary directory @sparticuz/chromium relies on at
  // runtime (its brotli-compressed Chromium build), causing "the input
  // directory .../bin does not exist" in production. This forces that
  // directory to actually be copied into the deployed function.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
