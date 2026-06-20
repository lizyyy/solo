import type { DraftEntry } from "@/types";
import { makeSubmissionFingerprint } from "@/engine/fingerprint";

export interface ParsedLine {
  questionNo: string;
  answerContent: string;
  answerVersion?: string;
  supplementaryNote?: string;
}

export function parseDraftText(raw: string): ParsedLine[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: ParsedLine[] = [];

  for (const line of lines) {
    let rest = line;
    let questionNo = "";
    const q = rest.match(/^([0-9A-Za-z\-–\.]+)[\s、:：|]+/);
    if (q) {
      questionNo = q[1];
      rest = rest.slice(q[0].length).trim();
    } else {
      const firstPipe = rest.indexOf("|");
      if (firstPipe > 0) {
        questionNo = rest.slice(0, firstPipe).trim();
        rest = rest.slice(firstPipe + 1).trim();
      }
    }

    let answerVersion: string | undefined;
    const vMatch = rest.match(/\bv(\d+[\.\w]*)/i);
    if (vMatch) {
      answerVersion = `v${vMatch[1].replace(/^v/i, "")}`;
    }

    let supplementaryNote: string | undefined;
    const noteIdx = [
      rest.lastIndexOf("备注"),
      rest.lastIndexOf("附"),
      rest.lastIndexOf("注："),
      rest.lastIndexOf("注:"),
    ]
      .filter((i) => i >= 0)
      .sort((a, b) => b - a)[0];
    if (noteIdx !== undefined && noteIdx > rest.length * 0.5) {
      supplementaryNote = rest.slice(noteIdx).replace(/^[备注附注：:\s]+/, "").trim();
      rest = rest.slice(0, noteIdx).trim().replace(/[|，,、\s]+$/, "");
    }

    out.push({
      questionNo: questionNo || `未编号-${out.length + 1}`,
      answerContent: rest || "(未提供答案内容)",
      answerVersion,
      supplementaryNote,
    });
  }
  return out;
}

export function parsedLineToDraft(p: ParsedLine, submittedAt = Date.now()): DraftEntry {
  const id = `dft-${submittedAt.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  return {
    id,
    questionNo: p.questionNo,
    answerContent: p.answerContent,
    answerVersion: p.answerVersion,
    supplementaryNote: p.supplementaryNote,
    rawSource: `${p.questionNo} | ${p.answerContent}${
      p.supplementaryNote ? ` | ${p.supplementaryNote}` : ""
    }`,
    submittedAt,
    submissionFingerprint: makeSubmissionFingerprint(
      p.questionNo,
      p.answerContent,
      p.supplementaryNote
    ),
  };
}
