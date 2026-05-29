import { useState, useCallback } from 'react';
import { WorkVersion, VersionDiff, ColorSample } from '../types';
import { useWorkStore } from '../store/useWorkStore';
import { db } from '../db';

interface UseWorkHistoryReturn {
  isLoading: boolean;
  error: string | null;
  versions: WorkVersion[];
  loadVersions: (workId: string) => Promise<void>;
  compareVersions: (versionId1: string, versionId2: string) => Promise<VersionDiff | null>;
  getVersionLabel: (version: WorkVersion) => string;
  getVersionStatusBadge: (version: WorkVersion) => { text: string; color: string };
}

export function useWorkHistory(): UseWorkHistoryReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<WorkVersion[]>([]);

  const getWorkVersions = useWorkStore(state => state.getWorkVersions);

  const loadVersions = useCallback(async (workId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const workVersions = await getWorkVersions(workId);
      setVersions(workVersions);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [getWorkVersions]);

  const compareVersions = useCallback(async (
    versionId1: string,
    versionId2: string
  ): Promise<VersionDiff | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const [v1, v2] = await Promise.all([
        db.getVersionWithAnalysis(versionId1),
        db.getVersionWithAnalysis(versionId2)
      ]);

      if (!v1 || !v2) return null;

      const colors1 = v1.colors.filter(c => !c.isBackground && !c.isExtreme);
      const colors2 = v2.colors.filter(c => !c.isBackground && !c.isExtreme);

      const colorMap1 = new Map(colors1.map(c => [c.hex, c]));
      const colorMap2 = new Map(colors2.map(c => [c.hex, c]));

      const allHexes = new Set([...colorMap1.keys(), ...colorMap2.keys()]);

      const colorChanges: VersionDiff['colorChanges'] = [];

      for (const hex of allHexes) {
        const c1 = colorMap1.get(hex);
        const c2 = colorMap2.get(hex);

        if (c1 && !c2) {
          colorChanges.push({
            hex,
            oldPercentage: c1.percentage,
            newPercentage: 0,
            change: 'removed'
          });
        } else if (!c1 && c2) {
          colorChanges.push({
            hex,
            oldPercentage: 0,
            newPercentage: c2.percentage,
            change: 'added'
          });
        } else if (c1 && c2 && Math.abs(c1.percentage - c2.percentage) > 1) {
          colorChanges.push({
            hex,
            oldPercentage: c1.percentage,
            newPercentage: c2.percentage,
            change: 'modified'
          });
        }
      }

      const issueMap1 = new Map(v1.issues.map(i => [`${i.type}-${i.colorHex}`, i]));
      const issueMap2 = new Map(v2.issues.map(i => [`${i.type}-${i.colorHex}`, i]));

      const allIssueKeys = new Set([...issueMap1.keys(), ...issueMap2.keys()]);

      const addedIssues: VersionDiff['issueChanges']['added'] = [];
      const removedIssues: VersionDiff['issueChanges']['removed'] = [];
      const modifiedIssues: VersionDiff['issueChanges']['modified'] = [];

      for (const key of allIssueKeys) {
        const i1 = issueMap1.get(key);
        const i2 = issueMap2.get(key);

        if (i1 && !i2) {
          removedIssues.push(i1);
        } else if (!i1 && i2) {
          addedIssues.push(i2);
        } else if (i1 && i2 && i1.severity !== i2.severity) {
          modifiedIssues.push(i2);
        }
      }

      const scoreChange = (v2.comment?.overallScore || 0) - (v1.comment?.overallScore || 0);

      const diff: VersionDiff = {
        version1: v1.version,
        version2: v2.version,
        colorChanges: colorChanges.sort((a, b) => Math.abs(b.newPercentage - b.oldPercentage) - Math.abs(a.newPercentage - a.oldPercentage)),
        scoreChange,
        issueChanges: {
          added: addedIssues,
          removed: removedIssues,
          modified: modifiedIssues
        },
        commentChange: v2.comment?.content !== v1.comment?.content ? v2.comment?.content : undefined
      };

      return diff;
    } catch (err) {
      const message = err instanceof Error ? err.message : '对比失败';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getVersionLabel = useCallback((version: WorkVersion): string => {
    return `版本 ${version.versionNumber}`;
  }, []);

  const getVersionStatusBadge = useCallback((version: WorkVersion): { text: string; color: string } => {
    if (version.dataGaps.forcedImport) {
      return { text: '强制导入', color: '#d46c3a' };
    }
    if (version.dataGaps.incomplete) {
      return { text: '数据不完整', color: '#e9c46a' };
    }
    if (version.dataGaps.warnings.length > 0) {
      return { text: '有警告', color: '#e9c46a' };
    }
    return { text: '正常', color: '#2d6a4f' };
  }, []);

  return {
    isLoading,
    error,
    versions,
    loadVersions,
    compareVersions,
    getVersionLabel,
    getVersionStatusBadge
  };
}
