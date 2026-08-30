import React from 'react';
import {
  Flame,
  Droplets,
  BookOpen,
  Dumbbell,
  Sparkles,
  Focus,
  Moon,
  Sun,
  Coffee,
  Code,
  Heart,
  Bike,
  Smile,
  Zap,
  Target,
  Clock,
  Compass,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  Award,
  Calendar,
  LucideIcon
} from 'lucide-react';

export const AVAILABLE_ICONS: Record<string, LucideIcon> = {
  Flame,
  Droplets,
  BookOpen,
  Dumbbell,
  Sparkles,
  Focus,
  Moon,
  Sun,
  Coffee,
  Code,
  Heart,
  Bike,
  Smile,
  Zap,
  Target,
  Clock,
  Compass,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  Award,
  Calendar,
};

export const COLOR_PALETTES = [
  { name: 'Emerald', hex: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399' },
  { name: 'Indigo', hex: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)', text: '#818CF8' },
  { name: 'Cyan', hex: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', text: '#22D3EE' },
  { name: 'Amber', hex: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24' },
  { name: 'Rose', hex: '#F43F5E', bg: 'rgba(244, 63, 94, 0.15)', text: '#FB7185' },
  { name: 'Violet', hex: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', text: '#A78BFA' },
  { name: 'Zinc', hex: '#71717A', bg: 'rgba(113, 113, 122, 0.15)', text: '#A1A1AA' },
];

export function getHabitIcon(iconName: string): LucideIcon {
  return AVAILABLE_ICONS[iconName] || Target;
}
