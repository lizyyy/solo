import type { ImportItem, MaterialRecord } from "@/types";
import { computeRecordKey } from "./id";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const validateImportItem = (item: ImportItem): ValidationResult => {
  const errors: string[] = [];
  if (!item.materialNo || item.materialNo.trim().length === 0) {
    errors.push("材料送审编号不能为空");
  }
  if (!item.title || item.title.trim().length === 0) {
    errors.push("标题不能为空");
  }
  if (item.title && item.title.length > 100) {
    errors.push("标题长度不能超过 100 字符");
  }
  if (item.materialNo && item.materialNo.length > 50) {
    errors.push("材料编号长度不能超过 50 字符");
  }
  if (item.remark && item.remark.length > 500) {
    errors.push("备注长度不能超过 500 字符");
  }
  return { valid: errors.length === 0, errors };
};

export interface DuplicateCheck {
  isDuplicate: boolean;
  reason?: string;
  existingRecord?: MaterialRecord;
}

export const checkDuplicate = (
  item: ImportItem,
  existingRecords: MaterialRecord[],
  incomingKeys: Set<string>
): DuplicateCheck => {
  const key = computeRecordKey(item.materialNo, item.title);

  if (incomingKeys.has(key)) {
    return {
      isDuplicate: true,
      reason: "本批次内重复，已跳过（不翻倍）",
    };
  }

  const matched = existingRecords.find(
    (r) => computeRecordKey(r.materialNo, r.title) === key
  );
  if (matched) {
    return {
      isDuplicate: true,
      reason: `与已有记录「${matched.title}」重复，已跳过（不翻倍）`,
      existingRecord: matched,
    };
  }
  return { isDuplicate: false };
};

export interface SupplementCheck {
  isSupplement: boolean;
  previousVersion: number;
  previousId?: string;
}

export const checkSupplement = (
  item: ImportItem,
  existingRecords: MaterialRecord[]
): SupplementCheck => {
  const sameNo = existingRecords
    .filter((r) => r.materialNo === item.materialNo)
    .sort((a, b) => b.version - a.version);
  if (sameNo.length === 0) {
    return { isSupplement: false, previousVersion: 0 };
  }
  const latest = sameNo[0];
  return {
    isSupplement: true,
    previousVersion: latest.version,
    previousId: latest.id,
  };
};

export const protectRemark = (oldRemark: string, newRemark: string): string => {
  const trimmed = (newRemark ?? "").trim();
  if (trimmed.length === 0 && oldRemark && oldRemark.trim().length > 0) {
    return oldRemark;
  }
  return trimmed;
};

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const formatDateShort = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
};
