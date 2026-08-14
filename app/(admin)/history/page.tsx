"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    CalendarDays,
    ExternalLink,
    FileText,
    Loader2,
    Search,
} from "lucide-react";
import {
    listRecentBookings,
    searchCustomerBookings,
    type ApprovalRow,
} from "@/lib/api/admin";
import { listAllBranches } from "@/lib/api/branches";
import { useAdminUser } from "@/components/admin/admin-shell";
import { apiMessage } from "@/lib/errors";
import { STUDIO_TZ } from "@/lib/calendar";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: STUDIO_TZ,
});
const timeFmt = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: STUDIO_TZ,
});

export default function HistoryPage() {
    const user = useAdminUser();
    const isSuperadmin = user.role === "superadmin";
    const [input, setInput] = useState("");
    const [search, setSearch] = useState("");
    const [branchId, setBranchId] = useState<string>("");
    const { data: branches = [] } = useQuery({
        queryKey: ["branches"],
        queryFn: () => listAllBranches(false),
        enabled: isSuperadmin,
    });
    const query = useQuery({
        queryKey: ["customer-history", search, branchId],
        queryFn: () =>
            search
                ? searchCustomerBookings(search, branchId || null)
                : listRecentBookings(20, branchId || null),
    });
    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSearch(input.trim());
    }

    return (
        <div className="mx-auto max-w-6xl space-y-8">
            <header>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cypress">
                    Customer records
                </p>
                <h1 className="mt-2 font-display text-4xl tracking-tight lg:text-5xl">
                    Booking history
                </h1>
                <p className="mt-2 text-sm text-ink/55">
                    Cari seluruh booking berdasarkan WhatsApp atau email.
                </p>
            </header>
            <div
                className={`flex w-full gap-2 ${isSuperadmin ? "flex-col sm:flex-row sm:items-center sm:justify-between" : ""}`}
            >
                <form
                    onSubmit={submit}
                    className="flex w-full gap-2 sm:max-w-xl"
                >
                    <label htmlFor="customer-search" className="sr-only">
                        WhatsApp atau email
                    </label>
                    <input
                        id="customer-search"
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="08xx atau nama@email.com"
                        className="ui-input min-w-0 flex-1"
                    />
                    <button
                        type="submit"
                        disabled={input.trim().length < 3}
                        className="inline-flex items-center gap-2 rounded-full bg-cypress px-5 py-2.5 text-sm font-bold text-paper disabled:opacity-50"
                    >
                        <Search className="size-4" />
                        Cari
                    </button>
                </form>
                {isSuperadmin && (
                    <label
                        htmlFor="branch-filter"
                        className="flex items-center gap-2 self-end text-sm text-ink/60"
                    >
                        <span className="whitespace-nowrap">Cabang</span>
                        <select
                            id="branch-filter"
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            className="ui-input min-w-[10rem]"
                        >
                            <option value="">Semua cabang</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>
            {query.isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2
                        className="size-6 animate-spin text-cypress"
                        aria-label="Memuat riwayat"
                    />
                </div>
            ) : query.isError ? (
                <div
                    role="alert"
                    className="rounded-2xl bg-ochre/10 p-6 text-sm text-ochre"
                >
                    {apiMessage(query.error, "Gagal memuat riwayat")}
                </div>
            ) : query.data?.length ? (
                <div className="space-y-3">
                    <p className="text-sm text-ink/55">
                        {search
                            ? `${query.data.length} booking ditemukan untuk `
                            : "20 booking terbaru"}
                        {search && (
                            <strong className="text-ink">{search}</strong>
                        )}
                        .
                    </p>
                    {query.data.map((row) => (
                        <HistoryRow key={row.id} row={row} />
                    ))}
                </div>
            ) : (
                <Empty
                    text={
                        search
                            ? "Tidak ada booking untuk pencarian ini."
                            : "Belum ada booking."
                    }
                />
            )}
        </div>
    );
}

function HistoryRow({ row }: { row: ApprovalRow }) {
    return (
        <article className="rounded-2xl border border-ink/10 bg-white/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="font-display text-2xl">
                        {row.customer_name}
                    </h2>
                    <p className="mt-1 text-sm text-ink/55">
                        {row.customer_wa} · {row.customer_email}
                    </p>
                </div>
                <Status value={row.status} />
            </div>
            <div className="mt-4 grid gap-3 border-t border-ink/10 pt-4 text-sm sm:grid-cols-3">
                <div>
                    <p className="text-xs text-ink/45">Sesi</p>
                    <p className="mt-1 inline-flex items-center gap-1 font-semibold">
                        <CalendarDays className="size-4 text-cypress" />
                        {row.session.class.title}
                    </p>
                    <p className="mt-1 text-ink/55">
                        {dateFmt.format(new Date(row.session.start_time))} ·{" "}
                        {timeFmt.format(new Date(row.session.start_time))} WITA
                        · {row.session.branch.name}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-ink/45">Tanggal booking</p>
                    <p className="mt-1 font-semibold">
                        {dateFmt.format(new Date(row.created_at))}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-ink/45">Bukti pembayaran</p>
                    <a
                        href={row.payment_proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 font-semibold text-cypress hover:underline"
                    >
                        <FileText className="size-4" />
                        Buka bukti <ExternalLink className="size-3" />
                    </a>
                </div>
            </div>
        </article>
    );
}
function Status({ value }: { value: string }) {
    return (
        <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${value === "APPROVED" ? "bg-cypress/10 text-cypress" : value === "REJECTED" || value === "CANCELLED" ? "bg-ochre/10 text-ochre" : "bg-ink/10 text-ink/60"}`}
        >
            {value}
        </span>
    );
}
function Empty({ text }: { text: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-ink/20 p-16 text-center text-sm text-ink/55">
            {text}
        </div>
    );
}
