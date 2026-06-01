import type { ImportedData, JsonValue } from '@/types';

export const sampleImportData: ImportedData = {
  source: '课堂计分表-2026-05-20-早高峰',
  importedAt: Date.now(),
  teacherNote: '这是老师批改后的计分表，请注意：第1回合的客流量数据有更新，与预设数据存在差异。',
  data: {
    round1: {
      passengerFlow: 2900,
      historicalAverage: 2100,
      trainCount: 18,
      threshold: 3000,
    },
    round2: {
      line1Interval: '2分钟',
      line10Interval: null,
      transferFlow: 8500,
      transferCapacity: 10000,
    },
    round3: {
      currentFlow: 3000,
      threshold: 3000,
      changeRate: '-2%',
    },
  },
};

export const conflictingImportData: ImportedData = {
  source: '课堂计分表-2026-05-20-早高峰(修正版)',
  importedAt: Date.now(),
  teacherNote: '修正版数据：第1回合客流量实际统计为2900，与预设值2850存在差异；第3回合阈值应为2950。请根据实际情况处理。',
  data: {
    round1: {
      passengerFlow: 2900,
      historicalAverage: 2200,
      trainCount: 18,
      threshold: 3000,
    },
    round2: {
      line1Interval: '2分钟',
      line10Interval: '3分钟',
      transferFlow: 8500,
      transferCapacity: 10000,
    },
    round3: {
      currentFlow: 3000,
      threshold: 2950,
      changeRate: '-2%',
    },
  },
};

export const badConfigData: Record<string, JsonValue> = {
  source: '错误配置测试',
  data: {
    round1: {
      passengerFlow: 'not-a-number',
      threshold: null,
    },
    invalidField: undefined,
  },
};

export const emptyValueTestData: ImportedData = {
  source: '空值测试数据',
  importedAt: Date.now(),
  teacherNote: '测试数据：包含多个空值字段，用于验证空值处理逻辑。',
  data: {
    round1: {
      passengerFlow: null,
      historicalAverage: 2100,
      trainCount: null,
      threshold: 3000,
    },
    round2: {
      line1Interval: null,
      line10Interval: null,
      transferFlow: null,
      transferCapacity: 10000,
    },
  },
};

export const duplicateTestData: ImportedData = {
  source: '重复项测试数据',
  importedAt: Date.now(),
  teacherNote: '测试数据：包含重复记录，用于验证去重逻辑。',
  data: {
    round1: {
      passengerFlow: 2850,
      passengerFlow_duplicate1: 2850,
      passengerFlow_duplicate2: 2850,
      threshold: 3000,
      threshold_duplicate: 3000,
    },
  },
};

export const boundaryTestData: ImportedData = {
  source: '边界情况测试数据',
  importedAt: Date.now(),
  teacherNote: '测试数据：包含边界值，用于验证边界处理逻辑。',
  data: {
    round1: {
      passengerFlow: 3000,
      threshold: 3000,
      historicalAverage: 3000,
    },
    round2: {
      passengerFlow: 0,
      threshold: 3000,
    },
    round3: {
      passengerFlow: 9999,
      threshold: 3000,
    },
  },
};
