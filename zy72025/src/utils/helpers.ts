import type { Resources, ResourceEffect, GameStep } from '@/types';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

export function applyResourceEffect(
  resources: Resources,
  effect: ResourceEffect
): Resources {
  const newResources = { ...resources };
  const { resource, change, type } = effect;

  if (type === 'absolute') {
    newResources[resource] = Math.round((newResources[resource] + change) * 100) / 100;
  } else {
    newResources[resource] = Math.round((newResources[resource] * (1 + change / 100)) * 100) / 100;
  }

  return newResources;
}

export function applyResourceEffects(
  resources: Resources,
  effects: ResourceEffect[]
): Resources {
  return effects.reduce((acc, effect) => applyResourceEffect(acc, effect), resources);
}

export function hasNegativeResources(resources: Resources): boolean {
  return Object.values(resources).some((value) => value < 0);
}

export function getNegativeResourceNames(resources: Resources): string[] {
  const labels: Record<keyof Resources, string> = {
    reserveRequirement: '准备金率',
    lendingRate: '贷款利率',
    depositRate: '存款利率',
    inflation: '通货膨胀率',
    gdpGrowth: 'GDP增长率',
    employment: '就业率',
  };

  return (Object.entries(resources) as [keyof Resources, number][])
    .filter(([, value]) => value < 0)
    .map(([key]) => labels[key]);
}

export function calculateDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const diff = end - start;

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }
  return `${seconds}秒`;
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function downloadJson(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readJsonFile<T = any>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        resolve(JSON.parse(content));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function findStepByIndex(steps: GameStep[], index: number): GameStep | undefined {
  return steps.find((s) => s.stepIndex === index);
}

export function getStepsSummary(steps: GameStep[]): {
  totalSteps: number;
  supplementCount: number;
  decisionCount: number;
} {
  return {
    totalSteps: steps.length,
    supplementCount: steps.filter((s) => s.isSupplement).length,
    decisionCount: steps.filter((s) => s.decisionId && !s.isSupplement).length,
  };
}

export function compareResources(a: Resources, b: Resources): {
  isEqual: boolean;
  differences: Partial<Record<keyof Resources, { a: number; b: number }>>;
} {
  const keys = Object.keys(a) as (keyof Resources)[];
  const differences: Partial<Record<keyof Resources, { a: number; b: number }>> = {};

  keys.forEach((key) => {
    if (Math.abs(a[key] - b[key]) > 0.01) {
      differences[key] = { a: a[key], b: b[key] };
    }
  });

  return {
    isEqual: Object.keys(differences).length === 0,
    differences,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
