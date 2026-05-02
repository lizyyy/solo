import { SubtitleCue, TranscriptEntry, SceneMark, SyncRule } from '../parser/types';

export interface DriftInfo {
  originalTime: number;
  translatedTime: number;
  drift: number;
  driftRate: number;
}

export interface AlignmentResult {
  fixedCues: SubtitleCue[];
  driftInfos: DriftInfo[];
  warnings: string[];
  overlapsFixed: number;
  anchorPointsUsed: number;
}

function findNearestAnchor(
  time: number,
  anchors: Array<{ originalTime: number; translatedTime: number }>
): { originalTime: number; translatedTime: number } | null {
  if (anchors.length === 0) return null;

  let nearest = anchors[0];
  let minDist = Math.abs(time - nearest.originalTime);

  for (const anchor of anchors) {
    const dist = Math.abs(time - anchor.originalTime);
    if (dist < minDist) {
      minDist = dist;
      nearest = anchor;
    }
  }

  return nearest;
}

function findSurroundingAnchors(
  time: number,
  anchors: Array<{ originalTime: number; translatedTime: number }>
): Array<{ originalTime: number; translatedTime: number }> | null {
  if (anchors.length === 0) return null;

  const sorted = [...anchors].sort((a, b) => a.originalTime - b.originalTime);

  if (time <= sorted[0].originalTime) {
    return [sorted[0]];
  }
  if (time >= sorted[sorted.length - 1].originalTime) {
    return [sorted[sorted.length - 1]];
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    if (time >= sorted[i].originalTime && time <= sorted[i + 1].originalTime) {
      return [sorted[i], sorted[i + 1]];
    }
  }

  return null;
}

function interpolateDrift(
  time: number,
  anchors: Array<{ originalTime: number; translatedTime: number }>,
  slope: number,
  intercept: number
): number {
  const surrounding = findSurroundingAnchors(time, anchors);

  if (!surrounding || surrounding.length === 1) {
    const anchor = surrounding ? surrounding[0] : anchors[0];
    const baseOffset = anchor.translatedTime - anchor.originalTime;
    return baseOffset + slope * (time - anchor.originalTime) + intercept;
  }

  const [prevAnchor, nextAnchor] = surrounding;
  const t = (time - prevAnchor.originalTime) / (nextAnchor.originalTime - prevAnchor.originalTime);
  const interpolatedOffset = prevAnchor.translatedTime + t * (nextAnchor.translatedTime - prevAnchor.translatedTime);
  return interpolatedOffset - time;
}

function detectOverlaps(cues: SubtitleCue[]): Array<{ index: number; nextIndex: number; overlapMs: number }> {
  const overlaps: Array<{ index: number; nextIndex: number; overlapMs: number }> = [];

  for (let i = 0; i < cues.length - 1; i++) {
    const current = cues[i];
    const next = cues[i + 1];

    if (current.endTime > next.startTime) {
      const overlapMs = current.endTime - next.startTime;
      overlaps.push({ index: i, nextIndex: i + 1, overlapMs });
    }
  }

  return overlaps;
}

function fixOverlaps(
  cues: SubtitleCue[],
  strategy: 'split' | 'extend' | 'skip'
): SubtitleCue[] {
  if (cues.length === 0) return cues;

  const fixed: SubtitleCue[] = [];
  let prevEndTime = 0;

  for (let i = 0; i < cues.length; i++) {
    const cue = { ...cues[i] };

    if (cue.startTime < prevEndTime) {
      switch (strategy) {
        case 'split':
          const midPoint = Math.round((prevEndTime + cue.startTime) / 2);
          const originalDuration = cue.endTime - cue.startTime;
          cue.startTime = midPoint;
          cue.endTime = midPoint + originalDuration;
          break;

        case 'extend':
          cue.startTime = prevEndTime;
          break;

        case 'skip':
          continue;
      }
    }

    prevEndTime = cue.endTime;
    fixed.push(cue);
  }

  return fixed;
}

export function alignSubtitles(
  cues: SubtitleCue[],
  transcript: TranscriptEntry[],
  sceneMarks: SceneMark[],
  rules: SyncRule
): AlignmentResult {
  const warnings: string[] = [];
  const driftInfos: DriftInfo[] = [];
  let overlapsFixed = 0;

  const anchors = rules.anchorPoints || [];
  if (anchors.length === 0 && transcript.length > 0) {
    warnings.push('No anchor points provided. Using transcript-based alignment.');
    const autoAnchors = generateAnchorsFromTranscript(transcript, cues);
    anchors.push(...autoAnchors);
  }

  const slope = rules.linearDrift?.slope ?? 1.0005;
  const intercept = rules.linearDrift?.intercept ?? 0;

  const fixedCues = cues.map((cue, idx) => {
    const nearestAnchor = findNearestAnchor(cue.startTime, anchors);

    let adjustedStartTime = cue.startTime;
    let adjustedEndTime = cue.endTime;

    if (nearestAnchor) {
      const drift = interpolateDrift(cue.startTime, anchors, slope, intercept);
      adjustedStartTime = cue.startTime + drift;
      adjustedEndTime = cue.endTime + drift;

      const originalDuration = cue.endTime - cue.startTime;
      const newDuration = adjustedEndTime - adjustedStartTime;

      driftInfos.push({
        originalTime: cue.startTime,
        translatedTime: adjustedStartTime,
        drift,
        driftRate: newDuration / originalDuration
      });
    } else {
      warnings.push(`Missing anchor for cue ${idx + 1} at ${cue.startTime}ms`);
    }

    if (rules.maxDrift) {
      const driftAmount = Math.abs(adjustedStartTime - cue.startTime);
      if (driftAmount > rules.maxDrift) {
        warnings.push(`Drift exceeds maxDrift for cue ${idx + 1}: ${driftAmount.toFixed(2)}ms > ${rules.maxDrift}ms`);
      }
    }

    return {
      ...cue,
      startTime: Math.round(Math.max(0, adjustedStartTime)),
      endTime: Math.round(Math.max(0, adjustedEndTime))
    };
  });

  const overlaps = detectOverlaps(fixedCues);
  overlapsFixed = overlaps.length;

  if (overlaps.length > 0) {
    warnings.push(`Detected ${overlaps.length} overlapping subtitle(s). Applying fix using '${rules.overlapHandling || 'split'}' strategy.`);
    const strategy = rules.overlapHandling || 'split';
    const finalCues = fixOverlaps(fixedCues, strategy);
    return {
      fixedCues: finalCues,
      driftInfos,
      warnings,
      overlapsFixed,
      anchorPointsUsed: anchors.length
    };
  }

  return {
    fixedCues,
    driftInfos,
    warnings,
    overlapsFixed,
    anchorPointsUsed: anchors.length
  };
}

function generateAnchorsFromTranscript(
  transcript: TranscriptEntry[],
  cues: SubtitleCue[]
): Array<{ originalTime: number; translatedTime: number }> {
  const anchors: Array<{ originalTime: number; translatedTime: number }> = [];

  for (const entry of transcript) {
    const matchingCue = cues.find(
      cue => cue.startTime >= entry.start - 500 && cue.startTime <= entry.start + 500
    );

    if (matchingCue) {
      anchors.push({
        originalTime: matchingCue.startTime,
        translatedTime: entry.start
      });
    }
  }

  return anchors;
}
