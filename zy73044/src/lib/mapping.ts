export type StandardField =
  | "partNo"
  | "partDesc"
  | "status"
  | "remark"
  | "sampling";

const ALIAS_TABLE: Record<StandardField, string[]> = {
  partNo: [
    "备件编号",
    "物料号",
    "零件号",
    "物料编号",
    "备件号",
    "SKU",
    "PartNo",
    "Part No",
    "partNo",
    "part_no",
    "编号",
  ],
  partDesc: [
    "备件描述",
    "名称",
    "品名",
    "规格型号",
    "描述",
    "备件名称",
    "规格",
    "Description",
    "desc",
  ],
  status: [
    "处理状态",
    "状态",
    "审核状态",
    "Status",
    "state",
  ],
  remark: [
    "备注",
    "人工备注",
    "说明",
    "交接说明",
    "Remark",
    "comment",
  ],
  sampling: [
    "采样值",
    "读数",
    "巡检值",
    "采样",
    "数值",
    "检测值",
    "Sampling",
    "value",
    "reading",
  ],
};

const normalize = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/［/g, "[")
    .replace(/］/g, "]")
    .replace(/【/g, "[")
    .replace(/】/g, "]");

const matchScore = (alias: string, colName: string): number => {
  const a = normalize(alias);
  const c = normalize(colName);
  if (a === c) return 100;
  if (c.includes(a) || a.includes(c)) return 60;
  let common = 0;
  for (const ch of c) if (a.includes(ch)) common++;
  return Math.round((common / Math.max(a.length, c.length)) * 30);
};

export interface MappingResult {
  mapping: Record<StandardField, string | null>;
  warnings: string[];
}

export function buildMapping(headers: string[]): MappingResult {
  const warnings: string[] = [];
  const result: Record<StandardField, string | null> = {
    partNo: null,
    partDesc: null,
    status: null,
    remark: null,
    sampling: null,
  };

  const usedCols = new Set<string>();

  const fields: StandardField[] = ["partNo", "partDesc", "sampling", "status", "remark"];
  for (const field of fields) {
    let bestCol: string | null = null;
    let bestScore = 0;
    for (const col of headers) {
      if (usedCols.has(col)) continue;
      for (const alias of ALIAS_TABLE[field]) {
        const s = matchScore(alias, col);
        if (s > bestScore) {
          bestScore = s;
          bestCol = col;
        }
      }
    }
    if (bestCol && bestScore >= 40) {
      result[field] = bestCol;
      usedCols.add(bestCol);
    }
  }

  if (!result.partNo) {
    warnings.push("未识别到备件编号列（尝试过：备件编号/物料号/零件号/SKU）");
  }
  if (!result.partDesc) {
    warnings.push("未识别到备件描述列（尝试过：备件描述/名称/规格型号）");
  }

  return { mapping: result, warnings };
}

export function fileSignature(headers: string[]): string {
  return headers.map(normalize).sort().join("||");
}

export const STATUS_LABEL: Record<string, import("./types").RecordStatus> = {
  待确认: "pending",
  未确认: "pending",
  pending: "pending",
  已确认: "confirmed",
  confirmed: "confirmed",
  通过: "confirmed",
  已撤回: "withdrawn",
  withdrawn: "withdrawn",
  退回: "withdrawn",
};
