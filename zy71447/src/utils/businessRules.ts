import type { BusinessExplanation, BandConfig, RiskType } from '@/types';
import { BUSINESS_EXPLANATIONS, BAND_CONFIGS, RISK_TYPE_LABELS } from '@/types';

export class BusinessRules {
  static getExplanation(featureKey: BusinessExplanation['featureKey']): BusinessExplanation {
    const explanation = BUSINESS_EXPLANATIONS.find((e) => e.featureKey === featureKey);
    if (!explanation) {
      throw new Error(`未找到功能「${featureKey}」的业务解释`);
    }
    return explanation;
  }

  static getBandConfig(band: BandConfig['key']): BandConfig {
    const config = BAND_CONFIGS.find((b) => b.key === band);
    if (!config) {
      throw new Error(`未找到频段「${band}」的配置`);
    }
    return config;
  }

  static getRiskTypeLabel(type: RiskType): string {
    return RISK_TYPE_LABELS[type];
  }

  static getFrequencyRangeForBand(band: BandConfig['key']): { min: number; max: number } {
    const config = this.getBandConfig(band);
    return { min: config.minFreq, max: config.maxFreq };
  }

  static isFrequencyInBand(frequency: number, band: BandConfig['key']): boolean {
    const { min, max } = this.getFrequencyRangeForBand(band);
    return frequency >= min && frequency <= max;
  }

  static determineBandForFrequency(frequency: number): BandConfig['key'] | null {
    for (const config of BAND_CONFIGS) {
      if (frequency >= config.minFreq && frequency <= config.maxFreq) {
        return config.key;
      }
    }
    return null;
  }

  static validateSectionPosition(
    axis: 'x' | 'y' | 'z',
    position: number,
    instrumentDimensions: { width: number; height: number; depth: number }
  ): { valid: boolean; min: number; max: number } {
    let min: number, max: number;

    switch (axis) {
      case 'x':
        min = -instrumentDimensions.width / 2;
        max = instrumentDimensions.width / 2;
        break;
      case 'y':
        min = -instrumentDimensions.height / 2;
        max = instrumentDimensions.height / 2;
        break;
      case 'z':
        min = -instrumentDimensions.depth / 2;
        max = instrumentDimensions.depth / 2;
        break;
      default:
        return { valid: false, min: 0, max: 0 };
    }

    return {
      valid: position >= min && position <= max,
      min,
      max,
    };
  }

  static getSectionThreshold(): number {
    return 0.3;
  }

  static getBandDeviationThreshold(): number {
    return 0.15;
  }

  static getHotspotTolerance(): number {
    return 0.002;
  }

  static getRuleSummary(): Array<{
    category: string;
    rule: string;
    threshold?: number;
    thresholdUnit?: string;
  }> {
    return [
      {
        category: '剖面切割',
        rule: '剖面切割以乐器中心线为基准，保证对称结构完整展示',
        threshold: 30,
        thresholdUnit: '%',
      },
      {
        category: '频段划分',
        rule: '频段划分参照声学标准，低频80-250Hz、中频250-2000Hz、高频2000-8000Hz',
        threshold: 15,
        thresholdUnit: '%',
      },
      {
        category: '热点标注',
        rule: '热点位置依据乐器设计图纸，误差控制在2mm以内',
        threshold: 2,
        thresholdUnit: 'mm',
      },
      {
        category: '数据口径',
        rule: '所有风险检测保留原始数据快照，不修改业务同事提供的数据口径',
      },
      {
        category: '报告批次',
        rule: '报告文件名格式：批次{YYYYMMDD}_{批次号}_{乐器类型}.pdf',
      },
    ];
  }

  static validateRiskType(type: string): type is RiskType {
    return ['section_occlusion', 'band_mismatch', 'hotspot_missing'].includes(type);
  }

  static getRiskDescription(type: RiskType): string {
    const descriptions: Record<RiskType, string> = {
      section_occlusion:
        '当切割面后方的关键结构被前方结构遮挡超过30%时触发，提示当前剖面可能影响关键结构的观察。',
      band_mismatch:
        '当标注频段与频率采样数据偏差超过15%时触发，提示频段标注可能与实测数据不符。',
      hotspot_missing:
        '当预设讲解点落在当前剖面切割范围外时触发，提示讲解点在当前剖面不可见。',
    };
    return descriptions[type];
  }
}
