import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, Zap, Users, BarChart3, Settings,
  Menu, X, Megaphone, Brain, Link2, Puzzle, Activity, AlertOctagon, FileText
} from 'lucide-react';

interface MobileNavProps {
  dlqCount?: number;
  brokenAccounts?: number;
  unreadInbox?: number;
  isOpen: boolean;
  onClose: () => void;
}

const mainNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home', exact: true },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/flows', icon: Zap, label: 'Flows' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
];

const bottomNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home', exact: true },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/flows', icon: Zap, label: 'Flows' },
  { to: '/analytics', icon: BarChart3, label: 'Stats' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const sideMenuItems = [
  { group: 'MAIN', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { to: '/inbox', icon: Inbox, label: 'Inbox' },
    { to: '/flows', icon: Zap, label: 'Flows' },
    { to: '/contacts', icon: Users, label: 'Contacts' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/broadcasts', icon: Megaphone, label: 'Broadcasts' },
  ]},
  { group: 'TOOLS', items: [
    { to: '/knowledge-base', icon: Brain, label: 'AI Knowledge Base' },
    { to: '/links', icon: Link2, label: 'Short Links' },
    { to: '/integrations', icon: Puzzle, label: 'Integrations' },
  ]},
  { group: 'MANAGEMENT', items: [
    { to: '/health', icon: Activity, label: 'Token Health' },
    { to: '/dlq', icon: AlertOctagon, label: 'DLQ Replay' },
    { to: '/templates', icon: FileText, label: 'Templates' },
  ]},
];

export function MobileNav({ dlqCount = 0, brokenAccounts = 0, unreadInbox = 0, isOpen, onClose }: MobileNavProps) {
  const location = useLocation();

  return (
    <>
      {/* Bottom Navigation - Fixed at bottom on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#111318] border-t border-[#1E2130] md:hidden safe-area-inset-bottom">
        <div className="flex items-center justify-around h-14 px-1">
          {bottomNavItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            const badge = item.to === '/inbox' ? unreadInbox : 0;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`relative flex flex-col items-center justify-center w-14 h-12 rounded-lg transition-all ${
                  isActive
                    ? 'text-blue-400'
                    : 'text-[#4B5068] active:bg-[#1A1C24]'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
                {badge > 0 && (
                  <span className="absolute top-1 right-2 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Side Menu Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Side Menu Drawer */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-[280px] max-w-[85vw] z-50 bg-[#111318] border-r border-[#1E2130] transform transition-transform duration-300 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } safe-area-inset-top`}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[#1E2130]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-[#F0F2FF]">FlowPulse</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8B90A7] hover:bg-[#1A1C24] active:bg-[#222530] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          {sideMenuItems.map((group) => (
            <div key={group.group} className="mb-4">
              <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-widest px-3 mb-2">
                {group.group}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = item.exact
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);

                  const badge = item.to === '/dlq' ? dlqCount
                    : item.to === '/health' ? brokenAccounts
                    : item.to === '/inbox' ? unreadInbox
                    : 0;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-blue-500/10 text-[#F0F2FF] border-l-2 border-blue-500 -ml-px pl-[11px]'
                          : 'text-[#8B90A7] active:bg-[#1A1C24]'
                      }`}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 font-medium">{item.label}</span>
                      {badge > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.to === '/health' || item.to === '/dlq'
                            ? 'bg-red-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}>
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
