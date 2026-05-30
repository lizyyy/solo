import type {
  BandRequirement,
  VersionRecord,
  ChangeDiff,
  Channel,
  Monitor
} from '@/types';
import { generateId, arrayDiff } from './helpers';

export function createVersion(
  requirement: BandRequirement,
  changeSummary: string
): VersionRecord {
  return {
    id: generateId(),
    requirementId: requirement.id,
    versionNumber: requirement.currentVersion,
    snapshot: JSON.parse(JSON.stringify(requirement)),
    changeSummary,
    createdAt: new Date().toISOString(),
    createdBy: 'current_user'
  };
}

export function compareVersions(
  v1: BandRequirement,
  v2: BandRequirement
): ChangeDiff {
  const channelDiff = arrayDiff<Channel>(v1.channels, v2.channels);
  const monitorDiff = arrayDiff<Monitor>(v1.monitors, v2.monitors);

  return {
    channels: channelDiff,
    monitors: monitorDiff,
    changeOverTime:
      v1.changeOverTime !== v2.changeOverTime
        ? { from: v1.changeOverTime, to: v2.changeOverTime }
        : null,
    stageNotes:
      v1.stageNotes !== v2.stageNotes
        ? { from: v1.stageNotes, to: v2.stageNotes }
        : null,
    startTime:
      v1.startTime !== v2.startTime
        ? { from: v1.startTime, to: v2.startTime }
        : null,
    endTime:
      v1.endTime !== v2.endTime
        ? { from: v1.endTime, to: v2.endTime }
        : null
  };
}

export function generateChangeSummary(diff: ChangeDiff): string {
  const changes: string[] = [];

  if (diff.channels.added.length > 0) {
    changes.push(`新增 ${diff.channels.added.length} 个通道`);
  }
  if (diff.channels.removed.length > 0) {
    changes.push(`删除 ${diff.channels.removed.length} 个通道`);
  }
  if (diff.channels.modified.length > 0) {
    changes.push(`修改 ${diff.channels.modified.length} 个通道`);
  }

  if (diff.monitors.added.length > 0) {
    changes.push(`新增 ${diff.monitors.added.length} 个返听`);
  }
  if (diff.monitors.removed.length > 0) {
    changes.push(`删除 ${diff.monitors.removed.length} 个返听`);
  }
  if (diff.monitors.modified.length > 0) {
    changes.push(`修改 ${diff.monitors.modified.length} 个返听配置`);
  }

  if (diff.changeOverTime) {
    changes.push(
      `换场时间: ${diff.changeOverTime.from}分钟 → ${diff.changeOverTime.to}分钟`
    );
  }

  if (diff.startTime) {
    changes.push(`演出开始: ${diff.startTime.from} → ${diff.startTime.to}`);
  }
  if (diff.endTime) {
    changes.push(`演出结束: ${diff.endTime.from} → ${diff.endTime.to}`);
  }

  if (diff.stageNotes) {
    changes.push('修改舞台备注');
  }

  return changes.length > 0 ? changes.join('；') : '无实质性变更';
}

export function getVersionsForRequirement(
  versions: VersionRecord[],
  requirementId: string
): VersionRecord[] {
  return versions
    .filter((v) => v.requirementId === requirementId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export function getLatestVersion(
  versions: VersionRecord[],
  requirementId: string
): VersionRecord | null {
  const reqVersions = getVersionsForRequirement(versions, requirementId);
  return reqVersions.length > 0 ? reqVersions[0] : null;
}

export function getVersionByNumber(
  versions: VersionRecord[],
  requirementId: string,
  versionNumber: number
): VersionRecord | null {
  return (
    versions.find(
      (v) => v.requirementId === requirementId && v.versionNumber === versionNumber
    ) || null
  );
}
