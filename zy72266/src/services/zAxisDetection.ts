import type {
  ZAxisDirection,
  ZAxisRuleCode,
  ZAxisDetectionResult,
  SafetyRadiusRecord,
} from "@/types";

export function detectZAxisDirection(
  zAxisValue: number | null
): {
  ruleCode: ZAxisRuleCode;
  zAxisDirection: ZAxisDirection;
  autoCorrectSuppressed: boolean;
} {
  if (zAxisValue === null || zAxisValue === undefined) {
    return {
      ruleCode: "ZR-003",
      zAxisDirection: "missing",
      autoCorrectSuppressed: false,
    };
  }
  if (zAxisValue < 0) {
    return {
      ruleCode: "ZR-001",
      zAxisDirection: "negative",
      autoCorrectSuppressed: true,
    };
  }
  return {
    ruleCode: "ZR-002",
    zAxisDirection: "positive",
    autoCorrectSuppressed: false,
  };
}

export function createDetectionResult(
  recordId: string,
  zAxisValue: number | null
): ZAxisDetectionResult {
  const detection = detectZAxisDirection(zAxisValue);
  const resultMessages: Record<ZAxisRuleCode, string> = {
    "ZR-001": `Z轴值 ${zAxisValue} 为负数，方向按旧习惯写反`,
    "ZR-002": `Z轴值 ${zAxisValue} 为正数，方向符合规范`,
    "ZR-003": "Z轴数值缺失",
  };
  const actionMessages: Record<ZAxisRuleCode, string> = {
    "ZR-001": "标记待复核，不自动修正，留给现场班组复核",
    "ZR-002": "标记已确认正常",
    "ZR-003": "标记数据缺失，要求补录",
  };
  return {
    id: `det-${recordId}-${Date.now()}`,
    recordId,
    ruleCode: detection.ruleCode,
    detectionResult: resultMessages[detection.ruleCode],
    suggestedAction: actionMessages[detection.ruleCode],
    autoCorrectSuppressed: detection.autoCorrectSuppressed,
  };
}

export function applyZAxisDetection(record: SafetyRadiusRecord): {
  record: SafetyRadiusRecord;
  detection: ZAxisDetectionResult;
} {
  const detection = createDetectionResult(record.id, record.zAxisValue);
  const direction = detectZAxisDirection(record.zAxisValue);
  return {
    record: {
      ...record,
      zAxisDirection: direction.zAxisDirection,
    },
    detection,
  };
}
