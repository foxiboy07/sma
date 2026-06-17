import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { ToastContainer } from '../ui';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { AuthPage } from '../../pages/AuthPage';

export const ToastContext = React.createContext<ReturnType<typeof useToast>['toast'] | null>(null);

export function AppLayout() {
  const { user, loading } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A0B0F]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center animate-pulse">
            <span className="text-white text-xl font-bold">F</span>
          </div>
          <div className="text-sm text-[#8B90A7] animate-pulse">Loading FlowPulse...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <ToastContext.Provider value={toast}>
      <div className="flex h-screen overflow-hidden bg-[#0A0B0F]">
        {/* Desktop Sidebar */}
        <Sidebar dlqCount={3} brokenAccounts={0} unreadInbox={12} />

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Topbar with mobile menu trigger */}
          <Topbar onMenuClick={() => setMobileMenuOpen(true)} />

          {/* Page Content */}
          <main className="flex-1 overflow-auto pb-14 md:pb-0">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        dlqCount={3}
        brokenAccounts={0}
        unreadInbox={12}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useAppToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useAppToast must be used inside AppLayout');
  return ctx;
}
