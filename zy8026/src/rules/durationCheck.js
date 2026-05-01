export function checkDuration(shotList, metadata, rules) {
  const issues = [];
  const durationTolerance = rules.duration?.tolerance || 0.5;
  
  for (const shot of shotList) {
    const expectedName = shot.filename || shot.name;
    if (!expectedName) continue;
    
    const fileMetadata = findMetadata(metadata, expectedName);
    
    if (!fileMetadata) {
      issues.push({
        type: 'duration',
        severity: 'error',
        message: `缺少媒体元数据: ${expectedName}`,
        shotId: shot.id,
        filename: expectedName,
        expectedDuration: null,
        actualDuration: null,
        deviation: null
      });
      continue;
    }
    
    const actualDuration = getDurationFromMetadata(fileMetadata);
    const expectedDuration = parseFloat(shot.duration);
    
    if (isNaN(expectedDuration)) {
      issues.push({
        type: 'duration',
        severity: 'warning',
        message: `第 ${shot.lineNumber} 行缺少期望时长`,
        shotId: shot.id,
        filename: expectedName,
        expectedDuration: null,
        actualDuration,
        deviation: null
      });
      continue;
    }
    
    const deviation = Math.abs(actualDuration - expectedDuration);
    
    if (deviation > durationTolerance) {
      issues.push({
        type: 'duration',
        severity: 'error',
        message: `时长偏差超过允许范围: 期望 ${expectedDuration.toFixed(2)}s, 实际 ${actualDuration.toFixed(2)}s, 偏差 ${deviation.toFixed(2)}s`,
        shotId: shot.id,
        filename: expectedName,
        expectedDuration,
        actualDuration,
        deviation
      });
    }
  }
  
  return issues;
}

function findMetadata(metadata, filename) {
  if (!metadata || !metadata.streams) return null;
  
  const baseName = filename.toLowerCase().replace(/\.[^.]+$/, '');
  
  for (const stream of metadata.streams) {
    if (stream.tags?.filename) {
      const metaName = stream.tags.filename.toLowerCase().replace(/\.[^.]+$/, '');
      if (metaName === baseName) return stream;
    }
  }
  
  if (metadata.format?.filename) {
    const metaName = metadata.format.filename.toLowerCase().replace(/\.[^.]+$/, '');
    if (metaName === baseName) return metadata.format;
  }
  
  return null;
}

function getDurationFromMetadata(metadata) {
  if (metadata.duration) {
    return parseFloat(metadata.duration);
  }
  if (metadata.avg_frame_rate) {
    const [num, den] = metadata.avg_frame_rate.split('/').map(Number);
    if (num && den && metadata.nb_frames) {
      return (parseInt(metadata.nb_frames) * den) / num;
    }
  }
  return 0;
}