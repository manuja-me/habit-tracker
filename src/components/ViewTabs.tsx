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
    { id: 'today', label: 'Today', icon: CheckSquare },
    { id: 'week', label: 'Week View', icon: Calendar },
    { id: 'heatmap', label: 'Heatmap', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 mb-6">
      <div className="flex items-center p-1 bg-neutral-900/90 border border-neutral-800 rounded-xl max-w-md mx-auto sm:mx-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-neutral-800 text-white shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-neutral-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
