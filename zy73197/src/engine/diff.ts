import type { Diff, ParamSet, Snapshot } from "./types";

function paramSignature(set: ParamSet): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of set.params) {
    out[p.key] = `${p.value}|${p.unit}|${p.rawFieldName}`;
  }
  return out;
}

export function computeDiffs(pre: Snapshot, post: Snapshot): Diff[] {
  const diffs: Diff[] = [];

  (["A", "B"] as const).forEach((g) => {
    const preSet = g === "A" ? pre.setA : pre.setB;
    const postSet = g === "A" ? post.setA : post.setB;
    if (preSet.source !== postSet.source) {
      diffs.push({ path: `${g}组·来源`, before: preSet.source, after: postSet.source });
    }
    const preS = paramSignature(preSet);
    const postS = paramSignature(postSet);
    for (const key of Object.keys(preS)) {
      if (preS[key] !== postS[key]) {
        diffs.push({ path: `${g}组·${key}`, before: preS[key], after: postS[key] });
      }
    }
  });

  const pr = pre.result;
  const po = post.result;
  if (pr.status !== po.status) {
    diffs.push({ path: "结论·状态", before: pr.status, after: po.status });
  }
  if ((pr.groups.A.finalValue ?? null) !== (po.groups.A.finalValue ?? null)) {
    diffs.push({
      path: "结论·A得分",
      before: pr.groups.A.finalValue != null ? String(pr.groups.A.finalValue.toFixed(2)) : "—",
      after: po.groups.A.finalValue != null ? String(po.groups.A.finalValue.toFixed(2)) : "—",
    });
  }
  if ((pr.groups.B.finalValue ?? null) !== (po.groups.B.finalValue ?? null)) {
    diffs.push({
      path: "结论·B得分",
      before: pr.groups.B.finalValue != null ? String(pr.groups.B.finalValue.toFixed(2)) : "—",
      after: po.groups.B.finalValue != null ? String(po.groups.B.finalValue.toFixed(2)) : "—",
    });
  }

  return diffs;
}
