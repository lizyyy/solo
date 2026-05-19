import { ResponseScene } from '../entities/ResponseScene';

export class MatchService {
  static matchRequest(
    scenes: ResponseScene[],
    request: {
      method: string;
      path: string;
      headers: Record<string, any>;
      query: Record<string, any>;
      body: Record<string, any>;
    }
  ): ResponseScene | null {
    const enabledScenes = scenes.filter(s => s.isEnabled);
    
    const scenesWithRules = enabledScenes.filter(s => s.matchRules && s.matchRules.length > 0);
    for (const scene of scenesWithRules) {
      if (this.matchScene(scene, request)) {
        return scene;
      }
    }
    
    const defaultScene = enabledScenes.find(s => s.isDefault);
    return defaultScene || null;
  }

  private static matchScene(
    scene: ResponseScene,
    request: {
      method: string;
      path: string;
      headers: Record<string, any>;
      query: Record<string, any>;
      body: Record<string, any>;
    }
  ): boolean {
    if (!scene.matchRules || scene.matchRules.length === 0) {
      return scene.isDefault;
    }

    for (const rule of scene.matchRules) {
      let actualValue: any;
      
      switch (rule.type) {
        case 'header':
          actualValue = request.headers[rule.key.toLowerCase()] || request.headers[rule.key];
          break;
        case 'query':
          actualValue = request.query[rule.key];
          break;
        case 'body':
          actualValue = this.getNestedValue(request.body, rule.key);
          break;
        case 'path':
          actualValue = request.path;
          break;
        default:
          return false;
      }

      if (!this.matchRuleValue(rule, actualValue)) {
        return false;
      }
    }

    return true;
  }

  private static matchRuleValue(rule: any, actualValue: any): boolean {
    const expectedValue = rule.value;
    
    switch (rule.operator) {
      case 'equals':
        return String(actualValue) === String(expectedValue);
      case 'contains':
        return String(actualValue).includes(String(expectedValue));
      case 'regex':
        try {
          const regex = new RegExp(expectedValue);
          return regex.test(String(actualValue));
        } catch {
          return false;
        }
      case 'exists':
        return actualValue !== undefined && actualValue !== null;
      default:
        return false;
    }
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  static calculateDelay(delayConfig: any): number {
    if (!delayConfig || !delayConfig.enabled) {
      return 0;
    }

    switch (delayConfig.strategy) {
      case 'fixed':
        return delayConfig.fixedDelay || 0;
      case 'random':
        return Math.floor(
          Math.random() * ((delayConfig.maxDelay || 0) - (delayConfig.minDelay || 0) + 1) + (delayConfig.minDelay || 0)
        );
      case 'linear':
        return delayConfig.minDelay || 0;
      default:
        return 0;
    }
  }
}
