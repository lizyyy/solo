import type { Bubble, BubbleVersion, RevisionLog } from '../types';
import { generateId } from '../utils/helpers';

export class VersionManager {
  static checkAndCreateVersion(
    existingBubble: Bubble | undefined,
    newData: Omit<BubbleVersion, 'id' | 'version' | 'createdAt'>
  ): { bubble: Bubble; newVersion: BubbleVersion; isConflict: boolean } {
    if (!existingBubble) {
      const bubbleId = generateId();
      const versionId = generateId();
      return {
        bubble: {
          id: bubbleId,
          pageId: newData.bubbleId.split(':')[0],
          sequenceNumber: parseInt(newData.bubbleId.split(':')[1]),
          compositeKey: newData.bubbleId,
          currentVersionId: versionId,
          latestVersion: 1,
          hasConflict: false,
          status: 'PENDING',
        },
        newVersion: {
          ...newData,
          id: versionId,
          version: 1,
          createdAt: new Date().toISOString(),
        },
        isConflict: false,
      };
    }

    const newVersionNum = existingBubble.latestVersion + 1;
    const versionId = generateId();
    return {
      bubble: {
        ...existingBubble,
        latestVersion: newVersionNum,
        hasConflict: true,
        status: 'PENDING',
      },
      newVersion: {
        ...newData,
        id: versionId,
        version: newVersionNum,
        createdAt: new Date().toISOString(),
      },
      isConflict: true,
    };
  }

  static setCurrentVersion(
    bubble: Bubble,
    versionId: string,
    allVersions: BubbleVersion[]
  ): { bubble: Bubble; updatedVersions: BubbleVersion[]; revisions: RevisionLog[] } {
    const targetVersion = allVersions.find(v => v.id === versionId);
    if (!targetVersion) {
      return { bubble, updatedVersions: allVersions, revisions: [] };
    }

    const revisions: RevisionLog[] = [];
    const updatedVersions = allVersions.map(v => {
      if (v.id === versionId) {
        const oldStatus = v.status;
        const newStatus = oldStatus === 'HISTORY' ? 'PENDING' : oldStatus;
        if (oldStatus !== newStatus) {
          revisions.push({
            id: generateId(),
            versionId: v.id,
            fieldName: 'status',
            oldValue: oldStatus,
            newValue: newStatus,
            operator: 'system',
            operatedAt: new Date().toISOString(),
          });
        }
        return { ...v, status: newStatus };
      }
      if (v.status !== 'HISTORY') {
        revisions.push({
          id: generateId(),
          versionId: v.id,
          fieldName: 'status',
          oldValue: v.status,
          newValue: 'HISTORY',
          operator: 'system',
          operatedAt: new Date().toISOString(),
        });
        return { ...v, status: 'HISTORY' as const };
      }
      return v;
    });

    return {
      bubble: {
        ...bubble,
        currentVersionId: versionId,
        hasConflict: false,
        status: targetVersion.status === 'HISTORY' ? 'PENDING' : targetVersion.status,
      },
      updatedVersions,
      revisions,
    };
  }

  static updateBubbleStatus(
    version: BubbleVersion,
    newStatus: BubbleVersion['status'],
    operator: string,
    remark?: string
  ): { updatedVersion: BubbleVersion; revision: RevisionLog } {
    const oldStatus = version.status;
    const updatedVersion = {
      ...version,
      status: newStatus,
      remark: remark || version.remark,
    };

    const revision: RevisionLog = {
      id: generateId(),
      versionId: version.id,
      fieldName: 'status',
      oldValue: oldStatus,
      newValue: newStatus,
      operator,
      operatedAt: new Date().toISOString(),
    };

    return { updatedVersion, revision };
  }

  static createRevision(
    versionId: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
    operator: string
  ): RevisionLog {
    return {
      id: generateId(),
      versionId,
      fieldName,
      oldValue,
      newValue,
      operator,
      operatedAt: new Date().toISOString(),
    };
  }
}
