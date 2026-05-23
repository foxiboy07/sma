import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '../ui';
import { useToast } from '../../hooks/useToast';

export const ToastContext = React.createContext<ReturnType<typeof useToast>['toast'] | null>(null);

export function AppLayout() {
  const { toasts, toast, removeToast } = useToast();

  return (
    <ToastContext.Provider value={toast}>
      <div className="flex h-screen overflow-hidden bg-[#0A0B0F]">
        <Sidebar dlqCount={3} brokenAccounts={0} unreadInbox={12} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useAppToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useAppToast must be used inside AppLayout');
  return ctx;
}
