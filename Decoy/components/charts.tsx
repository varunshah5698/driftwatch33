import type { Factor, Severity } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/format";

/* ------------------------------------------------------------------ helpers */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const pathFrom = (points: [number, number][], smooth = true): string => {
  if (points.length === 0) return "";
  if (!smooth || points.length < 3) {
    return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  }
  let d = `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const mid = (x0 + x1) / 2;
    d += ` C${mid.toFixed(2)} ${y0.toFixed(2)}, ${mid.toFixed(2)} ${y1.toFixed(2)}, ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  return d;
};

const gradientId = (seed: string) => `g-${seed.replace(/[^a-zA-Z0-9]/g, "")}`;

/* ---------------------------------------------------------------- sparkline */

export function Sparkline({
  values,
  color = "var(--lime)",
  height = 48,
  area = true,
  id = "spark",
}: {
  values: number[];
  color?: string;
  height?: number;
  area?: boolean;
  id?: string;
}) {
  const width = 220;
  const points = values.length ? values : [0];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const mapped: [number, number][] = points.map((value, index) => [
    (index / Math.max(points.length - 1, 1)) * width,
    height - 6 - clamp01((value - min) / span) * (height - 16),
  ]);
  const line = pathFrom(mapped);
  const fill = `${line} L${width} ${height} L0 ${height} Z`;
  const gid = gradientId(id);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Sparkline, ${values.length} points`}
    >
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area ? <path d={fill} fill={`url(#${gid})`} /> : null}
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle
        cx={mapped[mapped.length - 1][0]}
        cy={mapped[mapped.length - 1][1]}
        r="2.6"
        fill={color}
      />
    </svg>
  );
}

/* --------------------------------------------------------------- trend chart */

export interface TrendPoint {
  t: string;
  alignment: number;
  alerts: number;
}

export interface TrendAnnotation {
  at: string;
  title: string;
  type: string;
}

export function TrendChart({
  data,
  annotations = [],
  height = 230,
  showAlerts = true,
}: {
  data: TrendPoint[];
  annotations?: TrendAnnotation[];
  height?: number;
  showAlerts?: boolean;
}) {
  if (data.length === 0) return null;
  const width = 720;
  const margin = { top: 18, right: 16, bottom: 26, left: 34 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const values = data.map((point) => point.alignment);
  const minValue = Math.max(0, Math.min(...values) - 8);
  const maxValue = 100;
  const span = maxValue - minValue || 1;
  const x = (index: number) => margin.left + (index / Math.max(data.length - 1, 1)) * innerW;
  const y = (value: number) => margin.top + innerH - ((value - minValue) / span) * innerH;
  const points: [number, number][] = data.map((point, index) => [x(index), y(point.alignment)]);
  const line = pathFrom(points);
  const fill = `${line} L${x(data.length - 1)} ${margin.top + innerH} L${margin.left} ${margin.top + innerH} Z`;
  const maxAlerts = Math.max(1, ...data.map((point) => point.alerts));
  const gid = gradientId("trend");
  const ticks = [maxValue, Math.round((maxValue + minValue) / 2), minValue];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Fleet role alignment over ${data.length} days`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--lime)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--lime)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--grid-line)"
              strokeDasharray="3 5"
            />
            <text x={8} y={y(tick) + 3} fontSize="9" fill="var(--muted-dim)">
              {tick}
            </text>
          </g>
        ))}
        {showAlerts
          ? data.map((point, index) => (
              <rect
                key={point.t}
                x={x(index) - 3}
                y={margin.top + innerH - (point.alerts / maxAlerts) * 22}
                width={6}
                height={(point.alerts / maxAlerts) * 22}
                rx={2}
                fill="var(--orange)"
                opacity={point.alerts ? 0.5 : 0.12}
              >
                <title>{`${formatDate(point.t)} · ${point.alerts} alerts`}</title>
              </rect>
            ))
          : null}
        {annotations.map((annotation, index) => {
          const nearest = data.reduce(
            (best, point, pointIndex) => {
              const distance = Math.abs(
                new Date(point.t).getTime() - new Date(annotation.at).getTime(),
              );
              return distance < best.distance ? { index: pointIndex, distance } : best;
            },
            { index: 0, distance: Number.POSITIVE_INFINITY },
          );
          return (
            <g key={`${annotation.at}-${index}`}>
              <line
                x1={x(nearest.index)}
                x2={x(nearest.index)}
                y1={margin.top}
                y2={margin.top + innerH}
                stroke="var(--line-strong)"
                strokeDasharray="2 4"
              />
              <circle cx={x(nearest.index)} cy={y(data[nearest.index].alignment)} r="3" fill="var(--violet)" />
              <title>{`${formatDate(annotation.at)} · ${annotation.title}`}</title>
            </g>
          );
        })}
        <path d={fill} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="var(--lime)" strokeWidth="2" strokeLinecap="round" />
        {points.map(([cx, cy], index) => (
          <circle key={data[index].t} cx={cx} cy={cy} r={index === points.length - 1 ? 3.4 : 2} fill="var(--lime)">
            <title>{`${formatDate(data[index].t)} · ${data[index].alignment} alignment`}</title>
          </circle>
        ))}
        {data.map((point, index) =>
          index % 2 === 0 || index === data.length - 1 ? (
            <text
              key={`x-${point.t}`}
              x={x(index)}
              y={height - 6}
              textAnchor="middle"
              fontSize="9"
              fill="var(--muted-dim)"
            >
              {formatDate(point.t)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 px-1 text-[11px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)]" />
          Fleet alignment
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--orange)]" />
          Alerts / day
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--violet)]" />
          Change event
        </span>
        <span className="ml-auto metric-sm text-[11px] text-[var(--muted-dim)]">
          Last {data.length} days · UTC
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- alignment dial */

export function AlignmentDial({
  score,
  size = 210,
  label = "Role alignment",
  confidence,
}: {
  score: number;
  size?: number;
  label?: string;
  confidence?: number;
}) {
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - value / 100);
  const riskColor = score >= 80 ? "var(--lime)" : score >= 55 ? "var(--orange)" : "var(--red)";
  const trackColor = score < 30 ? "var(--red-soft)" : score < 55 ? "var(--orange-soft)" : "var(--line)";
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        role="img"
        aria-label={`${label}: ${score} out of 100`}
        className="-rotate-90"
      >
        <circle cx="100" cy="100" r={radius} fill="none" stroke={trackColor} strokeWidth="16" />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={riskColor}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.22,1,.36,1)" }}
        />
        <circle
          cx="100"
          cy="100"
          r={radius - 15}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
        {Array.from({ length: 36 }).map((_, index) => {
          const angle = (index / 36) * 2 * Math.PI;
          const inner = radius + 14;
          const outer = inner + (index % 3 === 0 ? 6 : 3);
          const round = (n: number) => Math.round(n * 100) / 100;
          return (
            <line
              key={index}
              x1={round(100 + Math.cos(angle) * inner)}
              y1={round(100 + Math.sin(angle) * inner)}
              x2={round(100 + Math.cos(angle) * outer)}
              y2={round(100 + Math.sin(angle) * outer)}
              stroke="var(--line-strong)"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="display leading-none text-[46px] text-[var(--text)]">{score}</span>
        <span className="mt-1 text-[9.5px] uppercase tracking-[0.16em] text-[var(--muted)]">
          {label}
        </span>
        {confidence !== undefined ? (
          <span className="mt-2 rounded-full border border-[var(--line)] px-2 py-0.5 text-[9px] text-[var(--muted)]">
            {Math.round(confidence * 100)}% confidence
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- factor bars */

export function FactorBars({
  factors,
  compact = false,
}: {
  factors: Factor[];
  compact?: boolean;
}) {
  const max = Math.max(1, ...factors.map((factor) => factor.points));
  return (
    <div className="flex flex-col gap-3">
      {factors.map((factor) => (
        <div key={factor.key} className="group">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[11.5px] font-medium text-[var(--text-soft)]">{factor.label}</span>
            <span className="metric-sm text-[11px] text-[var(--muted)]">
              {factor.points} pts
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.max(2, (factor.points / max) * 100)}%`,
                background:
                  factor.points > max * 0.7
                    ? "var(--orange)"
                    : factor.points > 0
                      ? "var(--lime)"
                      : "var(--line)",
                transition: "width 500ms ease",
              }}
            />
          </div>
          {!compact && factor.points > 0 ? (
            <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--muted-dim)]">{factor.observed}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- radar */

export function BehaviorRadar({
  baseline,
  current,
  axes,
  size = 250,
}: {
  baseline: number[];
  current: number[];
  axes: string[];
  size?: number;
}) {
  const center = size / 2;
  const radius = size * 0.34;
  const point = (value: number, index: number): [number, number] => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    const r = radius * clamp01(value);
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  };
  const polygon = (values: number[]) =>
    values.map((value, index) => point(value, index).join(",")).join(" ");
  const labelPoint = (index: number): [number, number] => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    return [center + Math.cos(angle) * (radius + 22), center + Math.sin(angle) * (radius + 22)];
  };
  const changed = axes.filter((_, index) => Math.abs((current[index] ?? 0) - (baseline[index] ?? 0)) > 0.25);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height={size}
      role="img"
      aria-label="Behavior fingerprint: baseline versus current window"
    >
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={axes.map((_, index) => point(ring, index).join(",")).join(" ")}
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
        />
      ))}
      {axes.map((_, index) => {
        const [x, y] = point(1, index);
        return (
          <line
            key={index}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="var(--line)"
            strokeDasharray="2 4"
          />
        );
      })}
      <polygon points={polygon(baseline)} fill="var(--white)" fillOpacity="0.06" stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />
      <polygon points={polygon(current)} fill="var(--lime)" fillOpacity="0.12" stroke="var(--lime)" strokeWidth="1.8" />
      {axes.map((axis, index) => {
        const [x, y] = labelPoint(index);
        const isChanged = changed.includes(axis);
        return (
          <text
            key={axis}
            x={x}
            y={y}
            textAnchor={Math.abs(x - center) < 12 ? "middle" : x > center ? "start" : "end"}
            dominantBaseline="middle"
            fontSize="8.6"
            fill={isChanged ? "var(--orange)" : "var(--muted)"}
            style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            {axis}
          </text>
        );
      })}
      <circle cx={center} cy={center} r="2.5" fill="var(--text)" />
      <g transform={`translate(${center - 52}, ${size - 14})`}>
        <circle cx="4" cy="0" r="3" fill="var(--muted)" />
        <text x="12" y="3" fontSize="8.5" fill="var(--muted)">baseline</text>
        <circle cx="58" cy="0" r="3" fill="var(--lime)" />
        <text x="66" y="3" fontSize="8.5" fill="var(--muted)">current</text>
      </g>
    </svg>
  );
}

/* --------------------------------------------------------------- dot matrix */

export function DotMatrix({
  counts,
  cols = 24,
  rows = 7,
  hue = "lime",
  label,
  cell = 5,
  gap = 4,
}: {
  counts: number[];
  cols?: number;
  rows?: number;
  hue?: "lime" | "orange" | "mixed";
  label?: string;
  cell?: number;
  gap?: number;
}) {
  const max = Math.max(1, ...counts);
  const width = cols * (cell + gap);
  const height = rows * (cell + gap);
  const colorFor = (value: number, _index: number) => {
    if (value === 0) return "var(--line)";
    if (hue === "orange") return "var(--orange)";
    if (hue === "mixed") {
      const ratio = value / max;
      if (ratio > 0.72) return "var(--orange)";
      if (ratio > 0.4) return "var(--lime)";
      return "color-mix(in srgb, var(--lime) 55%, var(--muted-dim))";
    }
    return "var(--lime)";
  };
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      preserveAspectRatio="none"
      role="img"
      aria-label={label ?? "Activity density dot matrix"}
    >
      {Array.from({ length: rows * cols }).map((_, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const value = counts[index] ?? 0;
        const intensity = value / max;
        return (
          <circle
            key={index}
            cx={col * (cell + gap) + cell / 2}
            cy={row * (cell + gap) + cell / 2}
            r={value === 0 ? cell / 2.6 : cell / 2}
            fill={colorFor(value, index)}
            opacity={value === 0 ? 0.55 : 0.35 + intensity * 0.65}
          >            <title>{`${value} actions`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------- capsule comparison */

export interface CapsuleItem {
  label: string;
  primary: number;
  secondary: number;
  icon?: string;
}

export function CapsuleCompare({
  items,
  primaryLabel = "Declared",
  secondaryLabel = "Observed",
  height = 190,
}: {
  items: CapsuleItem[];
  primaryLabel?: string;
  secondaryLabel?: string;
  height?: number;
}) {
  const max = Math.max(1, ...items.flatMap((item) => [item.primary, item.secondary]));
  const tall = (value: number) => 30 + (value / max) * (height - 66);
  return (
    <div>
      <div className="flex items-end justify-between gap-1 px-1">
        {items.map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-1.5" style={{ minWidth: 42 }}>
            <div
              className="flex w-[30px] items-center justify-center rounded-full border border-[var(--line)] bg-[var(--white)] text-[10px] font-bold text-[var(--bg)]"
              style={{ height: tall(item.primary) }}
              title={`${primaryLabel}: ${item.primary}`}
            >
              {item.primary}
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)]" />
            <div
              className="flex w-[30px] items-center justify-center rounded-full bg-[var(--orange)] text-[10px] font-bold text-[#211507]"
              style={{ height: tall(item.secondary) }}
              title={`${secondaryLabel}: ${item.secondary}`}
            >
              {item.secondary}
            </div>
            <span className="mt-1 max-w-[64px] truncate text-center text-[9px] uppercase tracking-[0.06em] text-[var(--muted)]" title={item.label}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--line)] pt-3 text-[11px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--white)]" /> {primaryLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--orange)]" /> {secondaryLabel}
        </span>
        <span className="ml-auto metric-sm">
          Total {items.reduce((total, item) => total + item.primary + item.secondary, 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ gantt timeline */

export interface GanttSession {
  sessionId: string;
  start: string;
  end: string;
  steps: number;
  risk: number;
  delegated: string[];
  tools: string[];
}

export function GanttTimeline({
  sessions,
  people = [],
}: {
  sessions: GanttSession[];
  people?: { initials: string; color: string; name: string }[];
}) {
  if (sessions.length === 0) {
    return <p className="px-6 py-10 text-center text-[12px] text-[var(--muted)]">No sessions in the window.</p>;
  }
  const startMs = Math.min(...sessions.map((session) => new Date(session.start).getTime()));
  const endMs = Math.max(...sessions.map((session) => new Date(session.end).getTime()));
  const span = Math.max(1, endMs - startMs);
  const rowsToShow = sessions.slice(0, 6);
  const hourTicks = Array.from({ length: 6 }).map((_, index) => startMs + (span / 5) * index);
  const color = (risk: number) =>
    risk >= 85 ? "var(--red)" : risk >= 50 ? "var(--orange)" : "var(--lime)";
  const textColor = (risk: number) => (risk >= 85 ? "#fff" : "#14140f");

  return (
    <div>
      <div className="relative ml-[58px] mr-2 mb-2 h-4">
        {hourTicks.map((tick) => (
          <span
            key={tick}
            className="absolute metric-sm -translate-x-1/2 text-[9px] text-[var(--muted-dim)]"
            style={{ left: `${((tick - startMs) / span) * 100}%` }}
          >
            {formatTime(new Date(tick).toISOString())}
          </span>
        ))}
      </div>
      <div className="relative">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <span
            key={index}
            className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-[var(--line)]"
            style={{ left: `calc(58px + ${(index / 5) * 100}% )`, height: rowsToShow.length * 44 }}
          />
        ))}
        <div className="flex flex-col gap-2">
          {rowsToShow.map((session) => {
            const rawLeft = ((new Date(session.start).getTime() - startMs) / span) * 100;
            const left = Math.min(rawLeft, 94);
            const rawWidth = ((new Date(session.end).getTime() - new Date(session.start).getTime()) / span) * 100;
            const width = Math.max(6, Math.min(100 - left, rawWidth));
            const delegatedPeople = session.delegated
              .map((id) => people.find((person) => person.name === id))
              .filter(Boolean)
              .slice(0, 3);
            return (
              <div key={session.sessionId} className="flex items-center gap-2">
                <div className="w-[52px] shrink-0 text-right">
                  <div className="metric-sm text-[10px] text-[var(--text-soft)]">{formatDate(session.start)}</div>
                  <div className="text-[8.5px] text-[var(--muted-dim)]">{formatTime(session.start)}</div>
                </div>
                <div className="relative h-9 flex-1">
                  <div
                    className="absolute top-0 flex h-9 items-center gap-1.5 overflow-hidden rounded-full px-2"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: color(session.risk),
                      color: textColor(session.risk),
                    }}
                    title={`${session.sessionId} · ${session.steps} steps · risk ${session.risk}`}
                  >
                    {width > 12 ? (
                      <>
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/20 text-[8px] font-bold">
                          {session.tools.length || 1}
                        </span>
                        <span className="truncate text-[9px] font-semibold uppercase tracking-wide opacity-80">
                          {session.steps} steps
                        </span>
                        {delegatedPeople.length ? (
                          <span className="ml-auto flex">
                            {delegatedPeople.map((person, index) =>
                              person ? (
                                <span
                                  key={`${person.name}-${index}`}
                                  className="flex h-4 w-4 items-center justify-center rounded-full border border-black/20 text-[6px] font-bold text-[#111]"
                                  style={{ background: person.color, marginLeft: index === 0 ? 0 : -5 }}
                                >
                                  {person.initials}
                                </span>
                              ) : null,
                            )}
                          </span>
                        ) : (
                          <span className="ml-auto text-[9px] font-bold">{session.steps}</span>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--line)] pt-3 text-[11px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--lime)]" /> Safe session
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--orange)]" /> Elevated
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--red)]" /> Critical
        </span>
        <span className="ml-auto metric-sm">Total {sessions.length} sessions</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- drift pulse */

export function DriftPulse({
  values,
  label = "Drift pulse · 14 days",
}: {
  values: number[];
  label?: string;
}) {
  return (
    <div>
      <div className="flex items-end gap-[3px]" aria-label={label} role="img">
        {values.map((value, index) => {
          const risk = 100 - value;
          const height = 10 + clamp01(risk / 90) * 34;
          return (
            <span
              key={index}
              className="flex-1 rounded-full"
              style={{
                height,
                background:
                  risk > 50 ? "var(--red)" : risk > 25 ? "var(--orange)" : "var(--lime)",
                opacity: 0.35 + (index / values.length) * 0.65,
                minWidth: 2,
              }}
              title={`${formatDate(new Date(Date.now() - (values.length - index) * 86_400_000).toISOString())} · alignment ${value}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span className="text-[10px] text-[var(--muted-dim)]">← older · now →</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- heat legend */

export function HeatLegend({ low = "low", high = "high" }: { low?: string; high?: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-[var(--muted-dim)]">
      <span>{low}</span>
      <span className="flex gap-1">
        {[0.15, 0.35, 0.55, 0.8, 1].map((opacity) => (
          <span
            key={opacity}
            className="h-2 w-2 rounded-full bg-[var(--lime)]"
            style={{ opacity }}
          />
        ))}
      </span>
      <span>{high}</span>
    </div>
  );
}

/* --------------------------------------------------------------- score chip */

export function ScoreOrb({ score, severity }: { score: number; severity: Severity }) {
  const color =
    severity === "critical"
      ? "var(--red)"
      : severity === "high"
        ? "var(--orange)"
        : severity === "medium"
          ? "var(--orange)"
          : "var(--lime)";
  return (
    <span
      className="metric-sm inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[14px] font-bold"
      style={{ borderColor: color, color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
      aria-label={`Risk score ${score}`}
    >
      {score}
    </span>
  );
}
