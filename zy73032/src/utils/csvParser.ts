import type { Schedule } from "@/types";

export interface ParsedCsv {
  schedules: Omit<Schedule, "id" | "status" | "sourceId" | "sourceRow">[] & {
    sourceRow: string;
  }[];
  warnings: string[];
}

const EXPECTED_HEADERS = [
  "宠物名",
  "课程名称",
  "上课日期",
  "时长(分钟)",
  "训导师",
];

function splitLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === "," && !inQuote) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export function parseScheduleCsv(raw: string): ParsedCsv {
  const warnings: string[] = [];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { schedules: [], warnings: ["CSV 文件为空"] };
  }
  const headers = splitLine(lines[0]);
  const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    warnings.push(
      `表头缺失字段: ${missing.join("、")}（按顺序尝试使用第${headers
        .slice(0, 5)
        .map((_, i) => i + 1)
        .join("/")}列）`
    );
  }
  const idx = (name: string, fallback: number) =>
    headers.includes(name) ? headers.indexOf(name) : fallback;

  const iPet = idx("宠物名", 0);
  const iCourse = idx("课程名称", 1);
  const iDate = idx("上课日期", 2);
  const iDur = idx("时长(分钟)", 3);
  const iTrainer = idx("训导师", 4);

  const schedules: ParsedCsv["schedules"] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitLine(lines[r]);
    const petName = (cells[iPet] || "").trim();
    const courseName = (cells[iCourse] || "").trim();
    const courseDate = normalizeDate((cells[iDate] || "").trim());
    const durationRaw = (cells[iDur] || "0").trim();
    const durationMin = parseInt(durationRaw.replace(/\D/g, ""), 10) || 0;
    const trainer = (cells[iTrainer] || "未填写").trim();
    if (!petName && !courseName) continue;
    if (!petName) {
      warnings.push(`第 ${r + 1} 行宠物名为空，已跳过`);
      continue;
    }
    if (!courseDate) {
      warnings.push(`第 ${r + 1} 行日期格式无法识别（${cells[iDate]}）`);
    }
    schedules.push({
      petName,
      courseName: courseName || "（未填写课程）",
      courseDate: courseDate || new Date().toISOString().slice(0, 10),
      durationMin,
      trainer,
      petId: null,
      sourceRow: `CSV第${r + 1}行`,
    });
  }
  return { schedules, warnings };
}

function normalizeDate(s: string): string {
  if (!s) return "";
  const m1 = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m1) {
    return `${m1[1]}-${pad(m1[2])}-${pad(m1[3])}`;
  }
  const m2 = s.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m2) {
    const year = new Date().getFullYear();
    return `${year}-${pad(m2[1])}-${pad(m2[2])}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return "";
}

function pad(n: string) {
  return n.length === 1 ? "0" + n : n;
}

export function buildSampleCsvContent(): string {
  return [
    EXPECTED_HEADERS.join(","),
    '小黄,基础服从课,2026-06-08,60,王教练',
    '阿黑,社交适应课,2026-06-09,45,李教练',
    '黑妞,唤回训练,2026-06-10,30,王教练',
  ].join("\n");
}
