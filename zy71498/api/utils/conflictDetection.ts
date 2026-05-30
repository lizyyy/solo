import type { Track, Conflict, TimelineEvent, EmotionTag, ConflictType } from '../../shared/types';

const generateId = () => Math.random().toString(36).substring(2, 11);

export const calculateTagSimilarity = (tags1: EmotionTag[], tags2: EmotionTag[]): number => {
  if (tags1.length === 0 && tags2.length === 0) return 1;
  if (tags1.length === 0 || tags2.length === 0) return 0;

  const intersection = tags1.filter(t => tags2.includes(t));
  const union = [...new Set([...tags1, ...tags2])];

  return intersection.length / union.length;
};

export const detectTagConflict = (track: Track): Conflict | null => {
  const similarity = calculateTagSimilarity(track.algorithmTags, track.manualTags);

  if (similarity >= 0.6) return null;

  let conflictType: ConflictType = 'algorithm_vs_manual';
  let severity: 'low' | 'medium' | 'high' = 'medium';

  if (similarity < 0.3) {
    conflictType = 'version_mismatch';
    severity = 'high';
  } else if (similarity < 0.6) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  return {
    id: generateId(),
    trackId: track.id,
    conflictType,
    severity,
    description: `算法标签[${track.algorithmTags.join(',')}]与人工标签[${track.manualTags.join(',')}]不一致，相似度${(similarity * 100).toFixed(0)}%`,
    resolved: false,
    createdAt: new Date().toISOString(),
  };
};

export const detectCopyrightConflict = (track: Track): Conflict | null => {
  if (track.copyrightStatus !== 'removed' || !track.isRecommended) return null;

  return {
    id: generateId(),
    trackId: track.id,
    conflictType: 'copyright_vs_recommend',
    severity: 'high',
    description: '曲目已版权下架，但仍在推荐列表中',
    resolved: false,
    createdAt: new Date().toISOString(),
  };
};

export const detectManualLostConflict = (
  track: Track,
  timeline: TimelineEvent[]
): Conflict | null => {
  const manualCorrections = timeline.filter(e => e.eventType === 'manual_correction');
  const algorithmTags = timeline.filter(e => e.eventType === 'algorithm_tag');

  if (manualCorrections.length === 0 || algorithmTags.length === 0) return null;

  const lastManualCorrection = manualCorrections[manualCorrections.length - 1];
  const algorithmTagsAfterManual = algorithmTags.filter(
    e => new Date(e.timestamp) > new Date(lastManualCorrection.timestamp)
  );

  if (algorithmTagsAfterManual.length === 0) return null;

  const earliestAlgorithmAfter = algorithmTagsAfterManual[0];

  return {
    id: generateId(),
    trackId: track.id,
    conflictType: 'manual_lost',
    severity: 'high',
    description: `人工修正(${new Date(lastManualCorrection.timestamp).toLocaleDateString()})后，算法标签(${new Date(earliestAlgorithmAfter.timestamp).toLocaleDateString()})覆盖了修正结果`,
    resolved: false,
    createdAt: new Date().toISOString(),
  };
};

export const detectAllConflicts = (track: Track, timeline: TimelineEvent[]): Conflict[] => {
  const conflicts: Conflict[] = [];

  const tagConflict = detectTagConflict(track);
  if (tagConflict) conflicts.push(tagConflict);

  const copyrightConflict = detectCopyrightConflict(track);
  if (copyrightConflict) conflicts.push(copyrightConflict);

  const manualLostConflict = detectManualLostConflict(track, timeline);
  if (manualLostConflict) conflicts.push(manualLostConflict);

  return conflicts;
};

export const detectDuplicateSubmission = (
  newTrack: Track,
  existingTracks: Track[]
): {
  status: 'new' | 'updated' | 'unchanged';
  existingTrack?: Track;
  changes?: Record<string, { old: any; new: any }>;
} => {
  const existing = existingTracks.find(t => t.trackId === newTrack.trackId);

  if (!existing) {
    return { status: 'new' };
  }

  const changes: Record<string, { old: any; new: any }> = {};
  const fieldsToCompare: (keyof Track)[] = [
    'title', 'artist', 'album', 'algorithmTags', 'manualTags',
    'copyrightStatus', 'isRecommended', 'status'
  ];

  fieldsToCompare.forEach(field => {
    const oldVal = existing[field];
    const newVal = newTrack[field];

    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      if (oldVal.join(',') !== newVal.join(',')) {
        changes[field] = { old: oldVal, new: newVal };
      }
    } else if (oldVal !== newVal) {
      changes[field] = { old: oldVal, new: newVal };
    }
  });

  if (Object.keys(changes).length > 0) {
    return { status: 'updated', existingTrack: existing, changes };
  }

  return { status: 'unchanged', existingTrack: existing };
};

export const validateTimelineOrder = (timeline: TimelineEvent[]): {
  isValid: boolean;
  anomalies: { event: TimelineEvent; reason: string }[];
} => {
  const anomalies: { event: TimelineEvent; reason: string }[] = [];
  const sorted = [...timeline].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (prev.eventType === 'manual_correction' && curr.eventType === 'algorithm_tag') {
      anomalies.push({
        event: curr,
        reason: '人工修正后出现算法标签，可能覆盖人工修正结果'
      });
    }

    if (prev.eventType === 'copyright_remove' && curr.eventType === 'recommend') {
      anomalies.push({
        event: curr,
        reason: '版权下架后仍有推荐记录，存在合规风险'
      });
    }
  }

  return {
    isValid: anomalies.length === 0,
    anomalies,
  };
};
