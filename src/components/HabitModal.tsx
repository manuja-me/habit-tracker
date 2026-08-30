'use client';

import React, { useState, useEffect } from 'react';
import { Habit, HabitCategory, HabitFrequency, HabitType } from '../lib/types';
import { AVAILABLE_ICONS, COLOR_PALETTES } from '../lib/utils/icons';
import { X, Check } from 'lucide-react';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habitData: any) => void;
  editingHabit?: Habit | null;
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

export function HabitModal({
  isOpen,
  onClose,
  onSave,
  editingHabit,
}: HabitModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<HabitCategory>('productivity');
  const [color, setColor] = useState(COLOR_PALETTES[0].hex);
  const [icon, setIcon] = useState('Flame');
  const [type, setType] = useState<HabitType>('boolean');
  const [targetValue, setTargetValue] = useState<number>(1);
  const [targetUnit, setTargetUnit] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (editingHabit) {
      setTitle(editingHabit.title);
      setDescription(editingHabit.description || '');
      setCategory(editingHabit.category);
      setColor(editingHabit.color);
      setIcon(editingHabit.icon);
      setType(editingHabit.type);
      setTargetValue(editingHabit.target_value);
      setTargetUnit(editingHabit.target_unit || '');
      setFrequency(editingHabit.frequency);
      setCustomDays(editingHabit.custom_days || [1, 2, 3, 4, 5]);
    } else {
      setTitle('');
      setDescription('');
      setCategory('productivity');
      setColor(COLOR_PALETTES[0].hex);
      setIcon('Flame');
      setType('boolean');
      setTargetValue(1);
      setTargetUnit('');
      setFrequency('daily');
      setCustomDays([1, 2, 3, 4, 5]);
    }
  }, [editingHabit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
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

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 pt-3 sm:pt-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sub mb-1.5">
              HABIT NAME *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Read 20 Pages, Morning Workout"
              className="w-full px-3 py-2 sm:py-2.5 rounded-none bg-input border border-main text-xs sm:text-sm text-main placeholder-muted-custom focus:outline-none focus:border-emerald-500 transition-colors font-mono"
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
              className="w-full px-3 py-2 sm:py-2.5 rounded-none bg-input border border-main text-xs sm:text-sm text-main placeholder-muted-custom focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-sub mb-1.5">
              CATEGORY
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-none text-[11px] font-mono transition-all cursor-pointer touch-manipulation select-none ${
                    category === cat.id
                      ? 'bg-emerald-500 text-black font-bold border border-emerald-400'
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
              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                {COLOR_PALETTES.map((c) => (
                  <button
                    type="button"
                    key={c.name}
                    onClick={() => setColor(c.hex)}
                    className={`w-7 h-7 sm:w-6 sm:h-6 rounded-none flex items-center justify-center transition-all cursor-pointer touch-manipulation ${
                      color.toLowerCase() === c.hex.toLowerCase()
                        ? 'border-2 border-white scale-110 shadow-xs'
                        : 'opacity-80 hover:opacity-100 border border-subtle'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={c.name}
                  >
                    {color.toLowerCase() === c.hex.toLowerCase() && (
                      <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
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
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {Object.keys(AVAILABLE_ICONS).slice(0, 7).map((iconName) => {
                  const IconComp = AVAILABLE_ICONS[iconName];
                  const isSelected = icon === iconName;
                  return (
                    <button
                      type="button"
                      key={iconName}
                      onClick={() => setIcon(iconName)}
                      className={`w-7 h-7 rounded-none flex items-center justify-center transition-all flex-shrink-0 cursor-pointer touch-manipulation ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500'
                          : 'bg-input border border-main text-sub hover:text-main'
                      }`}
                      aria-label={iconName}
                    >
                      <IconComp className="w-3.5 h-3.5" />
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
                className={`py-2 px-2 sm:px-3 rounded-none text-xs font-mono font-medium border text-center transition-all cursor-pointer touch-manipulation ${
                  type === 'boolean'
                    ? 'bg-subtle border-emerald-500 text-main font-bold shadow-xs'
                    : 'bg-input border-main text-sub hover:text-main'
                }`}
              >
                CHECKBOX (YES/NO)
              </button>
              <button
                type="button"
                onClick={() => setType('number')}
                className={`py-2 px-2 sm:px-3 rounded-none text-xs font-mono font-medium border text-center transition-all cursor-pointer touch-manipulation ${
                  type === 'number'
                    ? 'bg-subtle border-emerald-500 text-main font-bold shadow-xs'
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
                    className="w-full px-3 py-1.5 rounded-none bg-card border border-main text-xs text-main focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-sub mb-1">UNIT (ML, PAGES, REPS)</label>
                  <input
                    type="text"
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    placeholder="ml, pages, reps"
                    className="w-full px-3 py-1.5 rounded-none bg-card border border-main text-xs text-main focus:outline-none focus:border-emerald-500 font-mono"
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
                  className={`py-2 px-1.5 sm:px-2.5 rounded-none text-xs font-mono font-medium border text-center transition-all cursor-pointer touch-manipulation ${
                    frequency === freq.id
                      ? 'bg-subtle border-emerald-500 text-main font-bold shadow-xs'
                      : 'bg-input border-main text-sub hover:text-main'
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>

            {frequency === 'custom' && (
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 p-2 rounded-none bg-input border border-subtle">
                {DAYS_OF_WEEK.map((item, idx) => {
                  const isSelected = customDays.includes(item.day);
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => toggleCustomDay(item.day)}
                      className={`h-8 sm:h-7 rounded-none text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center touch-manipulation ${
                        isSelected
                          ? 'bg-emerald-500 text-black border border-emerald-400 shadow-xs'
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
          <div className="flex items-center justify-end gap-2 pt-3 sm:pt-4 border-t border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono font-medium text-sub hover:text-main transition-colors cursor-pointer touch-manipulation"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-black rounded-none border border-emerald-400 active:scale-95 transition-all cursor-pointer touch-manipulation"
            >
              {editingHabit ? 'SAVE CHANGES' : 'CREATE HABIT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
