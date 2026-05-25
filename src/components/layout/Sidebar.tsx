import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, Zap, Users, BarChart3, Megaphone,
  Brain, Link2, Puzzle, Activity, AlertOctagon, FileText,
  Settings, ChevronLeft, ChevronRight, Wifi, Menu, Rocket, Filter, ShoppingBag
} from 'lucide-react';

interface SidebarProps {
  dlqCount?: number;
  brokenAccounts?: number;
  unreadInbox?: number;
}

const navItems = [
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
    { to: '/growth-tools', icon: Rocket, label: 'Growth Tools' },
    { to: '/segments', icon: Filter, label: 'Segments' },
    { to: '/ecommerce', icon: ShoppingBag, label: 'E-commerce' },
    { to: '/links', icon: Link2, label: 'Short Links' },
    { to: '/integrations', icon: Puzzle, label: 'Integrations' },
  ]},
  { group: 'MANAGEMENT', items: [
    { to: '/health', icon: Activity, label: 'Token Health' },
    { to: '/dlq', icon: AlertOctagon, label: 'DLQ Replay' },
    { to: '/templates', icon: FileText, label: 'Templates' },
  ]},
];

interface ExtendedSidebarProps extends SidebarProps {
  onMenuClick?: () => void;
}

export function Sidebar({ dlqCount = 0, brokenAccounts = 0, unreadInbox = 0, onMenuClick }: ExtendedSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside className={`flex flex-col h-full bg-[#111318] border-r border-[#1E2130] transition-all duration-200 ${collapsed ? 'w-14' : 'w-60'} flex-shrink-0 hidden md:flex`}>
      {/* Logo area */}
      <div className="h-14 flex items-center px-4 border-b border-[#1E2130]">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-[#F0F2FF] tracking-tight">FlowPulse</span>
          </div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto">
            <Wifi className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {navItems.map(group => (
          <div key={group.group}>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-widest px-3 mb-1">{group.group}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
                const badge = item.to === '/dlq' ? dlqCount
                  : item.to === '/health' ? brokenAccounts
                  : item.to === '/inbox' ? unreadInbox
                  : 0;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-100 group relative ${
                      isActive
                        ? 'bg-blue-500/10 text-[#F0F2FF] border-l-2 border-blue-500 -ml-px pl-[11px]'
                        : 'text-[#8B90A7] hover:bg-[#1A1C24] hover:text-[#F0F2FF]'
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 font-medium">{item.label}</span>
                        {badge > 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0 rounded-full ${item.to === '/health' || item.to === '/dlq' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[#1E2130] p-2 space-y-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${isActive ? 'bg-blue-500/10 text-[#F0F2FF]' : 'text-[#8B90A7] hover:bg-[#1A1C24] hover:text-[#F0F2FF]'}`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="font-medium">Settings</span>}
        </NavLink>
        <button
          onClick={() => setCollapsed(p => !p)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#4B5068] hover:bg-[#1A1C24] hover:text-[#F0F2FF] transition-all w-full"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span className="font-medium">Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
