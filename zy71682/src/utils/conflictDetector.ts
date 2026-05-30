import type { BandRequirement, Channel, Conflict } from '@/types';
import { ConflictType } from '@/types';
import { generateId, calculateMinutes } from './helpers';

export function detectChannelDuplicates(channels: Channel[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const nameMap = new Map<string, Channel[]>();

  channels.forEach((ch) => {
    const existing = nameMap.get(ch.name) || [];
    nameMap.set(ch.name, [...existing, ch]);
  });

  nameMap.forEach((items, name) => {
    if (items.length > 1) {
      conflicts.push({
        id: generateId(),
        type: ConflictType.CHANNEL_DUPLICATE,
        description: `通道名称"${name}"重复使用 ${items.length} 次`,
        severity: 'error',
        relatedItemIds: items.map((i) => i.id),
        resolved: false
      });
    }
  });

  return conflicts;
}

export function detectMonitorMissing(
  channels: Channel[],
  monitors: { mix: Record<string, number> }[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  const channelIds = new Set(channels.map((c) => c.id));

  monitors.forEach((monitor, monitorIndex) => {
    Object.keys(monitor.mix).forEach((channelId) => {
      if (!channelIds.has(channelId)) {
        conflicts.push({
          id: generateId(),
          type: ConflictType.MONITOR_MISSING,
          description: `返听 #${monitorIndex + 1} 引用了不存在的通道 ID: ${channelId}`,
          severity: 'warning',
          relatedItemIds: [channelId],
          resolved: false
        });
      }
    });
  });

  return conflicts;
}

export function detectChangeOverTimeout(
  req: BandRequirement,
  allRequirements: BandRequirement[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  const sameDayReqs = allRequirements
    .filter((r) => r.performanceDate === req.performanceDate && r.id !== req.id)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const currentIndex = sameDayReqs.findIndex((r) => r.id === req.id);

  if (currentIndex > 0) {
    const prevReq = sameDayReqs[currentIndex - 1];
    const actualChangeOver = calculateMinutes(prevReq.endTime, req.startTime);

    if (actualChangeOver < req.changeOverTime) {
      conflicts.push({
        id: generateId(),
        type: ConflictType.CHANGE_OVER_TIMEOUT,
        description: `换场时间不足：需要 ${req.changeOverTime} 分钟，与"${prevReq.bandName}"之间实际只有 ${actualChangeOver} 分钟`,
        severity: 'error',
        relatedItemIds: [prevReq.id, req.id],
        resolved: false
      });
    }
  }

  if (currentIndex >= 0 && currentIndex < sameDayReqs.length - 1) {
    const nextReq = sameDayReqs[currentIndex + 1];
    const actualChangeOver = calculateMinutes(req.endTime, nextReq.startTime);

    if (actualChangeOver < nextReq.changeOverTime) {
      conflicts.push({
        id: generateId(),
        type: ConflictType.CHANGE_OVER_TIMEOUT,
        description: `后续换场时间不足："${nextReq.bandName}"需要 ${nextReq.changeOverTime} 分钟，实际只有 ${actualChangeOver} 分钟`,
        severity: 'error',
        relatedItemIds: [req.id, nextReq.id],
        resolved: false
      });
    }
  }

  return conflicts;
}

export function detectAllConflicts(
  req: BandRequirement,
  allRequirements: BandRequirement[]
): Conflict[] {
  const channelConflicts = detectChannelDuplicates(req.channels);
  const monitorConflicts = detectMonitorMissing(req.channels, req.monitors);
  const scheduleConflicts = detectChangeOverTimeout(req, allRequirements);

  return [...channelConflicts, ...monitorConflicts, ...scheduleConflicts];
}

export function hasUnresolvedConflicts(conflicts: Conflict[]): boolean {
  return conflicts.some((c) => !c.resolved && c.severity === 'error');
}

export function detectGlobalChannelConflicts(
  allRequirements: BandRequirement[]
): Map<string, Conflict[]> {
  const result = new Map<string, Conflict[]>();
  const channelUsage = new Map<string, { reqId: string; bandName: string }[]>();

  allRequirements.forEach((req) => {
    req.channels.forEach((ch) => {
      const existing = channelUsage.get(ch.name) || [];
      channelUsage.set(ch.name, [
        ...existing,
        { reqId: req.id, bandName: req.bandName }
      ]);
    });
  });

  channelUsage.forEach((usages, channelName) => {
    if (usages.length > 1) {
      const reqIds = usages.map((u) => u.reqId);
      const conflict: Conflict = {
        id: generateId(),
        type: ConflictType.CHANNEL_DUPLICATE,
        description: `通道"${channelName}"被 ${usages.length} 个乐队使用: ${usages.map((u) => u.bandName).join(', ')}`,
        severity: 'error',
        relatedItemIds: reqIds,
        resolved: false
      };

      reqIds.forEach((reqId) => {
        const existing = result.get(reqId) || [];
        result.set(reqId, [...existing, conflict]);
      });
    }
  });

  return result;
}
