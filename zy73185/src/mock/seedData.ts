import type { DraftEntry, ParamVersion } from "@/types";
import { makeSubmissionFingerprint } from "@/engine/fingerprint";

function uid(prefix = "d"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function mkDraft(
  questionNo: string,
  answerContent: string,
  opts: {
    answerVersion?: string;
    supplementaryNote?: string;
    offsetMinutes?: number;
  } = {}
): DraftEntry {
  const id = uid("dft");
  return {
    id,
    questionNo,
    answerContent,
    answerVersion: opts.answerVersion,
    supplementaryNote: opts.supplementaryNote,
    rawSource: `${questionNo} | ${answerContent}`,
    submittedAt: Date.now() - (opts.offsetMinutes || 0) * 60_000,
    submissionFingerprint: makeSubmissionFingerprint(
      questionNo,
      answerContent,
      opts.supplementaryNote
    ),
  };
}

export const seedDrafts: DraftEntry[] = [
  mkDraft("3-1", "重力加速度 g = 9.80 ± 0.02 m/s²，有效数字 3 位。", {
    answerVersion: "v1",
    supplementaryNote: "学生 A，第 2 次修改，引用讲义第 17 页。",
    offsetMinutes: 32,
  }),
  mkDraft("3-1", "重力加速度 g = 9.79 ± 0.03 m/s²，按 v2 标准取位。", {
    answerVersion: "v2",
    supplementaryNote: "学生 B，参考新版答案册。",
    offsetMinutes: 28,
  }),
  mkDraft("3-2", "长度 L = 25.40 ± 0.05 mm，千分尺读数。", {
    answerVersion: "v1",
    supplementaryNote: "学生 C，草稿纸扫描版。",
    offsetMinutes: 20,
  }),
  mkDraft("3-2", "长度 L = 25.40 ± 0.05 mm，千分尺读数。", {
    answerVersion: "v1",
    supplementaryNote: "学生 C，草稿纸扫描版。",
    offsetMinutes: 18,
  }),
  mkDraft("3-3", "密度 ρ = 7.85 ± 0.04 g/cm³，由质量和体积合成。", {
    answerVersion: "v1",
    offsetMinutes: 15,
  }),
  mkDraft("3-4", "周期 T = 2.015 ± 0.008 s，秒表平均 10 次。", {
    answerVersion: "v1",
    supplementaryNote: "学生 D，缺原始记录，建议补拍。",
    offsetMinutes: 10,
  }),
  mkDraft("3-4", "周期 T = 2.016 ± 0.007 s，秒表平均 10 次测量。", {
    answerVersion: "v1",
    supplementaryNote: "学生 E，与 D 数据高度相似，疑似参考同组。",
    offsetMinutes: 6,
  }),
  mkDraft("3-5", "相对误差 δ = 1.2%，合成不确定度取方和根。", {
    answerVersion: "v2",
    supplementaryNote: "学生 F，按 v2 标准。",
    offsetMinutes: 3,
  }),
];

export const seedParamVersions: ParamVersion[] = [
  {
    id: "pv-seed-v1",
    name: "v1-春季学期标准",
    createdAt: Date.now() - 86_400_000 * 5,
    tolerance: 0.05,
    roundingRule: "round",
    sigFigs: 3,
    isActive: true,
  },
  {
    id: "pv-seed-v2",
    name: "v2-新教材修订",
    createdAt: Date.now() - 86_400_000 * 2,
    tolerance: 0.03,
    roundingRule: "round",
    sigFigs: 4,
    isActive: false,
  },
];
