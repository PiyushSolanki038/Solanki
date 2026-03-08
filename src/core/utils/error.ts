/**
 * Shared error utilities
 *
 * Centralizes error-to-string conversion that was previously duplicated
 * across dozens of mutation `onError` handlers.
 */

/**
 * Safely extract a human-readable message from any thrown value.
 *
 * @example
 * ```ts
 * onError: (error: unknown) => {
 *   toast.error(getErrorMessage(error));
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
