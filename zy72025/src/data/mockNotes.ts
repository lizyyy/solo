export const teacherNotesTemplates = {
  excellent: [
    '操作非常稳健，对利率政策的理解深刻。决策逻辑清晰，各项指标控制精准。',
    '出色的表现！政策权衡得当，既控制了通胀，又保持了经济增长。',
    '完美的操作，各项经济指标全部达标，决策思路值得学习。',
  ],
  good: [
    '整体表现不错，决策基本正确，虽然有一些小的波动，但最终成功达成目标。',
    '良好的政策操作，对经济规律的理解到位，继续保持。',
    '决策合理，经济指标控制良好，部分细节可以进一步优化。',
  ],
  average: [
    '基本达标，但过程中有一些波折，通过调整后完成了目标。需要加强对政策时滞的理解。',
    '操作基本正确，但对部分决策需要更谨慎一些。继续努力！',
    '最终达标了，但中间的决策有些犹豫，需要更果断一些。',
  ],
  needsImprovement: [
    '前期政策过于激进，导致经济波动较大。建议加强理论学习，多做练习。',
    '对利率政策的权衡把握不准，导致多次调整才达标。需要加强练习。',
    '操作过程中出现了一些失误，通过补充材料才完成。建议多复习相关知识。',
  ],
};

export const commonComments = {
  inflationControl: '对通货膨胀的控制：',
  growthSupport: '对经济增长的支持：',
  employmentFocus: '对就业市场的关注：',
  policyBalance: '政策平衡性：',
  decisionLogic: '决策逻辑清晰度：',
  overallPerformance: '总体表现：',
};

export const supplementReasons = [
  '补充材料：由于就业数据低于预期',
  '补充材料：通胀压力超预期',
  '补充材料：GDP增速放缓需要调整',
  '补充材料：市场流动性紧张',
  '补充材料：外部环境变化',
  '补充材料：政策效果未达预期',
];

export const conflictResolutionGuidance = {
  resource_mismatch: '资源数据不一致，建议核对原始记录与系统计算结果，确认哪一方更准确。',
  step_missing: '步骤数量不匹配，建议检查学生记录是否有遗漏或重复。',
  timeline_conflict: '时间线存在冲突，建议按实际操作顺序核对时间戳。',
  duplicate_step: '存在重复步骤，建议确认哪一条是正确记录。',
  null_value: '存在空值，建议补充完整信息。',
  boundary_issue: '数值超出正常范围，建议核实数据准确性。',
};
