import { subDays, format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Habit, HabitLog } from '../types';
import { getTodayDateString, isHabitDueOnDate } from './date';
import { isDaySuccessful, calculateHabitStats, calculateMilestones, MILESTONE_DEFINITIONS, MilestoneBadge } from './streaks';

// Re-export streak milestone bridge for backward compatibility
export { calculateMilestones, MILESTONE_DEFINITIONS };
export type { MilestoneBadge };

/* ==========================================================================
   1. PRESTIGE TIERS & LEVEL FORMULA
   ========================================================================== */

export type PrestigeTierId = 
  | 'novice' 
  | 'consistent' 
  | 'vanguard' 
  | 'ironclad' 
  | 'master' 
  | 'titan' 
  | 'pantheon';

export interface PrestigeTier {
  id: PrestigeTierId;
  name: string;
  minLevel: number;
  maxLevel: number;
  color: string;
  badge: string;
  title: string;
}

export const PRESTIGE_TIERS: PrestigeTier[] = [
  { id: 'novice', name: 'Novice', minLevel: 1, maxLevel: 4, color: '#94A3B8', badge: '⚪', title: 'The Initiate' },
  { id: 'consistent', name: 'Consistent', minLevel: 5, maxLevel: 9, color: '#38BDF8', badge: '🔷', title: 'The Resolute' },
  { id: 'vanguard', name: 'Vanguard', minLevel: 10, maxLevel: 19, color: '#22C55E', badge: '🛡️', title: 'The Frontline' },
  { id: 'ironclad', name: 'Ironclad', minLevel: 20, maxLevel: 34, color: '#EAB308', badge: '⚡', title: 'The Unyielding' },
  { id: 'master', name: 'Master', minLevel: 35, maxLevel: 49, color: '#F97316', badge: '⚔️', title: 'The Sovereign' },
  { id: 'titan', name: 'Titan', minLevel: 50, maxLevel: 74, color: '#FF3B30', badge: '🔥', title: 'The Colossus' },
  { id: 'pantheon', name: 'Pantheon', minLevel: 75, maxLevel: Infinity, color: '#A855F7', badge: '👑', title: 'The Immortal' },
];

/**
 * Calibrated cumulative XP formula:
 * XP_Required(L) = floor(65 * (L - 1)^1.75 + 85 * (L - 1))
 */
export function getXpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(65 * Math.pow(level - 1, 1.75) + 85 * (level - 1));
}

export function getTierForLevel(level: number): PrestigeTier {
  for (const tier of PRESTIGE_TIERS) {
    if (level >= tier.minLevel && level <= tier.maxLevel) {
      return tier;
    }
  }
  return PRESTIGE_TIERS[PRESTIGE_TIERS.length - 1];
}

export function calculateLevelFromXp(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  tier: PrestigeTier;
} {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let level = 1;

  // Search forward for current level
  while (getXpRequiredForLevel(level + 1) <= safeXp) {
    level++;
    if (level >= 999) break; // safety bound
  }

  const baseForCurrent = getXpRequiredForLevel(level);
  const baseForNext = getXpRequiredForLevel(level + 1);
  const currentLevelXp = safeXp - baseForCurrent;
  const nextLevelXp = Math.max(1, baseForNext - baseForCurrent);
  const progressPercent = Math.min(100, Math.max(0, Math.floor((currentLevelXp / nextLevelXp) * 100)));
  const tier = getTierForLevel(level);

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    progressPercent,
    tier,
  };
}

/* ==========================================================================
   2. DAILY QUESTS
   ========================================================================== */

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  completed: boolean;
  currentProgress: number;
  targetProgress: number;
}

function hashDateString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateDailyQuests(
  habits: Habit[],
  logs: Record<string, HabitLog>,
  dateStr: string = getTodayDateString()
): DailyQuest[] {
  const dueHabits = habits.filter((h) => !h.archived && isHabitDueOnDate(h, dateStr));
  const completedDue = dueHabits.filter((h) => isDaySuccessful(h, dateStr, logs));
  const dontHabits = dueHabits.filter((h) => h.nature === 'dont');
  const cleanDontCount = dontHabits.filter((h) => isDaySuccessful(h, dateStr, logs)).length;
  const numberHabits = dueHabits.filter((h) => h.type === 'number');

  const totalDue = dueHabits.length;
  const totalCompleted = completedDue.length;

  if (totalDue === 0) {
    return [
      {
        id: `quest-${dateStr}-1`,
        title: 'Calm Sanctuary',
        description: 'No habits scheduled for today. Rest and recharge.',
        xpReward: 0,
        completed: true,
        currentProgress: 1,
        targetProgress: 1,
      },
      {
        id: `quest-${dateStr}-2`,
        title: 'Plan Ahead',
        description: 'Review your upcoming habits in the planner.',
        xpReward: 0,
        completed: true,
        currentProgress: 1,
        targetProgress: 1,
      },
      {
        id: `quest-${dateStr}-3`,
        title: 'Preserve Focus',
        description: 'Zero pending tasks. Discipline intact.',
        xpReward: 0,
        completed: true,
        currentProgress: 1,
        targetProgress: 1,
      },
    ];
  }

  const quests: DailyQuest[] = [];

  // Action habits are habits that require an active check-in ('do' habits or 'number' habits)
  const actionHabits = dueHabits.filter((h) => h.nature !== 'dont');
  const completedActionHabits = actionHabits.filter((h) => isDaySuccessful(h, dateStr, logs));
  const hasFirstStep = actionHabits.length > 0 
    ? completedActionHabits.length >= 1 
    : cleanDontCount >= 1;

  // Quest 1: Early Vanguard (First check-in)
  quests.push({
    id: `quest-${dateStr}-vanguard`,
    title: 'First Step',
    description: actionHabits.length > 0 
      ? 'Complete at least 1 habit scheduled for today' 
      : 'Maintain your clean streak today',
    xpReward: 20,
    completed: hasFirstStep,
    currentProgress: hasFirstStep ? 1 : 0,
    targetProgress: 1,
  });

  // Quest 2: Contextual middle quest
  if (dontHabits.length > 0) {
    quests.push({
      id: `quest-${dateStr}-ironwill`,
      title: 'Iron Will',
      description: `Keep all ${dontHabits.length} clean/quit habit${dontHabits.length > 1 ? 's' : ''} unbroken today`,
      xpReward: 35,
      completed: cleanDontCount === dontHabits.length,
      currentProgress: cleanDontCount,
      targetProgress: dontHabits.length,
    });
  } else if (numberHabits.length > 0) {
    const numCompleted = numberHabits.filter((h) => isDaySuccessful(h, dateStr, logs)).length;
    quests.push({
      id: `quest-${dateStr}-metric`,
      title: 'Target Locked',
      description: 'Hit the goal on at least 1 measurable number habit',
      xpReward: 30,
      completed: numCompleted >= 1,
      currentProgress: Math.min(1, numCompleted),
      targetProgress: 1,
    });
  } else if (totalDue >= 2) {
    const useFocus = hashDateString(dateStr) % 2 === 1;
    if (useFocus) {
      const focusIndex = hashDateString(dateStr) % totalDue;
      const targetHabit = dueHabits[focusIndex];
      const isTargetDone = isDaySuccessful(targetHabit, dateStr, logs);
      quests.push({
        id: `quest-${dateStr}-focus`,
        title: 'Priority Objective',
        description: `Complete "${targetHabit.title}" today`,
        xpReward: 35,
        completed: isTargetDone,
        currentProgress: isTargetDone ? 1 : 0,
        targetProgress: 1,
      });
    } else {
      const halfTarget = Math.ceil(totalDue / 2);
      quests.push({
        id: `quest-${dateStr}-halfway`,
        title: 'Momentum Builder',
        description: `Complete at least ${halfTarget} of ${totalDue} habits today`,
        xpReward: 30,
        completed: totalCompleted >= halfTarget,
        currentProgress: Math.min(halfTarget, totalCompleted),
        targetProgress: halfTarget,
      });
    }
  } else {
    // Single habit due: focus quest
    quests.push({
      id: `quest-${dateStr}-focus`,
      title: 'Singular Focus',
      description: `Complete "${dueHabits[0].title}"`,
      xpReward: 25,
      completed: totalCompleted === 1,
      currentProgress: totalCompleted,
      targetProgress: 1,
    });
  }

  // Quest 3: Flawless Execution (100% daily completion)
  quests.push({
    id: `quest-${dateStr}-flawless`,
    title: 'Flawless Execution',
    description: `Achieve 100% completion across all ${totalDue} scheduled habit${totalDue > 1 ? 's' : ''}`,
    xpReward: 50,
    completed: totalCompleted === totalDue && totalDue > 0,
    currentProgress: totalCompleted,
    targetProgress: totalDue,
  });

  return quests;
}

/* ==========================================================================
   3. 24-ACHIEVEMENT CODEX
   ========================================================================== */

export type AchievementCategory = 'flame' | 'forge' | 'stoic' | 'alchemist' | 'phoenix';

export interface Achievement {
  id: string;
  category: AchievementCategory;
  title: string;
  subtitle: string;
  description: string;
  iconName: string;
  color: string;
  unlocked: boolean;
  currentProgress: number;
  targetProgress: number;
  progressPercent: number;
}

interface AchievementDefinition {
  id: string;
  category: AchievementCategory;
  title: string;
  subtitle: string;
  description: string;
  iconName: string;
  color: string;
  target: number;
  evaluator: (ctx: AchievementContext) => number;
}

interface AchievementContext {
  bestStreak: number;
  totalCompletions: number;
  bestCleanStreak: number;
  distinctCategories: number;
  comebackCount: number;
}

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // 1. FLAME (11 Streak Milestones)
  {
    id: 'flame-3',
    category: 'flame',
    title: 'SPARK',
    subtitle: '3 Days Consecutive',
    description: 'Maintain an unbroken habit streak for 3 days.',
    iconName: 'Zap',
    color: '#38BDF8',
    target: 3,
    evaluator: (ctx) => ctx.bestStreak,
  },
  {
    id: 'flame-7',
    category: 'flame',
    title: 'IGNITION',
    subtitle: '1 Week Unbroken',
    description: 'Maintain an unbroken habit streak for 7 days.',
    iconName: 'Flame',
    color: '#F59E0B',
    target: 7,
    evaluator: (ctx) => ctx.bestStreak,
  },
  {
    id: 'flame-14',
    category: 'flame',
    title: 'MOMENTUM',
    subtitle: '2 Weeks Strong',
    description: 'Maintain an unbroken habit streak for 14 days.',
    iconName: 'TrendingUp',
    color: '#FF3B30',
    target: 14,
    evaluator: (ctx) => ctx.bestStreak,
  },
  {
    id: 'flame-21',
    category: 'flame',
    title: 'HABIT LOOP',
    subtitle: '21 Days Formed',
    description: 'Neurological habit formation window unlocked.',
    iconName: 'Activity',
    color: '#06B6D4',
    target: 21,
    evaluator: (ctx) => ctx.bestStreak,
  },
  {
    id: 'flame-30',
    category: 'flame',
    title: 'IRON WILL',
    subtitle: '1 Month Discipline',
    description: 'A full month of relentless consistency.',
    iconName: 'ShieldCheck',
    color: '#6366F1',
    target: 30,
    evaluator: (ctx) => ctx.bestStreak,
  },
  {
    id: 'flame-60',
    category: 'flame',
    title: 'DIAMOND',
    subtitle: '60 Days Automatic',
    description: 'Habits become an effortless subconscious routine.',
    iconName: 'Sparkles',
    color: '#8B5CF6',
    target: 60,
    evaluator: (ctx) => ctx.bestStreak,
  },
  {
    id: 'flame-100',
    category: 'flame',
    title: 'CENTURY',
    subtitle: '100 Days Triple Digits',
    description: 'Cross into the elite triple-digit streak realm.',
    iconName: 'Trophy',
    color: '#EC4899',
    target: 100,
    evaluator: (ctx) => ctx.bestStreak,
  },
  {
    id: 'flame-180',
    category: 'flame',
    title: 'HALF YEAR',
    subtitle: '6 Months Mastery',
    description: 'Half a year of unbroken daily discipline.',
    iconName: 'Star',
    color: '#F43F5E',
    target: 180,
    evaluator: (ctx) => ctx.bestStreak,
  },
  {
    id: 'flame-365',
    category: 'flame',
    title: 'LEGEND',
    subtitle: '1 Full Year Elite',
    description: '365 consecutive days. True mastery achieved.',
    iconName: 'Crown',
    color: '#EAB308',
    target: 365,
    evaluator: (ctx) => ctx.bestStreak,
  },
  {
    id: 'flame-500',
    category: 'flame',
    title: 'TITAN',
    subtitle: '500 Days Unstoppable',
    description: '500 days of absolute commitment and resilience.',
    iconName: 'Medal',
    color: '#F97316',
    target: 500,
    evaluator: (ctx) => ctx.bestStreak,
  },
  {
    id: 'flame-1000',
    category: 'flame',
    title: 'IMMORTAL',
    subtitle: '1,000 Days Pantheon',
    description: '1,000 days. Immortalized in habit tracking history.',
    iconName: 'Flame',
    color: '#FF3B30',
    target: 1000,
    evaluator: (ctx) => ctx.bestStreak,
  },

  // 2. FORGE (6 Volume Completions)
  {
    id: 'forge-50',
    category: 'forge',
    title: 'APPRENTICE',
    subtitle: '50 Check-Ins',
    description: 'Log 50 total habit completions across history.',
    iconName: 'CheckCircle2',
    color: '#38BDF8',
    target: 50,
    evaluator: (ctx) => ctx.totalCompletions,
  },
  {
    id: 'forge-100',
    category: 'forge',
    title: 'CENTURION',
    subtitle: '100 Check-Ins',
    description: 'Reach 100 total habit check-ins.',
    iconName: 'Award',
    color: '#22C55E',
    target: 100,
    evaluator: (ctx) => ctx.totalCompletions,
  },
  {
    id: 'forge-250',
    category: 'forge',
    title: 'BLACKSMITH',
    subtitle: '250 Check-Ins',
    description: 'Forge 250 habit completions into lasting discipline.',
    iconName: 'Shield',
    color: '#EAB308',
    target: 250,
    evaluator: (ctx) => ctx.totalCompletions,
  },
  {
    id: 'forge-500',
    category: 'forge',
    title: 'ARTISAN',
    subtitle: '500 Check-Ins',
    description: 'Accumulate 500 total check-in actions.',
    iconName: 'Zap',
    color: '#F97316',
    target: 500,
    evaluator: (ctx) => ctx.totalCompletions,
  },
  {
    id: 'forge-1000',
    category: 'forge',
    title: 'IRONMASTER',
    subtitle: '1,000 Check-Ins',
    description: 'Surpass 1,000 logged habit completions.',
    iconName: 'Trophy',
    color: '#FF3B30',
    target: 1000,
    evaluator: (ctx) => ctx.totalCompletions,
  },
  {
    id: 'forge-2500',
    category: 'forge',
    title: 'GRANDMASTER',
    subtitle: '2,500 Check-Ins',
    description: 'Surpass 2,500 lifetime habit completions.',
    iconName: 'Crown',
    color: '#A855F7',
    target: 2500,
    evaluator: (ctx) => ctx.totalCompletions,
  },

  // 3. STOIC (3 Clean / Quit Habit Milestones)
  {
    id: 'stoic-7',
    category: 'stoic',
    title: 'CLEAR MIND',
    subtitle: '7 Days Clean',
    description: 'Maintain 7 consecutive clean days on any quit habit.',
    iconName: 'ShieldCheck',
    color: '#38BDF8',
    target: 7,
    evaluator: (ctx) => ctx.bestCleanStreak,
  },
  {
    id: 'stoic-30',
    category: 'stoic',
    title: 'FORTITUDE',
    subtitle: '30 Days Clean',
    description: 'Maintain 30 consecutive clean days on any quit habit.',
    iconName: 'Shield',
    color: '#22C55E',
    target: 30,
    evaluator: (ctx) => ctx.bestCleanStreak,
  },
  {
    id: 'stoic-90',
    category: 'stoic',
    title: 'INDOMITABLE',
    subtitle: '90 Days Clean',
    description: 'Surpass 90 unbroken days free from an addiction/quit habit.',
    iconName: 'Crown',
    color: '#A855F7',
    target: 90,
    evaluator: (ctx) => ctx.bestCleanStreak,
  },

  // 4. ALCHEMIST (2 Diversity Milestones)
  {
    id: 'alchemist-3',
    category: 'alchemist',
    title: 'POLYMATH',
    subtitle: '3 Life Categories',
    description: 'Maintain active routines across 3 or more distinct categories.',
    iconName: 'Sparkles',
    color: '#06B6D4',
    target: 3,
    evaluator: (ctx) => ctx.distinctCategories,
  },
  {
    id: 'alchemist-5',
    category: 'alchemist',
    title: 'RENAISSANCE',
    subtitle: '5 Life Categories',
    description: 'Cultivate balance across 5 or more distinct life categories.',
    iconName: 'Star',
    color: '#A855F7',
    target: 5,
    evaluator: (ctx) => ctx.distinctCategories,
  },

  // 5. PHOENIX (2 Resilience & Comeback Milestones)
  {
    id: 'phoenix-1',
    category: 'phoenix',
    title: 'RISE AGAIN',
    subtitle: '1 Resilience Recovery',
    description: 'Bounce back and complete habits the day immediately following a missed day.',
    iconName: 'Flame',
    color: '#F97316',
    target: 1,
    evaluator: (ctx) => ctx.comebackCount,
  },
  {
    id: 'phoenix-5',
    category: 'phoenix',
    title: 'UNDYING',
    subtitle: '5 Resilience Recoveries',
    description: 'Prove relentless persistence with 5 successful post-miss recoveries.',
    iconName: 'Flame',
    color: '#FF3B30',
    target: 5,
    evaluator: (ctx) => ctx.comebackCount,
  },
];

export function calculateAchievements(context: AchievementContext): Achievement[] {
  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    const rawProgress = def.evaluator(context);
    const currentProgress = Math.max(0, Math.floor(rawProgress));
    const unlocked = currentProgress >= def.target;
    const progressPercent = Math.min(100, Math.round((currentProgress / def.target) * 100));

    return {
      id: def.id,
      category: def.category,
      title: def.title,
      subtitle: def.subtitle,
      description: def.description,
      iconName: def.iconName,
      color: def.color,
      unlocked,
      currentProgress,
      targetProgress: def.target,
      progressPercent,
    };
  });
}

/* ==========================================================================
   4. DISCIPLINE RATING (0 - 1000, Grades D to SSS)
   ========================================================================== */

export type DisciplineGrade = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

export interface DisciplineRating {
  totalScore: number;
  grade: DisciplineGrade;
  gradeColor: string;
  consistency: number; // 0 - 400
  momentum: number;    // 0 - 300
  resilience: number;  // 0 - 150
  balance: number;     // 0 - 150
}

export function calculateDisciplineRating({
  avg30DayRate,
  activeStreak,
  comebackCount,
  missedCount,
  distinctCategories,
  totalHabits,
}: {
  avg30DayRate: number;
  activeStreak: number;
  comebackCount: number;
  missedCount: number;
  distinctCategories: number;
  totalHabits: number;
}): DisciplineRating {
  if (totalHabits === 0) {
    return {
      totalScore: 0,
      grade: 'D',
      gradeColor: '#94A3B8',
      consistency: 0,
      momentum: 0,
      resilience: 0,
      balance: 0,
    };
  }

  // 1. Consistency: 0 - 400 pts based on 30-day adherence
  const consistency = Math.min(400, Math.max(0, Math.round((avg30DayRate / 100) * 400)));

  // 2. Momentum: 0 - 300 pts based on active streak relative to 30 days
  const momentum = Math.min(300, Math.max(0, Math.round((activeStreak / 30) * 300)));

  // 3. Resilience: 0 - 150 pts
  let resilience = 0;
  if (missedCount === 0 && avg30DayRate > 0) {
    resilience = 150; // Pristine record
  } else if (missedCount > 0) {
    const recoveryRatio = Math.min(1.0, comebackCount / Math.max(1, missedCount));
    resilience = Math.min(150, Math.max(30, Math.round(recoveryRatio * 150)));
  }

  // 4. Balance: 0 - 150 pts based on category diversity
  let balance = 0;
  if (distinctCategories >= 4) balance = 150;
  else if (distinctCategories === 3) balance = 135;
  else if (distinctCategories === 2) balance = 115;
  else if (distinctCategories === 1) balance = 90;

  const totalScore = Math.min(1000, Math.max(0, consistency + momentum + resilience + balance));

  let grade: DisciplineGrade = 'D';
  let gradeColor = '#94A3B8';

  if (totalScore >= 950) {
    grade = 'SSS';
    gradeColor = '#A855F7'; // Purple
  } else if (totalScore >= 900) {
    grade = 'SS';
    gradeColor = '#FF3B30'; // Zenith Crimson
  } else if (totalScore >= 800) {
    grade = 'S';
    gradeColor = '#F97316'; // Orange
  } else if (totalScore >= 700) {
    grade = 'A';
    gradeColor = '#EAB308'; // Gold/Yellow
  } else if (totalScore >= 550) {
    grade = 'B';
    gradeColor = '#22C55E'; // Emerald Green
  } else if (totalScore >= 400) {
    grade = 'C';
    gradeColor = '#38BDF8'; // Sky Blue
  } else {
    grade = 'D';
    gradeColor = '#94A3B8'; // Slate
  }

  return {
    totalScore,
    grade,
    gradeColor,
    consistency,
    momentum,
    resilience,
    balance,
  };
}

/* ==========================================================================
   5. COMPLETE GAMIFICATION PROFILE & CHRONOLOGICAL FORWARD SWEEP
   ========================================================================== */

export interface GamificationProfile {
  totalXp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  tier: PrestigeTier;
  comboMultiplier: number;
  discipline: DisciplineRating;
  dailyQuests: DailyQuest[];
  achievements: Achievement[];
  stats: {
    totalCompletions: number;
    bestStreak: number;
    activeStreak: number;
    avg30DayRate: number;
  };
}

export function calculateGamificationProfile(
  habits: Habit[],
  logs: Record<string, HabitLog>,
  referenceDateStr: string = getTodayDateString()
): GamificationProfile {
  const activeHabits = habits.filter((h) => !h.archived);

  // 1. Calculate habit stats & baseline metrics
  const statsList = habits.map((h) => ({
    habit: h,
    stats: calculateHabitStats(h, logs),
  }));

  const activeStatsList = statsList.filter((s) => !s.habit.archived);
  const bestStreak = Math.max(0, ...statsList.map((s) => s.stats.longestStreak));
  const activeStreak = Math.max(0, ...activeStatsList.map((s) => s.stats.currentStreak));
  const totalCompletions = Object.values(logs).filter((l) => l.completed).length;

  const avg30DayRate =
    activeStatsList.length > 0
      ? Math.round(
          activeStatsList.reduce((acc, s) => acc + s.stats.completionRate30Days, 0) /
            activeStatsList.length
        )
      : 0;

  // Best clean streak on quit/addiction habits
  const dontStats = statsList.filter((s) => s.habit.nature === 'dont');
  const bestCleanStreak = Math.max(0, ...dontStats.map((s) => s.stats.longestStreak));

  // Distinct categories among active habits
  const categoriesSet = new Set<string>();
  activeHabits.forEach((h) => categoriesSet.add(h.category));
  const distinctCategories = categoriesSet.size;

  // 2. Chronological Forward Sweep for Banked Monotonic XP & Comeback detection
  // Sweep through today so user account level, XP, and lifetime stats remain stable and monotonic
  const todayStr = getTodayDateString();
  const sweepEndStr = referenceDateStr > todayStr ? referenceDateStr : todayStr;

  let earliestDateStr = todayStr;
  habits.forEach((h) => {
    if (h.created_at) {
      const d = h.created_at.split('T')[0];
      if (d < earliestDateStr) earliestDateStr = d;
    }
  });
  Object.values(logs).forEach((l) => {
    if (l.date && l.date < earliestDateStr) earliestDateStr = l.date;
  });

  // Calculate day difference capped at 730 days (2 years) for performance
  let daysToSweep = 0;
  try {
    daysToSweep = Math.min(
      730,
      Math.max(0, differenceInCalendarDays(parseISO(sweepEndStr), parseISO(earliestDateStr)))
    );
  } catch {
    daysToSweep = 30;
  }

  let accumulatedXp = 0;
  let runningDailyStreak = 0;
  let comebackCount = 0;
  let missedCount = 0;
  let wasPreviousDayMissed = false;

  const sweepEndDate = parseISO(sweepEndStr);

  for (let i = daysToSweep; i >= 0; i--) {
    const currentDay = subDays(sweepEndDate, i);
    const dStr = format(currentDay, 'yyyy-MM-dd');
    const isToday = dStr === todayStr;

    const dueToday = habits.filter((h) => isHabitDueOnDate(h, dStr));
    if (dueToday.length === 0) continue;

    let dayCompletedCount = 0;
    let dayXp = 0;

    // Active combo multiplier for this day based on active streak: starts at 1.0x, +0.1x per 7 days, max 2.0x
    const dayMultiplier = Math.min(2.0, 1.0 + Math.floor(runningDailyStreak / 7) * 0.1);

    dueToday.forEach((h) => {
      const isSuccess = isDaySuccessful(h, dStr, logs);
      if (isSuccess) {
        dayCompletedCount++;
        if (h.nature === 'dont') {
          dayXp += 20 * dayMultiplier;
        } else if (h.type === 'number') {
          dayXp += 25 * dayMultiplier;
        } else {
          dayXp += 15 * dayMultiplier;
        }
      } else if (h.type === 'number') {
        // Proportional incremental steps for number habits
        const log = logs[`${h.id}_${dStr}`];
        if (log && log.value > 0 && h.target_value > 0) {
          const ratio = Math.min(0.99, Math.max(0, log.value / h.target_value));
          dayXp += Math.round(25 * ratio * dayMultiplier);
        }
      }
    });

    const isAllDueCompleted = dayCompletedCount === dueToday.length && dueToday.length > 0;
    if (isAllDueCompleted) {
      dayXp += 50 * dayMultiplier; // Perfect Day bonus
    }

    accumulatedXp += Math.round(dayXp);

    // Track daily streak & resilience
    if (dayCompletedCount > 0) {
      if (wasPreviousDayMissed) {
        comebackCount++;
        wasPreviousDayMissed = false;
      }
      runningDailyStreak++;
    } else if (!isToday) {
      // Past day with 0 completions is a missed day
      missedCount++;
      wasPreviousDayMissed = true;
      runningDailyStreak = 0;
    }
  }

  // Active combo multiplier for today
  const effectiveActiveStreak = Math.max(activeStreak, runningDailyStreak);
  const activeMultiplier = Number(
    Math.min(2.0, 1.0 + Math.floor(effectiveActiveStreak / 7) * 0.1).toFixed(1)
  );

  // 3. Quests for reference date
  const dailyQuests = generateDailyQuests(habits, logs, referenceDateStr);

  // 4. Calculate Level & Prestige Tier
  const levelInfo = calculateLevelFromXp(accumulatedXp);

  // 5. Calculate Discipline Rating
  const discipline = calculateDisciplineRating({
    avg30DayRate,
    activeStreak: effectiveActiveStreak,
    comebackCount,
    missedCount,
    distinctCategories,
    totalHabits: activeHabits.length,
  });

  // 6. Calculate 24-Achievement Codex
  const achievements = calculateAchievements({
    bestStreak,
    totalCompletions,
    bestCleanStreak,
    distinctCategories,
    comebackCount,
  });

  return {
    totalXp: accumulatedXp,
    level: levelInfo.level,
    currentLevelXp: levelInfo.currentLevelXp,
    nextLevelXp: levelInfo.nextLevelXp,
    progressPercent: levelInfo.progressPercent,
    tier: levelInfo.tier,
    comboMultiplier: activeMultiplier,
    discipline,
    dailyQuests,
    achievements,
    stats: {
      totalCompletions,
      bestStreak,
      activeStreak: effectiveActiveStreak,
      avg30DayRate,
    },
  };
}
