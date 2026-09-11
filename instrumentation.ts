export async function register() {
  // Node on Windows tries IPv6 first for outbound fetches and silently
  // falls back to IPv4 after a timeout — this alone can add ~2s to every
  // call to Supabase (auth checks, every DB query). Forcing IPv4-first
  // resolution removes that delay. No effect on non-Windows/non-Node
  // environments; guarded to the Node runtime since `dns` isn't available
  // on the Edge runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
