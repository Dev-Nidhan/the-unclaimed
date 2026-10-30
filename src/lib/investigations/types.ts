export type RecordMode = "stored" | "sample";

export type InvestigationView = {
  mode: RecordMode;
  id: string;
  title: string;
  subject: string;
  startingUrl: string;
  objective: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  sources: Array<{
    id: string;
    url: string;
    title: string | null;
    sourceType: string;
    discoveryMethod: string;
    accessStatus: string;
    createdAt: string;
  }>;
  findings: Array<{
    id: string;
    title: string;
    explanation: string;
    classification: string;
    createdAt: string;
    sourceIds: string[];
  }>;
  observations: Array<{
    id: string;
    sourceId: string;
    pageTitle: string | null;
    httpStatus: number | null;
    observedAt: string;
    excerpt: string;
  }>;
  archives: Array<{
    id: string;
    sourceId: string;
    archiveUrl: string;
    originalUrl: string;
    availabilityStatus: string;
    capturedAt: string;
  }>;
  entities: Array<{
    id: string;
    name: string;
    entityType: string;
    description: string | null;
  }>;
  relationships: Array<{
    id: string;
    fromEntityId: string;
    toEntityId: string;
    relationshipType: string;
  }>;
  activity: Array<{
    id: string;
    label: string;
    at: string;
  }>;
};

