import type { AlertRecord, ConsistencyResult, AlertStatus } from "@/types";

const STATUS_PASS_PATTERNS = [/通过/i, /pass/i, /正常/i, /合格/i, /同意/i];
const STATUS_FAIL_PATTERNS = [/驳回/i, /不通过/i, /fail/i, /拒绝/i, /整改/i, /异常/i];
const STATUS_PENDING_PATTERNS = [/待/i, /pending/i, /进行中/i, /处理中/i, /审核/i];

export function validateConsistency(record: AlertRecord): ConsistencyResult {
  const mismatches: ConsistencyResult["mismatches"] = [];

  const statusToText = (s: AlertStatus) => {
    const map: Record<AlertStatus, string> = {
      pending: "待复核",
      reviewing: "复核中",
      approved: "通过",
      rejected: "驳回",
    };
    return map[s];
  };

  const statusText = statusToText(record.status);
  const remark = record.remark || "(空)";
  const fileConclusionText =
    record.conclusionFile?.conclusion === "pass"
      ? "通过"
      : record.conclusionFile?.conclusion === "fail"
      ? "驳回"
      : "(未上传)";

  const checkMismatch = (
    field: string,
    statusMatches: boolean,
    remarkMatches: boolean,
    fileMatches: boolean
  ) => {
    if (!statusMatches || !remarkMatches || !fileMatches) {
      mismatches.push({
        field,
        statusValue: statusText + (statusMatches ? " ✓" : " ✗"),
        remarkValue: remark + (remarkMatches ? " ✓" : " ✗"),
        fileValue: fileConclusionText + (fileMatches ? " ✓" : " ✗"),
      });
    }
  };

  if (record.status === "approved") {
    checkMismatch(
      "通过结论",
      true,
      STATUS_PASS_PATTERNS.some((p) => p.test(record.remark)) ||
        !STATUS_FAIL_PATTERNS.some((p) => p.test(record.remark)),
      record.conclusionFile?.conclusion === "pass" || !record.conclusionFile
    );
  } else if (record.status === "rejected") {
    checkMismatch(
      "驳回结论",
      true,
      STATUS_FAIL_PATTERNS.some((p) => p.test(record.remark)) ||
        !STATUS_PASS_PATTERNS.some((p) => p.test(record.remark)),
      record.conclusionFile?.conclusion === "fail" || !record.conclusionFile
    );
  } else if (record.status === "pending" || record.status === "reviewing") {
    checkMismatch(
      "处理中状态",
      true,
      true,
      record.conclusionFile?.conclusion !== "pass" && record.conclusionFile?.conclusion !== "fail" || !record.conclusionFile
    );
  }

  return {
    isConsistent: mismatches.length === 0,
    mismatches,
  };
}

export function getStatusConsistencyBadge(record: AlertRecord): {
  isConsistent: boolean;
  message: string;
} {
  const result = validateConsistency(record);
  if (result.isConsistent) {
    return { isConsistent: true, message: "状态一致 ✓" };
  }
  return { isConsistent: false, message: `${result.mismatches.length}处不一致` };
}
