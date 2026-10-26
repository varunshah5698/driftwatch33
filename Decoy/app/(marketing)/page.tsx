import Link from "next/link";
import { HeroScene } from "@/components/hero-scene";

export const metadata = {
  title: "Driftwatch — Identity drift detection for autonomous AI agents",
  description:
    "A valid token proves who an agent is, not what it has become. Driftwatch learns each agent's normal behavior, compares it with the role it was created for, and contains drift without stopping legitimate work.",
  robots: { index: true, follow: true },
};

const TRACE = [
  {
    time: "15:07:02.114",
    event: "document.ingest",
    target: "supplier-acme-pricing.pdf",
    verdict: "TAINTED",
    tone: "#f2a35a",
    detail:
      "Hidden prompt block inside an invoice attachment marks the session context untrusted. Taint depth 0.",
  },
  {
    time: "15:07:14.890",
    event: "tool.call",
    target: "directory.lookup → hr-prod-db",
    verdict: "DRIFT +17",
    tone: "#f2a35a",
    detail:
      "Transition probability from invoice.parse to directory.lookup is 0.002 under the procurement Markov baseline.",
  },
  {
    time: "15:07:21.402",
    event: "data.read",
    target: "hr.salary, hr.performance · 1,420 rows",
    verdict: "VIOLATION +52",
    tone: "#ff6a58",
    detail:
      "Both classes are absent from procurement-v4.yaml. Causal taint links the read directly to the supplier PDF.",
  },
  {
    time: "15:07:39.918",
    event: "net.egress",
    target: "POST 45.83.211.19:443 · 3.3 MiB",
    verdict: "RESTRICTED",
    tone: "#c9f76f",
    detail:
      "Score reaches 100/100. The gateway blocks unapproved egress and HR classes. supplier.search keeps running.",
  },
];

const SIGNALS = [
  {
    name: "Exfiltration signal",
    weight: 31,
    formula: "bytes × destination novelty × sensitivity",
    reading: "3.3 MiB to 45.83.211.19 (unseen ASN)",
  },
  {
    name: "Indirect injection taint",
    weight: 27,
    formula: "source trust × hop decay × action privilege",
    reading: "supplier-acme-pricing.pdf → 6 hops → 5 actions",
  },
  {
    name: "Role scope violation",
    weight: 25,
    formula: "manifest diff on tool, class, and hour",
    reading: "hr.salary, hr.performance outside procurement-v4",
  },
  {
    name: "Distributional drift",
    weight: 10,
    formula: "Jensen–Shannon divergence vs. 7d window",
    reading: "JSD 0.254 across tool-call histogram",
  },
  {
    name: "Sequence anomaly",
    weight: 5,
    formula: "neg-log-likelihood of Markov transition",
    reading: "p(hr.read | pdf.extract) = 0.0004",
  },
  {
    name: "Delegation depth",
    weight: 2,
    formula: "call-chain depth above declared ceiling",
    reading: "depth 2 via helper-summarizer (max 1)",
  },
];

const LADDER = [
  { level: "L0", name: "Monitor", desc: "Log telemetry and score windows silently." },
  { level: "L1", name: "Notify", desc: "Emit a signed evidence bundle to the SOC queue." },
  { level: "L2", name: "Step-up", desc: "Require human approval for high-sensitivity tools." },
  {
    level: "L3",
    name: "Restrict",
    desc: "Block the offending data class or egress. Role work keeps flowing.",
    active: true,
  },
  { level: "L4", name: "Quarantine", desc: "Hold outbound side effects in a review buffer." },
  { level: "L5", name: "Isolate", desc: "Suspend the token and sever downstream delegation." },
];

function Logo() {
  return (
    <span className="flex items-center gap-3">
      <svg width="30" height="30" viewBox="0 0 40 40" role="img" aria-label="Driftwatch">
        <rect width="40" height="40" rx="12" fill="var(--white)" />
        <circle cx="20" cy="20" r="10.5" fill="none" stroke="var(--bg)" strokeWidth="2" />
        <circle cx="20" cy="20" r="5" fill="none" stroke="var(--bg)" strokeWidth="2" />
        <path d="M27 13 L34 6" stroke="var(--bg)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="20" cy="20" r="2" fill="var(--orange)" />
      </svg>
      <span className="display-tight text-[15px] tracking-[0.14em]">Driftwatch</span>
    </span>
  );
}

/** Faint concentric orbit rings echoing the 3D globe. */
function OrbitBackdrop({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute ${className}`} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-radial-gradient(circle at center, rgba(201,247,111,0.07) 0 1px, transparent 1px 78px)",
          maskImage: "radial-gradient(circle at center, black 0%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 0%, transparent 72%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(201,247,111,0.12), rgba(242,163,90,0.05) 42%, transparent 70%)",
        }}
      />
    </div>
  );
}

function Eyebrow({ children, tone = "lime" }: { children: React.ReactNode; tone?: "lime" | "orange" | "dim" }) {
  const color = tone === "lime" ? "#c9f76f" : tone === "orange" ? "#f2a35a" : "#8b8b80";
  return (
    <p className="flex items-center gap-3 font-mono text-[11.5px] tracking-[0.22em]" style={{ color }}>
      <span className="h-px w-8" style={{ background: color, opacity: 0.7 }} />
      {children}
    </p>
  );
}

function GlowPanel({
  children,
  className = "",
  accent = "rgba(201,247,111,0.16)",
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        background: "linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: `0 30px 80px -40px ${accent}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-[#060606] text-[#f4f4ee]">
      {/* Global atmosphere */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(1200px 640px at 82% -8%, rgba(201,247,111,0.10), transparent 62%), radial-gradient(900px 520px at -10% 38%, rgba(242,163,90,0.07), transparent 60%), radial-gradient(1000px 700px at 50% 118%, rgba(201,247,111,0.06), transparent 62%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.5]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.055) 0.6px, transparent 0.6px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(1200px 800px at 50% 20%, black, transparent 85%)",
          WebkitMaskImage: "radial-gradient(1200px 800px at 50% 20%, black, transparent 85%)",
        }}
      />

      <div className="relative z-10">
        {/* ----------------------------------------------------------- nav */}
        <header className="sticky top-0 z-40">
          <div
            className="border-b border-white/10"
            style={{
              background:
                "linear-gradient(to bottom, rgba(6,6,6,0.92), rgba(6,6,6,0.72))",
              backdropFilter: "blur(18px)",
            }}
          >
            <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between px-6">
              <Link href="/" className="focus-ring" aria-label="Driftwatch home">
                <Logo />
              </Link>

              <nav
                className="hidden items-center gap-9 text-[12.5px] tracking-[0.06em] text-[#9d9d93] lg:flex"
                aria-label="Primary"
              >
                <a href="#contract" className="transition-colors hover:text-[#c9f76f]">
                  Role contract
                </a>
                <a href="#trace" className="transition-colors hover:text-[#c9f76f]">
                  Incident trace
                </a>
                <a href="#engine" className="transition-colors hover:text-[#c9f76f]">
                  Scoring model
                </a>
                <a href="#containment" className="transition-colors hover:text-[#c9f76f]">
                  Containment
                </a>
              </nav>

              <div className="flex items-center gap-6">
                <Link
                  href="/login"
                  className="text-[12.5px] font-medium text-[#c4c4ba] transition-colors hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="focus-ring group relative inline-flex h-11 items-center overflow-hidden px-6 text-[12.5px] font-semibold text-[#10170a]"
                  style={{
                    background: "linear-gradient(135deg, #d8ff88, #c9f76f 55%, #a8e04f)",
                    boxShadow: "0 12px 34px -12px rgba(201,247,111,0.55)",
                  }}
                >
                  Open console
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* ---------------------------------------------------------- hero */}
        <section className="relative overflow-hidden">
          <OrbitBackdrop className="left-[-420px] top-[-120px] h-[900px] w-[900px] opacity-70" />

          <div className="relative mx-auto grid max-w-[1320px] items-center gap-10 px-6 pb-16 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] lg:gap-4 lg:pb-24 lg:pt-16">
            <div className="relative z-10 max-w-[560px]">
              <Eyebrow>RUNTIME IDENTITY CONTINUITY</Eyebrow>

              <h1
                className="display mt-7 text-[clamp(56px,7.6vw,108px)] leading-[0.87]"
                style={{ textShadow: "0 24px 80px rgba(0,0,0,0.65)" }}
              >
                Agents drift.
                <br />
                <span
                  style={{
                    background: "linear-gradient(120deg, #e9ffb0 0%, #c9f76f 42%, #8fd63d 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    filter: "drop-shadow(0 10px 46px rgba(201,247,111,0.35))",
                  }}
                >
                  Credentials
                </span>{" "}
                don&apos;t.
              </h1>

              <p className="mt-7 max-w-[52ch] text-[15.5px] leading-[1.72] text-[#b0b0a6]">
                An OAuth token proves who an agent was when it started — not what an untrusted
                document turns it into. Driftwatch learns each agent&apos;s behavioral baseline,
                scores every action against the role it was built for, and contains hijacked intent
                in seconds.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/login"
                  className="focus-ring inline-flex h-[52px] items-center px-7 text-[14px] font-semibold text-[#10170a] transition-transform hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(135deg, #d8ff88, #c9f76f 55%, #a8e04f)",
                    boxShadow: "0 22px 55px -18px rgba(201,247,111,0.6)",
                  }}
                >
                  Enter the operations console
                </Link>
                <a
                  href="#trace"
                  className="focus-ring inline-flex h-[52px] items-center border border-white/15 px-7 text-[14px] font-medium text-[#e6e6de] transition-colors hover:border-[rgba(201,247,111,0.5)] hover:text-[#c9f76f]"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  Read the 38-second trace
                </a>
              </div>

              <div className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-7">
                {[
                  { k: "FLEET WATCH", v: "60", u: "agents" },
                  { k: "MEDIAN DETECT", v: "38", u: "seconds" },
                  { k: "FALSE POSITIVE", v: "3.7", u: "percent" },
                ].map((stat) => (
                  <div key={stat.k}>
                    <p className="font-mono text-[10.5px] tracking-[0.18em] text-[#7d7d72]">
                      {stat.k}
                    </p>
                    <p className="mt-2 flex items-baseline gap-1.5">
                      <span
                        className="font-mono text-[30px] font-semibold leading-none"
                        style={{ textShadow: "0 0 30px rgba(201,247,111,0.25)" }}
                      >
                        {stat.v}
                      </span>
                      <span className="text-[11px] text-[#7d7d72]">{stat.u}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 3D globe — untouched centerpiece, bleeding to the edge */}
            <div className="relative mx-auto aspect-square w-full max-w-[720px] lg:-mr-16 lg:mx-0 lg:justify-self-end">
              <HeroScene className="absolute -inset-8 h-[calc(100%+4rem)] w-[calc(100%+4rem)]" />
            </div>
          </div>

          {/* glowing divider */}
          <div
            className="h-px w-full"
            aria-hidden
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(201,247,111,0.45) 30%, rgba(242,163,90,0.35) 62%, transparent)",
            }}
          />
        </section>

        {/* -------------------------------------------- 01 · the contract */}
        <section id="contract" className="relative scroll-mt-20 overflow-hidden">
          <OrbitBackdrop className="right-[-380px] top-[80px] h-[760px] w-[760px] opacity-50" />

          <div className="relative mx-auto max-w-[1320px] px-6 py-20 lg:py-28">
            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
              <div className="max-w-[480px]">
                <Eyebrow tone="dim">01 / THE CONTRACT</Eyebrow>
                <h2 className="mt-6 text-[clamp(34px,3.8vw,50px)] font-semibold leading-[1.08] tracking-[-0.025em]">
                  Permissions check identity.{" "}
                  <span className="text-[#8b8b80]">We verify behavior against</span>{" "}
                  <span
                    style={{
                      background: "linear-gradient(120deg, #e9ffb0, #c9f76f 50%, #93d845)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    a versioned role manifest.
                  </span>
                </h2>
                <p className="mt-6 text-[15px] leading-[1.75] text-[#a2a299]">
                  Every agent is bound to a declarative YAML manifest that specifies the exact tools,
                  data classifications, egress networks, active hours, and delegation depth its role
                  requires. When an indirect prompt injection turns a procurement agent into a
                  payroll scraper, IAM still sees a valid service token — Driftwatch sees a contract
                  breach the moment it happens.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <GlowPanel accent="rgba(201,247,111,0.22)">
                  <div className="flex items-center justify-between border-b border-white/10 px-6 py-3.5">
                    <span className="font-mono text-[11px] tracking-[0.18em] text-[#c9f76f]">
                      DECLARED
                    </span>
                    <span className="font-mono text-[10.5px] text-[#7d7d72]">
                      procurement-v4.yaml
                    </span>
                  </div>
                  <pre className="overflow-x-auto px-6 py-6 font-mono text-[12px] leading-[1.85] text-[#c8c8bd]">
{`role: procurement-standard
version: 2026.09.3

allowed_tools:
  - supplier.search
  - invoice.parse
  - po.draft

data_classes:
  - procurement.quotes
  - finance.invoices

denied_classes:
  - hr.salary
  - hr.performance

egress_allowlist:
  - api.suppliers.internal

max_delegation_depth: 1`}
                  </pre>
                </GlowPanel>

                <GlowPanel accent="rgba(255,106,88,0.25)">
                  <div className="flex items-center justify-between border-b border-white/10 px-6 py-3.5">
                    <span className="font-mono text-[11px] tracking-[0.18em] text-[#ff6a58]">
                      OBSERVED · 60s
                    </span>
                    <span className="font-mono text-[10.5px] font-semibold text-[#ff6a58]">
                      SCORE 100 / CRITICAL
                    </span>
                  </div>
                  <pre className="overflow-x-auto px-6 py-6 font-mono text-[12px] leading-[1.85] text-[#c8c8bd]">
{`agent: Procurement Atlas (agt-01)
token: valid · oauth2 · scope:read

taint_source:
  file: supplier-acme-pricing.pdf
  trust: untrusted-external

violations:
  - read: hr.salary (810 records)
  - read: hr.performance (610 rows)
  - egress: 45.83.211.19 (3.3 MiB)
  - delegation_depth: 2 (max 1)

gateway_verdict: RESTRICT`}
                  </pre>
                </GlowPanel>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------- 02 · incident trace */}
        <section id="trace" className="relative scroll-mt-20 border-y border-white/10">
          <div
            className="absolute inset-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(900px 420px at 50% 0%, rgba(242,163,90,0.07), transparent 70%)",
            }}
          />

          <div className="relative mx-auto max-w-[1320px] px-6 py-20 lg:py-28">
            <div className="max-w-[760px]">
              <Eyebrow tone="orange">02 / CAUSAL TAINT TRACE</Eyebrow>
              <h2 className="mt-6 text-[clamp(34px,4.4vw,58px)] font-semibold leading-[1.02] tracking-[-0.025em]">
                Anatomy of a 38-second
                <br />
                prompt injection.
              </h2>
              <p className="mt-5 max-w-[58ch] text-[15px] leading-[1.72] text-[#a2a299]">
                Driftwatch follows untrusted bytes from the moment they enter an agent&apos;s context
                window to every downstream tool call and network socket they influence.
              </p>
            </div>

            <div className="mt-14">
              {TRACE.map((row, index) => (
                <div key={row.time} className="relative grid gap-5 pb-12 pl-10 last:pb-0 lg:grid-cols-12 lg:gap-8 lg:pl-14">
                  {/* glowing timeline rail */}
                  <div
                    className="absolute left-[11px] top-2 h-full w-px lg:left-[15px]"
                    aria-hidden
                    style={{
                      background:
                        index < TRACE.length - 1
                          ? "linear-gradient(to bottom, rgba(201,247,111,0.5), rgba(255,255,255,0.08))"
                          : "transparent",
                    }}
                  />
                  <div
                    className="absolute left-[6px] top-[6px] h-[11px] w-[11px] rounded-full lg:left-[10px]"
                    aria-hidden
                    style={{
                      background: row.tone,
                      boxShadow: `0 0 18px ${row.tone}, 0 0 44px ${row.tone}66`,
                    }}
                  />

                  <div className="lg:col-span-3">
                    <p className="font-mono text-[12.5px] text-[#8b8b80]">{row.time}</p>
                    <p className="mt-1 font-mono text-[15px] font-semibold text-white">
                      {row.event}
                    </p>
                  </div>

                  <div className="lg:col-span-5">
                    <p className="font-mono text-[13px] text-[#e2e2d8]">{row.target}</p>
                    <p className="mt-2 max-w-[52ch] text-[13.5px] leading-[1.7] text-[#98988e]">
                      {row.detail}
                    </p>
                  </div>

                  <div className="lg:col-span-4 lg:text-right">
                    <span
                      className="inline-flex items-center px-3.5 py-1.5 font-mono text-[11.5px] font-semibold tracking-[0.12em]"
                      style={{
                        color: row.tone,
                        border: `1px solid ${row.tone}55`,
                        background: `${row.tone}14`,
                        boxShadow: `0 10px 34px -14px ${row.tone}66`,
                      }}
                    >
                      {row.verdict}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------ 03 · scoring engine */}
        <section id="engine" className="relative scroll-mt-20">
          <div className="mx-auto max-w-[1320px] px-6 py-20 lg:py-28">
            <div className="grid items-end gap-10 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <Eyebrow>03 / EXPLAINABLE SCORING</Eyebrow>
                <h2 className="mt-6 text-[clamp(34px,4.4vw,58px)] font-semibold leading-[1.02] tracking-[-0.025em]">
                  Six orthogonal signals.
                  <br />
                  <span className="text-[#8b8b80]">Zero black-box alerts.</span>
                </h2>
              </div>
              <p className="text-[15px] leading-[1.72] text-[#a2a299] lg:col-span-5">
                Every event window is scored by a weighted logistic model. Contributions are
                normalized so they always sum to the exact risk score the analyst sees — nothing is
                hidden behind a confidence label.
              </p>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {SIGNALS.map((sig) => (
                <GlowPanel key={sig.name} className="p-7">
                  <div className="flex items-start justify-between gap-5">
                    <h3 className="max-w-[16ch] text-[19px] font-semibold leading-tight tracking-[-0.01em]">
                      {sig.name}
                    </h3>
                    <span
                      className="font-mono text-[30px] font-semibold leading-none"
                      style={{
                        color: "#c9f76f",
                        textShadow: "0 0 32px rgba(201,247,111,0.45)",
                      }}
                    >
                      +{sig.weight}
                    </span>
                  </div>

                  <div className="mt-6">
                    <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(sig.weight / 31) * 100}%`,
                          background: "linear-gradient(90deg, #a8e04f, #c9f76f)",
                          boxShadow: "0 0 14px rgba(201,247,111,0.5)",
                        }}
                      />
                    </div>
                  </div>

                  <p className="mt-5 font-mono text-[11px] leading-relaxed text-[#7d7d72]">
                    {sig.formula}
                  </p>
                  <p className="mt-4 border-t border-white/10 pt-4 font-mono text-[11.5px] leading-relaxed text-[#c4c4ba]">
                    {sig.reading}
                  </p>
                </GlowPanel>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------- 04 · containment */}
        <section id="containment" className="relative scroll-mt-20 overflow-hidden border-t border-white/10">
          <OrbitBackdrop className="left-[-320px] bottom-[-300px] h-[720px] w-[720px] opacity-40" />

          <div className="relative mx-auto grid max-w-[1320px] gap-12 px-6 py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-28">
            <div className="max-w-[500px]">
              <Eyebrow tone="dim">04 / GRADUATED CONTAINMENT</Eyebrow>
              <h2 className="mt-6 text-[clamp(34px,3.8vw,50px)] font-semibold leading-[1.08] tracking-[-0.025em]">
                Block the hijacked action.{" "}
                <span
                  style={{
                    background: "linear-gradient(120deg, #e9ffb0, #c9f76f 50%, #93d845)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Keep the agent working.
                </span>
              </h2>
              <p className="mt-6 text-[15px] leading-[1.75] text-[#a2a299]">
                Revoking credentials halts legitimate business workflows. Because Driftwatch sits
                inline at the tool and egress gateway, it can deny the exact hijacked action — an HR
                table read, an unapproved destination — while declared procurement work continues
                uninterrupted.
              </p>

              <Link
                href="/login"
                className="focus-ring mt-9 inline-flex h-[50px] items-center border border-white/15 px-7 text-[13.5px] font-medium text-white transition-colors hover:border-[#c9f76f] hover:text-[#c9f76f]"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                Test policies in the simulation lab
              </Link>
            </div>

            <div className="relative">
              <div
                className="absolute left-[7px] top-4 h-[calc(100%-32px)] w-px"
                aria-hidden
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(201,247,111,0.55), rgba(255,255,255,0.08))",
                }}
              />
              {LADDER.map((rung) => (
                <div key={rung.level} className="relative pb-7 pl-9 last:pb-0">
                  <div
                    className="absolute left-[2px] top-[7px] h-[11px] w-[11px] rounded-full"
                    aria-hidden
                    style={{
                      background: rung.active ? "#c9f76f" : "rgba(255,255,255,0.22)",
                      boxShadow: rung.active ? "0 0 20px #c9f76f, 0 0 50px rgba(201,247,111,0.5)" : "none",
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-[12px] text-[#7d7d72]">{rung.level}</span>
                    <h3 className="text-[19px] font-semibold tracking-[-0.01em]">{rung.name}</h3>
                    {rung.active ? (
                      <span
                        className="px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.12em] text-[#10170a]"
                        style={{ background: "linear-gradient(135deg, #d8ff88, #a8e04f)" }}
                      >
                        DEFAULT ON CRITICAL
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 max-w-[56ch] text-[14px] leading-[1.7] text-[#98988e]">
                    {rung.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- footer */}
        <footer className="relative overflow-hidden">
          <div
            className="h-px w-full"
            aria-hidden
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(201,247,111,0.45) 35%, rgba(242,163,90,0.35) 65%, transparent)",
            }}
          />

          <div className="relative mx-auto max-w-[1320px] px-6 pb-14 pt-24 lg:pt-32">
            <div className="relative mx-auto max-w-[1040px] text-center">
              <OrbitBackdrop className="left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 opacity-80" />

              <div className="relative">
                <span className="flex justify-center">
                  <Eyebrow>SYNTHETIC 60-AGENT FLEET ONLINE</Eyebrow>
                </span>
                <h2
                  className="display mt-8 text-[clamp(40px,5.4vw,76px)] leading-[0.92]"
                >
                  Stop trusting the token.
                  <br />
                  <span
                    style={{
                      background: "linear-gradient(120deg, #e9ffb0, #c9f76f 45%, #8fd63d)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                      filter: "drop-shadow(0 14px 52px rgba(201,247,111,0.35))",
                    }}
                  >
                    Watch the behavior.
                  </span>
                </h2>

                <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                  <Link
                    href="/login"
                    className="focus-ring inline-flex h-[54px] items-center px-8 text-[14.5px] font-semibold text-[#10170a] transition-transform hover:-translate-y-0.5"
                    style={{
                      background: "linear-gradient(135deg, #d8ff88, #c9f76f 55%, #a8e04f)",
                      boxShadow: "0 26px 70px -18px rgba(201,247,111,0.65)",
                    }}
                  >
                    Sign in to the demo console
                  </Link>
                  <Link
                    href="/signup"
                    className="focus-ring inline-flex h-[54px] items-center border border-white/15 px-8 text-[14px] font-medium text-white transition-colors hover:border-white/40"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    Create account
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-white/10 pt-8 sm:flex-row">
              <Logo />
              <div className="flex flex-wrap items-center justify-center gap-7 text-[11.5px] text-[#7d7d72]">
                {["Control Room", "Agent Directory", "Simulation Lab", "Audit Hash Chain"].map(
                  (item) => (
                    <Link key={item} href="/login" className="transition-colors hover:text-white">
                      {item}
                    </Link>
                  ),
                )}
              </div>
              <span className="font-mono text-[11px] text-[#5f5f57]">
                © {new Date().getFullYear()} Driftwatch
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
