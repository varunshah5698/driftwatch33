import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/auth-forms";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  const user = await getSessionUser();
  if (user) redirect("/overview");

  return (
    <AuthShell
      eyebrow="Start in under a minute"
      title="Create account"
      subtitle="Spin up the demo console with a synthetic 60-agent fleet. No credit card, no real credentials."
      footer={
        <p className="text-center text-[11px] leading-relaxed text-[var(--muted-dim)]">
          New accounts start as Security Analysts with a seeded fleet. Sessions are signed, HttpOnly
          and expire in 8 hours.
        </p>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
