import { getSRTTotalDuration } from '../parsers/srtParser.js';

export function checkSubtitles(subtitles, metadata, shotList, rules) {
  const issues = [];
  const safetyMargin = rules.subtitle?.safetyMargin || 0.5;
  
  if (!subtitles || subtitles.length === 0) {
    return [{
      type: 'subtitle',
      severity: 'warning',
      message: '字幕文件为空或不存在',
      shotId: null,
      filename: null
    }];
  }
  
  const srtDuration = getSRTTotalDuration(subtitles);
  
  for (const shot of shotList) {
    const expectedName = shot.filename || shot.name;
    if (!expectedName) continue;
    
    const fileMetadata = findMetadata(metadata, expectedName);
    if (!fileMetadata) continue;
    
    const videoDuration = getDurationFromMetadata(fileMetadata);
    
    if (srtDuration > videoDuration + safetyMargin) {
      issues.push({
        type: 'subtitle',
        severity: 'error',
        message: `字幕时间越界: 字幕时长 ${srtDuration.toFixed(2)}s > 视频时长 ${videoDuration.toFixed(2)}s`,
        shotId: shot.id,
        filename: expectedName,
        srtDuration,
        videoDuration
      });
    }
    
    for (const sub of subtitles) {
      if (sub.start > videoDuration + safetyMargin) {
        issues.push({
          type: 'subtitle',
          severity: 'error',
          message: `字幕 ${sub.index} 起始时间 ${sub.start.toFixed(2)}s 超过视频时长 ${videoDuration.toFixed(2)}s`,
          shotId: shot.id,
          filename: expectedName,
          subtitleIndex: sub.index,
          startTime: sub.start,
          videoDuration
        });
      }
    }
  }
  
  return issues;
}

function findMetadata(metadata, filename) {
  if (!metadata) return null;
  
  const baseName = filename.toLowerCase().replace(/\.[^.]+$/, '');
  
  if (metadata.streams) {
    for (const stream of metadata.streams) {
      if (stream.tags?.filename) {
        const metaName = stream.tags.filename.toLowerCase().replace(/\.[^.]+$/, '');
        if (metaName === baseName) return stream;
      }
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
  return 0;
}