"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { Aperture, GitBranch, LayoutDashboard, Menu, Monitor, Plus, ScrollText, Settings, X } from "lucide-react";
import type { ReactNode } from "react";

const primaryLinks = [
  { href: "/", label: "The archive", icon: LayoutDashboard },
  { href: "/investigations/new", label: "Begin a case", icon: Plus },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const investigationMatch = pathname.match(/^\/investigations\/([^/]+)/);
  const investigationId = investigationMatch?.[1];
  const inInvestigation = investigationId && investigationId !== "new";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <div>
        <p className="px-3 text-[0.68rem] tracking-[0.18em] text-muted uppercase">Enter the archive</p>
        <ul className="mt-2 space-y-1">
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const current = isCurrent(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  onClick={onNavigate}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    current ? "bg-amber-soft text-foreground" : "text-muted hover:bg-raised hover:text-foreground"
                  }`}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {inInvestigation ? (
        <div>
          <p className="px-3 text-[0.68rem] tracking-[0.18em] text-muted uppercase">This record</p>
          <ul className="mt-2 space-y-1">
            {[
              { href: `/investigations/${investigationId}`, label: "Workspace", icon: ScrollText },
              { href: `/investigations/${investigationId}/browser`, label: "Cloud browser", icon: Monitor },
              { href: `/investigations/${investigationId}/graph`, label: "Evidence graph", icon: GitBranch },
              { href: `/investigations/${investigationId}/report`, label: "Archive report", icon: ScrollText },
            ].map((link) => {
              const Icon = link.icon;
              const current = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      current ? "bg-amber-soft text-foreground" : "text-muted hover:bg-raised hover:text-foreground"
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const browserStage = /^\/investigations\/[^/]+\/browser$/.test(pathname);
  const [open, setOpen] = useState(false);

  return (
    <div className="atmosphere flex h-dvh w-full overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-raised focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/80 lg:flex">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <span className="archive-brand-mark"><Aperture aria-hidden="true" className="size-5" /></span>
            <div>
              <p data-presence-mark className="font-serif text-2xl tracking-tight text-foreground">The Unclaimed</p>
              <p data-presence-text className="mt-1 text-[0.62rem] tracking-[0.17em] text-muted uppercase">Digital archaeology</p>
            </div>
          </div>
        </div>
        <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
          <Suspense fallback={<p className="px-3 text-sm text-muted">Loading navigation…</p>}>
            <NavLinks />
          </Suspense>
        </nav>
        <div className="archive-sidebar-note">
          <Aperture aria-hidden="true" className="size-4 shrink-0 text-amber" />
          <div><p>Residual presence</p><span>Atmosphere lives in Settings</span></div>
        </div>
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-10 flex h-dvh max-h-dvh w-[min(18rem,calc(100vw-2rem))] flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-2"><Aperture aria-hidden="true" className="size-4 text-amber" /><p data-presence-mark className="font-serif text-xl">The Unclaimed</p></div>
              <button
                type="button"
                aria-label="Close menu"
                className="rounded-md p-2 text-muted hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
              <Suspense fallback={<p className="px-3 text-sm text-muted">Loading navigation…</p>}>
                <NavLinks onNavigate={() => setOpen(false)} />
              </Suspense>
            </nav>
          </aside>
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            className="rounded-md border border-line p-2"
            onClick={() => setOpen(true)}
          >
            <Menu aria-hidden="true" className="size-4" />
          </button>
          <p data-presence-mark className="min-w-0 truncate font-serif text-lg">
            The Unclaimed
          </p>
          <p data-presence-text className="truncate text-xs tracking-[0.14em] text-muted uppercase">
            Digital archaeology
          </p>
        </header>
        <div
          id="main-content"
          tabIndex={-1}
          className={
            browserStage
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              : "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain"
          }
        >
          <div
            className={
              browserStage
                ? "flex min-h-0 flex-1 flex-col"
                : "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
