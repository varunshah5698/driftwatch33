"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Blocks,
  Command,
  FileCode2,
  Fingerprint,
  FlaskConical,
  Home,
  LogOut,
  Moon,
  Network,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import type { User } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/auth/rbac";
import { useAuthActions } from "@convex-dev/auth/react";
import { convexConfigured } from "@/app/ConvexClientProvider";

const NAV = [
  { href: "/agents", label: "Agents" },
  { href: "/monitor", label: "Monitoring" },
  { href: "/alerts", label: "Alerts" },
  { href: "/policies", label: "Policies" },
  { href: "/simulation", label: "Lab" },
];

const RAIL = [
  { href: "/overview", label: "Overview", icon: Home },
  { href: "/evidence", label: "Evidence", icon: Fingerprint },
  { href: "/chain", label: "Agent chains", icon: Network },
  { href: "/baselines", label: "Baselines", icon: Activity },
  { href: "/roles", label: "Role manifests", icon: FileCode2 },
  { href: "/audit", label: "Audit log", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

const EXTRA_PAGES = [
  { href: "/monitor", label: "Live monitor" },
  { href: "/simulation", label: "Simulation lab" },
  { href: "/baselines", label: "Baselines and learning" },
  { href: "/roles", label: "Role manifest editor" },
  { href: "/audit", label: "Hash-chained audit log" },
  { href: "/settings", label: "Settings and RBAC" },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="38" height="38" viewBox="0 0 40 40" role="img" aria-label="Driftwatch">
        <rect width="40" height="40" rx="13" fill="var(--white)" />
        <circle cx="20" cy="20" r="10.5" fill="none" stroke="var(--bg)" strokeWidth="2" />
        <circle cx="20" cy="20" r="5" fill="none" stroke="var(--bg)" strokeWidth="2" />
        <path d="M27 13 L34 6" stroke="var(--bg)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="20" cy="20" r="2" fill="var(--orange)" />
      </svg>
      {!compact ? (
        <span className="hidden leading-none sm:block">
          <span className="display-tight block text-[17px] tracking-[0.08em] text-[var(--text)]">
            Driftwatch
          </span>
          <span className="mt-1 block text-[8.5px] uppercase tracking-[0.22em] text-[var(--muted-dim)]">
            identity continuity
          </span>
        </span>
      ) : null}
    </span>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const toggle = async () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    await fetch("/api/preferences/theme", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => undefined);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="icon-btn"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title="Theme"
    >
      {theme === "dark" ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </button>
  );
}

function SearchPalette({
  open,
  onClose,
  agents,
}: {
  open: boolean;
  onClose: () => void;
  agents: { id: string; name: string; role: string }[];
}) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const results = useMemo(() => {
    const needle = query.toLowerCase().trim();
    const pages = [...NAV, ...EXTRA_PAGES]
      .filter((page) => !needle || page.label.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((page) => ({ id: page.href, label: page.label, sub: "Page", href: page.href }));
    const matchedAgents = agents
      .filter(
        (agent) =>
          needle &&
          (agent.name.toLowerCase().includes(needle) || agent.role.toLowerCase().includes(needle)),
      )
      .slice(0, 5)
      .map((agent) => ({
        id: agent.id,
        label: agent.name,
        sub: agent.role,
        href: `/agents/${agent.id}`,
      }));
    return [...pages, ...matchedAgents];
  }, [agents, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Search agents and pages"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-[560px] overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
          <Search size={17} className="text-[var(--muted)]" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agents, pages, tools…"
            aria-label="Search"
            className="h-8 w-full border-0 bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--muted-dim)]"
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "Enter" && results[0]) {
                router.push(results[0].href);
                onClose();
              }
            }}
          />
          <button type="button" onClick={onClose} className="icon-btn h-8 w-8" aria-label="Close search">
            <X size={14} aria-hidden />
          </button>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-[12px] text-[var(--muted)]">
              No matches. Try an agent codename.
            </li>
          ) : (
            results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-[var(--panel-hi)]"
                  onClick={() => {
                    router.push(result.href);
                    onClose();
                  }}
                >
                  <span className="text-[13px] text-[var(--text)]">{result.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--muted-dim)]">
                    {result.sub}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-2.5 text-[10px] text-[var(--muted-dim)]">
          <Command size={11} aria-hidden /> K opens search · Esc closes
        </div>
      </div>
    </div>
  );
}

function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const authActions = useAuthActions();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // End the Convex identity too — otherwise the next visit is already signed in.
    if (convexConfigured) await authActions.signOut().catch(() => undefined);
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--panel-soft)] py-1.5 pl-3 pr-1.5 transition-colors hover:border-[var(--line-strong)]"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="hidden text-right leading-tight md:block">
          <span className="block text-[11.5px] font-semibold text-[var(--text)]">{user.name}</span>
          <span className="block text-[9.5px] uppercase tracking-[0.08em] text-[var(--muted)]">
            {ROLE_LABEL[user.role]}
          </span>
        </span>
        <span
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-[#101010]"
          style={{ background: user.color }}
        >
          {user.initials}
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg)] bg-[var(--lime)]" />
        </span>
      </button>
      {open ? (
        <div className="panel absolute right-0 z-40 mt-2 w-52 p-1.5" role="menu">
          <div className="px-3 py-2">
            <p className="text-[12px] font-medium">{user.name}</p>
            <p className="text-[10px] text-[var(--muted)]">{user.email}</p>
            <p className="mt-1 text-[9px] uppercase tracking-wide text-[var(--lime)]">
              {ROLE_LABEL[user.role]}
            </p>
          </div>
          <div className="hairline mx-2 my-1" />
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] hover:bg-[var(--panel-hi)]"
            onClick={() => setOpen(false)}
          >
            <Settings size={13} aria-hidden /> Settings
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-[var(--red)] hover:bg-[var(--red-soft)]"
          >
            <LogOut size={13} aria-hidden /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({
  user,
  openAlerts,
  agents,
  children,
}: {
  user: User;
  openAlerts: number;
  agents: { id: string; name: string; role: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only-focusable fixed left-4 top-4 z-[100] rounded-full bg-[var(--lime)] px-4 py-2 text-[12px] font-semibold text-[var(--lime-ink)]"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1640px]">
        <aside
          className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--rail)]/95 p-1.5 shadow-2xl backdrop-blur lg:bottom-auto lg:left-5 lg:top-[118px] lg:z-20 lg:translate-x-0 lg:flex-col lg:gap-2 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
          aria-label="Workspace navigation"
        >
          {RAIL.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className="focus-ring group relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors lg:h-[46px] lg:w-[46px]"
                style={{
                  background: active ? "var(--lime)" : "var(--rail)",
                  borderColor: active ? "var(--lime)" : "var(--line)",
                  color: active ? "var(--lime-ink)" : "var(--muted)",
                }}
              >
                <Icon size={17} aria-hidden />
                <span className="pointer-events-none absolute left-[54px] hidden whitespace-nowrap rounded-full border border-[var(--line)] bg-[var(--panel-hi)] px-2.5 py-1 text-[10px] text-[var(--text)] opacity-0 transition-opacity group-hover:opacity-100 lg:block">
                  {item.label}
                </span>
              </Link>
            );
          })}
          <span className="mx-1 hidden h-px w-7 bg-[var(--line)] lg:block" />
          <Link
            href="/settings"
            title="Settings"
            aria-label="Settings"
            className="focus-ring hidden h-[46px] w-[46px] items-center justify-center rounded-full border border-[var(--line)] bg-[var(--rail)] text-[var(--muted)] transition-colors hover:text-[var(--text)] lg:flex"
          >
            <Settings size={17} aria-hidden />
          </Link>
          <Link
            href="/agents#register"
            aria-label="Register agent"
            title="Register agent"
            className="focus-ring hidden h-[46px] w-[46px] items-center justify-center rounded-full bg-[var(--lime)] text-[var(--lime-ink)] transition-transform hover:scale-[1.04] lg:mt-6 lg:flex"
          >
            <Plus size={20} aria-hidden />
          </Link>
        </aside>

        <div className="min-w-0 flex-1 px-3 pb-24 pt-3 sm:px-5 lg:ml-[92px] lg:pb-10 lg:pl-4 lg:pr-6">
          <header className="sticky top-2 z-30 mb-6 flex flex-wrap items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg)]/80 p-1.5 backdrop-blur-xl sm:flex-nowrap sm:gap-3 lg:top-3">
            <Link href="/overview" className="focus-ring shrink-0 pl-2 pr-1" aria-label="Driftwatch overview">
              <Logo />
            </Link>
            <nav className="scroll-x flex flex-1 items-center gap-1.5" aria-label="Primary">
              {NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`focus-ring flex h-10 shrink-0 items-center rounded-full border px-4 text-[12.5px] font-medium transition-colors ${
                      active
                        ? "border-[var(--white)] bg-[var(--white)] text-[var(--bg)]"
                        : "border-transparent text-[var(--text-soft)] hover:border-[var(--line)] hover:bg-[var(--panel)]"
                    }`}
                  >
                    {item.label}
                    {item.href === "/alerts" && openAlerts > 0 ? (
                      <span
                        className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          active ? "bg-[var(--bg)]/15" : "bg-[var(--red-soft)] text-[var(--red)]"
                        }`}
                      >
                        {openAlerts}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="icon-btn"
                aria-label="Search (Command K)"
                title="Search"
              >
                <Search size={17} aria-hidden />
              </button>
              <ThemeToggle />
              <Link href="/alerts" className="icon-btn relative" aria-label={`${openAlerts} open alerts`}>
                <Bell size={17} aria-hidden />
                {openAlerts > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--red)] px-1 text-[8.5px] font-bold text-white">
                    {openAlerts}
                  </span>
                ) : null}
              </Link>
              <UserMenu user={user} />
            </div>
          </header>

          <main id="main" className="min-h-[70vh]">
            {children}
          </main>

          <footer className="mt-10 flex flex-col gap-2 border-t border-[var(--line)] py-5 text-[10px] text-[var(--muted-dim)] sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2">
              <span className="live-dot" /> Telemetry streaming · HMAC-signed ingestion
            </span>
            <span className="inline-flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <Blocks size={11} aria-hidden /> v1.0.0
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FlaskConical size={11} aria-hidden /> Synthetic demo fleet
              </span>
              <span>UTC · {new Date().getFullYear()}</span>
            </span>
          </footer>
        </div>
      </div>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} agents={agents} />
    </div>
  );
}
