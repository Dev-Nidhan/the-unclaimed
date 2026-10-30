export type RobotsRules = {
  crawlDelayMs: number;
  allowed: (pathname: string) => boolean;
};

type Rule = { allow: boolean; path: string };

function matchingGroup(text: string, userAgent: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/#.*$/, "").trim());
  const groups: { agents: string[]; rules: string[] }[] = [];
  let current: { agents: string[]; rules: string[] } | null = null;

  for (const line of lines) {
    if (!line) {
      current = null;
      continue;
    }
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) {
      continue;
    }
    if (field === "disallow" || field === "allow" || field === "crawl-delay") {
      current.rules.push(`${field}:${value}`);
    }
  }

  const exact = groups.find((group) => group.agents.includes(userAgent.toLowerCase()));
  const wildcard = groups.find((group) => group.agents.includes("*"));
  return (exact ?? wildcard)?.rules ?? [];
}

export function parseRobots(text: string, userAgent: string): RobotsRules {
  const rules: Rule[] = [];
  let crawlDelayMs = 0;

  for (const rule of matchingGroup(text, userAgent)) {
    const separator = rule.indexOf(":");
    const field = rule.slice(0, separator);
    const value = rule.slice(separator + 1).trim();
    if (field === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) {
        crawlDelayMs = Math.max(crawlDelayMs, Math.round(seconds * 1000));
      }
      continue;
    }
    if (value === "") {
      continue;
    }
    rules.push({ allow: field === "allow", path: value });
  }

  return {
    crawlDelayMs,
    allowed(pathname: string) {
      const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
      const matches = rules.filter((rule) => path.startsWith(rule.path));
      if (matches.length === 0) {
        return true;
      }
      const longest = Math.max(...matches.map((rule) => rule.path.length));
      const winners = matches.filter((rule) => rule.path.length === longest);
      return winners.some((rule) => rule.allow);
    },
  };
}

export const allowAllRobots: RobotsRules = {
  crawlDelayMs: 0,
  allowed: () => true,
};
