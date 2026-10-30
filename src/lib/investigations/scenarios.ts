export type InvestigationScenario = {
  id: string;
  title: string;
  startingUrl: string;
  objective: string;
  note: string;
};

export const investigationScenarios: InvestigationScenario[] = [
  {
    id: "first-website",
    title: "The first website",
    startingUrl: "https://info.cern.ch/",
    objective: "Record what CERN still serves at the first public website, and which links on that page still open.",
    note: "Starting address only. CERN still hosts this page.",
  },
  {
    id: "space-jam-1996",
    title: "Space Jam, 1996",
    startingUrl: "https://www.spacejam.com/1996/",
    objective: "Follow the preserved 1996 Space Jam pages and note which images and links still resolve.",
    note: "Starting address only. This path is the preserved 1996 site.",
  },
  {
    id: "million-dollar-homepage",
    title: "The Million Dollar Homepage",
    startingUrl: "https://www.milliondollarhomepage.com/",
    objective: "Open the 2005 pixel page and record which advertised links still respond.",
    note: "Starting address only. The page is still online.",
  },
  {
    id: "fogcam",
    title: "FogCam",
    startingUrl: "https://www.fogcam.org/",
    objective: "See what the long-running San Francisco webcam page still shows, and whether older links remain.",
    note: "Starting address only. The camera page is still online.",
  },
  {
    id: "geocities-collection",
    title: "GeoCities collection",
    startingUrl: "https://archive.org/web/geocities.php",
    objective: "Use the Internet Archive GeoCities collection as the entry point. A neighborhood is not recovered until a capture is stored.",
    note: "Starting address only. This is the collection page, not a saved capture.",
  },
];
