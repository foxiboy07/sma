import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { FlowsPage } from './pages/FlowsPage';
import { FlowBuilderPage } from './pages/FlowBuilderPage';
import { InboxPage } from './pages/InboxPage';
import { ContactsPage } from './pages/ContactsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { TokenHealthPage } from './pages/TokenHealthPage';
import { DLQPage } from './pages/DLQPage';
import { BroadcastsPage } from './pages/BroadcastsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { ShortLinksPage } from './pages/ShortLinksPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { GDPRPage } from './pages/GDPRPage';
import { APIPage } from './pages/APIPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import {
  SettingsLayout, GeneralSettings, TeamSettings,
  BillingSettings, AISettings, NotificationsSettings
} from './pages/SettingsPage';
import { useAuth } from './hooks/useAuth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#0A0B0F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center animate-pulse" />
        <p className="text-xs text-[#4B5068]">Loading FlowPulse...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppWithAuth() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#0A0B0F] flex items-center justify-center">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 animate-pulse" />
    </div>
  );

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />

      {/* Full-screen flow builder (no AppLayout) */}
      <Route path="/flows/:id/builder" element={
        <ProtectedRoute><FlowBuilderPage /></ProtectedRoute>
      } />

      {/* Main app with sidebar */}
      <Route path="/" element={
        <ProtectedRoute><AppLayout /></ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="flows" element={<FlowsPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contacts/:id" element={<ContactDetailPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="broadcasts" element={<BroadcastsPage />} />
        <Route path="knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="links" element={<ShortLinksPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="health" element={<TokenHealthPage />} />
        <Route path="dlq" element={<DLQPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="audit" element={<AuditLogPage />} />

        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<GeneralSettings />} />
          <Route path="team" element={<TeamSettings />} />
          <Route path="billing" element={<BillingSettings />} />
          <Route path="notifications" element={<NotificationsSettings />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="ai" element={<AISettings />} />
          <Route path="gdpr" element={<GDPRPage />} />
          <Route path="api" element={<APIPage />} />
        </Route>

        <Route path="*" element={
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-6xl font-bold text-[#1E2130]">404</p>
            <p className="text-sm text-[#8B90A7]">Page not found</p>
            <a href="/" className="text-blue-400 hover:text-blue-300 text-sm">Go to Dashboard</a>
          </div>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppWithAuth />
    </BrowserRouter>
  );
}
