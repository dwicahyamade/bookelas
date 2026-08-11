"use client";

import { useRef } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileUploadProps {
  value?: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  disabled?: boolean;
  previewUrl?: string | null;
  id?: string;
}

export function FileUpload({ value, onChange, error, disabled, previewUrl, id = "payment_proof" }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        name={id}
        type="file"
        accept="image/*,application/pdf"
        disabled={disabled}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "group flex w-full flex-col items-center gap-3 rounded-xl border border-dashed bg-mist/50 px-5 py-8 text-center transition",
            "hover:border-cypress hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cypress focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
            error ? "border-ochre" : "border-ink/25",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <UploadCloud className="size-6 text-cypress transition group-hover:scale-110" aria-hidden="true" />
          <span className="text-sm">
            <span className="font-semibold underline decoration-cypress/40 underline-offset-4">Pilih atau jatuhkan file</span>
            <br />
            <span className="text-xs text-ink/55">JPG, PNG, atau PDF · maks 5 MB</span>
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-ink/15 bg-white/40 p-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-cypress/10 text-cypress">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="size-full rounded-lg object-cover" />
            ) : (
              <FileText className="size-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            <p className="text-xs text-ink/50">{(value.size / 1024).toFixed(0)} KB · {value.type || "file"}</p>
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ""; }}
            disabled={disabled}
            className="rounded-md p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cypress disabled:opacity-40"
            aria-label="Hapus file"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {error && <p id={`${id}-error`} className="mt-2 text-xs text-ochre">{error}</p>}
    </div>
  );
}
