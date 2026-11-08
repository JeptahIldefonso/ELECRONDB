/**
 * Utility to check if the current runtime environment is in read-only mode.
 * On Vercel, the application operates in read-only mode to preserve canonical ERP records.
 */
export function isReadOnly(): boolean {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    return false;
  }
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_IS_READONLY === 'true';
  }
  return Boolean(process.env.VERCEL);
}
