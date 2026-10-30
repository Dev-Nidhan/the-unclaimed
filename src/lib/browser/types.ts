export type BrowserView = {
  status: "none" | "active" | "closed";
  pageUrl: string | null;
  pageTitle: string | null;
  liveViewUrl: string | null;
};
