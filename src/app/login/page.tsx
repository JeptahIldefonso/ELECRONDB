'use client';

import React, { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, CheckCircle2, RotateCw, KeyRound } from 'lucide-react';
import { TopographicCanvas } from '@/components/ambient/TopographicCanvas';

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [resending, setResending] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 60-second cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Read URL query parameters (e.g. /login?error=verify_failed or /?verified=1)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get('error');
      const verified = params.get('verified');

      if (verified === '1') {
        setSuccessMessage('Email verified successfully! Welcome to ElectronDB ERP. Please sign in.');
      } else if (urlError === 'verify_failed') {
        setError('That verification link is invalid or has expired. You can resend a fresh link below.');
      } else if (urlError) {
        setError(urlError);
      }
    }
  }, []);

  // Synchronize browser tab title
  useEffect(() => {
    document.title =
      mode === 'signin'
        ? 'Sign In | ElectronDB ERP'
        : 'Register | ElectronDB ERP';
  }, [mode]);

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setMode('register');
      setError(null);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setMode('signin');
      setError(null);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setUnconfirmedEmail(null);
    const formData = new FormData(e.currentTarget);
    const identifier = (formData.get('email') as string)?.trim();
    const password = formData.get('password') as string;

    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await res.json();

        if (!data.ok) {
          setError(data.message || 'Invalid email/username or password.');
          if (data.canResend) {
            setUnconfirmedEmail(data.email || identifier);
          }
        } else {
          window.location.href = '/';
        }
      } catch {
        setError('Unable to sign in at this time. Please try again.');
      }
    });
  };

  const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string)?.trim().toLowerCase();
    const firstName = (formData.get('firstName') as string)?.trim() || '';
    const lastName = (formData.get('lastName') as string)?.trim() || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const username = (formData.get('username') as string)?.trim() || firstName.toLowerCase();
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!email || !password) {
      setError('Please provide an email and password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName, username }),
        });
        const data = await res.json();

        if (!data.ok) {
          setError(data.message || 'Registration failed.');
        } else if (data.needsVerification) {
          setVerificationEmail(data.email || email);
          setCooldown(60);
        } else {
          window.location.href = '/';
        }
      } catch {
        setError('Network error during registration. Please check your connection.');
      }
    });
  };

  const handleResend = async (targetEmail?: string) => {
    const toSend = targetEmail || verificationEmail || unconfirmedEmail;
    if (!toSend || cooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: toSend }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || 'Failed to resend verification email.');
      } else {
        setSuccessMessage(data.message || 'If that email is waiting for verification, a new link was sent.');
        setCooldown(60);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !verificationEmail) return;
    setVerifyingCode(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, token: code }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || 'Invalid or expired code.');
      } else {
        window.location.href = '/?verified=1';
      }
    } catch {
      setError('Network error verifying code.');
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[#F4F4F0] text-[#041a24] selection:bg-[#041a24] selection:text-white overflow-x-hidden font-sans transition-colors duration-150">
      <TopographicCanvas />

      {/* Brand Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#41555e] hover:text-[#041a25] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Landing</span>
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
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#41555e] mt-0.5">
              ERP
            </span>
          </div>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 w-full max-w-md mx-auto">
        <div className="w-full bg-white dark:bg-surface-1 border border-black/10 dark:border-border rounded-[6px] shadow-sm p-6 sm:p-8 space-y-5 transition-colors duration-150">
          {/* Card Title */}
          <div className="text-left">
            <h1 className="font-editorial text-2xl font-normal text-[#041a24] dark:text-text tracking-tight leading-tight">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-xs text-[#41555f] dark:text-text-muted mt-1 font-sans">
              {mode === 'signin'
                ? 'Sign in to your ElectronDB ERP account'
                : 'Create your ElectronDB ERP account'}
            </p>
          </div>

          {/* Role rule notice in Register mode */}
          {mode === 'register' && !verificationEmail && (
            <div className="rounded-[4px] bg-[#FFFBEB] dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#92400E]/40 p-2.5 text-[11px] text-[#92400E] dark:text-[#FDE68A] leading-relaxed">
              New accounts are created as <strong>User</strong>. Superadmin and Admin roles can only be assigned by existing administrators.
            </div>
          )}

          {/* Segmented Mode Switcher */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            tabIndex={0}
            onKeyDown={handleTabKeyDown}
            className="relative grid grid-cols-2 p-1 rounded-[4px] bg-[#F4F4F0] dark:bg-surface-2 border border-black/10 dark:border-border text-xs font-medium select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[#041a24]"
          >
            <div
              aria-hidden="true"
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-[3px] bg-[#041a24] dark:bg-primary-bg shadow-xs pointer-events-none transition-transform duration-200 ease-out motion-reduce:transition-none"
              style={{
                transform: mode === 'signin' ? 'translateX(0%)' : 'translateX(100%)',
              }}
            />

            <button
              id="tab-signin"
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              aria-controls="panel-signin"
              tabIndex={mode === 'signin' ? 0 : -1}
              onClick={() => {
                setMode('signin');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`relative z-10 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.14em] font-semibold transition-colors duration-200 cursor-pointer ${
                mode === 'signin'
                  ? 'text-white dark:!text-primary-fg'
                  : 'text-[#41555f] hover:text-[#041a24] dark:text-text-muted dark:hover:text-text'
              }`}
            >
              Sign In
            </button>

            <button
              id="tab-register"
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              aria-controls="panel-register"
              tabIndex={mode === 'register' ? 0 : -1}
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`relative z-10 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.14em] font-semibold transition-colors duration-200 cursor-pointer ${
                mode === 'register'
                  ? 'text-white dark:!text-primary-fg'
                  : 'text-[#41555f] hover:text-[#041a24] dark:text-text-muted dark:hover:text-text'
              }`}
            >
              Register
            </button>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="rounded-[3px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="rounded-[3px] bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-800 dark:text-red-200 flex flex-col gap-2 font-mono"
            >
              <div className="flex items-start gap-2">
                <span className="font-semibold shrink-0">NOTICE:</span>
                <span>{error}</span>
              </div>
              {unconfirmedEmail && (
                <button
                  type="button"
                  onClick={() => handleResend(unconfirmedEmail)}
                  disabled={resending || cooldown > 0}
                  className="mt-1 self-start inline-flex items-center gap-1.5 text-xs text-red-900 dark:text-red-100 underline hover:no-underline font-sans cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                  <span>
                    {cooldown > 0
                      ? `Resend available in ${cooldown}s`
                      : 'Resend verification email'}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Sign In Form */}
          {mode === 'signin' && (
            <form id="panel-signin" role="tabpanel" aria-labelledby="tab-signin" onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="signin-email"
                  className="block font-mono text-[11px] uppercase tracking-[0.14em] font-medium text-[#41555f] dark:text-text-muted mb-1.5"
                >
                  Email or Username
                </label>
                <input
                  id="signin-email"
                  name="email"
                  type="text"
                  required
                  placeholder="admin or name@hope.com"
                  className="w-full h-9 px-3 bg-white dark:bg-surface-2 border border-black/15 dark:border-border focus:border-[#041a24] dark:focus:border-text focus:ring-1 focus:ring-[#041a24]/20 rounded-[3px] text-xs text-[#041a24] dark:text-text placeholder-[#41555f]/60 dark:placeholder-text-muted/60 outline-none transition-all font-sans"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="signin-password"
                    className="block font-mono text-[11px] uppercase tracking-[0.14em] font-medium text-[#41555f] dark:text-text-muted"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] font-sans text-[#41555f] hover:text-[#041a24] dark:text-text-muted dark:hover:text-text transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="signin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your password"
                    className="w-full h-9 pl-3 pr-9 bg-white dark:bg-surface-2 border border-black/15 dark:border-border focus:border-[#041a24] dark:focus:border-text focus:ring-1 focus:ring-[#041a24]/20 rounded-[3px] text-xs text-[#041a24] dark:text-text placeholder-[#41555f]/60 dark:placeholder-text-muted/60 outline-none transition-all font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-black/40 dark:text-text-muted hover:text-[#041a24] dark:hover:text-text p-1 rounded transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full h-9 bg-[#041a24] dark:bg-primary-bg hover:bg-[#1c313b] dark:hover:bg-primary-bg/90 active:bg-black dark:active:bg-primary-bg/80 disabled:opacity-50 text-white dark:!text-primary-fg font-medium text-xs rounded-[3px] shadow-2xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#041a24] dark:border-primary-bg"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white dark:!text-primary-fg" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              <div className="text-center pt-1 text-xs text-[#41555f] dark:text-text-muted font-sans">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="font-medium text-[#041a24] dark:text-text hover:underline cursor-pointer"
                >
                  Register
                </button>
              </div>
            </form>
          )}

          {/* Registration Form / Check Inbox State */}
          {mode === 'register' && (
            verificationEmail ? (
              /* C5: Check your inbox panel */
              <div className="space-y-4 py-1">
                <div className="p-4 rounded-[4px] border border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-mono text-xs uppercase tracking-wider font-bold text-emerald-800 dark:text-emerald-300">
                      Check your inbox
                    </h3>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                    We sent a verification link to <strong className="font-semibold text-slate-900 dark:text-white">{verificationEmail}</strong>. Click the link in the email to activate your account.
                  </p>
                </div>

                {/* Optional code entry fallback for link scanners (C4) */}
                <form onSubmit={handleVerifyCode} className="space-y-2 pt-1 border-t border-black/10 dark:border-border">
                  <label htmlFor="verify-code" className="block font-mono text-[11px] uppercase tracking-[0.12em] font-medium text-[#41555f] dark:text-text-muted">
                    Or enter verification code from email
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="verify-code"
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.trim())}
                      placeholder="e.g. 123456"
                      className="flex-1 h-9 px-3 bg-white dark:bg-surface-2 border border-black/15 dark:border-border focus:border-[#041a24] dark:focus:border-text rounded-[3px] text-xs font-mono outline-none"
                    />
                    <button
                      type="submit"
                      disabled={verifyingCode || !code}
                      className="px-3.5 h-9 bg-[#041a24] dark:bg-primary-bg hover:bg-[#1c313b] text-white text-xs font-medium rounded-[3px] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {verifyingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                      <span>Verify</span>
                    </button>
                  </div>
                </form>

                {/* Resend and switch email actions */}
                <div className="flex flex-col gap-2 pt-2 border-t border-black/10 dark:border-border">
                  <button
                    type="button"
                    onClick={() => handleResend(verificationEmail)}
                    disabled={resending || cooldown > 0}
                    className="w-full h-8 border border-black/20 dark:border-border hover:bg-black/5 dark:hover:bg-white/5 text-[#041a24] dark:text-text font-medium text-xs rounded-[3px] flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    <span>
                      {cooldown > 0
                        ? `Resend email in ${cooldown}s`
                        : 'Resend verification email'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVerificationEmail(null);
                      setError(null);
                    }}
                    className="text-xs text-[#41555f] dark:text-text-muted hover:underline text-center cursor-pointer py-1"
                  >
                    Use a different email address
                  </button>
                </div>
              </div>
            ) : (
              /* Registration Form */
              <form id="panel-register" role="tabpanel" aria-labelledby="tab-register" onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="reg-first"
                      className="block font-mono text-[11px] uppercase tracking-[0.14em] font-medium text-[#41555f] dark:text-text-muted mb-1.5"
                    >
                      First name
                    </label>
                    <input
                      id="reg-first"
                      name="firstName"
                      type="text"
                      required
                      placeholder="Jeptah"
                      className="w-full h-9 px-3 bg-white dark:bg-surface-2 border border-black/15 dark:border-border focus:border-[#041a24] dark:focus:border-text rounded-[3px] text-xs text-[#041a24] dark:text-text placeholder-[#41555f]/60 dark:placeholder-text-muted/60 outline-none transition-all font-sans"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="reg-last"
                      className="block font-mono text-[11px] uppercase tracking-[0.14em] font-medium text-[#41555f] dark:text-text-muted mb-1.5"
                    >
                      Last name
                    </label>
                    <input
                      id="reg-last"
                      name="lastName"
                      type="text"
                      required
                      placeholder="Ildefonso"
                      className="w-full h-9 px-3 bg-white dark:bg-surface-2 border border-black/15 dark:border-border focus:border-[#041a24] dark:focus:border-text rounded-[3px] text-xs text-[#041a24] dark:text-text placeholder-[#41555f]/60 dark:placeholder-text-muted/60 outline-none transition-all font-sans"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-email"
                    className="block font-mono text-[11px] uppercase tracking-[0.14em] font-medium text-[#41555f] dark:text-text-muted mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    required
                    placeholder="name@gmail.com"
                    className="w-full h-9 px-3 bg-white dark:bg-surface-2 border border-black/15 dark:border-border focus:border-[#041a24] dark:focus:border-text rounded-[3px] text-xs text-[#041a24] dark:text-text placeholder-[#41555f]/60 dark:placeholder-text-muted/60 outline-none transition-all font-sans"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-password"
                    className="block font-mono text-[11px] uppercase tracking-[0.14em] font-medium text-[#41555f] dark:text-text-muted mb-1.5"
                  >
                    Password (8+ characters)
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      name="password"
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="••••••••••••"
                      className="w-full h-9 pl-3 pr-9 bg-white dark:bg-surface-2 border border-black/15 dark:border-border focus:border-[#041a24] dark:focus:border-text rounded-[3px] text-xs text-[#041a24] dark:text-text placeholder-[#41555f]/60 dark:placeholder-text-muted/60 outline-none transition-all font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-black/40 dark:text-text-muted hover:text-[#041a24] dark:hover:text-text p-1 rounded transition-colors"
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-confirm"
                    className="block font-mono text-[11px] uppercase tracking-[0.14em] font-medium text-[#41555f] dark:text-text-muted mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="reg-confirm"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="••••••••••••"
                      className="w-full h-9 pl-3 pr-9 bg-white dark:bg-surface-2 border border-black/15 dark:border-border focus:border-[#041a24] dark:focus:border-text rounded-[3px] text-xs text-[#041a24] dark:text-text placeholder-[#41555f]/60 dark:placeholder-text-muted/60 outline-none transition-all font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-black/40 dark:text-text-muted hover:text-[#041a24] dark:hover:text-text p-1 rounded transition-colors"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-9 bg-[#041a24] dark:bg-primary-bg hover:bg-[#1c313b] dark:hover:bg-primary-bg/90 active:bg-black dark:active:bg-primary-bg/80 disabled:opacity-50 text-white dark:!text-primary-fg font-medium text-xs rounded-[3px] shadow-2xs flex items-center justify-center gap-2 transition-colors cursor-pointer mt-1 border border-[#041a24] dark:border-primary-bg"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white dark:!text-primary-fg" />
                      <span>Creating account...</span>
                    </span>
                  ) : (
                    <span>Register</span>
                  )}
                </button>

                <div className="text-center pt-1 text-xs text-[#41555f] dark:text-text-muted font-sans">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="font-medium text-[#041a24] dark:text-text hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </div>
              </form>
            )
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-6 py-4 text-center text-xs font-mono text-[#41555e]">
        ElectronDB ERP &bull; Student Explainer
      </footer>
    </div>
  );
}
