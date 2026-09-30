'use client';

import React, { useState, useEffect } from 'react';
import { Habit, HabitCategory, HabitFrequency, HabitType, HabitNature } from '../lib/types';
import { AVAILABLE_ICONS, COLOR_PALETTES } from '../lib/utils/icons';
import { X, Check, ShieldAlert, Sparkles, ShieldOff } from 'lucide-react';

export type WeaningProtocolType = 'exponential' | 'linear' | 'rapid' | 'none';

export interface HabitFormData {
  nature?: HabitNature;
  weaning?: {
    enabled: boolean;
    protocol: WeaningProtocolType;
  };
  title: string;
  description: string;
  category: HabitCategory;
  color: string;
  icon: string;
  type: HabitType;
  target_value: number;
  target_unit?: string;
  frequency: HabitFrequency;
  custom_days?: number[];
}

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habitData: HabitFormData) => void;
  editingHabit?: Habit | null;
  initialNature?: HabitNature;
}

const CATEGORIES: { id: HabitCategory; label: string }[] = [
  { id: 'productivity', label: 'PRODUCTIVITY' },
  { id: 'health', label: 'HEALTH' },
  { id: 'fitness', label: 'FITNESS' },
  { id: 'mindfulness', label: 'MINDFULNESS' },
  { id: 'learning', label: 'LEARNING' },
  { id: 'finance', label: 'FINANCE' },
  { id: 'lifestyle', label: 'LIFESTYLE' },
];

const DAYS_OF_WEEK = [
  { day: 1, label: 'M' },
  { day: 2, label: 'T' },
  { day: 3, label: 'W' },
  { day: 4, label: 'T' },
  { day: 5, label: 'F' },
  { day: 6, label: 'S' },
  { day: 0, label: 'S' },
];

export function HabitModal(props: HabitModalProps) {
  if (!props.isOpen) return null;
  const mountKey = props.editingHabit?.id || `new-${props.initialNature || 'do'}`;
  return <HabitModalDialog key={mountKey} {...props} />;
}

function HabitModalDialog({
  onClose,
  onSave,
  editingHabit,
  initialNature = 'do',
}: HabitModalProps) {
  const defaultNat = editingHabit?.nature || initialNature || 'do';
  const [nature, setNature] = useState<HabitNature>(defaultNat);
  const [weaningProtocol, setWeaningProtocol] = useState<WeaningProtocolType>(() => {
    if (editingHabit?.weaning?.enabled && editingHabit.weaning.protocol !== 'custom') {
      return editingHabit.weaning.protocol as WeaningProtocolType;
    }
    return 'exponential';
  });
  const [title, setTitle] = useState(editingHabit?.title || '');
  const [description, setDescription] = useState(editingHabit?.description || '');
  const [category, setCategory] = useState<HabitCategory>(
    editingHabit?.category || (defaultNat === 'dont' ? 'health' : 'productivity')
  );
  const [color, setColor] = useState(
    editingHabit?.color || (defaultNat === 'dont' ? '#FE8019' : COLOR_PALETTES[0].hex)
  );
  const [icon, setIcon] = useState(
    editingHabit?.icon || (defaultNat === 'dont' ? 'ShieldOff' : 'Flame')
  );
  const [type, setType] = useState<HabitType>(editingHabit?.type || 'boolean');
  const [targetValue, setTargetValue] = useState<number>(editingHabit?.target_value ?? 1);
  const [targetUnit, setTargetUnit] = useState(editingHabit?.target_unit || '');
  const [frequency, setFrequency] = useState<HabitFrequency>(editingHabit?.frequency || 'daily');
  const [customDays, setCustomDays] = useState<number[]>(editingHabit?.custom_days || [1, 2, 3, 4, 5]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      nature,
      weaning: nature === 'dont' ? {
        enabled: weaningProtocol !== 'none',
        protocol: weaningProtocol,
      } : undefined,
      title: title.trim(),
      description: description.trim(),
      category,
      color,
      icon,
      type,
      target_value: type === 'number' ? Number(targetValue) || 1 : 1,
      target_unit: type === 'number' ? targetUnit.trim() : undefined,
      frequency,
      custom_days: frequency === 'custom' ? customDays : undefined,
    });
    onClose();
  };

  const toggleCustomDay = (day: number) => {
    if (customDays.includes(day)) {
      setCustomDays(customDays.filter(d => d !== day));
    } else {
      setCustomDays([...customDays, day]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100 font-mono">
      <div className="w-full max-w-lg rounded-none bg-card border border-main p-4 sm:p-6 shadow-2xl overflow-y-auto max-h-[88vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-subtle">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-main">
            {editingHabit ? 'EDIT HABIT' : 'CREATE NEW HABIT'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-none text-sub hover:text-main hover:bg-subtle transition-colors cursor-pointer touch-manipulation"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nature Switcher: DO vs DON'T */}
        <div className="pt-3 pb-2 border-b border-subtle space-y-2">
          <div className="text-[10px] font-bold text-sub uppercase">ROUTINE TYPE</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setNature('do');
                if (color === '#FE8019') setColor(COLOR_PALETTES[0].hex);
              }}
              className={`p-2.5 text-left border transition-all cursor-pointer ${
                nature === 'do'
                  ? 'bg-[#FF3B30]/15 border-[#FF3B30] text-[#FF3B30]'
                  : 'bg-input border-subtle text-sub hover:border-main'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold font-mono uppercase">
                <Sparkles className="w-3.5 h-3.5 text-[#FF3B30]" />
                DO (BUILD)
              </div>
              <p className="text-[10px] text-sub mt-0.5 leading-tight">
                Positive routine to perform and check off daily.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setNature('dont');
                setColor('#FE8019');
                setIcon('ShieldOff');
              }}
              className={`p-2.5 text-left border transition-all cursor-pointer ${
                nature === 'dont'
                  ? 'bg-rose-500/15 border-rose-500 text-rose-400'
                  : 'bg-input border-subtle text-sub hover:border-main'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold font-mono uppercase">
                <ShieldOff className="w-3.5 h-3.5 text-rose-400" />
                DON&apos;T (QUIT)
              </div>
              <p className="text-[10px] text-sub mt-0.5 leading-tight">
                Addiction to avoid. Auto-clean daily unless you slip up.
              </p>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 pt-3 sm:pt-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sub mb-1.5">
              {nature === 'do' ? 'HABIT NAME *' : 'ADDICTION / HABIT TO STOP *'}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={nature === 'do' ? 'e.g. Read 20 Pages, Morning Workout' : 'e.g. Smoking Cigarettes, Junk Food, Late Night Phone'}
              className="w-full px-3.5 py-3 sm:py-2 rounded-none bg-input border border-main text-sm sm:text-sm text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30] transition-colors font-mono min-h-[44px] sm:min-h-[38px]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sub mb-1.5">
              DESCRIPTION (OPTIONAL)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, targets, reasons..."
              className="w-full px-3.5 py-3 sm:py-2 rounded-none bg-input border border-main text-sm sm:text-sm text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30] transition-colors font-mono min-h-[44px] sm:min-h-[38px]"
            />
          </div>

          {/* Weaning / Spacing Protocol (DON'T habits only) */}
          {nature === 'dont' && (
            <div className="p-3 sm:p-3 bg-input border border-rose-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  GRADUAL WEANING & TAPERING SCHEDULE
                </label>
                <span className="text-[10px] text-sub font-mono">SCIENTIFIC FADING</span>
              </div>
              <p className="text-[11px] sm:text-[10px] text-sub leading-tight">
                Instead of quitting cold turkey, expand clean days between indulgences to smoothly rewire dopamine pathways.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {[
                  { id: 'exponential' as const, title: 'EXPONENTIAL (RECOMMENDED)', desc: '1d → 2d → 4d → 7d → 14d → 21d → 30d' },
                  { id: 'linear' as const, title: 'LINEAR STEP (+1 DAY)', desc: '1d → 2d → 3d → 4d → 5d → 6d...' },
                  { id: 'rapid' as const, title: 'RAPID FADING', desc: '2d → 5d → 10d → 20d → 30d' },
                  { id: 'none' as const, title: 'STRICT / COLD TURKEY', desc: '100% clean every day, no tapering' },
                ].map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setWeaningProtocol(p.id)}
                    className={`p-2.5 sm:p-2 text-left border transition-all cursor-pointer touch-manipulation min-h-[48px] sm:min-h-[40px] ${
                      weaningProtocol === p.id
                        ? 'bg-rose-500/15 border-rose-500 text-rose-400'
                        : 'bg-card border-subtle text-sub hover:border-main'
                    }`}
                  >
                    <div className="text-xs sm:text-[10px] font-bold font-mono">{p.title}</div>
                    <div className="text-[10px] sm:text-[9px] text-sub truncate mt-0.5">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sub mb-1.5">
              CATEGORY
            </label>
            <div className="flex flex-wrap gap-1.5 sm:gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-2 sm:px-2.5 sm:py-1 rounded-none text-xs sm:text-[11px] font-mono transition-all cursor-pointer touch-manipulation select-none min-h-[38px] sm:min-h-0 flex items-center justify-center ${
                    category === cat.id
                      ? 'bg-[#FF3B30] text-white font-bold border border-[#FF3B30]'
                      : 'bg-input border border-main text-sub hover:text-main'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color & Icon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Color */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sub mb-2">
                COLOR
              </label>
              <div className="flex items-center gap-2 sm:gap-1.5 flex-wrap sm:flex-nowrap">
                {COLOR_PALETTES.map((c) => (
                  <button
                    type="button"
                    key={c.name}
                    onClick={() => setColor(c.hex)}
                    className={`w-9 h-9 sm:w-6 sm:h-6 rounded-none flex items-center justify-center transition-all cursor-pointer touch-manipulation active:scale-95 ${
                      color.toLowerCase() === c.hex.toLowerCase()
                        ? 'border-2 border-white scale-110 shadow-xs'
                        : 'opacity-80 hover:opacity-100 border border-subtle'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={c.name}
                  >
                    {color.toLowerCase() === c.hex.toLowerCase() && (
                      <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-black stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sub mb-2">
                ICON
              </label>
              <div className="flex items-center gap-2 sm:gap-1.5 overflow-x-auto pb-1">
                {Object.keys(AVAILABLE_ICONS).slice(0, 7).map((iconName) => {
                  const IconComp = AVAILABLE_ICONS[iconName];
                  const isSelected = icon === iconName;
                  return (
                    <button
                      type="button"
                      key={iconName}
                      onClick={() => setIcon(iconName)}
                      className={`w-9 h-9 sm:w-7 sm:h-7 rounded-none flex items-center justify-center transition-all flex-shrink-0 cursor-pointer touch-manipulation active:scale-95 ${
                        isSelected
                          ? 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]'
                          : 'bg-input border border-main text-sub hover:text-main'
                      }`}
                      aria-label={iconName}
                    >
                      <IconComp className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Habit Type */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sub mb-2">
              TYPE
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setType('boolean')}
                className={`h-11 sm:h-9 px-3 rounded-none text-xs font-mono font-medium border text-center transition-all cursor-pointer touch-manipulation flex items-center justify-center ${
                  type === 'boolean'
                    ? 'bg-subtle border-[#FF3B30] text-main font-bold shadow-xs'
                    : 'bg-input border-main text-sub hover:text-main'
                }`}
              >
                CHECKBOX (YES/NO)
              </button>
              <button
                type="button"
                onClick={() => setType('number')}
                className={`h-11 sm:h-9 px-3 rounded-none text-xs font-mono font-medium border text-center transition-all cursor-pointer touch-manipulation flex items-center justify-center ${
                  type === 'number'
                    ? 'bg-subtle border-[#FF3B30] text-main font-bold shadow-xs'
                    : 'bg-input border-main text-sub hover:text-main'
                }`}
              >
                MEASURABLE TARGET
              </button>
            </div>

            {type === 'number' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 p-3 rounded-none bg-input border border-subtle">
                <div>
                  <label className="block text-[10px] font-mono text-sub mb-1">TARGET VALUE</label>
                  <input
                    type="number"
                    min="1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(Number(e.target.value))}
                    className="w-full px-3 py-2.5 sm:py-1.5 rounded-none bg-card border border-main text-sm sm:text-xs text-main focus:outline-none focus:border-[#FF3B30] font-mono min-h-[40px] sm:min-h-0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-sub mb-1">UNIT (ML, PAGES, REPS)</label>
                  <input
                    type="text"
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    placeholder="ml, pages, reps"
                    className="w-full px-3 py-2.5 sm:py-1.5 rounded-none bg-card border border-main text-sm sm:text-xs text-main focus:outline-none focus:border-[#FF3B30] font-mono min-h-[40px] sm:min-h-0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sub mb-2">
              FREQUENCY
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { id: 'daily', label: 'DAILY' },
                { id: 'weekdays', label: 'WEEKDAYS' },
                { id: 'custom', label: 'CUSTOM' },
              ].map((freq) => (
                <button
                  type="button"
                  key={freq.id}
                  onClick={() => setFrequency(freq.id as HabitFrequency)}
                  className={`h-11 sm:h-9 px-2 rounded-none text-xs font-mono font-medium border text-center transition-all cursor-pointer touch-manipulation flex items-center justify-center ${
                    frequency === freq.id
                      ? 'bg-subtle border-[#FF3B30] text-main font-bold shadow-xs'
                      : 'bg-input border-main text-sub hover:text-main'
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>

            {frequency === 'custom' && (
              <div className="grid grid-cols-7 gap-1.5 sm:gap-1.5 p-2.5 rounded-none bg-input border border-subtle">
                {DAYS_OF_WEEK.map((item, idx) => {
                  const isSelected = customDays.includes(item.day);
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => toggleCustomDay(item.day)}
                      className={`h-10 sm:h-7 rounded-none text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center touch-manipulation ${
                        isSelected
                          ? 'bg-[#FF3B30] text-white border border-[#FF3B30] shadow-xs'
                          : 'text-sub hover:text-main'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-4 sm:pt-4 border-t border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="h-11 sm:h-9 px-4 text-xs font-mono font-bold text-sub hover:text-main transition-colors cursor-pointer touch-manipulation flex items-center justify-center uppercase"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="h-11 sm:h-9 px-6 text-xs font-sans font-black bg-[#FF3B30] hover:bg-[#E02D24] text-white rounded-none border border-[#FF3B30] active:scale-95 transition-all cursor-pointer touch-manipulation flex items-center justify-center uppercase tracking-tight shadow-xs"
            >
              {editingHabit ? 'SAVE CHANGES' : 'INITIALIZE ROUTINE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
