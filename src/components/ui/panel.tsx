import type { ReactNode } from "react";

export function Panel({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[0.68rem] tracking-[0.16em] text-amber uppercase">{eyebrow}</p>
          ) : null}
          <h2 className="font-serif text-lg text-foreground">{title}</h2>
        </div>
        {action}
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-dashed border-line px-3 py-6 text-center">
      <p className="font-serif text-base text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted">{detail}</p>
    </div>
  );
}

export function SampleBanner() {
  return (
    <p className="rounded-md border border-amber/40 bg-amber-soft px-3 py-2 text-sm text-foreground">
      Sample layout. These entries are not stored, and they are not discoveries.
    </p>
  );
}

export function buttonClass(variant: "primary" | "quiet" = "primary"): string {
  const base =
    "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:cursor-not-allowed disabled:opacity-40";
  if (variant === "quiet") {
    return `${base} border border-line bg-raised text-foreground hover:border-amber/50`;
  }
  return `${base} bg-amber text-[#1c140c] hover:bg-[#c4a06e]`;
}

export function fieldClass(): string {
  return "w-full min-w-0 rounded-md border border-line bg-raised px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-amber";
}
