import { parseExpr } from "./expr";
import { runRecurrence } from "./recurrence";
import type { Conclusion, Material, QuoteRef, ReviewPair, ReviewRun } from "./types";

let runSeq = 0;
function nextRunId(): string {
  runSeq += 1;
  return `run-${Date.now().toString(36)}-${runSeq}`;
}

export function buildReviewPair(materials: Material[], steps = 6): ReviewPair | null {
  const hist = materials.find(
    (m) => m.type === "历史答案" && m.contributes?.recurrence && m.contributes?.boundary,
  );
  if (!hist || !hist.contributes?.recurrence || !hist.contributes?.boundary) return null;

  const rec = hist.contributes.recurrence;
  const numAst = parseExpr(rec.num);
  const denAst = parseExpr(rec.den);
  const a0 = hist.contributes.boundary.a0 ?? 0;
  const a1Old = hist.contributes.boundary.a1 ?? 0;

  const note = materials.find(
    (m) => m.type === "后补备注" && m.contributes?.boundary?.a1 !== undefined,
  );
  const a1Fixed = note?.contributes?.boundary?.a1 ?? a1Old;
  const a1FixedMaterialId = note?.id ?? hist.id;

  const oldRun: ReviewRun = {
    id: nextRunId(),
    label: `旧版边界（a₁ = ${a1Old}）`,
    numExpr: rec.num,
    denExpr: rec.den,
    a0,
    a1: a1Old,
    a0MaterialId: hist.id,
    a1MaterialId: hist.id,
    steps,
    ts: Date.now(),
    result: runRecurrence({
      numAst,
      denAst,
      a0,
      a1: a1Old,
      a0MaterialId: hist.id,
      a1MaterialId: hist.id,
      steps,
    }),
  };

  const fixedRun: ReviewRun = {
    id: nextRunId(),
    label: `修正边界（a₁ = ${a1Fixed}）`,
    numExpr: rec.num,
    denExpr: rec.den,
    a0,
    a1: a1Fixed,
    a0MaterialId: hist.id,
    a1MaterialId: a1FixedMaterialId,
    steps,
    ts: Date.now(),
    result: runRecurrence({
      numAst,
      denAst,
      a0,
      a1: a1Fixed,
      a0MaterialId: hist.id,
      a1MaterialId: a1FixedMaterialId,
      steps,
    }),
  };

  const conclusions = buildConclusions(oldRun, fixedRun, materials);
  return { old: oldRun, fixed: fixedRun, primary: "old", conclusions, ts: Date.now() };
}

function buildConclusions(
  oldRun: ReviewRun,
  fixedRun: ReviewRun,
  materials: Material[],
): Conclusion[] {
  const hist = materials.find((m) => m.type === "历史答案");
  const note = materials.find((m) => m.type === "后补备注");
  const verbal = materials.find((m) => m.type === "口头备注");
  const conclusions: Conclusion[] = [];
  const div = oldRun.result.find((s) => s.status === "divzero");

  const quotes: QuoteRef[] = [
    hist ? { materialId: hist.id, quote: hist.quote } : null,
    verbal ? { materialId: verbal.id, quote: verbal.quote } : null,
    note ? { materialId: note.id, quote: note.quote } : null,
  ].filter(Boolean) as QuoteRef[];

  if (div) {
    const causeVar = div.causedBy?.varName === "a0" ? "a₀" : "a₁";
    const causeVal = div.causedBy?.value ?? NaN;
    const denDisplay = div.denIsBin ? `(${div.denStr})` : div.denStr;
    const fixedStep = fixedRun.result.find((s) => s.n === div.n);

    conclusions.push({
      id: "c-divzero",
      key: "divzero",
      title: `第 ${div.n} 项除零：序列在此中断`,
      text: `a_${div.n} = ${div.numStr} ÷ ${denDisplay}，分母 = ${div.denomValue}。使分母为 0 的是旧版边界 ${causeVar} = ${causeVal}。`,
      severity: "divzero",
      materialIds: [hist?.id, verbal?.id].filter(Boolean) as string[],
      quoteRefs: [hist, verbal]
        .filter(Boolean)
        .map((m) => ({ materialId: m!.id, quote: m!.quote })),
    });

    conclusions.push({
      id: "c-trace",
      key: "trace",
      title: "除零根源追溯",
      text: `除零根源为旧版边界 ${causeVar} = ${causeVal}（来自历史答案 ${hist?.version ?? ""}）；后补备注 ${note?.version ?? ""} 已将其修正为 ${fixedRun.a1}，修正后第 ${div.n} 项分母 = ${fixedStep?.denomValue ?? "—"} ≠ 0。`,
      severity: "warn",
      materialIds: [hist?.id, note?.id, verbal?.id].filter(Boolean) as string[],
      quoteRefs: quotes,
    });
  } else {
    conclusions.push({
      id: "c-ok",
      key: "ok",
      title: "旧版边界下未触发除零",
      text: `按当前边界推演至 n=${oldRun.steps}，未出现分母为 0 的项。`,
      severity: "ok",
      materialIds: [hist?.id].filter(Boolean) as string[],
      quoteRefs: [],
    });
  }

  const lastFixed = fixedRun.result[fixedRun.result.length - 1];
  conclusions.push({
    id: "c-fixed",
    key: "fixed",
    title: "按后补备注修正后无除零",
    text: `若按后补备注将 a₁ 修正为 ${fixedRun.a1}，则序列可正常延拓至 n=${lastFixed?.n ?? oldRun.steps}，全程未出现除零。`,
    severity: "ok",
    materialIds: [note?.id].filter(Boolean) as string[],
    quoteRefs: note ? [{ materialId: note.id, quote: note.quote }] : [],
  });

  return conclusions;
}
