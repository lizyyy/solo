import { useMemo } from 'react';
import type { StepRecord, TimelineItem } from '@/types';
import { calculateTimeGap } from '@/utils/date';

export function useTimeline(stepRecords: StepRecord[]) {
  const timelineItems = useMemo(() => {
    return stepRecords
      .map((record) => {
        const timeGap = calculateTimeGap(record.actualOccurredAt, record.recordedAt);
        return {
          ...record,
          timeGap,
        } as TimelineItem;
      })
      .sort((a, b) => {
        return new Date(a.actualOccurredAt).getTime() - new Date(b.actualOccurredAt).getTime();
      });
  }, [stepRecords]);

  const studentRecords = useMemo(
    () => stepRecords.filter((r) => r.source === 'student'),
    [stepRecords]
  );

  const scoreRecords = useMemo(
    () => stepRecords.filter((r) => r.source === 'score_sheet'),
    [stepRecords]
  );

  const supplementaryRecords = useMemo(
    () => stepRecords.filter((r) => r.isSupplementary),
    [stepRecords]
  );

  const skippedRecords = useMemo(
    () => stepRecords.filter((r) => r.status === 'skipped'),
    [stepRecords]
  );

  return {
    timelineItems,
    studentRecords,
    scoreRecords,
    supplementaryRecords,
    skippedRecords,
  };
}
