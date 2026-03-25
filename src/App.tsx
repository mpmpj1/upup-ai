import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@/components/AuthProvider';
import Index from '@/pages/Index';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ForgotPassword from '@/components/ForgotPassword';
import AuthConfirmPage from '@/pages/AuthConfirmPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import InvitationSetup from '@/pages/InvitationSetup';
import TermsOfService from '@/pages/TermsOfService';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import FAQ from '@/pages/FAQ';
import NotFound from '@/pages/NotFound';
import ResearchArchive from '@/pages/ResearchArchive';
import ResearchSettings from '@/pages/ResearchSettings';
import ResearchWorkspace from '@/pages/ResearchWorkspace';

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/workspace" element={<ResearchWorkspace />} />
      <Route path="/dashboard" element={<ResearchWorkspace />} />
      <Route path="/analysis-records" element={<ResearchArchive />} />
      <Route path="/settings" element={<ResearchSettings />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/confirm" element={<AuthConfirmPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invitation-setup" element={<InvitationSetup />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  const basename = import.meta.env.BASE_URL || '/';

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename={basename}>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
