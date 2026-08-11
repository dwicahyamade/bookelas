export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "API_ERROR"
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function apiMessage(e: unknown, fallback: string): string {
  return isApiError(e) ? e.message : fallback;
}
