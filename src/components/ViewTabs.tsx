'use client';

import React from 'react';
import { CheckSquare, Calendar, PenLine, Activity, BarChart2 } from 'lucide-react';

export type ActiveTab = 'today' | 'week' | 'planner' | 'heatmap' | 'analytics';

interface ViewTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export function ViewTabs({ activeTab, onTabChange }: ViewTabsProps) {
  const tabs: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'today', label: 'TODAY', icon: CheckSquare },
    { id: 'week', label: 'WEEK', icon: Calendar },
    { id: 'planner', label: 'PLANNER', icon: PenLine },
    { id: 'heatmap', label: 'HEATMAP', icon: Activity },
    { id: 'analytics', label: 'ANALYTICS', icon: BarChart2 },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-3.5 sm:px-6 mb-4 sm:mb-6">
      <div className="grid grid-cols-5 bg-card border border-main rounded-none max-w-xl mx-auto sm:mx-0 shadow-xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 h-12 sm:h-10 px-1.5 sm:px-2 rounded-none text-[11px] sm:text-xs font-sans font-black tracking-tight uppercase transition-all cursor-pointer touch-manipulation select-none border-r border-main last:border-r-0 active:scale-95 ${
                isActive
                  ? 'bg-subtle text-main border-b-2 border-b-[#FF3B30]'
                  : 'text-sub hover:text-main hover:bg-subtle/40'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 flex-shrink-0 ${isActive ? 'text-[#FF3B30]' : 'text-sub'}`} />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
