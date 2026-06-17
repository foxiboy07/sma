import React, { useState, useEffect } from 'react';
import { Search, Bell, HelpCircle, ChevronDown, User, LogOut, Keyboard, Settings, Sparkles, X, Check, ExternalLink, Menu } from 'lucide-react';
import { Dropdown } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { realtimeApi } from '../../lib/api';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  is_read: boolean;
  created_at: string;
  action_url: string | null;
}

interface TopbarProps {
  onCommandPalette?: () => void;
  onMenuClick?: () => void;
}

export function Topbar({ onCommandPalette, onMenuClick }: TopbarProps) {
  const { user, tenant, brand, signOut } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  useEffect(() => {
    if (!tenant?.id) return;

    async function fetchNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    }

    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('topbar-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `tenant_id=eq.${tenant.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev.slice(0, 19)]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  // Mark notification as read
  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  // Mark all as read
  async function markAllAsRead() {
    if (!tenant?.id) return;
    await realtimeApi.markAllRead(tenant.id, user?.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  const typeIcons: Record<string, React.ReactNode> = {
    'inbox.new_message': <Sparkles className="w-3.5 h-3.5 text-blue-400" />,
    'inbox.sentiment_alert': <Bell className="w-3.5 h-3.5 text-red-400" />,
    'account.token_broken': <Bell className="w-3.5 h-3.5 text-red-400" />,
    'account.circuit_open': <Bell className="w-3.5 h-3.5 text-amber-400" />,
    'dlq.message_added': <Bell className="w-3.5 h-3.5 text-amber-400" />,
    default: <Bell className="w-3.5 h-3.5 text-[#8B90A7]" />,
  };

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-[#111318] border-b border-[#1E2130] flex-shrink-0 z-30 safe-area-inset-top">
      {/* Left: Mobile menu + Brand */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[#8B90A7] hover:bg-[#1A1C24] active:bg-[#222530] transition-colors md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Logo */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Desktop Brand Switcher */}
        {brand && (
          <Dropdown
            trigger={
              <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A1C24] border border-[#2A2E42] hover:bg-[#222530] transition-colors">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-cyan-400 flex-shrink-0" />
                <span className="text-sm font-medium text-[#F0F2FF] max-w-[120px] truncate">{brand.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#4B5068]" />
              </button>
            }
            items={[
              { label: brand.name, icon: <div className="w-4 h-4 rounded bg-blue-500" /> },
              { divider: true },
              { label: '+ Add Brand', onClick: () => {} },
            ]}
            align="left"
          />
        )}
      </div>

      {/* Center: Global search (hidden on mobile) */}
      <div className="flex-1 max-w-xs mx-4 hidden md:block">
        <button
          onClick={onCommandPalette}
          className={`w-full flex items-center gap-2 h-8 px-3 rounded-lg text-sm transition-all border ${searchFocused ? 'border-blue-500 bg-[#1A1C24]' : 'border-[#2A2E42] bg-[#1A1C24] hover:bg-[#222530]'}`}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        >
          <Search className="w-3.5 h-3.5 text-[#4B5068] flex-shrink-0" />
          <span className="text-[#4B5068] flex-1 text-left">Search contacts, flows...</span>
          <kbd className="text-[10px] text-[#4B5068] bg-[#222530] px-1.5 py-0.5 rounded border border-[#2A2E42] font-mono">Ctrl+K</kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Mobile Search Button */}
        <button
          onClick={onCommandPalette}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[#8B90A7] hover:bg-[#1A1C24] active:bg-[#222530] transition-colors md:hidden"
        >
          <Search className="w-5 h-5" />
        </button>

        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-[#8B90A7] hover:bg-[#1A1C24] active:bg-[#222530] transition-colors hidden md:flex">
          <Sparkles className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-400 rounded-full" />
        </button>

        {/* Notifications dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg text-[#8B90A7] hover:bg-[#1A1C24] active:bg-[#222530] transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-4.5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />

              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-1 w-80 bg-[#1A1C24] border border-[#2A2E42] rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2E42]">
                  <h3 className="text-sm font-semibold text-[#F0F2FF]">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-[320px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell className="w-8 h-8 text-[#4B5068] mx-auto mb-2" />
                      <p className="text-xs text-[#8B90A7]">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => markAsRead(notif.id)}
                        className={`px-4 py-3 border-b border-[#1E2130] cursor-pointer hover:bg-[#222530] transition-colors ${!notif.is_read ? 'bg-blue-500/5' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg bg-[#222530] flex items-center justify-center flex-shrink-0">
                            {typeIcons[notif.type] || typeIcons.default}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-[#F0F2FF] truncate">{notif.title}</span>
                              {!notif.is_read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                              )}
                            </div>
                            {notif.description && (
                              <p className="text-[11px] text-[#8B90A7] line-clamp-2">{notif.description}</p>
                            )}
                            <p className="text-[10px] text-[#4B5068] mt-1">
                              {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          {notif.action_url && (
                            <a
                              href={notif.action_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#4B5068] hover:text-[#F0F2FF]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <button className="w-9 h-9 flex items-center justify-center rounded-lg text-[#8B90A7] hover:bg-[#1A1C24] active:bg-[#222530] transition-colors hidden md:flex">
          <HelpCircle className="w-4 h-4" />
        </button>

        <Dropdown
          trigger={
            <button className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold hover:opacity-90 active:opacity-80 transition-opacity ml-1">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </button>
          }
          items={[
            { label: user?.email || 'Account', icon: <User className="w-4 h-4" /> },
            { label: 'Settings', icon: <Settings className="w-4 h-4" />, onClick: () => {} },
            { label: 'Keyboard shortcuts', icon: <Keyboard className="w-4 h-4" />, onClick: () => {} },
            { divider: true },
            { label: 'Sign out', icon: <LogOut className="w-4 h-4" />, onClick: signOut, danger: true },
          ]}
        />
      </div>
    </header>
  );
}
