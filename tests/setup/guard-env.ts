// tests/setup/guard-env.ts
/**
 * Production environment guard for automated testing suites.
 * Throws an exception if test suite attempts to target production Supabase database.
 */
export function assertNotProduction(): void {
  const prodRef = process.env.PROD_SUPABASE_REF || '1kooiwalyqqvumdwxnnv';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  if (prodRef && supabaseUrl.includes(prodRef) && process.env.ALLOW_PROD_TEST !== 'true') {
    throw new Error(
      `[SECURITY GUARD] Automated tests must NEVER run against production Supabase project ref '${prodRef}'! Configure a local or staging test environment.`
    );
  }
}
