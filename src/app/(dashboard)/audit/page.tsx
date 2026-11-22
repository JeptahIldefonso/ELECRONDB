import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { normalizeRole } from '@/lib/permissions';
import {
  validateAuditFilters,
  getAuditLogs,
  type RawAuditFilterParams,
} from '@/lib/audit';
import { AuditView } from '@/components/audit/AuditView';

export const dynamic = 'force-dynamic';

interface AuditPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const user = await getCurrentUser();

  // 1. Authentication check: must be logged in
  if (!user) {
    redirect('/login');
  }

  // 2. Strict Role Authorization: Superadmin only (Stage 3 Requirement)
  const normRole = normalizeRole(user.role);
  if (normRole !== 'superadmin') {
    redirect('/?denied=1');
  }

  // 3. Resolve and validate URL search parameters safely
  const resolvedParams = await searchParams;
  const rawFilters: RawAuditFilterParams = {
    table: typeof resolvedParams.table === 'string' ? resolvedParams.table : null,
    action: typeof resolvedParams.action === 'string' ? resolvedParams.action : null,
    actor: typeof resolvedParams.actor === 'string' ? resolvedParams.actor : null,
    recordKey: typeof resolvedParams.recordKey === 'string' ? resolvedParams.recordKey : null,
    dateFrom: typeof resolvedParams.dateFrom === 'string' ? resolvedParams.dateFrom : null,
    dateTo: typeof resolvedParams.dateTo === 'string' ? resolvedParams.dateTo : null,
    page: typeof resolvedParams.page === 'string' ? resolvedParams.page : 1,
    pageSize: typeof resolvedParams.pageSize === 'string' ? resolvedParams.pageSize : 50,
  };

  const validatedFilters = validateAuditFilters(rawFilters);

  // 4. Query paginated audit records with parameterized SQL
  const auditData = await getAuditLogs(validatedFilters);

  const formattedFilters = {
    table: validatedFilters.table,
    action: validatedFilters.action,
    actor: validatedFilters.actor,
    recordKey: validatedFilters.recordKey,
    dateFrom: validatedFilters.dateFrom.toISOString().split('T')[0],
    dateTo: validatedFilters.dateTo.toISOString().split('T')[0],
    page: validatedFilters.page,
    pageSize: validatedFilters.pageSize,
  };

  return (
    <div className="space-y-6">
      <AuditView initialData={auditData} currentFilters={formattedFilters} />
    </div>
  );
}
