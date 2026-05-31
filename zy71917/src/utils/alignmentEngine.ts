import type { SubtitleEntry, SubtitleTrack, AlignmentIssue } from "@/types";

export function detectSilentDeletions(
  audioDuration: number,
  entries: SubtitleEntry[]
): AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  const sorted = [...entries].sort((a, b) => a.startTime - b.startTime);

  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].startTime - sorted[i].endTime;
    if (gap > 5) {
      issues.push({
        id: crypto.randomUUID(),
        projectId: "",
        type: "silent_deletion",
        severity: "warning",
        startTime: sorted[i].endTime,
        endTime: sorted[i + 1].startTime,
        description: `Gap of ${gap.toFixed(1)}s detected between entries ${sorted[i].index} and ${sorted[i + 1].index}, possible silent deletion`,
        affectedTrackIds: [sorted[i].trackId],
        status: "open",
      });
    }
  }

  if (sorted.length > 0) {
    const leadingGap = sorted[0].startTime;
    if (leadingGap > 5) {
      issues.push({
        id: crypto.randomUUID(),
        projectId: "",
        type: "silent_deletion",
        severity: "info",
        startTime: 0,
        endTime: sorted[0].startTime,
        description: `Leading gap of ${leadingGap.toFixed(1)}s before first subtitle entry`,
        affectedTrackIds: [sorted[0].trackId],
        status: "open",
      });
    }

    const trailingGap = audioDuration - sorted[sorted.length - 1].endTime;
    if (trailingGap > 5) {
      issues.push({
        id: crypto.randomUUID(),
        projectId: "",
        type: "silent_deletion",
        severity: "info",
        startTime: sorted[sorted.length - 1].endTime,
        endTime: audioDuration,
        description: `Trailing gap of ${trailingGap.toFixed(1)}s after last subtitle entry`,
        affectedTrackIds: [sorted[sorted.length - 1].trackId],
        status: "open",
      });
    }
  }

  return issues;
}

export function detectTimelineDrift(
  tracks: SubtitleTrack[],
  allEntries: SubtitleEntry[]
): AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  if (tracks.length < 2) return issues;

  const entriesByTrack = new Map<string, SubtitleEntry[]>();
  for (const track of tracks) {
    const trackEntries = allEntries
      .filter((e) => e.trackId === track.id)
      .sort((a, b) => a.index - b.index);
    entriesByTrack.set(track.id, trackEntries);
  }

  for (let i = 0; i < tracks.length - 1; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      const entriesA = entriesByTrack.get(tracks[i].id) ?? [];
      const entriesB = entriesByTrack.get(tracks[j].id) ?? [];

      const pairCount = Math.min(entriesA.length, entriesB.length);
      for (let k = 0; k < pairCount; k++) {
        const drift = Math.abs(entriesA[k].startTime - entriesB[k].startTime);
        if (drift > 2) {
          issues.push({
            id: crypto.randomUUID(),
            projectId: tracks[i].projectId,
            type: "timeline_drift",
            severity: "warning",
            startTime: Math.min(entriesA[k].startTime, entriesB[k].startTime),
            endTime: Math.max(entriesA[k].startTime, entriesB[k].startTime),
            description: `Timeline drift of ${drift.toFixed(1)}s at entry ${k + 1} between ${tracks[i].language} and ${tracks[j].language}`,
            affectedTrackIds: [tracks[i].id, tracks[j].id],
            status: "open",
          });
        }
      }
    }
  }

  return issues;
}

export function detectMissingLines(
  tracks: SubtitleTrack[]
): AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  if (tracks.length < 2) return issues;

  const entryCounts = tracks.map((t) => ({
    track: t,
    count: t.entries.length,
  }));

  const maxCount = Math.max(...entryCounts.map((e) => e.count));

  for (const { track, count } of entryCounts) {
    const diff = maxCount - count;
    if (diff > 0 && maxCount > 0 && diff / maxCount > 0.1) {
      issues.push({
        id: crypto.randomUUID(),
        projectId: track.projectId,
        type: "missing_line",
        severity: "warning",
        startTime: 0,
        endTime: 0,
        description: `Track "${track.label}" (${track.language}) has ${count} entries, ${diff} fewer than the maximum (${maxCount})`,
        affectedTrackIds: [track.id],
        status: "open",
      });
    }
  }

  return issues;
}

export function runAllDetections(
  audioDuration: number,
  tracks: SubtitleTrack[],
  allEntries: SubtitleEntry[]
): AlignmentIssue[] {
  const silentDeletions = detectSilentDeletions(audioDuration, allEntries);
  const timelineDrifts = detectTimelineDrift(tracks, allEntries);
  const missingLines = detectMissingLines(tracks);

  const combined = [...silentDeletions, ...timelineDrifts, ...missingLines];

  const seen = new Set<string>();
  return combined.filter((issue) => {
    if (seen.has(issue.id)) return false;
    seen.add(issue.id);
    return true;
  });
}
