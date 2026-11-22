import React from 'react';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata = {
  title: 'Reset Password | ElectronDB ERP',
  description: 'Reset your ElectronDB ERP account password via email verification.',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
