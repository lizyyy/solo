import { DateTime } from 'luxon';
import {
  DataContext,
  Issue,
  IssueType,
  IssueSeverity,
  ValidationResult,
  ReviewSummary,
  LinenTag,
  LaundryBatch,
  Room
} from './types';

function generateIssueId(): string {
  return `ISSUE_${DateTime.now().toFormat('yyyyMMddHHmmss')}_${Math.random().toString(36).substring(2, 8)}`;
}

function createIssue(
  type: IssueType,
  severity: IssueSeverity,
  title: string,
  description: string,
  affectedEntities: string[],
  storeId: string,
  details: Record<string, unknown> = {}
): Issue {
  return {
    id: generateIssueId(),
    type,
    severity,
    title,
    description,
    affectedEntities,
    storeId,
    timestamp: DateTime.now().toISO(),
    details
  };
}

export function detectDuplicateTagsInBatch(batch: LaundryBatch): Issue[] {
  const issues: Issue[] = [];
  const tagCounts: Record<string, number> = {};

  batch.tags.forEach(tag => {
    tagCounts[tag.tagId] = (tagCounts[tag.tagId] || 0) + 1;
  });

  Object.entries(tagCounts).forEach(([tagId, count]) => {
    if (count > 1) {
      const duplicateScans = batch.tags
        .filter(t => t.tagId === tagId)
        .map(t => t.scanTime);

      issues.push(createIssue(
        IssueType.DUPLICATE_TAG_IN_BATCH,
        IssueSeverity.ERROR,
        `标签 ${tagId} 在批次 ${batch.batchId} 中重复入袋`,
        `标签 ${tagId} 在批次 ${batch.batchId} 中被扫描 ${count} 次，扫描时间分别为: ${duplicateScans.join(', ')}`,
        [tagId, batch.batchId],
        batch.storeId,
        {
          batchId: batch.batchId,
          tagId,
          scanCount: count,
          scanTimes: duplicateScans
        }
      ));
    }
  });

  return issues;
}

export function detectCrossStoreMix(batch: LaundryBatch, linenTags: LinenTag[]): Issue[] {
  const issues: Issue[] = [];
  const batchStoreId = batch.storeId;

  const tagStoreMap: Record<string, string> = {};
  linenTags.forEach(tag => {
    tagStoreMap[tag.tagId] = tag.storeId;
  });

  const crossStoreTags: string[] = [];
  batch.tags.forEach(batchTag => {
    const tagStoreId = tagStoreMap[batchTag.tagId];
    if (tagStoreId && tagStoreId !== batchStoreId) {
      crossStoreTags.push(batchTag.tagId);
    }
  });

  if (crossStoreTags.length > 0) {
    issues.push(createIssue(
      IssueType.CROSS_STORE_MIX,
      IssueSeverity.ERROR,
      `批次 ${batch.batchId} 存在跨店混包`,
      `批次 ${batch.batchId} 属于门店 ${batchStoreId}，但包含来自其他门店的标签: ${crossStoreTags.join(', ')}`,
      [batch.batchId, ...crossStoreTags],
      batchStoreId,
      {
        batchId: batch.batchId,
        batchStoreId,
        crossStoreTags,
        tagStoreMap: crossStoreTags.reduce((acc, tagId) => {
          acc[tagId] = tagStoreMap[tagId];
          return acc;
        }, {} as Record<string, string>)
      }
    ));
  }

  return issues;
}

export function detectOverdueReturns(batches: LaundryBatch[], currentTime: DateTime): Issue[] {
  const issues: Issue[] = [];

  batches.forEach(batch => {
    if (batch.status === '已送洗' && batch.expectedReturn && !batch.returnedAt) {
      const expectedReturn = DateTime.fromISO(batch.expectedReturn);
      if (currentTime > expectedReturn) {
        const overdueHours = currentTime.diff(expectedReturn, 'hours').hours;
        issues.push(createIssue(
          IssueType.OVERDUE_RETURN,
          IssueSeverity.ERROR,
          `批次 ${batch.batchId} 超时未回`,
          `批次 ${batch.batchId} 预计返回时间为 ${batch.expectedReturn}，当前已超时 ${overdueHours.toFixed(1)} 小时`,
          [batch.batchId],
          batch.storeId,
          {
            batchId: batch.batchId,
            expectedReturn: batch.expectedReturn,
            overdueHours: overdueHours.toFixed(2),
            vendorId: batch.vendorId
          }
        ));
      }
    }
  });

  return issues;
}

export function detectSoilLevelMismatches(
  linenTags: LinenTag[],
  vendorRules: Record<string, string[]>
): Issue[] {
  const issues: Issue[] = [];

  linenTags.forEach(tag => {
    const soilLevel = tag.soilLevel;
    const linenType = tag.type;

    if (soilLevel === '未知') {
      issues.push(createIssue(
        IssueType.UNKNOWN_SOIL_LEVEL,
        IssueSeverity.WARNING,
        `标签 ${tag.tagId} 脏污等级未知`,
        `标签 ${tag.tagId} (${linenType}) 的脏污等级为未知，无法匹配洗涤规则`,
        [tag.tagId],
        tag.storeId,
        {
          tagId: tag.tagId,
          linenType,
          soilLevel
        }
      ));
    } else {
      const vendorKey = `${tag.storeId}_${linenType}`;
      const validSoilLevels = vendorRules[vendorKey] || [];

      if (validSoilLevels.length > 0 && !validSoilLevels.includes(soilLevel)) {
        issues.push(createIssue(
          IssueType.SOIL_LEVEL_RULE_MISMATCH,
          IssueSeverity.WARNING,
          `标签 ${tag.tagId} 脏污等级与洗涤规则不匹配`,
          `标签 ${tag.tagId} (${linenType}) 的脏污等级为 ${soilLevel}，不在供应商洗涤规则的有效范围内: ${validSoilLevels.join(', ')}`,
          [tag.tagId],
          tag.storeId,
          {
            tagId: tag.tagId,
            linenType,
            soilLevel,
            validSoilLevels
          }
        ));
      }
    }
  });

  return issues;
}

export function detectMissingRfidScans(rooms: Room[], linenTags: LinenTag[]): Issue[] {
  const issues: Issue[] = [];
  const tagScanMap: Record<string, string> = {};

  linenTags.forEach(tag => {
    tagScanMap[tag.tagId] = tag.lastScan;
  });

  rooms.forEach(room => {
    const roomTags = linenTags.filter(tag =>
      tag.scanLocation.includes(room.roomNumber) ||
      tag.lastScan >= room.checkoutTime
    );

    const unscannedTags = linenTags.filter(tag =>
      tag.storeId === room.storeId &&
      !roomTags.some(rt => rt.tagId === tag.tagId)
    );

    if (unscannedTags.length > 0) {
      issues.push(createIssue(
        IssueType.MISSING_RFID_SCAN,
        IssueSeverity.WARNING,
        `客房 ${room.roomNumber} 退房后部分布草缺少 RFID 扫描`,
        `客房 ${room.roomNumber} 于 ${room.checkoutTime} 退房，以下布草标签缺少退房后的 RFID 扫描: ${unscannedTags.map(t => t.tagId).join(', ')}`,
        [room.roomNumber, ...unscannedTags.map(t => t.tagId)],
        room.storeId,
        {
          roomNumber: room.roomNumber,
          checkoutTime: room.checkoutTime,
          missingTags: unscannedTags.map(t => ({
            tagId: t.tagId,
            type: t.type,
            lastScan: t.lastScan
          }))
        }
      ));
    }
  });

  return issues;
}

export function detectCrossMidnightCheckouts(rooms: Room[]): Issue[] {
  const issues: Issue[] = [];

  rooms.forEach(room => {
    const checkoutTime = DateTime.fromISO(room.checkoutTime);
    const hour = checkoutTime.hour;

    if (hour >= 0 && hour < 6) {
      issues.push(createIssue(
        IssueType.CROSS_MIDNIGHT_CHECKOUT,
        IssueSeverity.INFO,
        `客房 ${room.roomNumber} 存在跨午夜退房`,
        `客房 ${room.roomNumber} 于 ${room.checkoutTime} 退房，时间在凌晨 0:00-6:00 之间，请注意确认是否为实际退房时间`,
        [room.roomNumber],
        room.storeId,
        {
          roomNumber: room.roomNumber,
          checkoutTime: room.checkoutTime,
          hour
        }
      ));
    }
  });

  return issues;
}

export function detectUnsentBatches(batches: LaundryBatch[]): Issue[] {
  const issues: Issue[] = [];

  batches.forEach(batch => {
    if (batch.status === '已创建' && !batch.sentAt) {
      const createdAt = DateTime.fromISO(batch.createdAt);
      const now = DateTime.now();
      const pendingHours = now.diff(createdAt, 'hours').hours;

      issues.push(createIssue(
        IssueType.BATCH_NOT_SENT,
        IssueSeverity.WARNING,
        `批次 ${batch.batchId} 已创建但未送洗`,
        `批次 ${batch.batchId} 于 ${batch.createdAt} 创建，但尚未送洗，已等待 ${pendingHours.toFixed(1)} 小时`,
        [batch.batchId],
        batch.storeId,
        {
          batchId: batch.batchId,
          createdAt: batch.createdAt,
          pendingHours: pendingHours.toFixed(2)
        }
      ));
    }
  });

  return issues;
}

export function buildVendorRulesMap(vendorRules: any[]): Record<string, Record<string, string[]>> {
  const ruleMap: Record<string, Record<string, string[]>> = {};

  vendorRules.forEach(rule => {
    const key = `${rule.vendorId}_${rule.linenType}`;
    if (!ruleMap[key]) {
      ruleMap[key] = {};
    }
    if (!ruleMap[key][rule.linenType]) {
      ruleMap[key][rule.linenType] = [];
    }
    if (!ruleMap[key][rule.linenType].includes(rule.soilLevel)) {
      ruleMap[key][rule.linenType].push(rule.soilLevel);
    }
  });

  return ruleMap;
}

export function analyzeData(context: DataContext): { issues: Issue[]; warnings: Issue[]; infos: Issue[] } {
  const allIssues: Issue[] = [];
  const allWarnings: Issue[] = [];
  const allInfos: Issue[] = [];

  const currentTime = DateTime.now();
  const vendorRulesMap = buildVendorRulesMap(context.vendorRules);

  context.laundryBatches.forEach(batch => {
    allIssues.push(...detectDuplicateTagsInBatch(batch));
    allIssues.push(...detectCrossStoreMix(batch, context.linenTags));
  });

  allIssues.push(...detectOverdueReturns(context.laundryBatches, currentTime));

  allWarnings.push(...detectMissingRfidScans(context.rooms, context.linenTags));
  allWarnings.push(...detectUnsentBatches(context.laundryBatches));

  const simplifiedVendorMap: Record<string, string[]> = {};
  context.vendorRules.forEach(rule => {
    const key = `${rule.vendorId}_${rule.linenType}`;
    if (!simplifiedVendorMap[key]) {
      simplifiedVendorMap[key] = [];
    }
    if (!simplifiedVendorMap[key].includes(rule.soilLevel)) {
      simplifiedVendorMap[key].push(rule.soilLevel);
    }
  });

  allWarnings.push(...detectSoilLevelMismatches(context.linenTags, simplifiedVendorMap));

  allInfos.push(...detectCrossMidnightCheckouts(context.rooms));

  return {
    issues: allIssues,
    warnings: allWarnings,
    infos: allInfos
  };
}

export function validateData(context: DataContext): ValidationResult {
  const { issues, warnings } = analyzeData(context);

  return {
    isValid: issues.length === 0,
    issues,
    warnings
  };
}

export function generateReviewSummary(
  context: DataContext,
  issues: Issue[],
  warnings: Issue[],
  infos: Issue[]
): ReviewSummary {
  const allIssues = [...issues, ...warnings, ...infos];

  const issuesByType: Partial<Record<IssueType, number>> = {};
  const issuesByStore: Record<string, number> = {};

  allIssues.forEach(issue => {
    issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
    issuesByStore[issue.storeId] = (issuesByStore[issue.storeId] || 0) + 1;
  });

  return {
    totalRooms: context.rooms.length,
    totalTags: context.linenTags.length,
    totalBatches: context.laundryBatches.length,
    crossMidnightCheckouts: infos.filter(i => i.type === 'CROSS_MIDNIGHT_CHECKOUT').length,
    issuesByType: issuesByType as Record<IssueType, number>,
    issuesByStore,
    overdueBatches: issues.filter(i => i.type === 'OVERDUE_RETURN').length,
    duplicateTags: issues.filter(i => i.type === 'DUPLICATE_TAG_IN_BATCH').length,
    crossStoreMixes: issues.filter(i => i.type === 'CROSS_STORE_MIX').length
  };
}