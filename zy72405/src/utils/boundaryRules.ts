import { BoundaryRule, ShortageRecord } from '@/types';

export const BOUNDARY_KEYWORDS = ['请假', '缺勤', '补课', '已消耗', '课时', '调课', '停课'];

export const BOUNDARY_RULES: BoundaryRule[] = [
  {
    id: 'rule-001',
    name: '请假课时被算进已消耗',
    description: '合同中备注包含请假、缺勤等关键词，但被计入已消耗课时或已售数量',
    detectionLogic: '备注或原始内容中包含"请假"、"缺勤"、"补课"、"已消耗"、"课时"等关键词之一，且缺货/已消耗数量 > 0',
    handlingGuide: '1. 自动标记为边界场景，状态设为 review_needed（待巡演统筹复核）\n2. 音乐老师许老师不可直接确认，必须由巡演统筹操作\n3. 巡演统筹需核对实际出勤记录，确认是否应计入\n4. 确认正常：状态改为 reviewed；标记异常：状态改为 rejected 并注明原因',
    rollbackGuide: '1. 在记录详情中找到对应变更日志\n2. 点击"回滚到上一状态"\n3. 重新触发边界规则检测\n4. 巡演统筹需再次复核',
    example: '原始内容："第3行 曲目A 已消耗5张 备注：学员请假2课时"，系统检测到"请假"+"已消耗"关键词，标记为待复核，不会自动确认。'
  },
  {
    id: 'rule-002',
    name: '缺货数量逻辑矛盾',
    description: '缺货数量与已售/已消耗数量逻辑上存在矛盾',
    detectionLogic: '缺货数量 > 预售总量，或缺货数量为负数，或同一场演出同一曲目缺货数量前后不一致',
    handlingGuide: '1. 标记为边界场景，高亮显示\n2. 音乐老师需核对原始合同，修正数量后重新提交\n3. 巡演统筹确认修正后的数据',
    rollbackGuide: '1. 恢复原始数量\n2. 重新核对合同页截图\n3. 修改后重新走复核流程',
    example: '预售总量100张，缺货数量显示150张，系统自动标记异常。'
  },
  {
    id: 'rule-003',
    name: '曲目名无别名映射',
    description: '合同中的曲目名在曲目别名表中不存在，且无法模糊匹配',
    detectionLogic: '曲目名精确匹配不到，且编辑距离 > 3（无法模糊匹配）',
    handlingGuide: '1. 停留在 alias_mapped 之前的状态\n2. 提示音乐老师补充曲目别名表\n3. 补完全部别名映射后才能进入下一步',
    rollbackGuide: '1. 删除错误的别名映射\n2. 重新匹配曲目名\n3. 或在别名表中新增正确的标准曲目名',
    example: '合同中写"夜曲Nocturne"，但别名表中只有"夜曲"，且未配置"Nocturne"为别名，系统提示补充。'
  },
  {
    id: 'rule-004',
    name: '同一曲目多条冲突记录',
    description: '同一场演出同一曲目出现多条缺货记录且数据冲突',
    detectionLogic: '同一场演出（同一snapshotId）中，同一standardTrackName出现多条记录，且缺货数量/备注不一致',
    handlingGuide: '1. 全部标记为边界场景\n2. 音乐老师需核对原始合同，保留正确的一条，删除重复/错误记录\n3. 巡演统筹复核最终结果',
    rollbackGuide: '1. 恢复所有冲突记录\n2. 重新核对原始行号和内容\n3. 合并或删除记录后重新确认',
    example: '同一合同页中，第3行和第7行都是"曲目A"，但缺货数量分别是5和8，系统全部标记待处理。'
  }
];

export interface BoundaryDetectionResult {
  isBoundary: boolean;
  matchedRules: BoundaryRule[];
  boundaryType?: string;
}

export function detectBoundaryCase(
  record: Partial<ShortageRecord>,
  allRecords: ShortageRecord[] = []
): BoundaryDetectionResult {
  const matchedRules: BoundaryRule[] = [];
  const content = `${record.originalContent || ''} ${record.currentNote || ''} ${record.trackName || ''}`;
  const contentLower = content.toLowerCase();

  if (BOUNDARY_KEYWORDS.some(kw => contentLower.includes(kw))) {
    matchedRules.push(BOUNDARY_RULES[0]);
  }

  const qty = record.shortageQuantity ?? 0;
  if (qty < 0 || qty > 1000) {
    matchedRules.push(BOUNDARY_RULES[1]);
  }

  const sameTrackRecords = allRecords.filter(
    r => r.id !== record.id &&
         r.snapshotId === record.snapshotId &&
         (r.standardTrackName === record.standardTrackName || r.trackName === record.trackName)
  );
  if (sameTrackRecords.length > 0) {
    const hasConflict = sameTrackRecords.some(r => r.shortageQuantity !== qty);
    if (hasConflict) {
      matchedRules.push(BOUNDARY_RULES[3]);
    }
  }

  return {
    isBoundary: matchedRules.length > 0,
    matchedRules,
    boundaryType: matchedRules.map(r => r.name).join('; ')
  };
}

export function getNextStatusAfterBoundaryCheck(
  currentStatus: string,
  isBoundary: boolean
): string {
  if (isBoundary) {
    return 'review_needed';
  }
  if (currentStatus === 'alias_mapped') {
    return 'confirmed';
  }
  return currentStatus;
}

export function canUserConfirm(
  status: string,
  userRole: 'music_teacher' | 'tour_coordinator' | 'operator'
): boolean {
  if (status === 'review_needed') {
    return userRole === 'tour_coordinator';
  }
  if (status === 'pending' || status === 'alias_mapped') {
    return userRole === 'music_teacher' || userRole === 'tour_coordinator';
  }
  return false;
}
