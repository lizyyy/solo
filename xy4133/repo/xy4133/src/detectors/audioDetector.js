import { IssueType, Severity, msToReadable } from '../types.js';

export function detectOverlaps(events, options = {}) {
  const {
    gapThreshold = 50,
    includeTypes = ['clip', 'ad']
  } = options;
  
  const issues = [];
  const filteredEvents = events.filter(e => includeTypes.includes(e.type));
  
  filteredEvents.sort((a, b) => a.startTime - b.startTime);
  
  for (let i = 0; i < filteredEvents.length - 1; i++) {
    const current = filteredEvents[i];
    const next = filteredEvents[i + 1];
    
    const overlapAmount = current.endTime - next.startTime;
    
    if (overlapAmount > gapThreshold) {
      issues.push({
        id: `overlap_${Date.now()}_${i}`,
        type: IssueType.OVERLAP,
        severity: Severity.CRITICAL,
        startTime: next.startTime,
        endTime: current.endTime,
        duration: overlapAmount,
        events: [current, next],
        message: `${current.name} 和 ${next.name} 重叠 ${msToReadable(overlapAmount)}`,
        details: {
          event1: { id: current.id, name: current.name, endTime: current.endTime },
          event2: { id: next.id, name: next.name, startTime: next.startTime },
          overlapMs: overlapAmount
        }
      });
    }
  }
  
  return issues;
}

export function detectGaps(events, totalDuration, options = {}) {
  const {
    gapThreshold = 1000,
    includeTypes = ['clip'],
    ignoreSilenceType = 'silence'
  } = options;
  
  const issues = [];
  const filteredEvents = events.filter(e => includeTypes.includes(e.type));
  
  filteredEvents.sort((a, b) => a.startTime - b.startTime);
  
  if (filteredEvents.length === 0) {
    issues.push({
      id: `gap_${Date.now()}_empty`,
      type: IssueType.GAP,
      severity: Severity.HIGH,
      startTime: 0,
      endTime: totalDuration,
      duration: totalDuration,
      message: `音频中没有检测到任何片段`,
      details: { totalDuration }
    });
    return issues;
  }
  
  const firstEvent = filteredEvents[0];
  if (firstEvent.startTime > gapThreshold) {
    issues.push({
      id: `gap_${Date.now()}_start`,
      type: IssueType.GAP,
      severity: Severity.MEDIUM,
      startTime: 0,
      endTime: firstEvent.startTime,
      duration: firstEvent.startTime,
      message: `开头有 ${msToReadable(firstEvent.startTime)} 的空白`,
      details: { position: 'start', gapMs: firstEvent.startTime }
    });
  }
  
  for (let i = 0; i < filteredEvents.length - 1; i++) {
    const current = filteredEvents[i];
    const next = filteredEvents[i + 1];
    
    const gapAmount = next.startTime - current.endTime;
    
    if (gapAmount > gapThreshold) {
      const hasSilenceClip = events.some(e => 
        e.type === 'clip' && 
        e.clipType === ignoreSilenceType &&
        e.startTime >= current.endTime &&
        e.endTime <= next.startTime
      );
      
      if (!hasSilenceClip) {
        issues.push({
          id: `gap_${Date.now()}_${i}`,
          type: IssueType.GAP,
          severity: Severity.HIGH,
          startTime: current.endTime,
          endTime: next.startTime,
          duration: gapAmount,
          events: [current, next],
          message: `${current.name} 和 ${next.name} 之间有 ${msToReadable(gapAmount)} 的空白`,
          details: {
            event1: { id: current.id, name: current.name, endTime: current.endTime },
            event2: { id: next.id, name: next.name, startTime: next.startTime },
            gapMs: gapAmount
          }
        });
      }
    }
  }
  
  const lastEvent = filteredEvents[filteredEvents.length - 1];
  if (totalDuration - lastEvent.endTime > gapThreshold) {
    issues.push({
      id: `gap_${Date.now()}_end`,
      type: IssueType.GAP,
      severity: Severity.LOW,
      startTime: lastEvent.endTime,
      endTime: totalDuration,
      duration: totalDuration - lastEvent.endTime,
      message: `结尾有 ${msToReadable(totalDuration - lastEvent.endTime)} 的空白`,
      details: { position: 'end', gapMs: totalDuration - lastEvent.endTime }
    });
  }
  
  return issues;
}

export function detectSilenceNotCut(loudnessAnalysis, clips, options = {}) {
  const {
    minSilenceDuration = 500,
    maxAllowedSilence = 100
  } = options;
  
  const issues = [];
  
  if (!loudnessAnalysis || !loudnessAnalysis.silenceRegions) {
    return issues;
  }
  
  const silenceRegions = loudnessAnalysis.silenceRegions.filter(
    s => s.duration >= minSilenceDuration
  );
  
  for (const silence of silenceRegions) {
    const overlappingClips = clips.filter(c =>
      !(c.startTime >= silence.endTime || c.endTime <= silence.startTime)
    );
    
    if (overlappingClips.length > 0) {
      for (const clip of overlappingClips) {
        const overlapStart = Math.max(silence.startTime, clip.startTime);
        const overlapEnd = Math.min(silence.endTime, clip.endTime);
        const overlapDuration = overlapEnd - overlapStart;
        
        if (overlapDuration > maxAllowedSilence) {
          issues.push({
            id: `silence_${Date.now()}_${issues.length}`,
            type: IssueType.SILENCE_NOT_CUT,
            severity: Severity.MEDIUM,
            startTime: overlapStart,
            endTime: overlapEnd,
            duration: overlapDuration,
            events: [clip],
            message: `片段 "${clip.name}" 中包含未裁剪的静音 (${msToReadable(overlapDuration)})`,
            details: {
              clip: { id: clip.id, name: clip.name },
              silenceRegion: silence,
              overlapMs: overlapDuration
            }
          });
        }
      }
    }
  }
  
  return issues;
}

export function detectLoudnessPeaks(loudnessAnalysis, options = {}) {
  const {
    peakThreshold = -3,
    clipTypes = ['clip', 'ad']
  } = options;
  
  const issues = [];
  
  if (!loudnessAnalysis || !loudnessAnalysis.peaks) {
    return issues;
  }
  
  const significantPeaks = loudnessAnalysis.peaks.filter(
    p => p.peakDb > peakThreshold
  );
  
  for (const peak of significantPeaks) {
    issues.push({
      id: `peak_${Date.now()}_${issues.length}`,
      type: IssueType.LOUDNESS_PEAK,
      severity: peak.peakDb > 0 ? Severity.CRITICAL : Severity.HIGH,
      startTime: peak.startTime,
      endTime: peak.endTime,
      duration: peak.endTime - peak.startTime,
      message: `检测到响度峰值: ${peak.peakDb.toFixed(1)} dB`,
      details: {
        peakDb: peak.peakDb,
        rmsDb: peak.rmsDb,
        threshold: peakThreshold
      }
    });
  }
  
  if (loudnessAnalysis.maxPeakDb && loudnessAnalysis.maxPeakDb > peakThreshold) {
    issues.push({
      id: `peak_summary_${Date.now()}`,
      type: IssueType.LOUDNESS_PEAK,
      severity: Severity.HIGH,
      startTime: 0,
      endTime: loudnessAnalysis.header?.duration || 0,
      message: `整体最大峰值: ${loudnessAnalysis.maxPeakDb.toFixed(1)} dB (阈值: ${peakThreshold} dB)`,
      details: {
        maxPeakDb: loudnessAnalysis.maxPeakDb,
        avgRmsDb: loudnessAnalysis.avgRmsDb,
        threshold: peakThreshold
      }
    });
  }
  
  return issues;
}

export function detectOutOfOrder(clips) {
  const issues = [];
  
  const orderedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
  
  for (let i = 0; i < orderedClips.length - 1; i++) {
    const current = orderedClips[i];
    const next = orderedClips[i + 1];
    
    if (current.order && next.order && current.order > next.order) {
      issues.push({
        id: `order_${Date.now()}_${i}`,
        type: IssueType.OUT_OF_ORDER,
        severity: Severity.CRITICAL,
        startTime: current.startTime,
        endTime: next.endTime,
        duration: next.endTime - current.startTime,
        events: [current, next],
        message: `片段顺序可能错误: ${current.name} (#${current.order}) 在 ${next.name} (#${next.order}) 之前`,
        details: {
          expectedOrder: [next.order, current.order],
          actualOrder: [current.order, next.order]
        }
      });
    }
  }
  
  return issues;
}

export function runAllAudioDetectors(timeline, loudnessAnalysis, options = {}) {
  const allIssues = [];
  
  const overlapIssues = detectOverlaps(timeline.allEvents, options);
  allIssues.push(...overlapIssues);
  
  const gapIssues = detectGaps(timeline.clips, timeline.totalDuration, options);
  allIssues.push(...gapIssues);
  
  const orderIssues = detectOutOfOrder(timeline.clips);
  allIssues.push(...orderIssues);
  
  if (loudnessAnalysis) {
    const silenceIssues = detectSilenceNotCut(loudnessAnalysis, timeline.clips, options);
    allIssues.push(...silenceIssues);
    
    const peakIssues = detectLoudnessPeaks(loudnessAnalysis, options);
    allIssues.push(...peakIssues);
  }
  
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
        [IssueType.OVERLAP]: allIssues.filter(i => i.type === IssueType.OVERLAP).length,
        [IssueType.GAP]: allIssues.filter(i => i.type === IssueType.GAP).length,
        [IssueType.SILENCE_NOT_CUT]: allIssues.filter(i => i.type === IssueType.SILENCE_NOT_CUT).length,
        [IssueType.LOUDNESS_PEAK]: allIssues.filter(i => i.type === IssueType.LOUDNESS_PEAK).length,
        [IssueType.OUT_OF_ORDER]: allIssues.filter(i => i.type === IssueType.OUT_OF_ORDER).length
      }
    }
  };
}
