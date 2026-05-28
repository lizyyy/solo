import { Artwork, VersionEntry } from '../types/artwork';

export function mergeArtworkVersions(existing: Artwork, newData: Partial<Artwork>): Artwork {
  const newVersion: VersionEntry = {
    version: generateNextVersion(existing.dataVersion),
    timestamp: new Date().toISOString(),
    fields: { ...newData },
    note: '自动合并新版本数据'
  };

  const merged: Artwork = {
    ...existing,
    ...newData,
    dataVersion: newVersion.version,
    versionHistory: [...existing.versionHistory, newVersion]
  };

  return merged;
}

export function generateNextVersion(currentVersion: string): string {
  const match = currentVersion.match(/^v(\d+)\.(\d+)$/);
  if (match) {
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10) + 1;
    return `v${major}.${minor}`;
  }
  return 'v1.0';
}

export function getVersionDiff(version1: VersionEntry, version2: VersionEntry): string[] {
  const differences: string[] = [];
  const allKeys = new Set([
    ...Object.keys(version1.fields),
    ...Object.keys(version2.fields)
  ]);

  allKeys.forEach(key => {
    const v1 = JSON.stringify(version1.fields[key]);
    const v2 = JSON.stringify(version2.fields[key]);
    if (v1 !== v2) {
      differences.push(`${key}: ${v1 || '无'} → ${v2 || '无'}`);
    }
  });

  return differences;
}

export function rollbackToVersion(artwork: Artwork, targetVersion: string): Artwork {
  const targetEntry = artwork.versionHistory.find(v => v.version === targetVersion);
  if (!targetEntry) {
    return artwork;
  }

  const historyBeforeTarget = artwork.versionHistory.filter(
    v => v.version !== targetVersion && 
    parseInt(v.version.split('.')[0].slice(1)) <= parseInt(targetVersion.split('.')[0].slice(1)) &&
    parseInt(v.version.split('.')[1]) <= parseInt(targetVersion.split('.')[1])
  );

  return {
    ...artwork,
    ...targetEntry.fields,
    dataVersion: targetVersion,
    versionHistory: historyBeforeTarget
  };
}

export function detectDataConflicts(artworks: Artwork[]): { artworkId: string; conflicts: string[] }[] {
  const conflicts: { artworkId: string; conflicts: string[] }[] = [];

  artworks.forEach(artwork => {
    if (artwork.versionHistory.length > 1) {
      const lastTwo = artwork.versionHistory.slice(-2);
      const diff = getVersionDiff(lastTwo[0], lastTwo[1]);
      if (diff.length > 0) {
        conflicts.push({
          artworkId: artwork.id,
          conflicts: diff
        });
      }
    }
  });

  return conflicts;
}

export function completeMissingFields(artwork: Artwork): Artwork {
  const updated = { ...artwork };
  
  if (updated.hue === null) updated.hue = 180;
  if (updated.lightness === null) updated.lightness = 50;
  if (updated.saturation === null) updated.saturation = 50;
  
  return updated;
}

export function validateArtworkData(artwork: Artwork): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!artwork.id) errors.push('缺少作品ID');
  if (!artwork.title) errors.push('缺少作品名称');
  if (!artwork.classId) errors.push('缺少班级ID');
  if (!artwork.imageUrl) errors.push('缺少作品图片');

  if (artwork.hue !== null && (artwork.hue < 0 || artwork.hue > 360)) {
    errors.push('色相值超出范围(0-360)');
  }
  if (artwork.lightness !== null && (artwork.lightness < 0 || artwork.lightness > 100)) {
    errors.push('明度值超出范围(0-100)');
  }
  if (artwork.saturation !== null && (artwork.saturation < 0 || artwork.saturation > 100)) {
    errors.push('饱和度值超出范围(0-100)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
