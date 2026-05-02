import { IssueType, Severity, msToReadable, timeToMs } from '../types.js';

export function detectAdOverlaps(timeline, options = {}) {
  const {
    safetyMargin = 100,
    clipTypes = ['clip']
  } = options;
  
  const issues = [];
  const ads = timeline.ads;
  const clips = timeline.clips.filter(c => clipTypes.includes(c.type) || c.clipType !== 'ad');
  
  for (const ad of ads) {
    for (const clip of clips) {
      if (clip.type === 'ad') continue;
      
      const overlapStart = Math.max(ad.startTime, clip.startTime);
      const overlapEnd = Math.min(ad.endTime, clip.endTime);
      const overlapDuration = overlapEnd - overlapStart;
      
      if (overlapDuration > 0) {
        issues.push({
          id: `ad_overlap_${Date.now()}_${issues.length}`,
          type: IssueType.AD_OVERLAPS_CONTENT,
          severity: Severity.CRITICAL,
          startTime: overlapStart,
          endTime: overlapEnd,
          duration: overlapDuration,
          events: [ad, clip],
          message: `广告 "${ad.name}" 与内容片段 "${clip.name}" 重叠 ${msToReadable(overlapDuration)}`,
          details: {
            ad: { id: ad.id, name: ad.name, startTime: ad.startTime, endTime: ad.endTime },
            clip: { id: clip.id, name: clip.name, startTime: clip.startTime, endTime: clip.endTime },
            overlapMs: overlapDuration
          }
        });
      }
      
      const distanceBefore = clip.endTime - ad.startTime;
      if (distanceBefore < safetyMargin && distanceBefore > 0) {
        issues.push({
          id: `ad_gap_before_${Date.now()}_${issues.length}`,
          type: IssueType.AD_OVERLAPS_CONTENT,
          severity: Severity.MEDIUM,
          startTime: clip.endTime,
          endTime: ad.startTime,
          duration: ad.startTime - clip.endTime,
          events: [clip, ad],
          message: `广告 "${ad.name}" 与前一内容片段之间的安全距离不足 (${msToReadable(distanceBefore)} < ${msToReadable(safetyMargin)})`,
          details: {
            actualDistance: distanceBefore,
            requiredDistance: safetyMargin
          }
        });
      }
      
      const distanceAfter = ad.endTime - clip.startTime;
      if (distanceAfter < safetyMargin && distanceAfter > 0) {
        issues.push({
          id: `ad_gap_after_${Date.now()}_${issues.length}`,
          type: IssueType.AD_OVERLAPS_CONTENT,
          severity: Severity.MEDIUM,
          startTime: ad.endTime,
          endTime: clip.startTime,
          duration: clip.startTime - ad.endTime,
          events: [ad, clip],
          message: `广告 "${ad.name}" 与后一内容片段之间的安全距离不足`,
          details: {
            actualDistance: distanceAfter,
            requiredDistance: safetyMargin
          }
        });
      }
    }
  }
  
  return issues;
}

export function detectSubtitleDrift(timeline, options = {}) {
  const {
    maxAllowedDrift = 500,
    gapThreshold = 2000
  } = options;
  
  const issues = [];
  const subtitles = timeline.subtitles;
  const clips = timeline.clips;
  
  if (subtitles.length === 0) {
    issues.push({
      id: `subtitle_none_${Date.now()}`,
      type: IssueType.SUBTITLE_DRIFT,
      severity: Severity.LOW,
      startTime: 0,
      endTime: timeline.totalDuration,
      message: `未检测到字幕文件`,
      details: {}
    });
    return issues;
  }
  
  for (const subtitle of subtitles) {
    const matchingClips = clips.filter(clip =>
      subtitle.startTime >= clip.startTime &&
      subtitle.endTime <= clip.endTime
    );
    
    if (matchingClips.length === 0) {
      const nearbyClips = clips.filter(clip =>
        Math.abs(subtitle.startTime - clip.startTime) < 10000 ||
        Math.abs(subtitle.endTime - clip.endTime) < 10000
      );
      
      issues.push({
        id: `subtitle_drift_${Date.now()}_${issues.length}`,
        type: IssueType.SUBTITLE_DRIFT,
        severity: Severity.HIGH,
        startTime: subtitle.startTime,
        endTime: subtitle.endTime,
        duration: subtitle.duration,
        events: [subtitle, ...nearbyClips],
        message: `字幕 "${subtitle.name.substring(0, 30)}..." 未匹配到任何片段`,
        details: {
          subtitle: {
            id: subtitle.id,
            text: subtitle.name,
            startTime: subtitle.startTime,
            endTime: subtitle.endTime
          },
          nearbyClips: nearbyClips.map(c => ({
            id: c.id,
            name: c.name,
            startTime: c.startTime,
            endTime: c.endTime
          }))
        }
      });
    }
  }
  
  for (const clip of clips) {
    if (clip.clipType === 'silence' || clip.clipType === 'ad') continue;
    
    const clipSubtitles = subtitles.filter(sub =>
      sub.startTime >= clip.startTime &&
      sub.endTime <= clip.endTime
    );
    
    if (clipSubtitles.length === 0) {
      issues.push({
        id: `subtitle_missing_${Date.now()}_${issues.length}`,
        type: IssueType.SUBTITLE_DRIFT,
        severity: Severity.MEDIUM,
        startTime: clip.startTime,
        endTime: clip.endTime,
        duration: clip.duration,
        events: [clip],
        message: `片段 "${clip.name}" 没有匹配的字幕`,
        details: {
          clip: {
            id: clip.id,
            name: clip.name,
            startTime: clip.startTime,
            endTime: clip.endTime,
            duration: clip.duration
          }
        }
      });
    } else {
      const firstSub = clipSubtitles[0];
      const lastSub = clipSubtitles[clipSubtitles.length - 1];
      
      const startDrift = Math.abs(firstSub.startTime - clip.startTime);
      const endDrift = Math.abs(lastSub.endTime - clip.endTime);
      
      if (startDrift > maxAllowedDrift) {
        issues.push({
          id: `subtitle_start_drift_${Date.now()}_${issues.length}`,
          type: IssueType.SUBTITLE_DRIFT,
          severity: startDrift > maxAllowedDrift * 2 ? Severity.HIGH : Severity.MEDIUM,
          startTime: clip.startTime,
          endTime: firstSub.startTime,
          duration: startDrift,
          events: [clip, firstSub],
          message: `片段 "${clip.name}" 开头与首条字幕漂移 ${msToReadable(startDrift)}`,
          details: {
            clipStartTime: clip.startTime,
            firstSubStartTime: firstSub.startTime,
            driftMs: startDrift,
            maxAllowedDrift
          }
        });
      }
      
      if (endDrift > maxAllowedDrift) {
        issues.push({
          id: `subtitle_end_drift_${Date.now()}_${issues.length}`,
          type: IssueType.SUBTITLE_DRIFT,
          severity: endDrift > maxAllowedDrift * 2 ? Severity.HIGH : Severity.MEDIUM,
          startTime: lastSub.endTime,
          endTime: clip.endTime,
          duration: endDrift,
          events: [lastSub, clip],
          message: `片段 "${clip.name}" 结尾与最后一条字幕漂移 ${msToReadable(endDrift)}`,
          details: {
            clipEndTime: clip.endTime,
            lastSubEndTime: lastSub.endTime,
            driftMs: endDrift,
            maxAllowedDrift
          }
        });
      }
    }
  }
  
  for (let i = 0; i < subtitles.length - 1; i++) {
    const current = subtitles[i];
    const next = subtitles[i + 1];
    
    const gap = next.startTime - current.endTime;
    
    if (gap > gapThreshold) {
      issues.push({
        id: `subtitle_gap_${Date.now()}_${issues.length}`,
        type: IssueType.SUBTITLE_DRIFT,
        severity: Severity.LOW,
        startTime: current.endTime,
        endTime: next.startTime,
        duration: gap,
        events: [current, next],
        message: `字幕之间存在 ${msToReadable(gap)} 的空白 (可能遗漏内容)`,
        details: {
          gapMs: gap,
          gapThreshold,
          prevSubtitle: current.name,
          nextSubtitle: next.name
        }
      });
    }
  }
  
  return issues;
}

export function detectChapterSubtitleMismatch(timeline, options = {}) {
  const {
    maxAllowedDrift = 500
  } = options;
  
  const issues = [];
  const chapters = timeline.chapters;
  
  for (const chapter of chapters) {
    if (chapter.subtitles.length === 0) {
      issues.push({
        id: `chapter_no_subs_${Date.now()}_${issues.length}`,
        type: IssueType.SUBTITLE_DRIFT,
        severity: Severity.MEDIUM,
        startTime: chapter.startTime,
        endTime: chapter.endTime,
        duration: chapter.duration,
        message: `章节 "${chapter.name}" 没有匹配的字幕`,
        details: {
          chapter: {
            id: chapter.id,
            name: chapter.name,
            startTime: chapter.startTime,
            endTime: chapter.endTime
          }
        }
      });
      continue;
    }
    
    const firstSub = chapter.subtitles[0];
    const lastSub = chapter.subtitles[chapter.subtitles.length - 1];
    
    const startDrift = Math.abs(firstSub.startTime - chapter.startTime);
    const endDrift = Math.abs(lastSub.endTime - chapter.endTime);
    
    if (startDrift > maxAllowedDrift) {
      issues.push({
        id: `chapter_start_drift_${Date.now()}_${issues.length}`,
        type: IssueType.SUBTITLE_DRIFT,
        severity: Severity.HIGH,
        startTime: chapter.startTime,
        endTime: firstSub.startTime,
        duration: startDrift,
        message: `章节 "${chapter.name}" 标题时间与首条字幕漂移 ${msToReadable(startDrift)}`,
        details: {
          chapterStartTime: chapter.startTime,
          firstSubStartTime: firstSub.startTime,
          driftMs: startDrift
        }
      });
    }
  }
  
  return issues;
}

export function runAllRuleChecks(timeline, options = {}) {
  const allIssues = [];
  
  const adIssues = detectAdOverlaps(timeline, options);
  allIssues.push(...adIssues);
  
  const subtitleIssues = detectSubtitleDrift(timeline, options);
  allIssues.push(...subtitleIssues);
  
  const chapterIssues = detectChapterSubtitleMismatch(timeline, options);
  allIssues.push(...chapterIssues);
  
  allIssues.sort((a, b) => {
    const severityOrder = {
      [Severity.CRITICAL]: 0,
      [Severity.HIGH]: 1,
      [Severity.MEDIUM]: 2,
      [Severity.LOW]: 3
    };
    
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    
    return a.startTime - b.startTime;
  });
  
  return {
    issues: allIssues,
    summary: {
      total: allIssues.length,
      critical: allIssues.filter(i => i.severity === Severity.CRITICAL).length,
      high: allIssues.filter(i => i.severity === Severity.HIGH).length,
      medium: allIssues.filter(i => i.severity === Severity.MEDIUM).length,
      low: allIssues.filter(i => i.severity === Severity.LOW).length,
      byType: {
        [IssueType.AD_OVERLAPS_CONTENT]: allIssues.filter(i => i.type === IssueType.AD_OVERLAPS_CONTENT).length,
        [IssueType.SUBTITLE_DRIFT]: allIssues.filter(i => i.type === IssueType.SUBTITLE_DRIFT).length
      }
    }
  };
}
