'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search,
  Filter,
  Calendar,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  ShieldCheck,
  Database,
  ArrowRight,
} from 'lucide-react';
import {
  type AuditQueryResult,
  type AuditLogRecord,
  VALID_AUDIT_TABLES,
  VALID_AUDIT_ACTIONS,
  formatAuditTimestamp,
} from '@/lib/audit-types';

interface AuditViewProps {
  initialData: AuditQueryResult;
  currentFilters: {
    table?: string;
    action?: string;
    actor?: string;
    recordKey?: string;
    dateFrom: string;
    dateTo: string;
    page: number;
    pageSize: number;
  };
}

export function AuditView({ initialData, currentFilters }: AuditViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local form state for filter controls
  const [selectedTable, setSelectedTable] = useState(currentFilters.table || 'all');
  const [selectedAction, setSelectedAction] = useState(currentFilters.action || 'all');
  const [actorQuery, setActorQuery] = useState(currentFilters.actor || '');
  const [recordKeyQuery, setRecordKeyQuery] = useState(currentFilters.recordKey || '');
  const [dateFrom, setDateFrom] = useState(currentFilters.dateFrom);
  const [dateTo, setDateTo] = useState(currentFilters.dateTo);

  // Inspector modal state
  const [inspectedRecord, setInspectedRecord] = useState<AuditLogRecord | null>(null);

  const applyFilters = (newPage = 1) => {
    const params = new URLSearchParams();
    if (selectedTable && selectedTable !== 'all') params.set('table', selectedTable);
    if (selectedAction && selectedAction !== 'all') params.set('action', selectedAction);
    if (actorQuery.trim()) params.set('actor', actorQuery.trim());
    if (recordKeyQuery.trim()) params.set('recordKey', recordKeyQuery.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (newPage > 1) params.set('page', String(newPage));

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setSelectedTable('all');
    setSelectedAction('all');
    setActorQuery('');
    setRecordKeyQuery('');
    const now = new Date();
    const toIso = now.toISOString().split('T')[0];
    const fromIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDateFrom(fromIso);
    setDateTo(toIso);

    startTransition(() => {
      router.push(pathname);
    });
  };

  const getActionBadgeClass = (action: string) => {
    switch (action.toUpperCase()) {
      case 'ADD':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
      case 'EDIT':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
      case 'DELETE':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800';
      case 'RESTORE':
        return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const startIndex = (initialData.page - 1) * initialData.pageSize + 1;
  const endIndex = Math.min(initialData.page * initialData.pageSize, initialData.total);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-editorial text-2xl sm:text-3xl font-normal text-text tracking-tight">
              System Audit Log
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#0284C7]/10 text-[#0284C7] dark:bg-[#0284C7]/20 border border-[#0284C7]/30">
              <ShieldCheck className="w-3 h-3" />
              Superadmin Only
            </span>
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Immutable, append-only record of all system operations, data revisions, and permission updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-muted">
            Total Records: <strong className="text-text">{initialData.total.toLocaleString()}</strong>
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-surface-1 border border-border rounded-lg p-4 space-y-4 shadow-xs transition-colors duration-150">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Date From */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full text-xs font-mono bg-bg border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-text"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full text-xs font-mono bg-bg border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-text"
            />
          </div>

          {/* Table Select */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Database className="w-3 h-3" />
              Table
            </label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full text-xs font-mono bg-bg border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-text"
            >
              <option value="all">All Tables</option>
              {VALID_AUDIT_TABLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Action Select */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Action
            </label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full text-xs font-mono bg-bg border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-text"
            >
              <option value="all">All Actions</option>
              {VALID_AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Actor Query */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Search className="w-3 h-3" />
              Actor
            </label>
            <input
              type="text"
              placeholder="Filter by actor..."
              value={actorQuery}
              onChange={(e) => setActorQuery(e.target.value)}
              className="w-full text-xs bg-bg border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-text"
            />
          </div>

          {/* Record Key Query */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Search className="w-3 h-3" />
              Record Key
            </label>
            <input
              type="text"
              placeholder="e.g. 00068 or ID..."
              value={recordKeyQuery}
              onChange={(e) => setRecordKeyQuery(e.target.value)}
              className="w-full text-xs font-mono bg-bg border border-border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-text"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text px-2 py-1 rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>

          <button
            type="button"
            onClick={() => applyFilters(1)}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded text-xs font-medium bg-[#041a24] dark:bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? 'Filtering...' : 'Apply Filters'}
          </button>
        </div>
      </div>

      {/* Main Audit Records Table */}
      <div className="bg-white dark:bg-surface-1 border border-border rounded-lg overflow-hidden shadow-xs transition-colors duration-150">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-[#FBF9F5] dark:bg-surface-2 text-[11px] font-mono text-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp (Asia/Manila)</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Table</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Record Key</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {initialData.records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-mono text-xs">No audit records found matching the active filters.</p>
                  </td>
                </tr>
              ) : (
                initialData.records.map((r) => (
                  <tr
                    key={r.auditId}
                    className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-text-muted whitespace-nowrap">
                      {formatAuditTimestamp(r.actionAt)}
                    </td>
                    <td className="py-3 px-4 font-medium text-text">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
                          {r.actionBy.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate max-w-[160px]">{r.actionBy}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                        {r.tableName}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${getActionBadgeClass(
                          r.action
                        )}`}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-text-muted truncate max-w-[180px]">
                      {r.recordKey}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setInspectedRecord(r)}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0284C7] hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Changes
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {initialData.total > 0 && (
          <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-text-muted">
            <div>
              Showing <strong>{startIndex}</strong> to <strong>{endIndex}</strong> of{' '}
              <strong>{initialData.total}</strong> entries
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyFilters(initialData.page - 1)}
                disabled={initialData.page <= 1 || isPending}
                className="px-2.5 py-1.5 rounded border border-border bg-bg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <span className="px-3 py-1 font-mono">
                Page {initialData.page} of {initialData.totalPages}
              </span>

              <button
                type="button"
                onClick={() => applyFilters(initialData.page + 1)}
                disabled={initialData.page >= initialData.totalPages || isPending}
                className="px-2.5 py-1.5 rounded border border-border bg-bg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Changes Inspector Modal */}
      {inspectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-white dark:bg-surface-1 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between shrink-0 bg-slate-50 dark:bg-surface-2">
              <div>
                <h3 className="font-editorial text-lg text-text">
                  Audit Record #{inspectedRecord.auditId} Details
                </h3>
                <p className="text-xs font-mono text-text-muted mt-0.5">
                  {inspectedRecord.tableName} &bull; {inspectedRecord.action} &bull; Key:{' '}
                  {inspectedRecord.recordKey}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedRecord(null)}
                className="p-1 rounded text-text-muted hover:text-text hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-bg border border-border rounded text-xs font-mono">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase">Action By</span>
                  <strong className="text-text">{inspectedRecord.actionBy}</strong>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase">Timestamp</span>
                  <span className="text-text">{formatAuditTimestamp(inspectedRecord.actionAt)}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase">Table</span>
                  <span className="text-text">{inspectedRecord.tableName}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase">Action</span>
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${getActionBadgeClass(
                      inspectedRecord.action
                    )}`}
                  >
                    {inspectedRecord.action}
                  </span>
                </div>
              </div>

              {/* Side-by-side or stacked Before vs After diff view */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Old Values */}
                <div className="space-y-1.5">
                  <div className="text-xs font-mono font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <span>Before (Old Values)</span>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-[300px]">
                    {inspectedRecord.oldValues
                      ? JSON.stringify(inspectedRecord.oldValues, null, 2)
                      : 'null (Initial record or insertion)'}
                  </pre>
                </div>

                {/* New Values */}
                <div className="space-y-1.5">
                  <div className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span>After (New Values)</span>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-[300px]">
                    {inspectedRecord.newValues
                      ? JSON.stringify(inspectedRecord.newValues, null, 2)
                      : 'null (Deletion)'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end bg-slate-50 dark:bg-surface-2">
              <button
                type="button"
                onClick={() => setInspectedRecord(null)}
                className="px-4 py-1.5 rounded text-xs font-medium border border-border bg-bg hover:bg-slate-100 dark:hover:bg-slate-800 text-text transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
