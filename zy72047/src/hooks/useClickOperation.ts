import { useCallback, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import type { Effect } from '@/types/game';

export interface ClickButtonConfig {
  id: string;
  label: string;
  icon?: string;
  effect: Effect;
  description?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
}

export const useClickOperation = () => {
  const processClick = useGameStore(state => state.processClick);
  const currentLevel = useGameStore(state => state.currentLevel);
  const isPaused = useGameStore(state => state.isPaused);
  const currentRound = useGameStore(state => state.currentRound);
  const error = useGameStore(state => state.error);
  const clearError = useGameStore(state => state.clearError);
  const resources = useGameStore(state => state.resources);

  const [lastClicked, setLastClicked] = useState<string | null>(null);

  const handleClick = useCallback((
    buttonId: string,
    label: string,
    note: string = ''
  ) => {
    if (!currentLevel || !currentRound || isPaused) return null;

    setLastClicked(buttonId);
    setTimeout(() => setLastClicked(null), 300);

    const operation = processClick(
      buttonId,
      label,
      note,
      '黑胶节拍修复赛'
    );

    return operation;
  }, [currentLevel, currentRound, isPaused, processClick]);

  const getButtonEffect = useCallback((buttonId: string): Effect | null => {
    if (!currentLevel) return null;
    return currentLevel.rules.clickEffects[buttonId] || null;
  }, [currentLevel]);

  const canClick = useCallback((buttonId: string) => {
    if (!currentRound || isPaused) return false;

    const effect = getButtonEffect(buttonId);
    if (!effect) return false;

    const newResources = resources + effect.resource;
    if (currentLevel?.rules.negativeResourceBlocked && newResources < 0 && effect.resource < 0) {
      return false;
    }

    return true;
  }, [currentRound, isPaused, resources, getButtonEffect, currentLevel]);

  const getButtonConfig = useCallback((
    buttonId: string,
    label: string,
    description?: string
  ): ClickButtonConfig | null => {
    const effect = getButtonEffect(buttonId);
    if (!effect) return null;

    let variant: ClickButtonConfig['variant'] = 'primary';
    if (effect.resource < 0 && effect.score > 0 && effect.risk > 0) {
      variant = 'danger';
    } else if (effect.resource > 0 && effect.score < 0) {
      variant = 'success';
    } else if (effect.risk > 15) {
      variant = 'warning';
    } else if (effect.resource > 0 || effect.risk < 0) {
      variant = 'secondary';
    }

    return {
      id: buttonId,
      label,
      effect,
      description,
      variant,
    };
  }, [getButtonEffect]);

  const getButtonTooltip = useCallback((config: ClickButtonConfig) => {
    const parts: string[] = [];
    if (config.effect.resource !== 0) {
      parts.push(`资源${config.effect.resource > 0 ? '+' : ''}${config.effect.resource}`);
    }
    if (config.effect.score !== 0) {
      parts.push(`分数${config.effect.score > 0 ? '+' : ''}${config.effect.score}`);
    }
    if (config.effect.risk !== 0) {
      parts.push(`风险${config.effect.risk > 0 ? '+' : ''}${config.effect.risk}`);
    }

    return `${config.label}: ${parts.join(', ')}${config.description ? ` | ${config.description}` : ''}`;
  }, []);

  const getVariantClasses = useCallback((variant: ClickButtonConfig['variant'], disabled: boolean) => {
    const baseClasses = 'px-4 py-3 rounded-lg font-medium transition-all duration-200 flex flex-col items-center justify-center gap-1 min-w-[100px]';
    
    if (disabled) {
      return `${baseClasses} bg-vinyl-800 text-vinyl-500 cursor-not-allowed opacity-50`;
    }

    const variants: Record<string, string> = {
      primary: `${baseClasses} bg-gradient-to-br from-gold-500 to-gold-600 text-vinyl-900 hover:from-gold-400 hover:to-gold-500 hover:shadow-gold active:scale-95`,
      secondary: `${baseClasses} bg-gradient-to-br from-vinyl-600 to-vinyl-700 text-vinyl-100 hover:from-vinyl-500 hover:to-vinyl-600 active:scale-95`,
      danger: `${baseClasses} bg-gradient-to-br from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 active:scale-95 shadow-lg`,
      success: `${baseClasses} bg-gradient-to-br from-green-600 to-green-700 text-white hover:from-green-500 hover:to-green-600 active:scale-95`,
      warning: `${baseClasses} bg-gradient-to-br from-yellow-500 to-yellow-600 text-vinyl-900 hover:from-yellow-400 hover:to-yellow-500 active:scale-95`,
    };

    return variants[variant] || variants.primary;
  }, []);

  const getAvailableButtons = useCallback((): ClickButtonConfig[] => {
    if (!currentLevel) return [];

    const buttonConfigs: Array<{ id: string; label: string; description?: string }> = [
      { id: 'btn-boost', label: '加速', description: '快速获取少量分数' },
      { id: 'btn-repair', label: '修复', description: '恢复部分资源' },
      { id: 'btn-risk', label: '高风险', description: '高风险高收益' },
      { id: 'btn-safe', label: '安全', description: '稳妥的小收益' },
      { id: 'btn-gamble', label: '赌博', description: '完全随机' },
      { id: 'btn-easter', label: '彩蛋', description: '节日特别效果' },
    ];

    return buttonConfigs
      .map(cfg => getButtonConfig(cfg.id, cfg.label, cfg.description))
      .filter((cfg): cfg is ClickButtonConfig => cfg !== null);
  }, [currentLevel, getButtonConfig]);

  return {
    handleClick,
    getButtonEffect,
    canClick,
    getButtonConfig,
    getButtonTooltip,
    getVariantClasses,
    getAvailableButtons,
    lastClicked,
    isPaused,
    currentRound,
    error,
    clearError,
  };
};
