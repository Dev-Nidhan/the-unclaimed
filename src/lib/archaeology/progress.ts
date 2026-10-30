export type FieldworkProgress = {
  status: "idle" | "running" | "cancelling" | "completed" | "cancelled" | "failed";
  phase: string;
  pagesVisited: number;
  maxPages: number;
  currentUrl: string | null;
  observationsSaved: number;
  sourcesDiscovered: number;
  errors: string[];
  missingReferences: Array<{ url: string; accessStatus: string; note: string }>;
};

type Job = FieldworkProgress & {
  controller: AbortController;
};

const jobs = new Map<string, Job>();

const idle: FieldworkProgress = {
  status: "idle",
  phase: "Not started",
  pagesVisited: 0,
  maxPages: 15,
  currentUrl: null,
  observationsSaved: 0,
  sourcesDiscovered: 0,
  errors: [],
  missingReferences: [],
};

export function fieldworkProgress(investigationId: string): FieldworkProgress {
  const job = jobs.get(investigationId);
  if (!job) {
    return idle;
  }
  return {
    status: job.status,
    phase: job.phase,
    pagesVisited: job.pagesVisited,
    maxPages: job.maxPages,
    currentUrl: job.currentUrl,
    observationsSaved: job.observationsSaved,
    sourcesDiscovered: job.sourcesDiscovered,
    errors: job.errors,
    missingReferences: job.missingReferences,
  };
}

export function startFieldworkJob(investigationId: string, maxPages: number): AbortSignal {
  const existing = jobs.get(investigationId);
  if (existing?.status === "running" || existing?.status === "cancelling") {
    throw new Error("Fieldwork is already running for this investigation.");
  }
  const controller = new AbortController();
  jobs.set(investigationId, {
    ...idle,
    status: "running",
    phase: "Starting",
    maxPages,
    controller,
  });
  return controller.signal;
}

export function updateFieldwork(investigationId: string, patch: Partial<FieldworkProgress>): void {
  const job = jobs.get(investigationId);
  if (!job) {
    return;
  }
  Object.assign(job, patch);
}

export function cancelFieldwork(investigationId: string): FieldworkProgress {
  const job = jobs.get(investigationId);
  if (!job || (job.status !== "running" && job.status !== "cancelling")) {
    return fieldworkProgress(investigationId);
  }
  job.status = "cancelling";
  job.phase = "Stopping after the current page";
  job.controller.abort();
  return fieldworkProgress(investigationId);
}

export function finishFieldwork(
  investigationId: string,
  status: "completed" | "cancelled" | "failed",
  phase: string,
): void {
  updateFieldwork(investigationId, { status, phase, currentUrl: null });
}
