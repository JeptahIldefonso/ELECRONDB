'use client';

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { formatPHP } from '@/lib/utils';
import {
  addPriceAction,
  updatePriceAction,
  deletePriceAction,
  restorePriceAction,
} from '@/app/actions/products';
import type { ProductItem, PriceRecordItem } from '@/lib/data/products';
import {
  Plus,
  RotateCcw,
  AlertCircle,
  X,
  History,
} from 'lucide-react';

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductItem;
  priceRecords: PriceRecordItem[];
  userRole?: string;
}

export function PriceHistoryModal({
  isOpen,
  onClose,
  product,
  priceRecords,
  userRole = 'admin',
}: PriceHistoryModalProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const roleUpper = userRole.toUpperCase();
  const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(roleUpper);
  const canModify = ['ADMIN', 'SUPERADMIN', 'SALES'].includes(roleUpper);

  // Status Filter: 'active' | 'inactive' | 'all'
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  // Local state initialized with priceRecords prop for optimistic instant feedback
  const [localRecords, setLocalRecords] = useState<PriceRecordItem[]>(priceRecords);

  useEffect(() => {
    setLocalRecords(priceRecords);
  }, [priceRecords]);

  // Sub-modal or inline form for Adding / Editing a price
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PriceRecordItem | null>(null);

  // Form states
  const getTodayManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const [formEffDate, setFormEffDate] = useState(getTodayManila());
  const [formPrice, setFormPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter prices for this product
  const productPrices = useMemo(() => {
    let list = localRecords.filter((p) => p.prodCode === product.prodCode);
    list.sort((a, b) => b.effDate.localeCompare(a.effDate));

    if (!isAdmin) {
      // In User view (Figure 13), show active prices only
      return list.filter((p) => !p.isDeleted);
    }

    if (statusFilter === 'active') {
      return list.filter((p) => !p.isDeleted);
    }
    if (statusFilter === 'inactive') {
      return list.filter((p) => p.isDeleted);
    }
    return list;
  }, [localRecords, product.prodCode, statusFilter, isAdmin]);

  // Check if a record already exists for the date selected in the Add form
  const existingForFormDate = useMemo(() => {
    if (editingPrice) return null;
    return localRecords.find((p) => p.prodCode === product.prodCode && p.effDate === formEffDate);
  }, [localRecords, product.prodCode, formEffDate, editingPrice]);

  // Check if current error message matches any existing record for quick 1-click edit
  const matchedCollidedPrice = useMemo(() => {
    if (!errorMsg) return null;
    return productPrices.find((p) => errorMsg.includes(p.effDate));
  }, [errorMsg, productPrices]);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingPrice(null);
    setFormEffDate(getTodayManila());
    setFormPrice('');
    setErrorMsg(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (price: PriceRecordItem) => {
    setIsAddOpen(false);
    setEditingPrice(price);
    setFormEffDate(price.effDate);
    setFormPrice(String(price.unitPrice));
    setErrorMsg(null);
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const priceVal = parseFloat(formPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      setErrorMsg('Unit price must be a positive number greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPrice) {
        const res = await updatePriceAction({
          prodCode: product.prodCode,
          effDate: editingPrice.effDate,
          unitPrice: priceVal,
        });
        if (res.error) {
          setErrorMsg(res.error);
          setIsSubmitting(false);
          return;
        }

        // Optimistically update local record
        setLocalRecords((prev) =>
          prev.map((p) =>
            p.prodCode === product.prodCode && p.effDate === editingPrice.effDate
              ? { ...p, unitPrice: priceVal, isDeleted: false, status: 'Active' }
              : p
          )
        );
        setEditingPrice(null);
      } else {
        const shouldUpdate = Boolean(existingForFormDate);
        const res = await addPriceAction({
          prodCode: product.prodCode,
          effDate: formEffDate,
          unitPrice: priceVal,
          allowUpdate: shouldUpdate,
        });
        if (res.error) {
          setErrorMsg(res.error);
          setIsSubmitting(false);
          return;
        }

        // Optimistically update or append local record
        if (shouldUpdate) {
          setLocalRecords((prev) =>
            prev.map((p) =>
              p.prodCode === product.prodCode && p.effDate === formEffDate
                ? { ...p, unitPrice: priceVal, isDeleted: false, status: 'Active' }
                : p
            )
          );
        } else {
          setLocalRecords((prev) => [
            {
              prodCode: product.prodCode,
              effDate: formEffDate,
              unitPrice: priceVal,
              isDeleted: false,
              status: 'Active',
              stamp: `CREATED ${getTodayManila()}`,
            },
            ...prev,
          ]);
        }
        setIsAddOpen(false);
      }

      setIsSubmitting(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save price record.');
      setIsSubmitting(false);
    }
  };

  const handleDeletePrice = async (price: PriceRecordItem) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await deletePriceAction(price.prodCode, price.effDate);
      if (res.error) {
        setErrorMsg(res.error);
        setIsSubmitting(false);
        return;
      }

      setLocalRecords((prev) =>
        prev.map((p) =>
          p.prodCode === price.prodCode && p.effDate === price.effDate
            ? { ...p, isDeleted: true, status: 'Inactive' }
            : p
        )
      );

      setIsSubmitting(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to soft-delete price record.');
      setIsSubmitting(false);
    }
  };

  const handleRestorePrice = async (price: PriceRecordItem) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await restorePriceAction(price.prodCode, price.effDate);
      if (res.error) {
        setErrorMsg(res.error);
        setIsSubmitting(false);
        return;
      }

      setLocalRecords((prev) =>
        prev.map((p) =>
          p.prodCode === price.prodCode && p.effDate === price.effDate
            ? { ...p, isDeleted: false, status: 'Active' }
            : p
        )
      );

      setIsSubmitting(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to restore price record.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5"
        role="dialog"
        aria-modal="true"
      >
        {/* Header (Figure 12 & 13) */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Price History &mdash; {product.prodCode}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {product.description} &bull; Unit: <span className="font-mono font-medium">{product.unit}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actionable Error Banner */}
        {errorMsg && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
              {matchedCollidedPrice && (
                <button
                  type="button"
                  onClick={() => handleOpenEdit(matchedCollidedPrice)}
                  className="font-bold underline hover:no-underline text-rose-800 dark:text-rose-200 cursor-pointer ml-1"
                >
                  Edit {matchedCollidedPrice.effDate} price now &rarr;
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 dark:text-rose-300 hover:underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Controls: Filter Pills & + Add Price Button (Figure 12) */}
        <div className="flex items-center justify-between gap-3">
          {isAdmin ? (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-md text-xs font-medium">
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 rounded transition-all cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-white dark:bg-slate-700 text-[#041a24] dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1 rounded transition-all cursor-pointer ${
                  statusFilter === 'inactive'
                    ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Inactive
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                All
              </button>
            </div>
          ) : (
            <div />
          )}

          {canModify && (
            <Button
              type="button"
              size="sm"
              onClick={handleOpenAdd}
              className="bg-[#001A2B] hover:bg-[#00263E] text-white text-xs px-3.5 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Price</span>
            </Button>
          )}
        </div>

        {/* Inline Add / Edit Price Form */}
        {(isAddOpen || editingPrice) && (
          <form
            onSubmit={handleSavePrice}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 space-y-3.5 text-xs shadow-xs"
          >
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <span className="text-sm">
                {editingPrice ? `Edit Price Record (${editingPrice.effDate})` : 'Add New Price Record'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingPrice(null);
                  setErrorMsg(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Informative notice if date collides during Add */}
            {existingForFormDate && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    A price record of <strong className="font-mono">{formatPHP(existingForFormDate.unitPrice)}</strong> already exists for {formEffDate}.
                  </span>
                </div>
                <span className="text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 px-2 py-0.5 rounded">
                  Will update this record
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Effective Date (YYYY-MM-DD) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  disabled={Boolean(editingPrice)}
                  value={formEffDate}
                  onChange={(e) => setFormEffDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 disabled:opacity-60 focus:border-[#001A2B] focus:ring-1 focus:ring-[#001A2B]/40 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Unit Price (PHP) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 28.00"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-[#001A2B] focus:ring-1 focus:ring-[#001A2B]/40 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingPrice(null);
                  setErrorMsg(null);
                }}
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-[#001A2B] hover:bg-[#00263E] text-white transition-colors cursor-pointer"
              >
                {isSubmitting
                  ? 'Saving...'
                  : editingPrice
                  ? `Save Price for ${editingPrice.effDate}`
                  : existingForFormDate
                  ? `Update Price for ${formEffDate}`
                  : 'Add Price'}
              </Button>
            </div>
          </form>
        )}

        {/* Price History Table (Figure 12 & 13) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-2xs">
          <table className="w-full text-left text-xs border-collapse min-w-[620px]">
            <thead className="bg-slate-50 dark:bg-slate-850 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-mono w-32 whitespace-nowrap">EFFECTIVE DATE</th>
                <th scope="col" className="px-4 py-2.5 font-mono w-32 whitespace-nowrap">UNIT PRICE</th>
                {isAdmin && <th scope="col" className="px-4 py-2.5 w-24 whitespace-nowrap">STATUS</th>}
                {isAdmin && <th scope="col" className="px-4 py-2.5">AUDIT STAMP</th>}
                {canModify && <th scope="col" className="px-4 py-2.5 text-right w-36 whitespace-nowrap">ACTIONS</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {productPrices.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 3} className="px-4 py-8 text-center text-slate-400">
                    <History className="h-6 w-6 mx-auto mb-1 text-slate-300 dark:text-slate-600" />
                    No price records found.
                  </td>
                </tr>
              ) : (
                productPrices.map((price) => {
                  const isDeleted = price.isDeleted;
                  return (
                    <tr
                      key={price.effDate}
                      className={
                        isDeleted
                          ? 'bg-rose-50/60 dark:bg-rose-950/20 text-slate-500'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors'
                      }
                    >
                      <td className="px-4 py-2.5 font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {price.effDate}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatPHP(price.unitPrice)}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {isDeleted ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                              Inactive
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Active
                            </span>
                          )}
                        </td>
                      )}
                      {isAdmin && (
                        <td
                          className="px-4 py-2.5 text-[11px] font-mono text-slate-400 dark:text-slate-500 max-w-[240px] truncate"
                          title={price.stamp || ''}
                        >
                          {price.stamp || '—'}
                        </td>
                      )}
                      {canModify && (
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {!isDeleted ? (
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(price)}
                                className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 shadow-2xs transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePrice(price)}
                                className="px-2.5 py-1 text-xs font-medium rounded border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 shadow-2xs transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRestorePrice(price)}
                              className="px-2.5 py-1 text-xs font-medium rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Restore</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
