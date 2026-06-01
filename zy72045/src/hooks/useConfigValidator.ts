import type { GameConfig, ValidationResult, ValidationError } from '../types/game';
import { clamp } from '../utils/formatters';

export function useConfigValidator() {
  const validate = (config: GameConfig): ValidationResult => {
    const errors: ValidationError[] = [];

    if (config.rounds.length === 0) {
      errors.push({
        type: 'empty_level',
        path: 'rounds',
        message: '关卡配置为空，没有任何回合',
      });
    }

    config.rounds.forEach((round, roundIdx) => {
      if (round.news.length === 0) {
        errors.push({
          type: 'empty_level',
          path: `rounds[${roundIdx}].news`,
          message: `第 ${round.roundNumber} 回合没有新闻事件`,
        });
      }

      const seenIds = new Set<string>();
      round.news.forEach((news, newsIdx) => {
        if (seenIds.has(news.id)) {
          errors.push({
            type: 'duplicate_event',
            path: `rounds[${roundIdx}].news[${newsIdx}]`,
            message: `第 ${round.roundNumber} 回合存在重复的新闻 ID: ${news.id}`,
            value: news.id,
          });
        }
        seenIds.add(news.id);

        if (news.impactScore < -100 || news.impactScore > 100) {
          errors.push({
            type: 'boundary_violation',
            path: `rounds[${roundIdx}].news[${newsIdx}].impactScore`,
            message: `新闻影响分数超出边界 [-100, 100]`,
            value: news.impactScore,
            boundary: { min: -100, max: 100 },
          });
        }
      });
    });

    config.stocks.forEach((stock, stockIdx) => {
      if (stock.basePrice <= 0) {
        errors.push({
          type: 'boundary_violation',
          path: `stocks[${stockIdx}].basePrice`,
          message: `股票 ${stock.symbol} 基准价格必须大于0`,
          value: stock.basePrice,
          boundary: { min: 0.01, max: 100000 },
        });
      }
      if (stock.volatility < 0 || stock.volatility > 1) {
        errors.push({
          type: 'boundary_violation',
          path: `stocks[${stockIdx}].volatility`,
          message: `股票 ${stock.symbol} 波动率必须在 [0, 1] 范围内`,
          value: stock.volatility,
          boundary: { min: 0, max: 1 },
        });
      }
    });

    if (config.initialCapital <= 0) {
      errors.push({
        type: 'boundary_violation',
        path: 'initialCapital',
        message: '初始资金必须大于0',
        value: config.initialCapital,
        boundary: { min: 1, max: 1000000000 },
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const fixConfig = (config: GameConfig, errors: ValidationError[]): GameConfig => {
    const fixedConfig = JSON.parse(JSON.stringify(config)) as GameConfig;

    errors.forEach((error) => {
      if (error.type === 'boundary_violation' && error.boundary) {
        const pathParts = error.path.split(/[\[\].]/).filter(Boolean);
        let current: any = fixedConfig;

        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (/\d+/.test(part)) {
            current = current[parseInt(part)];
          } else {
            current = current[part];
          }
        }

        const lastKey = pathParts[pathParts.length - 1];
        if (current && lastKey && typeof error.value === 'number') {
          current[lastKey] = clamp(error.value, error.boundary.min, error.boundary.max);
        }
      }

      if (error.type === 'duplicate_event') {
        const pathParts = error.path.split(/[\[\].]/).filter(Boolean);
        const roundIdx = parseInt(pathParts[1]);
        const newsIdx = parseInt(pathParts[3]);

        if (fixedConfig.rounds[roundIdx] && fixedConfig.rounds[roundIdx].news[newsIdx]) {
          fixedConfig.rounds[roundIdx].news[newsIdx].id = `${error.value}-dup-${Date.now()}`;
        }
      }
    });

    return fixedConfig;
  };

  return { validate, fixConfig };
}
