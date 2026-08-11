export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "API_ERROR") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function apiMessage(e: unknown, fallback: string): string {
  return isApiError(e) ? e.message : fallback;
}
