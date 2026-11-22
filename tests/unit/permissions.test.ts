import { describe, it, expect } from 'vitest';
import {
  normalizeRole,
  canAccess,
  getAccessibleModules,
  MODULE_RIGHTS_MAP,
} from '@/lib/permissions';

describe('Role Normalization (normalizeRole)', () => {
  it('normalizes superadmin case variations', () => {
    expect(normalizeRole('superadmin')).toBe('superadmin');
    expect(normalizeRole('Superadmin')).toBe('superadmin');
    expect(normalizeRole('SUPERADMIN')).toBe('superadmin');
    expect(normalizeRole('  superadmin  ')).toBe('superadmin');
  });

  it('normalizes admin case variations', () => {
    expect(normalizeRole('admin')).toBe('admin');
    expect(normalizeRole('Admin')).toBe('admin');
    expect(normalizeRole('ADMIN')).toBe('admin');
  });

  it('defaults invalid or empty roles to user', () => {
    expect(normalizeRole('')).toBe('user');
    expect(normalizeRole(null)).toBe('user');
    expect(normalizeRole(undefined)).toBe('user');
    expect(normalizeRole('guest')).toBe('user');
    expect(normalizeRole('manager')).toBe('user');
  });
});

describe('Module Access Control (canAccess)', () => {
  it('grants Superadmin full access to all modules regardless of userRights', () => {
    expect(canAccess('Superadmin', 'sales', [])).toBe(true);
    expect(canAccess('Superadmin', 'customer', [])).toBe(true);
    expect(canAccess('Superadmin', 'products', [])).toBe(true);
    expect(canAccess('Superadmin', 'human-resources', [])).toBe(true);
    expect(canAccess('Superadmin', 'reports', [])).toBe(true);
    expect(canAccess('Superadmin', 'user-management', [])).toBe(true);
  });

  it('allows Admin to access operational modules and user management', () => {
    expect(canAccess('Admin', 'sales', [])).toBe(true);
    expect(canAccess('Admin', 'customer', [])).toBe(true);
    expect(canAccess('Admin', 'products', [])).toBe(true);
    expect(canAccess('Admin', 'human-resources', [])).toBe(true);
    expect(canAccess('Admin', 'reports', [])).toBe(true);
    expect(canAccess('Admin', 'user-management', [])).toBe(true);
  });

  it('blocks standard User from user-management always', () => {
    expect(canAccess('User', 'user-management', ['all_rights'])).toBe(false);
  });

  it('allows standard User access to a module if user has any matching right in userRights', () => {
    expect(canAccess('User', 'customer', ['add_customer'])).toBe(true);
    expect(canAccess('User', 'products', ['view_price'])).toBe(false); // not in module
    expect(canAccess('User', 'products', ['add_product'])).toBe(true);
  });

  it('blocks standard User from a module if no matching rights exist', () => {
    expect(canAccess('User', 'sales', [])).toBe(false);
    expect(canAccess('User', 'reports', ['add_customer'])).toBe(false);
  });
});

describe('Accessible Modules Resolution (getAccessibleModules)', () => {
  it('returns all modules for Superadmin', () => {
    const modules = getAccessibleModules('Superadmin');
    expect(modules).toContain('sales');
    expect(modules).toContain('customer');
    expect(modules).toContain('products');
    expect(modules).toContain('human-resources');
    expect(modules).toContain('reports');
    expect(modules).toContain('user-management');
  });

  it('returns only permitted modules for User based on rights', () => {
    const modules = getAccessibleModules('User', ['add_customer', 'add_product']);
    expect(modules).toContain('customer');
    expect(modules).toContain('products');
    expect(modules).not.toContain('sales');
    expect(modules).not.toContain('human-resources');
    expect(modules).not.toContain('user-management');
  });
});

describe('Rights Catalogue Completeness', () => {
  it('defines 36 canonical per-action rights across all 6 modules', () => {
    const customerRights = MODULE_RIGHTS_MAP['customer'];
    const productRights = MODULE_RIGHTS_MAP['products'];
    const hrRights = MODULE_RIGHTS_MAP['human-resources'];
    const salesRights = MODULE_RIGHTS_MAP['sales'];
    const reportsRights = MODULE_RIGHTS_MAP['reports'];
    const userMgmtRights = MODULE_RIGHTS_MAP['user-management'];

    expect(customerRights.length).toBe(3);
    expect(productRights.length).toBe(6);
    expect(hrRights.length).toBe(13);
    expect(salesRights.length).toBe(7);
    expect(reportsRights.length).toBe(7);
    expect(userMgmtRights.length).toBe(0);

    const totalRights =
      customerRights.length +
      productRights.length +
      hrRights.length +
      salesRights.length +
      reportsRights.length +
      userMgmtRights.length;

    expect(totalRights).toBe(36);
  });
});
