"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, fieldClass } from "@/components/ui/panel";
import { artifactKinds, type ArtifactKind } from "@/lib/storage/files";

type ArtifactRow = {
  id: string;
  sourceId: string;
  filename: string;
  mimeType: string;
  createdAt: string;
  storage: "local" | "spaces";
};

const kindLabels: Record<ArtifactKind, string> = {
  screenshot: "Screenshot",
  pdf: "Recovered PDF",
  archive_page: "Archived page",
  report: "Exported report",
  attachment: "Attachment",
};

export function ArtifactPanel({
  investigationId,
  disabled,
  sources,
}: {
  investigationId: string;
  disabled: boolean;
  sources: Array<{ id: string; title: string | null; url: string }>;
}) {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [kind, setKind] = useState<ArtifactKind>("pdf");

  useEffect(() => {
    if (disabled) {
      return;
    }
    let stop = false;
    void fetch(`/api/investigations/${investigationId}/artifacts`)
      .then(async (response) => {
        const body = (await response.json()) as { artifacts?: ArtifactRow[]; error?: string };
        if (!stop) {
          if (!response.ok) {
            setError(body.error ?? "Stored files could not be listed.");
            return;
          }
          setArtifacts(body.artifacts ?? []);
        }
      })
      .catch(() => {
        if (!stop) {
          setError("Stored files could not be listed.");
        }
      });
    return () => {
      stop = true;
    };
  }, [disabled, investigationId]);

  async function upload(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/investigations/${investigationId}/artifacts`, { method: "POST", body: formData });
    const body = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(body.error ?? "The file could not be stored.");
      return;
    }
    router.refresh();
    const listed = await fetch(`/api/investigations/${investigationId}/artifacts`);
    const next = (await listed.json()) as { artifacts?: ArtifactRow[] };
    setArtifacts(next.artifacts ?? []);
  }

  async function remove(artifactId: string) {
    setError(null);
    const response = await fetch(`/api/investigations/${investigationId}/artifacts?artifactId=${artifactId}`, {
      method: "DELETE",
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "The file could not be removed.");
      return;
    }
    setArtifacts((current) => current.filter((item) => item.id !== artifactId));
  }

  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface px-4 py-4">
      <p className="text-[0.68rem] tracking-[0.16em] text-amber uppercase">Files</p>
      <h2 className="font-serif text-lg">Artifacts</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
        Screenshots, PDFs, archived pages, and reports stay out of the database. A file is stored only when you upload it.
        Downloads are short-lived when Spaces is configured.
      </p>
      {disabled ? <p className="mt-3 text-sm text-muted">The sample layout does not store files.</p> : null}
      {!disabled && sources.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Store a source before uploading a file. The file is linked to that source.</p>
      ) : null}
      {!disabled && sources.length > 0 ? (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void upload(new FormData(event.currentTarget));
          }}
        >
          <label className="text-sm">
            Source
            <select className={`${fieldClass()} mt-1`} name="sourceId" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.title ?? source.url}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Type
            <select
              className={`${fieldClass()} mt-1`}
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as ArtifactKind)}
            >
              {artifactKinds.map((item) => (
                <option key={item} value={item}>
                  {kindLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            File
            <input className={`${fieldClass()} mt-1`} type="file" name="file" required />
          </label>
          <button type="submit" className={buttonClass()} disabled={pending}>
            {pending ? "Storing…" : "Upload"}
          </button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!disabled && artifacts.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {artifacts.map((artifact) => (
            <li key={artifact.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{artifact.filename}</p>
                <p className="text-xs text-muted">
                  {artifact.mimeType} · {artifact.storage === "spaces" ? "Spaces" : "Local fallback"}
                </p>
              </div>
              <div className="flex gap-2">
                <a className={buttonClass("quiet")} href={`/api/investigations/${investigationId}/artifacts/${artifact.id}`}>
                  Download
                </a>
                <button type="button" className={buttonClass("quiet")} onClick={() => void remove(artifact.id)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
