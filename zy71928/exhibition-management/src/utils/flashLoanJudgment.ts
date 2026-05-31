import {
  FlashLoanRequest,
  LoanItem,
  AutoJudgment,
  LoanChangeType,
  FlashLoanStatus,
  VersionDifference,
  Exhibition,
  Anomaly,
  User,
  Artwork,
} from '@/types';

const ALGORITHM_VERSION = 'v1.2.0';

const materialOnlyKeywords = [
  '补充', '更新', '修正', '完善', '添加', '说明', '文件', '资料',
  '出处', '来源', '证书', '审批', '备案', '登记', '记录',
];

const conclusionChangeKeywords = [
  '更换', '替换', '调整', '变更', '移除', '增加', '删除',
  '修改方案', '重新安排', '改变位置', '调换',
];

function analyzeLoanItem(item: LoanItem): {
  isMaterialOnly: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let isMaterialOnly = item.isMaterialOnly;

  const desc = item.changeDescription;
  const title = item.artworkTitle;

  if (item.impactLevel === 'high') {
    isMaterialOnly = false;
    reasons.push(`作品《${title}》变更影响等级为高`);
  }

  const hasMaterialKeyword = materialOnlyKeywords.some(kw => desc.includes(kw));
  const hasConclusionKeyword = conclusionChangeKeywords.some(kw => desc.includes(kw));

  if (hasMaterialKeyword && !hasConclusionKeyword) {
    if (isMaterialOnly) {
      reasons.push(`变更描述包含"${materialOnlyKeywords.find(kw => desc.includes(kw))}"，判定为补充材料`);
    }
  }

  if (hasConclusionKeyword) {
    isMaterialOnly = false;
    reasons.push(`变更描述包含"${conclusionChangeKeywords.find(kw => desc.includes(kw))}"，可能涉及方案调整`);
  }

  if (desc.includes('位置') || desc.includes('展墙')) {
    isMaterialOnly = false;
    reasons.push('涉及展示位置变更，可能影响布展方案');
  }

  if (desc.includes('尺寸') || desc.includes('大小')) {
    isMaterialOnly = false;
    reasons.push('涉及尺寸变更，可能影响布展方案');
  }

  if (isMaterialOnly && reasons.length === 0) {
    reasons.push('未检测到方案变更关键词，默认判定为补充材料');
  }

  return { isMaterialOnly, reasons };
}

function checkForAnomalies(exhibition: Exhibition): {
  hasDangerousAnomalies: boolean;
  anomalyReasons: string[];
} {
  const anomalyReasons: string[] = [];
  const unconfirmedAnomalies = exhibition.anomalies.filter(a => !a.confirmed);

  for (const anomaly of unconfirmedAnomalies) {
    if (anomaly.type === 'lighting_overridden') {
      anomalyReasons.push('存在未确认的灯光方案覆盖记录');
    }
    if (anomaly.type === 'dimension_unit_error') {
      anomalyReasons.push('存在未确认的尺寸单位错误');
    }
    if (anomaly.type === 'artwork_replaced_no_trace') {
      anomalyReasons.push('存在作品调换但缺少完整审批记录');
    }
    if (anomaly.type === 'note_silently_overwritten') {
      anomalyReasons.push('存在备注被静默覆盖的记录');
    }
  }

  return {
    hasDangerousAnomalies: unconfirmedAnomalies.some(a => a.severity === 'danger'),
    anomalyReasons,
  };
}

function compareWithPreviousRequest(
  newRequest: Omit<FlashLoanRequest, 'versionDiff'>,
  previousRequest: FlashLoanRequest,
  exhibition: Exhibition
): VersionDifference[] {
  const diffs: VersionDifference[] = [];

  const oldArtworkIds = previousRequest.changes.map(c => c.artworkId);
  const newArtworkIds = newRequest.changes.map(c => c.artworkId);

  const added = newArtworkIds.filter(id => !oldArtworkIds.includes(id));
  const removed = oldArtworkIds.filter(id => !newArtworkIds.includes(id));
  const common = oldArtworkIds.filter(id => newArtworkIds.includes(id));

  for (const id of added) {
    const item = newRequest.changes.find(c => c.artworkId === id)!;
    diffs.push({
      field: 'artwork',
      oldValue: '(无)',
      newValue: `新增：${item.artworkTitle} - ${item.changeDescription}`,
      changeType: 'artwork',
      requiresAttention: !item.isMaterialOnly,
    });
  }

  for (const id of removed) {
    const item = previousRequest.changes.find(c => c.artworkId === id)!;
    diffs.push({
      field: 'artwork',
      oldValue: `移除：${item.artworkTitle} - ${item.changeDescription}`,
      newValue: '(无)',
      changeType: 'artwork',
      requiresAttention: true,
    });
  }

  for (const id of common) {
    const oldItem = previousRequest.changes.find(c => c.artworkId === id)!;
    const newItem = newRequest.changes.find(c => c.artworkId === id)!;
    
    if (oldItem.changeDescription !== newItem.changeDescription) {
      diffs.push({
        field: 'changeDescription',
        oldValue: oldItem.changeDescription,
        newValue: newItem.changeDescription,
        changeType: 'artwork',
        requiresAttention: oldItem.isMaterialOnly !== newItem.isMaterialOnly,
      });
    }
  }

  for (const note of exhibition.curatorNotes) {
    if (note.isSupplement && 
        new Date(note.createdAt) > new Date(previousRequest.updatedAt) &&
        new Date(note.createdAt) <= new Date(newRequest.updatedAt)) {
      diffs.push({
        field: 'curatorNote',
        oldValue: '(无)',
        newValue: `新增备注 v${note.version}：${note.content.substring(0, 50)}...`,
        changeType: 'note',
        requiresAttention: true,
      });
    }
  }

  return diffs;
}

export function performAutoJudgment(
  changes: LoanItem[],
  exhibition: Exhibition,
  previousRequest?: FlashLoanRequest
): {
  judgment: AutoJudgment;
  finalStatus: FlashLoanStatus;
  changeType: LoanChangeType;
  curatorMessage: string;
  nextSteps: string[];
  versionDiffs?: VersionDifference[];
} {
  const allReasons: string[] = [];
  let allMaterialOnly = true;
  let anyConclusionChange = false;
  let needsConfirmation = false;

  for (const item of changes) {
    const analysis = analyzeLoanItem(item);
    allReasons.push(...analysis.reasons.map(r => `[${item.artworkTitle}] ${r}`));
    
    if (!analysis.isMaterialOnly) {
      allMaterialOnly = false;
      anyConclusionChange = true;
    }
  }

  const anomalyCheck = checkForAnomalies(exhibition);
  if (anomalyCheck.hasDangerousAnomalies) {
    needsConfirmation = true;
    allReasons.push(...anomalyCheck.anomalyReasons.map(r => `[异常检测] ${r}`));
  }

  let judgmentType: AutoJudgment['judgmentType'];
  let finalStatus: FlashLoanStatus;
  let changeType: LoanChangeType;

  if (needsConfirmation) {
    judgmentType = 'needs_confirmation';
    finalStatus = 'needs_confirmation';
    changeType = anyConclusionChange ? 'both' : 'material_supplement';
  } else if (allMaterialOnly) {
    judgmentType = 'material_only';
    finalStatus = 'material_only';
    changeType = 'material_supplement';
  } else {
    judgmentType = 'conclusion_changed';
    finalStatus = 'conclusion_changed';
    changeType = anyConclusionChange ? 'conclusion_revision' : 'both';
  }

  const confidence = calculateConfidence(changes, exhibition, judgmentType);

  const judgment: AutoJudgment = {
    judgmentType,
    reasons: allReasons,
    confidence,
    algorithmVersion: ALGORITHM_VERSION,
    judgedAt: new Date().toISOString(),
  };

  const curatorMessage = generateCuratorMessage(judgmentType, allReasons, changes);
  const nextSteps = generateNextSteps(judgmentType, changes, exhibition);

  let versionDiffs: VersionDifference[] | undefined;
  if (previousRequest) {
    versionDiffs = compareWithPreviousRequest(
      { ...previousRequest, ...{ changes, updatedAt: new Date().toISOString() } },
      previousRequest,
      exhibition
    );
    
    if (versionDiffs.length > 0) {
      allReasons.push(`[版本比对] 与上一版本相比有 ${versionDiffs.length} 处变化`);
    }
  }

  return {
    judgment,
    finalStatus,
    changeType,
    curatorMessage,
    nextSteps,
    versionDiffs,
  };
}

function calculateConfidence(
  changes: LoanItem[],
  _exhibition: Exhibition,
  judgmentType: AutoJudgment['judgmentType']
): number {
  let baseConfidence = 0.8;

  if (judgmentType === 'needs_confirmation') {
    baseConfidence = 0.6;
  }

  const clearItems = changes.filter(c => 
    c.changeDescription.length > 10 && 
    (c.isMaterialOnly || c.impactLevel !== 'low')
  );
  const clarityBonus = (clearItems.length / changes.length) * 0.2;

  return Math.min(0.99, Math.max(0.3, baseConfidence + clarityBonus));
}

function generateCuratorMessage(
  judgmentType: AutoJudgment['judgmentType'],
  reasons: string[],
  changes: LoanItem[]
): string {
  const count = changes.length;
  const materialCount = changes.filter(c => c.isMaterialOnly).length;
  const conclusionCount = count - materialCount;

  switch (judgmentType) {
    case 'material_only':
      return `本次快闪借调涉及 ${count} 件作品，全部为补充材料性质（${materialCount} 项）。` +
        `主要原因：${reasons.filter(r => !r.startsWith('[异常检测]')).slice(0, 2).join('；')}。` +
        `无需调整布展方案，请您确认后即可归档。`;

    case 'conclusion_changed':
      return `注意：本次快闪借调涉及 ${count} 件作品，其中 ${conclusionCount} 件涉及方案变更。` +
        `变更原因：${reasons.filter(r => r.includes('可能涉及')).slice(0, 2).join('；')}。` +
        `请您仔细审阅变更内容，确认是否需要调整最终布展方案。`;

    case 'needs_confirmation':
      return `重要提醒：本次借调存在 ${reasons.filter(r => r.startsWith('[异常检测]')).length} 项待确认异常。` +
        `异常包括：${reasons.filter(r => r.startsWith('[异常检测]')).join('；')}。` +
        `请您先处理这些异常（如确认尺寸单位、补充审批记录等），再继续审批借调。` +
        `异常未处理前，相关作品将标记为"待确认"状态，不会混入正常布展清单。`;

    default:
      return `请审阅本次快闪借调的 ${count} 项变更。`;
  }
}

function generateNextSteps(
  judgmentType: AutoJudgment['judgmentType'],
  changes: LoanItem[],
  exhibition: Exhibition
): string[] {
  const steps: string[] = [];
  const unconfirmedAnomalies = exhibition.anomalies.filter(a => !a.confirmed);

  switch (judgmentType) {
    case 'material_only':
      steps.push('策展人确认补充材料已收到并完整');
      steps.push('在布展清单备注栏更新补充说明');
      steps.push('将本次借调归档，无需调整布展位置');
      break;

    case 'conclusion_changed':
      steps.push('策展人逐项审阅方案变更内容');
      steps.push(`确认 ${changes.filter(c => !c.isMaterialOnly).length} 项方案调整的必要性`);
      steps.push('如需调整，更新布展清单的作品位置或顺序');
      steps.push('通知画廊助理执行变更后的布展方案');
      steps.push('重新生成最终布展清单');
      break;

    case 'needs_confirmation':
      steps.push(`优先处理 ${unconfirmedAnomalies.length} 项未确认异常`);
      for (const anomaly of unconfirmedAnomalies.slice(0, 3)) {
        steps.push(`- 确认异常：${anomaly.description.substring(0, 30)}...`);
      }
      steps.push('所有异常确认无误后，再次审阅借调内容');
      steps.push('异常处理期间，相关作品保持"待确认"状态');
      break;
  }

  steps.push('审批完成后，系统自动更新布展清单状态');

  return steps;
}

export function createFlashLoanRequest(
  exhibitionId: string,
  title: string,
  description: string,
  changes: LoanItem[],
  submitter: User,
  exhibition: Exhibition,
  previousRequest?: FlashLoanRequest
): FlashLoanRequest {
  const now = new Date().toISOString();
  const requestNumber = `FL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

  const autoResult = performAutoJudgment(changes, exhibition, previousRequest);

  return {
    id: `fl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    exhibitionId,
    requestNumber,
    title,
    description,
    changes,
    submittedBy: submitter.id,
    submittedAt: now,
    status: autoResult.finalStatus,
    changeType: autoResult.changeType,
    autoJudgment: autoResult.judgment,
    nextSteps: autoResult.nextSteps,
    curatorMessage: autoResult.curatorMessage,
    previousRequestId: previousRequest?.id,
    versionDiff: autoResult.versionDiffs,
    updatedAt: now,
  };
}

export function manuallyOverrideJudgment(
  request: FlashLoanRequest,
  newStatus: FlashLoanStatus,
  overrideReason: string,
  operator: User
): FlashLoanRequest {
  return {
    ...request,
    status: newStatus,
    manualOverride: true,
    overrideReason,
    overrideBy: operator.id,
    updatedAt: new Date().toISOString(),
  };
}

export function detectArtworkReplacementAnomaly(
  oldArtwork: Artwork,
  newArtwork: Artwork,
  changeLogs: Array<{ changeType: string; entityId: string }>
): Anomaly | null {
  const hasReplacementLog = changeLogs.some(
    log => log.changeType === 'artwork_replaced' && log.entityId === oldArtwork.id
  );

  if (!hasReplacementLog) {
    return {
      id: `an-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      exhibitionId: oldArtwork.id.startsWith('a') ? 'exh-001' : '',
      type: 'artwork_replaced_no_trace',
      description: `作品《${oldArtwork.title}》被调换为《${newArtwork.title}》，但缺少完整的变更审批记录`,
      entityId: oldArtwork.id,
      entityType: 'artwork',
      severity: 'danger',
      confirmed: false,
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

export function generateLayoutList(
  exhibition: Exhibition,
  generator: User
): { layoutList: any; warnings: string[] } {
  const warnings: string[] = [];
  const activeArtworks = exhibition.artworks.filter(a => a.status !== 'replaced');

  const unconfirmedCount = exhibition.anomalies.filter(a => !a.confirmed).length;
  const hasUnconfirmedDanger = exhibition.anomalies.some(a => !a.confirmed && a.severity === 'danger');

  if (unconfirmedCount > 0) {
    warnings.push(`存在 ${unconfirmedCount} 项未确认异常`);
    if (hasUnconfirmedDanger) {
      warnings.push('警告：存在未处理的严重异常，布展清单可能不准确');
    }
  }

  const unitIssues = activeArtworks.filter(a => !a.unitConfirmed);
  if (unitIssues.length > 0) {
    warnings.push(`${unitIssues.length} 件作品尺寸单位未最终确认`);
  }

  const layoutList = {
    exhibitionId: exhibition.id,
    version: Date.now(),
    artworks: activeArtworks.map((artwork, index) => ({
      artworkId: artwork.id,
      title: artwork.title,
      artist: artwork.artist,
      dimensions: `${artwork.width} × ${artwork.height} ${artwork.unit}`,
      location: artwork.location,
      sequence: index + 1,
      status: artwork.status,
    })),
    generatedAt: new Date().toISOString(),
    generatedBy: generator.id,
    hasAnomalies: unconfirmedCount > 0,
    anomalyCount: unconfirmedCount,
    pendingConfirmationCount: activeArtworks.filter(a => a.status === 'pending_confirmation').length,
  };

  return { layoutList, warnings };
}
