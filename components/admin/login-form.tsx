"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { login } from "@/lib/api/auth";
import { apiMessage } from "@/lib/errors";
import { Field } from "@/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(apiMessage(err, "Gagal masuk"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="password" label="Kata sandi" error={error ?? undefined}>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="ui-input" autoFocus />
      </Field>
      <button type="submit" disabled={busy || !password} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper hover:bg-cypress/90 disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}Masuk
      </button>
    </form>
  );
}
