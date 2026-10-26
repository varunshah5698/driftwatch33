import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  MoreHorizontal,
  ShieldQuestion,
} from "lucide-react";
import type { AgentStatus, Severity, UserRole } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/auth/rbac";

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  // Grid rows already stretch their items to equal height (align-items:
  // stretch), so a card fills its row without h-full. Forcing h-full here made
  // cards in stacked flex columns balloon and leave blank space.
  return <Tag className={`panel ${className}`}>{children}</Tag>;
}

export function CardHead({
  title,
  subtitle,
  right,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="display-tight text-[19px] leading-none tracking-wide text-[var(--text)]">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 max-w-[46ch] text-[12px] leading-relaxed text-[var(--muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function OverflowMenu({ label = "Card actions" }: { label?: string }) {
  return (
    <details className="relative">
      <summary
        className="icon-btn h-8 w-8 cursor-pointer list-none border-transparent bg-transparent text-[var(--muted)]"
        aria-label={label}
      >
        <MoreHorizontal size={16} aria-hidden />
      </summary>
      <div className="panel absolute right-0 z-20 mt-2 w-44 p-1.5 text-[12px] shadow-xl">
        <button className="flex w-full items-center rounded-lg px-3 py-2 text-left hover:bg-[var(--panel-hi)]" type="button">
          Export CSV
        </button>
        <button className="flex w-full items-center rounded-lg px-3 py-2 text-left hover:bg-[var(--panel-hi)]" type="button">
          Copy link
        </button>
        <button className="flex w-full items-center rounded-lg px-3 py-2 text-left hover:bg-[var(--panel-hi)]" type="button">
          View raw events
        </button>
      </div>
    </details>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="animate-in">
        {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
        <h1 className="display text-[clamp(38px,5.2vw,62px)] leading-[0.9] text-[var(--text)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-[var(--muted)]">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="scroll-x flex items-center gap-2 pb-0.5">{actions}</div> : null}
    </header>
  );
}

const STATUS_STYLES: Record<AgentStatus, { className: string; label: string }> = {
  active: { className: "chip-lime", label: "Active" },
  learning: { className: "chip-violet", label: "Learning" },
  degraded: { className: "chip-orange", label: "Degraded" },
  quarantined: { className: "chip-red", label: "Quarantined" },
  isolated: { className: "chip-red", label: "Isolated" },
  retired: { className: "", label: "Retired" },
};

export function StatusPill({ status }: { status: AgentStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`chip ${style.className}`}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background:
            status === "active"
              ? "var(--lime)"
              : status === "learning"
                ? "var(--violet)"
                : status === "degraded"
                  ? "var(--orange)"
                  : status === "retired"
                    ? "var(--muted)"
                    : "var(--red)",
        }}
      />
      {style.label}
    </span>
  );
}

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "chip-red",
  high: "chip-orange",
  medium: "chip-orange",
  low: "chip",
  info: "chip",
};

export function SeverityBadge({ severity, showScore }: { severity: Severity; showScore?: number }) {
  return (
    <span className={`chip uppercase tracking-[0.08em] ${SEVERITY_STYLES[severity]}`}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background:
            severity === "critical" || severity === "high"
              ? "var(--red)"
              : severity === "medium"
                ? "var(--orange)"
                : severity === "low"
                  ? "var(--lime)"
                  : "var(--muted)",
        }}
      />
      {severity}
      {showScore !== undefined ? <span className="opacity-70">· {showScore}</span> : null}
    </span>
  );
}

export function OwnerAvatar({
  initials,
  color,
  name,
  size = 26,
}: {
  initials: string;
  color: string;
  name: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-black/30 text-[10px] font-bold text-[#101010]"
      style={{ width: size, height: size, background: color }}
      title={name}
      aria-label={name}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({
  people,
  limit = 4,
}: {
  people: { initials: string; color: string; name: string }[];
  limit?: number;
}) {
  const shown = people.slice(0, limit);
  return (
    <span className="flex items-center">
      {shown.map((person, index) => (
        <span key={`${person.initials}-${index}`} style={{ marginLeft: index === 0 ? 0 : -8 }}>
          <span className="rounded-full ring-2 ring-[var(--panel)]">
            <OwnerAvatar initials={person.initials} color={person.color} name={person.name} size={24} />
          </span>
        </span>
      ))}
      {people.length > limit ? (
        <span className="ml-1 text-[11px] text-[var(--muted)]">+{people.length - limit}</span>
      ) : null}
    </span>
  );
}

export function Delta({
  value,
  direction,
  suffix = "",
  invert = false,
}: {
  value: number | string;
  direction: "up" | "down";
  suffix?: string;
  invert?: boolean;
}) {
  const good = invert ? direction === "down" : direction === "up";
  const Icon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11.5px] font-semibold"
      style={{ color: good ? "var(--lime)" : "var(--orange)" }}
    >
      <Icon size={13} aria-hidden />
      {value}
      {suffix}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  direction = "up",
  hint,
  spark,
  invertDelta,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: string;
  direction?: "up" | "down";
  hint?: string;
  spark?: ReactNode;
  invertDelta?: boolean;
}) {
  return (
    <Card className="overflow-hidden px-5 pt-4 pb-0">
      <div className="flex items-start justify-between">
        <p className="eyebrow">{label}</p>
        <span className="text-[var(--muted-dim)]">
          <MoreHorizontal size={15} aria-hidden />
        </span>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <span className="kpi-num">{value}</span>
        {unit ? <span className="pb-1.5 text-[13px] text-[var(--muted)]">{unit}</span> : null}
      </div>
      <div className="mt-2 flex min-h-[18px] items-center gap-2">
        {delta ? (
          <Delta value={delta} direction={direction} invert={invertDelta} />
        ) : null}
        {hint ? <span className="text-[11px] text-[var(--muted-dim)]">{hint}</span> : null}
      </div>
      {spark ? <div className="-mx-5 mt-3">{spark}</div> : null}
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel-soft)] text-[var(--muted)]">
        <ShieldQuestion size={20} aria-hidden />
      </span>
      <p className="display-tight text-[16px] uppercase">{title}</p>
      <p className="mt-2 max-w-[38ch] text-[12px] text-[var(--muted)]">{description}</p>
    </div>
  );
}

export function RoleChip({ role }: { role: UserRole }) {
  return (
    <span className="chip chip-violet">
      {ROLE_LABEL[role]}
    </span>
  );
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
    >
      {children}
    </Link>
  );
}

export function FilterPill({
  children,
  icon,
  active,
}: {
  children: ReactNode;
  icon?: ReactNode;
  active?: boolean;
}) {
  return (
    <span className={`pill !h-10 cursor-default !text-[12px] ${active ? "pill-active" : ""}`}>
      {icon}
      {children}
      <ChevronDown size={13} aria-hidden className="opacity-60" />
    </span>
  );
}

export function SectionTitle({
  title,
  right,
  subtitle,
}: {
  title: string;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="display-tight text-[16px] uppercase tracking-wide">{title}</h2>
        {subtitle ? <p className="mt-1 text-[11.5px] text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-[var(--line)] bg-[var(--panel-soft)] px-1.5 py-0.5 font-sans text-[10px] text-[var(--muted)]">
      {children}
    </kbd>
  );
}
