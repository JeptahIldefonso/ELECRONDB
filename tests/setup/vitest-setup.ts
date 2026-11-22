// tests/setup/vitest-setup.ts
import { assertNotProduction } from './guard-env';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

// Verify test environment guard
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  assertNotProduction();
}
