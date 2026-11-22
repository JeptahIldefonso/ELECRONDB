/**
 * Single Source of Truth for Role-Based Access Control and Module Permissions.
 * Canonical Reference: Hope, Inc. ERP — System Architecture & Implementation Guidelines
 */

export type ModuleName =
  | 'sales'
  | 'customer'
  | 'products'
  | 'human-resources'
  | 'reports'
  | 'user-management';

export type NormalizedRole = 'superadmin' | 'admin' | 'user';

/**
 * Normalizes case across stored and session role strings ('Superadmin', 'Admin', 'User', etc.).
 */
export function normalizeRole(role?: string | null): NormalizedRole {
  const r = (role || '').toLowerCase().trim();
  if (r === 'superadmin') return 'superadmin';
  if (r === 'admin') return 'admin';
  return 'user';
}

/**
 * Mapping of canonical 36 rights to their respective modules (Hope, Inc. ERP — Section 3.8).
 */
export const MODULE_RIGHTS_MAP: Record<ModuleName, string[]> = {
  customer: ['add_customer', 'edit_customer', 'delete_customer'],
  products: [
    'add_product',
    'edit_product',
    'delete_product',
    'add_price',
    'edit_price',
    'delete_price',
  ],
  'human-resources': [
    'add_job',
    'edit_job',
    'delete_job',
    'add_department',
    'edit_department',
    'delete_department',
    'add_employee',
    'edit_employee',
    'delete_employee',
    'view_job_history',
    'add_job_history',
    'edit_job_history',
    'delete_job_history',
  ],
  sales: [
    'add_sale',
    'edit_sale',
    'delete_sale',
    'view_sale_details',
    'add_sale_detail',
    'edit_sale_detail',
    'delete_sale_detail',
  ],
  reports: [
    'report_top_customers',
    'report_product_master',
    'report_top_products',
    'report_active_employees',
    'report_all_employees',
    'report_employee_job_history',
    'report_top_sales',
  ],
  'user-management': [], // Strictly Superadmin & Admin only
};

/**
 * Evaluates whether a user with given role and rights can access a module.
 * - Superadmin: Access to all modules.
 * - Admin: Access to all 6 business modules + User Management (Superadmin accounts are protected).
 * - User: Fail-closed. Access ONLY if user holds at least one matching right for that module.
 */
export function canAccess(
  role: string | null | undefined,
  module: ModuleName,
  userRights: string[] = []
): boolean {
  const normRole = normalizeRole(role);

  if (normRole === 'superadmin') return true;
  if (normRole === 'admin') {
    // Admin has access to all business modules and user management
    return true;
  }

  // User role is strictly forbidden from User Management
  if (module === 'user-management') return false;

  const requiredRights = MODULE_RIGHTS_MAP[module] || [];
  // Fail closed: if empty rights, access is denied
  if (requiredRights.length === 0 || userRights.length === 0) {
    return false;
  }

  return requiredRights.some((right) => userRights.includes(right));
}

/**
 * Returns the list of all modules accessible to the user.
 */
export function getAccessibleModules(
  role: string | null | undefined,
  userRights: string[] = []
): ModuleName[] {
  const allModules: ModuleName[] = [
    'sales',
    'customer',
    'products',
    'human-resources',
    'reports',
    'user-management',
  ];
  return allModules.filter((m) => canAccess(role, m, userRights));
}

export interface ModuleMeta {
  id: ModuleName;
  label: string;
  href: string;
  section: 'TRANSACTIONS' | 'CATALOG' | 'ORGANIZATION' | 'ADMINISTRATION';
  shortDesc: string;
}

export const MODULE_METADATA: Record<ModuleName, ModuleMeta> = {
  sales: {
    id: 'sales',
    label: 'Sales',
    href: '/sales',
    section: 'TRANSACTIONS',
    shortDesc: 'Order headers & itemized lines',
  },
  customer: {
    id: 'customer',
    label: 'Customer',
    href: '/customers',
    section: 'TRANSACTIONS',
    shortDesc: 'Client roster & credit terms',
  },
  products: {
    id: 'products',
    label: 'Products',
    href: '/products',
    section: 'CATALOG',
    shortDesc: 'Hardware inventory & price logs',
  },
  'human-resources': {
    id: 'human-resources',
    label: 'Human Resources',
    href: '/employees',
    section: 'ORGANIZATION',
    shortDesc: 'Staff, jobs, depts & salaries',
  },
  reports: {
    id: 'reports',
    label: 'Reports',
    href: '/reports',
    section: 'ORGANIZATION',
    shortDesc: '7 analytical SQL summaries',
  },
  'user-management': {
    id: 'user-management',
    label: 'User Management',
    href: '/users',
    section: 'ADMINISTRATION',
    shortDesc: 'Accounts, rights & access gates',
  },
};
