import { canonicalizeUrl } from "../discovery/canonicalize";
import type { sourceAccessStatuses } from "../db/schema";

export type AccessStatus = (typeof sourceAccessStatuses)[number];

export function classifyVisit(input: {
  httpStatus: number | null;
  requestedUrl: string;
  finalUrl: string | null;
  timedOut: boolean;
  navigationError: boolean;
  blocked: boolean;
}): AccessStatus {
  if (input.blocked) {
    return "blocked";
  }
  if (input.timedOut) {
    return "timeout";
  }
  if (input.httpStatus === 404) {
    return "http_404";
  }
  if (input.httpStatus === 403) {
    return "http_403";
  }
  if (input.navigationError && input.httpStatus == null) {
    return "navigation_error";
  }
  if (input.httpStatus != null && input.httpStatus >= 400) {
    return "navigation_error";
  }

  const requested = canonicalizeUrl(input.requestedUrl);
  const finalUrl = input.finalUrl ? canonicalizeUrl(input.finalUrl) : null;
  if (requested && finalUrl && requested !== finalUrl) {
    return "redirected";
  }
  if (input.httpStatus != null && input.httpStatus >= 200 && input.httpStatus < 400) {
    return "accessible";
  }
  return "unknown";
}

export function accessStatusLabel(status: string): string {
  switch (status) {
    case "accessible":
    case "reachable":
      return "Accessible";
    case "http_404":
      return "HTTP 404";
    case "http_403":
      return "HTTP 403";
    case "redirected":
      return "Redirected";
    case "timeout":
      return "Timeout";
    case "blocked":
      return "Blocked";
    case "navigation_error":
    case "unreachable":
      return status === "unreachable" ? "Unreachable" : "Navigation error";
    default:
      return "Unknown";
  }
}

const privateHost = (host: string) =>
  host === "localhost" ||
  host.endsWith(".localhost") ||
  host.endsWith(".local") ||
  host === "0.0.0.0" ||
  host.startsWith("127.") ||
  host.startsWith("10.") ||
  host.startsWith("192.168.") ||
  host.startsWith("169.254.");

const restrictedPath = /\/(login|signin|sign-in|signup|sign-up|account|checkout|subscribe|paywall)(\/|$)/i;

export function selectCrawlLink(href: string, pageUrl: string, allowedHosts: Set<string>): string | null {
  let url: URL;
  try {
    url = new URL(href, pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (privateHost(host) || restrictedPath.test(url.pathname)) {
    return null;
  }
  const known =
    allowedHosts.has(host) ||
    host === "github.com" ||
    host.endsWith(".github.io") ||
    host === "web.archive.org";
  if (!known) {
    return null;
  }
  return canonicalizeUrl(url.toString());
}
