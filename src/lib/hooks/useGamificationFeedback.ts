'use client';

import { useState, useEffect, useRef } from 'react';
import { triggerDailyCelebration } from '../utils/confetti';
import { playMilestoneSound, playLevelUpSound, playAchievementSound } from '../utils/sound';
import { GamificationProfile } from '../utils/gamification';

interface UseGamificationFeedbackOptions {
  isUnlocked: boolean | null;
  completedCount: number;
  totalCount: number;
  gamificationProfile: GamificationProfile;
}

export function useGamificationFeedback({
  isUnlocked,
  completedCount,
  totalCount,
  gamificationProfile,
}: UseGamificationFeedbackOptions) {
  const [levelUpToast, setLevelUpToast] = useState<{ level: number; tierName: string } | null>(null);

  const prevCompletionRef = useRef<boolean>(false);
  const prevUnlockedRef = useRef<Set<string> | null>(null);

  // Daily 100% completion celebration
  useEffect(() => {
    const isAllDone = totalCount > 0 && completedCount === totalCount;
    if (isAllDone && !prevCompletionRef.current) {
      triggerDailyCelebration();
      playMilestoneSound();
    }
    prevCompletionRef.current = isAllDone;
  }, [completedCount, totalCount]);

  // Player level progression feedback
  useEffect(() => {
    if (!isUnlocked || typeof window === 'undefined') return;

    const storedLevelStr = localStorage.getItem('zenith_player_level');
    const currentLevel = gamificationProfile.level;

    if (storedLevelStr === null) {
      localStorage.setItem('zenith_player_level', String(currentLevel));
      return;
    }

    const prevLevel = parseInt(storedLevelStr, 10);
    if (!isNaN(prevLevel) && currentLevel > prevLevel) {
      localStorage.setItem('zenith_player_level', String(currentLevel));
      playLevelUpSound();
      triggerDailyCelebration();
      const toastTimer = setTimeout(() => {
        setLevelUpToast({
          level: currentLevel,
          tierName: gamificationProfile.tier.name,
        });
      }, 50);

      const hideTimer = setTimeout(() => {
        setLevelUpToast(null);
      }, 4550);
      return () => {
        clearTimeout(toastTimer);
        clearTimeout(hideTimer);
      };
    } else if (!isNaN(prevLevel) && currentLevel !== prevLevel) {
      localStorage.setItem('zenith_player_level', String(currentLevel));
    }
  }, [gamificationProfile.level, gamificationProfile.tier.name, isUnlocked]);

  // Achievement unlock chime
  useEffect(() => {
    if (!isUnlocked || typeof window === 'undefined') return;

    const currentUnlocked = new Set(
      gamificationProfile.achievements.filter((a) => a.unlocked).map((a) => a.id)
    );

    if (prevUnlockedRef.current === null) {
      prevUnlockedRef.current = currentUnlocked;
      return;
    }

    let hasNewUnlock = false;
    currentUnlocked.forEach((id) => {
      if (!prevUnlockedRef.current?.has(id)) {
        hasNewUnlock = true;
      }
    });

    if (hasNewUnlock) {
      playAchievementSound();
    }

    prevUnlockedRef.current = currentUnlocked;
  }, [gamificationProfile.achievements, isUnlocked]);

  return { levelUpToast };
}
