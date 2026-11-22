// tests/setup/vitest-setup.ts
import { assertNotProduction } from './guard-env';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

// Fail-closed security check before any test execution
assertNotProduction();
