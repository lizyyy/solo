import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import type { SampleRecord, IssueType } from "@/types";

export function useFilteredRecords(): SampleRecord[] {
  const records = useStore((s) => s.records);
  const filter = useStore((s) => s.filter);

  return useMemo(() => {
    let result = [...records];

    if (filter.authorizationStatus.length > 0) {
      result = result.filter((r) =>
        filter.authorizationStatus.includes(r.authorizationStatus)
      );
    }

    if (filter.issueTypes.length > 0) {
      result = result.filter((r) => {
        if (filter.issueTypes.includes("expired" as IssueType) && r.authorizationStatus === "expired")
          return true;
        if (filter.issueTypes.includes("timecode" as IssueType) && r.hasTimecodeIssue) return true;
        if (filter.issueTypes.includes("duplicate" as IssueType) && r.isDuplicate) return true;
        return false;
      });
    }

    if (filter.dateRange.start) {
      result = result.filter(
        (r) => r.authorizationExpiry && r.authorizationExpiry >= filter.dateRange.start!
      );
    }
    if (filter.dateRange.end) {
      result = result.filter(
        (r) => r.authorizationExpiry && r.authorizationExpiry <= filter.dateRange.end!
      );
    }

    if (filter.keyword.trim()) {
      const kw = filter.keyword.toLowerCase();
      result = result.filter(
        (r) =>
          r.trackName.toLowerCase().includes(kw) ||
          r.originalFileName.toLowerCase().includes(kw) ||
          r.sourcePath.toLowerCase().includes(kw) ||
          r.userNote.toLowerCase().includes(kw)
      );
    }

    return result;
  }, [records, filter]);
}

export function useIssueCounts(): Record<IssueType, number> {
  const records = useStore((s) => s.records);

  return useMemo(() => ({
    expired: records.filter((r) => r.authorizationStatus === "expired").length,
    timecode: records.filter((r) => r.hasTimecodeIssue).length,
    duplicate: records.filter((r) => r.isDuplicate).length,
  }), [records]);
}

export function useExpiredRecords(): SampleRecord[] {
  const records = useStore((s) => s.records);
  return useMemo(() => records.filter((r) => r.authorizationStatus === "expired"), [records]);
}

export function useTimecodeIssueRecords(): SampleRecord[] {
  const records = useStore((s) => s.records);
  return useMemo(() => records.filter((r) => r.hasTimecodeIssue), [records]);
}

export function useDuplicateRecords(): SampleRecord[] {
  const records = useStore((s) => s.records);
  return useMemo(() => records.filter((r) => r.isDuplicate), [records]);
}
