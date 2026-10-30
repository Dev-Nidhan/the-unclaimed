const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];

export function canonicalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  for (const key of trackingParams) {
    url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

function absoluteHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function isSearchRedirect(value: string): boolean {
  try {
    const url = new URL(value, "https://www.google.com");
    const host = url.hostname.toLowerCase();
    const googleHost = host === "google.com" || host.endsWith(".google.com");
    return googleHost && (url.pathname === "/goto" || url.pathname === "/url");
  } catch {
    return value.startsWith("/goto") || value.startsWith("/url");
  }
}

export function selectDestinationUrl(link: string, displayedLink: string): string | null {
  const direct = absoluteHttpUrl(link);
  if (direct && !isSearchRedirect(direct)) {
    return direct;
  }
  if (!isSearchRedirect(link) && !isSearchRedirect(direct ?? "")) {
    return direct;
  }
  const displayed = absoluteHttpUrl(displayedLink);
  if (displayed && !isSearchRedirect(displayed)) {
    return displayed;
  }
  return null;
}
