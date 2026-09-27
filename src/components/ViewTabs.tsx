'use client';

import React from 'react';
import { CheckSquare, Calendar, PenLine, Activity, BarChart2, Users } from 'lucide-react';

export type ActiveTab = 'today' | 'week' | 'planner' | 'heatmap' | 'analytics' | 'admin';

interface ViewTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isAdmin?: boolean;
}

export function ViewTabs({ activeTab, onTabChange, isAdmin = false }: ViewTabsProps) {
  const tabs: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'today', label: 'Today', icon: CheckSquare },
    { id: 'week', label: 'Week', icon: Calendar },
    { id: 'planner', label: 'Planner', icon: PenLine },
    { id: 'heatmap', label: 'Heatmap', icon: Activity },
    { id: 'analytics', label: 'Stats', icon: BarChart2 },
  ];

  if (isAdmin) {
    tabs.push({ id: 'admin', label: 'Users', icon: Users });
  }

  return (
    <div className="w-full max-w-4xl xl:max-w-7xl mx-auto px-4 sm:px-6 mb-5">
      <div className="flex items-center gap-1 border-b border-subtle overflow-x-auto scrollbar-none pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 h-9 px-3.5 text-xs font-sans font-bold uppercase tracking-tight transition-all cursor-pointer whitespace-nowrap select-none border-b-2 -mb-px ${
                isActive
                  ? 'border-[#FF3B30] text-main font-black'
                  : 'border-transparent text-sub hover:text-main hover:border-subtle'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FF3B30]' : 'text-sub'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
