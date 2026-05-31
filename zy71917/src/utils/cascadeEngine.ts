import type { SubtitleEntry, EditPoint, Segment, AlignmentIssue, AdjustmentRecord } from "@/types";

export interface CascadeStore {
  getEntriesBySegment(segmentId: string): SubtitleEntry[];
  getEditPointsBySegment(segmentId: string): EditPoint[];
  getSegment(id: string): Segment | undefined;
  getAllSegments(projectId: string): Segment[];
  getEntriesByProject(projectId: string): SubtitleEntry[];
  getEditPoint(id: string): EditPoint | undefined;
  getEditPointsByProject(projectId: string): EditPoint[];
  getIssuesByProject(projectId: string): AlignmentIssue[];
  updateEntry(entry: SubtitleEntry): void;
  updateEditPoint(point: EditPoint): void;
  saveSegment(segment: Segment): void;
  deleteSegment(id: string): void;
  saveAdjustment(record: AdjustmentRecord): void;
}

export function updateSegmentTime(
  segmentId: string,
  newStart: number,
  newEnd: number,
  store: CascadeStore
): void {
  const segment = store.getSegment(segmentId);
  if (!segment) return;

  const oldDuration = segment.endTime - segment.startTime;
  const newDuration = newEnd - newStart;
  if (oldDuration <= 0) return;

  const scaleFactor = newDuration / oldDuration;

  const entries = store.getEntriesBySegment(segmentId);
  for (const entry of entries) {
    const relativeStart = entry.startTime - segment.startTime;
    const relativeEnd = entry.endTime - segment.startTime;

    const adjustedStart = newStart + relativeStart * scaleFactor;
    const adjustedEnd = newStart + relativeEnd * scaleFactor;

    store.saveAdjustment({
      id: crypto.randomUUID(),
      entryId: entry.id,
      timestamp: Date.now(),
      operator: "cascade_segment",
      field: "startTime",
      oldValue: String(entry.startTime),
      newValue: String(adjustedStart),
    });
    store.saveAdjustment({
      id: crypto.randomUUID(),
      entryId: entry.id,
      timestamp: Date.now(),
      operator: "cascade_segment",
      field: "endTime",
      oldValue: String(entry.endTime),
      newValue: String(adjustedEnd),
    });

    store.updateEntry({
      ...entry,
      startTime: adjustedStart,
      endTime: adjustedEnd,
      isManuallyAdjusted: true,
      adjustmentHistory: [...entry.adjustmentHistory, `cascade_segment:${segmentId}`],
    });
  }

  const editPoints = store.getEditPointsBySegment(segmentId);
  for (const point of editPoints) {
    const relativeTime = point.time - segment.startTime;
    const adjustedTime = newStart + relativeTime * scaleFactor;

    store.updateEditPoint({
      ...point,
      time: adjustedTime,
    });
  }

  store.saveSegment({
    ...segment,
    startTime: newStart,
    endTime: newEnd,
  });
}

export function updateEditPoint(
  editPointId: string,
  newTime: number,
  store: CascadeStore
): void {
  const targetPoint = store.getEditPoint(editPointId);
  if (!targetPoint) return;

  const oldTime = targetPoint.time;
  const delta = newTime - oldTime;

  store.updateEditPoint({
    ...targetPoint,
    time: newTime,
  });

  const entries = store.getEntriesByProject(targetPoint.projectId);
  for (const entry of entries) {
    let changed = false;
    let newStartTime = entry.startTime;
    let newEndTime = entry.endTime;

    if (entry.startTime >= oldTime) {
      newStartTime = entry.startTime + delta;
      changed = true;
    }
    if (entry.endTime >= oldTime) {
      newEndTime = entry.endTime + delta;
      changed = true;
    }

    if (changed) {
      store.saveAdjustment({
        id: crypto.randomUUID(),
        entryId: entry.id,
        timestamp: Date.now(),
        operator: "cascade_edit_point",
        field: "startTime",
        oldValue: String(entry.startTime),
        newValue: String(newStartTime),
      });
      store.saveAdjustment({
        id: crypto.randomUUID(),
        entryId: entry.id,
        timestamp: Date.now(),
        operator: "cascade_edit_point",
        field: "endTime",
        oldValue: String(entry.endTime),
        newValue: String(newEndTime),
      });

      store.updateEntry({
        ...entry,
        startTime: newStartTime,
        endTime: newEndTime,
        isManuallyAdjusted: true,
        adjustmentHistory: [...entry.adjustmentHistory, `cascade_edit_point:${editPointId}`],
      });
    }
  }
}

export function recalculateSegments(
  projectId: string,
  store: CascadeStore
): void {
  const existingSegments = store.getAllSegments(projectId);
  for (const seg of existingSegments) {
    store.deleteSegment(seg.id);
  }

  const entries = store.getEntriesByProject(projectId);
  const editPoints = store.getEditPointsByProject(projectId);
  const issues = store.getIssuesByProject(projectId);

  if (entries.length === 0 && editPoints.length === 0) return;

  const boundaries = new Set<number>();
  boundaries.add(0);

  for (const entry of entries) {
    boundaries.add(entry.startTime);
    boundaries.add(entry.endTime);
  }
  for (const point of editPoints) {
    boundaries.add(point.time);
  }

  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const segStart = sortedBoundaries[i];
    const segEnd = sortedBoundaries[i + 1];

    const segIssues = issues.filter(
      (issue) => issue.startTime < segEnd && issue.endTime > segStart
    );
    const hasOpenIssue = segIssues.some((issue) => issue.status === "open");

    let alignmentStatus: Segment["alignmentStatus"] = "aligned";
    if (hasOpenIssue) {
      alignmentStatus = "has_issue";
    } else if (segIssues.length > 0) {
      alignmentStatus = "needs_review";
    }

    store.saveSegment({
      id: crypto.randomUUID(),
      projectId,
      startTime: segStart,
      endTime: segEnd,
      alignmentStatus,
      notes: "",
    });
  }
}
