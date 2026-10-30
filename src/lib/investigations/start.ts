export type InvestigationStart =
  | {
      ok: true;
      title: string;
      subject: string;
      startingUrl: string;
      objective: string;
    }
  | { ok: false; error: string };

export function parseInvestigationStart(input: {
  title: string;
  starting: string;
  objective: string;
}): InvestigationStart {
  const title = input.title.trim();
  const starting = input.starting.trim();
  const objective = input.objective.trim();

  if (!title) {
    return { ok: false, error: "Enter an investigation title." };
  }
  if (!objective) {
    return { ok: false, error: "Enter a research objective." };
  }
  if (!starting) {
    return { ok: false, error: "Enter a starting URL. Topic search is not connected yet." };
  }

  let url: URL;
  try {
    url = new URL(starting);
  } catch {
    return {
      ok: false,
      error: "Topic search is not connected yet. Enter an http or https URL to open a record.",
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Enter an http or https address." };
  }

  return {
    ok: true,
    title,
    subject: url.hostname,
    startingUrl: url.toString(),
    objective,
  };
}
