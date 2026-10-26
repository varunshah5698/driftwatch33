"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  UserPlus,
} from "lucide-react";
const DEMO_ACCOUNTS = [
  { email: "analyst@driftwatch.dev", label: "Security analyst", note: "triage · contain" },
  { email: "admin@driftwatch.dev", label: "Admin", note: "full control" },
  { email: "owner@driftwatch.dev", label: "Agent owner", note: "manifests" },
  { email: "auditor@driftwatch.dev", label: "Auditor", note: "read + export" },
];

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow mb-2 block">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-dim)]" aria-hidden>
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] pl-11 pr-4 text-[13px] text-[var(--text)] outline-none transition-colors focus:border-[var(--line-strong)]";

/* --------------------------------------------------------------- sign in */
export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("analyst@driftwatch.dev");
  const [password, setPassword] = useState("driftwatch-demo");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoPending, setDemoPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signInAs = async (nextEmail: string, nextPassword: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: nextEmail, password: nextPassword }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to sign in.");
        return;
      }
      router.push("/overview");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
      setDemoPending(null);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await signInAs(email, password);
  };

  /** One-click demo sign-in: no fields to fill, straight into the console. */
  const demoSignIn = async (account: (typeof DEMO_ACCOUNTS)[number]) => {
    if (loading) return;
    setDemoPending(account.email);
    setEmail(account.email);
    setPassword("driftwatch-demo");
    await signInAs(account.email, "driftwatch-demo");
  };

  return (
    <form onSubmit={submit} aria-describedby="signin-error">
      <div className="space-y-4">
        <Field id="email" label="Work email" icon={<Mail size={15} />}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            aria-label="Email address"
          />
        </Field>

        <Field id="password" label="Password" icon={<LockKeyhole size={15} />}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`${inputClass} pr-12`}
            aria-label="Password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-hi)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
          </button>
        </Field>
      </div>

      <p id="signin-error" role="alert" className="mt-3 min-h-[16px] text-[11.5px] text-[var(--red)]">
        {error}
      </p>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary mt-1 h-11 w-full justify-between !text-[13px]"
      >
        <span>{loading ? "Verifying…" : "Enter the operations console"}</span>
        {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ArrowRight size={15} aria-hidden />}
      </button>

      {/* ------------------------------------------------ one-click demo */}
      <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
        <p className="eyebrow mb-2">Demo sign-in · one click</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => demoSignIn(account)}
              disabled={loading}
              className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-left transition-colors hover:border-[var(--line-strong)] disabled:opacity-60"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium">{account.label}</span>
                {demoPending === account.email && loading ? (
                  <Loader2 size={12} className="animate-spin text-[var(--lime)]" aria-hidden />
                ) : (
                  <ArrowRight size={12} className="text-[var(--muted-dim)]" aria-hidden />
                )}
              </span>
              <span className="block text-[9.5px] text-[var(--muted-dim)]">{account.note}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted-dim)]">
          Signs you in immediately as that identity — no typing. Every demo account uses{" "}
          <code className="text-[var(--text-soft)]">driftwatch-demo</code>. Sessions are signed,
          HttpOnly and expire in 8 hours.
        </p>
      </div>

      <p className="mt-5 text-center text-[11.5px] text-[var(--muted)]">
        New here?{" "}
        <Link href="/signup" className="focus-ring font-semibold text-[var(--lime)] hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

/* --------------------------------------------------------------- sign up */
export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to create the account.");
        return;
      }
      router.push("/overview");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const strength = Math.min(4, Math.floor(password.length / 4));
  const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"][strength] ?? "Too short";

  return (
    <form onSubmit={submit} aria-describedby="signup-error">
      <div className="space-y-4">
        <Field id="name" label="Full name" icon={<UserPlus size={15} />}>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nadia Park"
            className={inputClass}
            aria-label="Full name"
          />
        </Field>

        <Field id="email" label="Work email" icon={<Mail size={15} />}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className={inputClass}
            aria-label="Email address"
          />
        </Field>

        <Field id="password" label="Password" icon={<LockKeyhole size={15} />}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            className={`${inputClass} pr-12`}
            aria-label="Password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-hi)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
          </button>
        </Field>
      </div>

      {password.length > 0 ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
            <span
              className="block h-full rounded-full transition-colors"
              style={{
                width: `${(strength / 4) * 100}%`,
                background: strength <= 1 ? "var(--red)" : strength === 2 ? "var(--orange)" : "var(--lime)",
              }}
            />
          </span>
          <span className="text-[10px] text-[var(--muted-dim)]">{strengthLabel}</span>
        </div>
      ) : null}

      <p id="signup-error" role="alert" className="mt-3 min-h-[16px] text-[11.5px] text-[var(--red)]">
        {error}
      </p>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary mt-1 h-11 w-full justify-between !text-[13px]"
      >
        <span>{loading ? "Creating account…" : "Create account"}</span>
        {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ArrowRight size={15} aria-hidden />}
      </button>

      <p className="mt-4 text-center text-[11.5px] text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="focus-ring font-semibold text-[var(--lime)] hover:underline">
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-[10px] leading-relaxed text-[var(--muted-dim)]">
        By continuing you agree to the synthetic-data notice: every seeded agent, event and alert in
        this demo is generated, and no real credentials are stored.
      </p>
    </form>
  );
}
