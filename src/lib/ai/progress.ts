export type AnalysisProgress = {
  status: "idle" | "running" | "completed" | "failed";
  phase: string;
  findingsSaved: number;
  discarded: number;
  errors: string[];
};

type Job = AnalysisProgress;

const jobs = new Map<string, Job>();

const idle: AnalysisProgress = {
  status: "idle",
  phase: "Not started",
  findingsSaved: 0,
  discarded: 0,
  errors: [],
};

export function analysisProgress(investigationId: string): AnalysisProgress {
  return jobs.get(investigationId) ?? idle;
}

export function startAnalysis(investigationId: string): void {
  const existing = jobs.get(investigationId);
  if (existing?.status === "running") {
    throw new Error("Analysis is already running for this investigation.");
  }
  jobs.set(investigationId, { ...idle, status: "running", phase: "Reading stored evidence" });
}

export function updateAnalysis(investigationId: string, patch: Partial<AnalysisProgress>): void {
  const job = jobs.get(investigationId);
  if (!job) {
    return;
  }
  Object.assign(job, patch);
}

export function finishAnalysis(investigationId: string, status: "completed" | "failed", phase: string): void {
  updateAnalysis(investigationId, { status, phase });
}
