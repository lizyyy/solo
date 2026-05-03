import yaml from 'js-yaml';
import { SceneRules, ParsingError } from '../types';

const DEFAULT_RULES: SceneRules = {
  blackoutThreshold: 5,
  requiresSafetyLight: true,
  safetyLightChannels: [],
  maxFadeOverlap: 2
};

export function parseRules(yamlString: string): { rules: SceneRules; errors: ParsingError[] } {
  const errors: ParsingError[] = [];
  let rules: SceneRules = { ...DEFAULT_RULES };

  try {
    const data = yaml.load(yamlString) as Record<string, unknown>;
    
    if (data && typeof data === 'object') {
      rules = validateAndMapRules(data, errors);
    }

  } catch (e) {
    errors.push({
      type: 'yaml',
      message: `YAML 解析错误: ${e instanceof Error ? e.message : '未知错误'}`
    });
  }

  return { rules, errors };
}

function validateAndMapRules(
  data: Record<string, unknown>,
  errors: ParsingError[]
): SceneRules {
  const rules: SceneRules = { ...DEFAULT_RULES };

  if (data.blackoutThreshold !== undefined) {
    const value = Number(data.blackoutThreshold);
    if (!isNaN(value) && value >= 0) {
      rules.blackoutThreshold = value;
    } else {
      errors.push({
        type: 'yaml',
        message: 'blackoutThreshold 必须是有效的正数'
      });
    }
  }

  if (data.requiresSafetyLight !== undefined) {
    rules.requiresSafetyLight = Boolean(data.requiresSafetyLight);
  }

  if (data.safetyLightChannels !== undefined) {
    if (Array.isArray(data.safetyLightChannels)) {
      rules.safetyLightChannels = data.safetyLightChannels.map((ch: unknown) => String(ch));
    } else {
      errors.push({
        type: 'yaml',
        message: 'safetyLightChannels 必须是数组格式'
      });
    }
  }

  if (data.maxFadeOverlap !== undefined) {
    const value = Number(data.maxFadeOverlap);
    if (!isNaN(value) && value >= 0) {
      rules.maxFadeOverlap = value;
    } else {
      errors.push({
        type: 'yaml',
        message: 'maxFadeOverlap 必须是有效的正数'
      });
    }
  }

  return rules;
}

export function generateRulesYAML(rules: SceneRules): string {
  const data = {
    blackoutThreshold: rules.blackoutThreshold,
    requiresSafetyLight: rules.requiresSafetyLight,
    safetyLightChannels: rules.safetyLightChannels,
    maxFadeOverlap: rules.maxFadeOverlap
  };

  return yaml.dump(data);
}

export { DEFAULT_RULES };