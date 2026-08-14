"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { login } from "@/lib/api/auth";
import { apiMessage } from "@/lib/errors";
import { Field } from "@/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(apiMessage(err, "Gagal masuk"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="username" label="Username" error={error ?? undefined} required>
        <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="ui-input" autoComplete="username" autoFocus />
      </Field>
      <Field id="password" label="Kata sandi" required>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="ui-input" autoComplete="current-password" />
      </Field>
      <button type="submit" disabled={busy || !username || !password} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cypress px-5 py-3 text-sm font-semibold text-paper hover:bg-cypress/90 disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}Masuk
      </button>
    </form>
  );
}
