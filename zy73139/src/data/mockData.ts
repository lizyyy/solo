import type {
  WaterQualityReport,
  DelayedRecord,
  DuplicateBottle,
  TempRemark,
  AnomalyDetail,
} from '@/types';

export const reportData: WaterQualityReport = {
  id: 'rpt-001',
  reportNo: 'NB-2026-0615-01',
  stationName: '青岛近岸海洋监测站',
  dateRange: {
    start: '2026-06-10',
    end: '2026-06-15',
  },
  conclusion:
    '本期近岸水质整体良好，主要监测指标均符合第二类海水水质标准。其中化学需氧量（COD）和无机氮在6月13日出现短时升高，经实验室复核确认属正常波动范围。需注意B12号采样瓶数据重复录入问题已人工修正。',
  materials: [
    {
      type: 'sensor',
      name: '传感器实时数据',
      updateTime: '2026-06-15 08:00',
      status: 'normal',
      recordCount: 2880,
    },
    {
      type: 'lab',
      name: '实验室结果表',
      updateTime: '2026-06-17 14:30',
      status: 'delayed',
      recordCount: 156,
    },
    {
      type: 'ship',
      name: '船上采样记录',
      updateTime: '2026-06-16 09:15',
      status: 'delayed',
      recordCount: 48,
    },
  ],
  anomalies: [
    {
      type: 'delayed',
      count: 2,
      description: '晚到数据条目',
    },
    {
      type: 'duplicate',
      count: 3,
      description: '采样瓶重复',
    },
    {
      type: 'manual',
      count: 1,
      description: '人工确认修正',
    },
  ],
};

export const delayedRecords: DelayedRecord[] = [
  {
    id: 'delay-001',
    materialType: 'lab',
    materialName: '实验室结果表（第二批）',
    arriveTime: '2026-06-17 14:30',
    expectedTime: '2026-06-15 18:00',
    delayHours: 44.5,
    impactDescription:
      '第二批实验室数据晚到，补全了6月13日B9-B16号采样瓶的检测结果。其中无机氮和活性磷酸盐数据修正了之前基于传感器的初步判断。',
    originalConclusion: '6月13日无机氮指标接近第二类标准上限，需进一步观察',
    revisedConclusion: '6月13日无机氮指标经实验室复核确认属正常范围，水质等级维持第二类',
    affectedIndicators: ['无机氮', '活性磷酸盐', '化学需氧量', '石油类'],
    sourceRows: [
      {
        tableName: '实验室结果表',
        rowNumber: 45,
        columnName: '无机氮',
        originalValue: '0.32 (预估)',
        currentValue: '0.28',
        remark: '传感器预估 → 实验室实测',
      },
      {
        tableName: '实验室结果表',
        rowNumber: 47,
        columnName: '活性磷酸盐',
        originalValue: '0.035 (预估)',
        currentValue: '0.030',
        remark: '传感器预估 → 实验室实测',
      },
    ],
  },
  {
    id: 'delay-002',
    materialType: 'ship',
    materialName: '船上采样记录（补充）',
    arriveTime: '2026-06-16 09:15',
    expectedTime: '2026-06-15 12:00',
    delayHours: 21.25,
    impactDescription:
      '补充记录了6月14日下午的采样气象条件和现场观测情况，确认了当时的水色异常为附近船舶排污所致，非水质整体恶化。',
    originalConclusion: '6月14日下午水色异常原因待查',
    revisedConclusion: '6月14日下午水色异常系附近船舶排污造成局部影响，整体水质无异常',
    affectedIndicators: ['现场观测', '水色', '透明度'],
    sourceRows: [
      {
        tableName: '船上采样记录',
        rowNumber: 23,
        columnName: '现场备注',
        originalValue: '(空)',
        currentValue: '发现东侧500米处有货船排污',
        remark: '补充记录',
      },
    ],
  },
];

export const duplicateBottles: DuplicateBottle[] = [
  {
    id: 'dup-001',
    bottleNo: 'B12',
    duplicateCount: 2,
    affectedIndicators: ['水温', '盐度', 'pH值', '溶解氧', '化学需氧量'],
    impactScope:
      '影响6月12日表层水样的统计平均值，导致化学需氧量平均值偏高约8%，可能影响水质等级判定。',
    isManualChecked: true,
    checkTime: '2026-06-16 15:30',
    checker: '宋海洋',
    sourceRows: [
      {
        tableName: '实验室结果表',
        rowNumber: 36,
        columnName: '化学需氧量',
        originalValue: '2.4',
        currentValue: '2.1',
        remark: '取首次记录值，删除重复行',
      },
      {
        tableName: '实验室结果表',
        rowNumber: 37,
        columnName: '化学需氧量',
        originalValue: '2.1',
        currentValue: '(已删除)',
        remark: '重复行，已标记删除',
      },
    ],
    originalBottleData: {
      bottleNo: 'B12',
      collectTime: '2026-06-12 10:30',
      depth: '表层',
      indicators: {
        水温: '21.5℃',
        盐度: '30.2‰',
        pH值: '8.12',
        溶解氧: '7.8 mg/L',
        化学需氧量: '2.4 mg/L',
      },
    },
    currentBottleData: {
      bottleNo: 'B12',
      collectTime: '2026-06-12 10:30',
      depth: '表层',
      indicators: {
        水温: '21.5℃',
        盐度: '30.2‰',
        pH值: '8.12',
        溶解氧: '7.8 mg/L',
        化学需氧量: '2.1 mg/L',
      },
    },
  },
  {
    id: 'dup-002',
    bottleNo: 'B05',
    duplicateCount: 2,
    affectedIndicators: ['无机氮', '活性磷酸盐'],
    impactScope:
      '影响6月11日中层水样营养盐统计，重复数据导致无机氮计算值偏低。',
    isManualChecked: true,
    checkTime: '2026-06-16 11:00',
    checker: '宋海洋',
    sourceRows: [
      {
        tableName: '实验室结果表',
        rowNumber: 18,
        columnName: '无机氮',
        originalValue: '0.20',
        currentValue: '0.25',
        remark: '取第二次记录的正确值',
      },
    ],
    originalBottleData: {
      bottleNo: 'B05',
      collectTime: '2026-06-11 14:00',
      depth: '10米',
      indicators: {
        无机氮: '0.20 mg/L',
        活性磷酸盐: '0.025 mg/L',
      },
    },
    currentBottleData: {
      bottleNo: 'B05',
      collectTime: '2026-06-11 14:00',
      depth: '10米',
      indicators: {
        无机氮: '0.25 mg/L',
        活性磷酸盐: '0.028 mg/L',
      },
    },
  },
  {
    id: 'dup-003',
    bottleNo: 'B21',
    duplicateCount: 2,
    affectedIndicators: ['水温', '盐度'],
    impactScope:
      '仅影响基础物理参数统计，不改变水质评价结论。两条记录数值差异极小。',
    isManualChecked: false,
    sourceRows: [
      {
        tableName: '传感器数据表',
        rowNumber: 156,
        columnName: '水温',
        originalValue: '22.1',
        currentValue: '22.1',
        remark: '数值一致，待确认保留哪条',
      },
    ],
    originalBottleData: {
      bottleNo: 'B21',
      collectTime: '2026-06-14 09:00',
      depth: '表层',
      indicators: {
        水温: '22.1℃',
        盐度: '30.5‰',
      },
    },
    currentBottleData: {
      bottleNo: 'B21',
      collectTime: '2026-06-14 09:00',
      depth: '表层',
      indicators: {
        水温: '22.1℃',
        盐度: '30.5‰',
      },
    },
  },
];

export const tempRemarks: TempRemark[] = [
  {
    id: 'remark-001',
    materialType: 'lab',
    content:
      '彩排进场前补充：6月13日B10号样品因仪器波动导致溶解氧数据异常，经与平行样比对确认以平行样结果为准。已在实验室结果表第32行添加备注。',
    addTime: '2026-06-17 16:45',
    addedBy: '宋海洋（彩排前补充）',
    changedJudgments: [
      {
        indicator: '溶解氧',
        originalJudgment: '6月13日B10站点溶解氧偏低，接近二类标准下限',
        newJudgment: '6月13日B10站点溶解氧属正常范围，以平行样数据为准',
        reason: '仪器波动导致单样数据异常，平行样复核结果正常',
      },
      {
        indicator: '水质等级',
        originalJudgment: '6月13日B10站点需重点关注溶解氧指标',
        newJudgment: '6月13日B10站点水质等级维持第二类不变',
        reason: '溶解氧数据修正后仍满足第二类标准',
      },
    ],
  },
];

export const getAnomalyDetail = (id: string): AnomalyDetail | null => {
  if (id === 'delay-001') {
    return {
      id: 'delay-001',
      type: 'delayed',
      title: '实验室结果表（第二批）晚到影响分析',
      tracePath: [
        { step: 1, name: '报告汇总', description: '近岸水质报告汇总', time: '2026-06-15 18:00' },
        { step: 2, name: '异常发现', description: '实验室数据仅到第一批', time: '2026-06-15 18:00' },
        { step: 3, name: '数据补到', description: '第二批实验室结果表送达', time: '2026-06-17 14:30' },
        { step: 4, name: '影响分析', description: '对比差异，更新结论', time: '2026-06-17 15:00' },
        { step: 5, name: '当前状态', description: '已纳入最新报告版本' },
      ],
      beforeData: {
        '报告版本': 'V1.0（初稿）',
        '数据状态': '实验室第一批数据',
        '无机氮': '0.32 mg/L（预估）',
        '活性磷酸盐': '0.035 mg/L（预估）',
        '化学需氧量': '2.2 mg/L（平均）',
        '水质结论': '6月13日无机氮接近上限，需观察',
      },
      afterData: {
        '报告版本': 'V1.1（更新版）',
        '数据状态': '实验室全部数据',
        '无机氮': '0.28 mg/L（实测）',
        '活性磷酸盐': '0.030 mg/L（实测）',
        '化学需氧量': '2.1 mg/L（平均）',
        '水质结论': '各项指标正常，维持第二类',
      },
      sourceRows: [
        {
          tableName: '实验室结果表',
          rowNumber: 45,
          columnName: '无机氮',
          originalValue: '0.32 (预估)',
          currentValue: '0.28',
          remark: '传感器预估 → 实验室实测',
        },
        {
          tableName: '实验室结果表',
          rowNumber: 47,
          columnName: '活性磷酸盐',
          originalValue: '0.035 (预估)',
          currentValue: '0.030',
          remark: '传感器预估 → 实验室实测',
        },
        {
          tableName: '实验室结果表',
          rowNumber: 50,
          columnName: '化学需氧量',
          originalValue: '2.3 (预估)',
          currentValue: '2.1',
          remark: '传感器预估 → 实验室实测',
        },
      ],
      manualConfirm: {
        operator: '宋海洋',
        time: '2026-06-17 15:20',
        comment:
          '第二批实验室数据已核验，与现场采样记录一致，无机氮和活性磷酸盐数据修正后结论更准确，建议使用更新版报告。',
      },
    };
  }

  if (id === 'dup-001') {
    return {
      id: 'dup-001',
      type: 'duplicate',
      title: 'B12号采样瓶重复数据修正详情',
      tracePath: [
        { step: 1, name: '报告汇总', description: '近岸水质报告汇总' },
        { step: 2, name: '异常检测', description: '系统检测到B12瓶号重复' },
        { step: 3, name: '人工核查', description: '值班员核对原始记录', time: '2026-06-16 15:00' },
        { step: 4, name: '数据修正', description: '删除重复行，更新统计', time: '2026-06-16 15:30' },
        { step: 5, name: '确认完成', description: '已纳入修正后报告' },
      ],
      beforeData: {
        '采样瓶号': 'B12（重复2次）',
        '采样时间': '2026-06-12 10:30',
        '采样深度': '表层',
        '化学需氧量': '2.4 mg/L（偏高）',
        '统计影响': '平均值偏高约8%',
        '处理状态': '待确认',
      },
      afterData: {
        '采样瓶号': 'B12（已去重）',
        '采样时间': '2026-06-12 10:30',
        '采样深度': '表层',
        '化学需氧量': '2.1 mg/L（正确值）',
        '统计影响': '已修正，不影响等级',
        '处理状态': '人工确认完成',
      },
      sourceRows: [
        {
          tableName: '实验室结果表',
          rowNumber: 36,
          columnName: '化学需氧量',
          originalValue: '2.4',
          currentValue: '2.1',
          remark: '保留首次正确记录',
        },
        {
          tableName: '实验室结果表',
          rowNumber: 37,
          columnName: '全部列',
          originalValue: '（整条记录）',
          currentValue: '（已删除）',
          remark: '重复录入的第二条记录',
        },
      ],
      manualConfirm: {
        operator: '宋海洋',
        time: '2026-06-16 15:30',
        comment:
          '经核对原始采样记录单，B12号瓶确为重复录入。第一条记录数值2.1mg/L与现场传感器数据趋势一致，第二条2.4mg/L疑为录入时手误，已删除第二条重复记录。',
      },
    };
  }

  if (id === 'remark-001') {
    return {
      id: 'remark-001',
      type: 'remark',
      title: '彩排前补充备注 - B10站点溶解氧异常修正',
      tracePath: [
        { step: 1, name: '报告汇总', description: '近岸水质报告汇总 V1.1' },
        { step: 2, name: '彩排准备', description: '进场前数据复核', time: '2026-06-17 16:00' },
        { step: 3, name: '发现问题', description: 'B10站点溶解氧偏低存疑' },
        { step: 4, name: '补充备注', description: '实验室追加说明并更新判断', time: '2026-06-17 16:45' },
        { step: 5, name: '当前状态', description: '已生成备注说明' },
      ],
      beforeData: {
        '数据来源': '实验室结果表 V1.1',
        'B10站点溶解氧': '5.2 mg/L（偏低）',
        '水质判断': '接近二类标准下限，需关注',
        '数据可信度': '单样检测，无平行样对照',
      },
      afterData: {
        '数据来源': '实验室结果表 V1.1 + 补充备注',
        'B10站点溶解氧': '6.8 mg/L（平行样值）',
        '水质判断': '正常范围，维持第二类',
        '数据可信度': '平行样复核，以平行样为准',
      },
      sourceRows: [
        {
          tableName: '实验室结果表',
          rowNumber: 32,
          columnName: '溶解氧',
          originalValue: '5.2',
          currentValue: '6.8（平行样）',
          remark: '原数据标注为异常，以平行样为准',
        },
        {
          tableName: '实验室结果表',
          rowNumber: 32,
          columnName: '备注列',
          originalValue: '(空)',
          currentValue: '仪器波动，以平行样为准',
          remark: '彩排前补充备注',
        },
      ],
      manualConfirm: {
        operator: '宋海洋',
        time: '2026-06-17 16:45',
        comment:
          '彩排进场前复核发现B10站点溶解氧数据异常偏低，经与实验室沟通确认当时仪器存在波动。平行样检测结果为6.8mg/L，属正常范围。已在结果表中添加备注，最终结论以平行样数据为准，不影响水质等级评价。',
      },
    };
  }

  return null;
};
