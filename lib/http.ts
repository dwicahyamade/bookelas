import { ApiError, isApiError } from "./errors.ts";

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function handleApiError(e: unknown): Response {
  if (isApiError(e)) {
    return Response.json(
      { message: e.message, code: e.code },
      { status: e.status }
    );
  }

  return Response.json(
    { message: "Terjadi kesalahan server", code: "INTERNAL" },
    { status: 500 }
  );
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${baseUrl()}${path}`;
  const res = await fetch(url, { ...init, headers: { ...init.headers } });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const record = body && typeof body === "object"
      ? body as Record<string, unknown>
      : {};
    throw new ApiError(
      res.status,
      typeof record.message === "string" ? record.message : "Permintaan gagal",
      typeof record.code === "string" ? record.code : "API_ERROR"
    );
  }

  return body as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function apiSend<T>(path: string, init: RequestInit): Promise<T> {
  return request<T>(path, init);
}
