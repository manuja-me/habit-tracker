'use client';

import React from 'react';
import { CheckSquare, Calendar, Activity, BarChart2 } from 'lucide-react';

export type ActiveTab = 'today' | 'week' | 'heatmap' | 'analytics';

interface ViewTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export function ViewTabs({ activeTab, onTabChange }: ViewTabsProps) {
  const tabs: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'today', label: 'TODAY', icon: CheckSquare },
    { id: 'week', label: 'WEEK', icon: Calendar },
    { id: 'heatmap', label: 'HEATMAP', icon: Activity },
    { id: 'analytics', label: 'ANALYTICS', icon: BarChart2 },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 mb-6">
      <div className="flex items-center p-0.5 bg-card border border-main rounded-none max-w-md mx-auto sm:mx-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-none text-xs font-mono font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-subtle text-main border border-main font-bold shadow-xs'
                  : 'text-sub hover:text-main hover:bg-subtle/50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-500' : 'text-sub'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
