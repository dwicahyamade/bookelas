import type { ReactNode } from "react";

export function Field({ id, label, error, hint, required, children }: { id: string; label: string; error?: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">{label} {required && <span className="text-ochre">*</span>}</label>
      {children}
      {hint && !error && <p className="text-xs text-ink/50">{hint}</p>}
      {error && <p className="text-xs text-ochre" role="alert">{error}</p>}
    </div>
  );
}
