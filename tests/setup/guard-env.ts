// tests/setup/guard-env.ts
/**
 * Production environment guard for automated testing suites.
 * Hard-coded default production project ref fails closed.
 */
export const HARDCODED_PROD_SUPABASE_REF = '1kooiwalyqqvumdwxnnv';

export function assertNotProduction(): void {
  const prodRef = process.env.PROD_SUPABASE_REF || HARDCODED_PROD_SUPABASE_REF;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  // Fail-closed: If NEXT_PUBLIC_SUPABASE_URL contains the production project ref, abort immediately!
  if (prodRef && supabaseUrl.toLowerCase().includes(prodRef.toLowerCase())) {
    if (process.env.ALLOW_PROD_TEST !== 'true') {
      throw new Error(
        `[SECURITY GUARD] ABORTING: Test environment detected production Supabase project ref '${prodRef}' in NEXT_PUBLIC_SUPABASE_URL ('${supabaseUrl}')! Automated tests must NEVER target production data.`
      );
    }
  }
}
