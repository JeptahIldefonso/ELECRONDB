'use client';

import React, { useState, useTransition } from 'react';
import { X, Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { UserAccount, UserRole } from '@/lib/types';
import { adminSendPasswordResetEmailAction } from '@/app/actions/auth';

interface ResetPasswordModalProps {
  user: UserAccount | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
  onSuccess: () => void;
}

export function ResetPasswordModal({
  user,
  isOpen,
  onClose,
  currentUserRole,
  onSuccess,
}: ResetPasswordModalProps) {
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen || !user) return null;

  const handleClose = () => {
    setSentMessage(null);
    setError(null);
    onClose();
  };

  const handleSendResetEmail = () => {
    setError(null);
    startTransition(async () => {
      const res = await adminSendPasswordResetEmailAction(user.email);
      if (res.error) {
        setError(res.error);
      } else {
        setSentMessage(
          res.message || `Password reset link sent successfully to ${user.email}!`
        );
        onSuccess();
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150 font-sans"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 id="reset-password-modal-title" className="font-editorial text-base font-bold text-slate-900 dark:text-slate-100">
                Email Password Reset
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Send a secure reset link to the user&apos;s Gmail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-400 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!sentMessage ? (
            <>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Send a password reset email to{' '}
                <strong className="text-slate-900 dark:text-slate-100 font-semibold">{user.fullName || user.email}</strong>.
              </p>

              {/* User Details Card */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 uppercase">Target Email</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 uppercase">User Role</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{user.role}</span>
                </div>
              </div>

              {/* Information Notice */}
              <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg text-sky-800 dark:text-sky-300 leading-relaxed flex items-start gap-2">
                <Mail className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p>
                  A single-use verification link will be delivered directly to the user&apos;s Gmail inbox. The user can click the link to choose their new password.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-[#001A2B] hover:bg-[#00263E] rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending to Gmail...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send Reset Link to Gmail</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-xs">Reset Email Sent Successfully!</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    A password recovery link has been delivered to <strong>{user.email}</strong>. The user can open Gmail and click the link to set their new password.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-[#001A2B] hover:bg-[#00263E] rounded-md transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
