'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { requestPasswordResetAction } from '@/app/actions/auth';
import { TopographicCanvas } from '@/components/ambient/TopographicCanvas';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    startTransition(async () => {
      const res = await requestPasswordResetAction(cleanEmail);
      if (res.error) {
        setError(res.error);
      } else {
        setSentMessage(
          res.message || `Password recovery email sent to ${cleanEmail}. Please check your Gmail.`
        );
      }
    });
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[#F4F4F0] text-[#041a24] selection:bg-[#041a24] selection:text-white overflow-x-hidden font-sans transition-colors duration-150">
      <TopographicCanvas />

      {/* Brand Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          href="/login"
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#41555e] hover:text-[#041a25] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>

        {/* Artistic ElectronDB Brand Mark & Wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 shrink-0 rounded-md overflow-hidden border border-black/10 dark:border-white/10 shadow-2xs bg-white">
            <Image
              src="/logo.jpg"
              alt="ElectronDB Logo"
              fill
              sizes="32px"
              className="object-cover"
              priority
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-editorial italic text-xl font-normal tracking-tight text-[#041a25]">
              ElectronDB
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#41555f]/80">
              HOPE ERP System
            </span>
          </div>
        </div>
      </header>

      {/* Main Form Card */}
      <main className="relative z-10 w-full max-w-md mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="bg-[#FAF9F5] border border-black/10 rounded-lg p-6 sm:p-8 shadow-xs space-y-6">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded bg-[#041a24]/5 border border-[#041a24]/10 flex items-center justify-center text-[#041a24] mb-3">
              <Mail className="w-4 h-4" />
            </div>
            <h1 className="font-editorial text-2xl font-normal tracking-tight text-[#041a25]">
              Reset Password
            </h1>
            <p className="font-sans text-xs text-[#41555f] leading-relaxed">
              Enter your registered Gmail address. We will send you a secure verification link to reset your password.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-[4px] text-xs text-red-700 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {sentMessage ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-[4px] text-xs text-emerald-800 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Check your inbox</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed pt-1">
                  {sentMessage}
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="w-full h-9 bg-[#041a24] hover:bg-[#1c313b] text-white font-medium text-xs rounded-[3px] shadow-2xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block font-mono text-[11px] uppercase tracking-[0.14em] font-medium text-[#41555f] mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@gmail.com"
                  className="w-full h-9 px-3 bg-white border border-black/15 focus:border-[#041a24] focus:ring-1 focus:ring-[#041a24]/20 rounded-[3px] text-xs text-[#041a24] placeholder-[#41555f]/60 outline-none transition-all font-sans"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-9 bg-[#041a24] hover:bg-[#1c313b] active:bg-black text-white font-medium text-xs rounded-[3px] shadow-2xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending reset email...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send Password Reset Link</span>
                    </>
                  )}
                </button>

                <Link
                  href="/login"
                  className="w-full h-8 text-center text-xs text-[#41555f] hover:text-[#041a24] flex items-center justify-center transition-colors"
                >
                  Cancel and return to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#41555f]/80 gap-2 border-t border-black/5">
        <div className="font-editorial text-sm text-[#041a24]">
          Hope, Inc. ERP
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-[#41555f]/60">
          Supabase Email Authentication
        </div>
      </footer>
    </div>
  );
}
