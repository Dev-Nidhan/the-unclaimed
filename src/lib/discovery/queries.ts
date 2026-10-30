import type { DiscoveryInput } from "./types";

function hostName(startingUrl: string | undefined): string | null {
  if (!startingUrl) {
    return null;
  }
  try {
    const url = new URL(startingUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

function quoted(value: string): string {
  const cleaned = value.replaceAll('"', "").replace(/\s+/g, " ").trim().slice(0, 120);
  return `"${cleaned}"`;
}

export function buildSearchQueries(input: DiscoveryInput, maxQueries: number): string[] {
  const name = input.subject.replaceAll('"', "").replace(/\s+/g, " ").trim().slice(0, 120);
  const host = hostName(input.startingUrl);
  const alternate =
    host && !name.toLowerCase().includes(host.split(".")[0] ?? host) ? host.split(".")[0] : null;

  const planned = [
    host ? `site:${host}` : quoted(name),
    host
      ? `site:${host} (inurl:docs OR inurl:documentation OR intitle:documentation)`
      : `${quoted(name)} (inurl:docs OR intitle:documentation)`,
    `site:github.com ${quoted(name)}`,
    `${quoted(name)} (site:web.archive.org OR archived OR wayback)`,
    `${quoted(name)} (forum OR discussion)`,
    `${quoted(name)} (article OR reference)`,
    alternate ? `${quoted(alternate)} (project OR software)` : "",
  ].filter((query) => query.length > 0);

  return planned.slice(0, maxQueries);
}
