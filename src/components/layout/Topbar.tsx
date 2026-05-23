import React, { useState } from 'react';
import { Search, Bell, HelpCircle, ChevronDown, User, LogOut, Keyboard, Settings, Sparkles } from 'lucide-react';
import { Dropdown } from '../ui';
import { useAuth } from '../../hooks/useAuth';

interface TopbarProps {
  onCommandPalette?: () => void;
  notificationCount?: number;
}

export function Topbar({ onCommandPalette, notificationCount = 0 }: TopbarProps) {
  const { user, tenant, brand, signOut } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="h-13 flex items-center justify-between px-4 bg-[#111318] border-b border-[#1E2130] flex-shrink-0 z-30" style={{ height: 52 }}>
      {/* Left: Brand switcher + breadcrumb */}
      <div className="flex items-center gap-3">
        {brand && (
          <Dropdown
            trigger={
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A1C24] border border-[#2A2E42] hover:bg-[#222530] transition-colors">
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

      {/* Center: Global search */}
      <div className="flex-1 max-w-xs mx-4">
        <button
          onClick={onCommandPalette}
          className={`w-full flex items-center gap-2 h-8 px-3 rounded-lg text-sm transition-all border ${searchFocused ? 'border-blue-500 bg-[#1A1C24]' : 'border-[#2A2E42] bg-[#1A1C24] hover:bg-[#222530]'}`}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        >
          <Search className="w-3.5 h-3.5 text-[#4B5068] flex-shrink-0" />
          <span className="text-[#4B5068] flex-1 text-left">Search contacts, flows...</span>
          <kbd className="text-[10px] text-[#4B5068] bg-[#222530] px-1.5 py-0.5 rounded border border-[#2A2E42] font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-[#8B90A7] hover:bg-[#1A1C24] hover:text-[#F0F2FF] transition-colors">
          <Sparkles className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-400 rounded-full" />
        </button>

        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-[#8B90A7] hover:bg-[#1A1C24] hover:text-[#F0F2FF] transition-colors">
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
              {notificationCount}
            </span>
          )}
        </button>

        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8B90A7] hover:bg-[#1A1C24] hover:text-[#F0F2FF] transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>

        <Dropdown
          trigger={
            <button className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold hover:opacity-90 transition-opacity ml-1">
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
