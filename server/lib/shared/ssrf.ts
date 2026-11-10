// @ts-nocheck: web app code, kept as written
import { resolve4, resolve6 } from 'node:dns/promises';
// SSRF protection: validate that a URL uses http(s) and resolves to a public
// (non-private, non-loopback, non-link-local) address before it is fetched.
// Shared by any backend function that fetches a user-supplied URL.

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::' || v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) return true;
    return false;
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

// Resolve a hostname via DNS and confirm every resolved IP is public.
// Blocks DNS-rebinding to private/loopback/link-local addresses.
export async function isPublicHost(host: string): Promise<boolean> {
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) return false;
  // If the host is an IP literal, block private/loopback/link-local ranges.
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':')) {
    return !isPrivateIp(host);
  }
  // Resolve hostname via DNS and ensure every resolved IP is public.
  try {
    const v4 = await resolve4(host).catch(() => []);
    const v6 = await resolve6(host).catch(() => []);
    const ips = [...v4, ...v6];
    if (ips.length === 0) return false; // unresolvable -> reject
    return ips.every((ip: string) => !isPrivateIp(ip));
  } catch {
    return false;
  }
}

export async function validatePublicUrl(rawUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const host = parsed.hostname;
  if (!host) return null;
  const ok = await isPublicHost(host);
  return ok ? rawUrl : null;
}

// Fetch with manual redirect handling -- every redirect target is re-validated
// via validatePublicUrl (DNS resolution + private-IP check) before following.
export async function safeFetchText(
  initialUrl: string,
  options: { headers?: Record<string, string>; maxRedirects?: number } = {}
): Promise<{ ok: boolean; text: string; finalUrl: string }> {
  const maxRedirects = options.maxRedirects ?? 3;
  const headers = options.headers || {};
  let currentUrl = initialUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(currentUrl, { headers, redirect: 'manual' as RequestRedirect });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { ok: false, text: '', finalUrl: currentUrl };
      const nextUrl = new URL(loc, currentUrl).href;
      const safe = await validatePublicUrl(nextUrl);
      if (!safe) throw new Error('Redirect target is not a public URL');
      currentUrl = nextUrl;
      continue;
    }
    if (res.ok) return { ok: true, text: await res.text(), finalUrl: currentUrl };
    return { ok: false, text: '', finalUrl: currentUrl };
  }
  throw new Error('Too many redirects');
}