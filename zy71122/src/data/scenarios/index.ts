import { normalScenario } from './normal';
import { conflictScenario } from './conflict';
import { emptyScenario } from './empty';
import type { Scenario } from '@/types';

export const scenarios: Scenario[] = [normalScenario, conflictScenario, emptyScenario];

export const getScenarioById = (id: string): Scenario | undefined => {
  return scenarios.find((s) => s.id === id);
};

export const getScenariosByType = (type: Scenario['type']): Scenario[] => {
  return scenarios.filter((s) => s.type === type);
};
