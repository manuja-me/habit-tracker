'use client';

import React, { useState, useEffect } from 'react';
import { Habit, HabitCategory, HabitFrequency, HabitType } from '../lib/types';
import { AVAILABLE_ICONS, COLOR_PALETTES } from '../lib/utils/icons';
import { X, Check, Target, Sparkles } from 'lucide-react';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habitData: any) => void;
  editingHabit?: Habit | null;
}

const CATEGORIES: { id: HabitCategory; label: string }[] = [
  { id: 'productivity', label: 'Productivity' },
  { id: 'health', label: 'Health' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'mindfulness', label: 'Mindfulness' },
  { id: 'learning', label: 'Learning' },
  { id: 'finance', label: 'Finance' },
  { id: 'lifestyle', label: 'Lifestyle' },
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
      // Reset form
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-white">
            {editingHabit ? 'Edit Habit' : 'Create New Habit'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 pt-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Habit Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Read 20 Pages, Morning Workout, Meditate"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why this habit matters to you..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    category === cat.id
                      ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                      : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color & Icon Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Color Palette */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                Color Accent
              </label>
              <div className="flex items-center gap-2">
                {COLOR_PALETTES.map((c) => (
                  <button
                    type="button"
                    key={c.name}
                    onClick={() => setColor(c.hex)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      color.toLowerCase() === c.hex.toLowerCase()
                        ? 'ring-2 ring-white scale-110'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {color.toLowerCase() === c.hex.toLowerCase() && (
                      <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                Icon
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {Object.keys(AVAILABLE_ICONS).slice(0, 7).map((iconName) => {
                  const IconComp = AVAILABLE_ICONS[iconName];
                  const isSelected = icon === iconName;
                  return (
                    <button
                      type="button"
                      key={iconName}
                      onClick={() => setIcon(iconName)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500'
                          : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Habit Type (Yes/No vs Numeric Target) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Habit Type
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                onClick={() => setType('boolean')}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                  type === 'boolean'
                    ? 'bg-neutral-800 border-emerald-500 text-white font-semibold'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Yes / No (Checkbox)
              </button>
              <button
                type="button"
                onClick={() => setType('number')}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                  type === 'number'
                    ? 'bg-neutral-800 border-emerald-500 text-white font-semibold'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Measurable Target
              </button>
            </div>

            {type === 'number' && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">Target Amount</label>
                  <input
                    type="number"
                    min="1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">Unit (e.g. ml, mins, pages)</label>
                  <input
                    type="text"
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    placeholder="ml, pages, reps"
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Frequency Schedule
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { id: 'daily', label: 'Every Day' },
                { id: 'weekdays', label: 'Weekdays' },
                { id: 'custom', label: 'Custom' },
              ].map((freq) => (
                <button
                  type="button"
                  key={freq.id}
                  onClick={() => setFrequency(freq.id as HabitFrequency)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all ${
                    frequency === freq.id
                      ? 'bg-neutral-800 border-emerald-500 text-white font-semibold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>

            {frequency === 'custom' && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-950 border border-neutral-800">
                {DAYS_OF_WEEK.map((item, idx) => {
                  const isSelected = customDays.includes(item.day);
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => toggleCustomDay(item.day)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-black shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-200'
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
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
            >
              {editingHabit ? 'Save Changes' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
