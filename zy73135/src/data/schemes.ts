import type { ParameterScheme } from '@/types';

export const mockSchemes: ParameterScheme[] = [
  {
    id: 'scheme-standard',
    name: '标准方案',
    description: '日常监测使用的标准清洗参数，平衡数据保真度与降噪效果',
    parameters: {
      outlierThreshold: 2,
      driftCorrectionEnabled: true,
      smoothingWindowSize: 3,
      interpolationMethod: 'linear',
      minValidValue: 0,
      maxValidValue: 100,
    },
    isActive: true,
  },
  {
    id: 'scheme-strict',
    name: '严格方案',
    description: '敏感区域监测使用，更严格的异常剔除与漂移校正标准',
    parameters: {
      outlierThreshold: 3,
      driftCorrectionEnabled: true,
      smoothingWindowSize: 5,
      interpolationMethod: 'cubic',
      minValidValue: 0,
      maxValidValue: 100,
    },
    isActive: false,
  },
  {
    id: 'scheme-conservative',
    name: '保守方案',
    description: '保留更多原始数据特征，适用于异常事件分析场景',
    parameters: {
      outlierThreshold: 1.5,
      driftCorrectionEnabled: false,
      smoothingWindowSize: 1,
      interpolationMethod: 'nearest',
      minValidValue: 0,
      maxValidValue: 100,
    },
    isActive: false,
  },
];
