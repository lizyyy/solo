import { evalExpr, isBin, renderAst, type Ast } from "./expr";
import type { Step, SubstitutedVar, ValueOrigin } from "./types";

export interface RunInput {
  numAst: Ast;
  denAst: Ast;
  a0: number;
  a1: number;
  a0MaterialId: string;
  a1MaterialId: string;
  steps: number;
}

export function runRecurrence(input: RunInput): Step[] {
  const { numAst, denAst, a0, a1, a0MaterialId, a1MaterialId, steps } = input;
  const values: number[] = [a0, a1];
  const origins: ValueOrigin[] = [
    { kind: "boundary", varName: "a0", materialId: a0MaterialId },
    { kind: "boundary", varName: "a1", materialId: a1MaterialId },
  ];
  const result: Step[] = [];

  for (let n = 0; n <= steps; n++) {
    if (n < 2) {
      result.push({
        n,
        value: values[n],
        numStr: "—",
        denStr: "—",
        denIsBin: false,
        denomValue: NaN,
        status: "initial",
        substituted: [],
      });
      continue;
    }
    const prev1 = values[n - 1];
    const prev2 = values[n - 2];
    const env = { a1: prev1, a2: prev2 };
    const numEval = evalExpr(numAst, env);
    const denEval = evalExpr(denAst, env);
    const numStr = renderAst(numAst, env);
    const denStr = renderAst(denAst, env);
    const substituted: SubstitutedVar[] = [
      {
        token: "a1",
        label: `a${n - 1}`,
        value: prev1,
        origin: origins[n - 1],
      },
      {
        token: "a2",
        label: `a${n - 2}`,
        value: prev2,
        origin: origins[n - 2],
      },
    ];
    const denomValue = denEval.ok ? denEval.value : 0;
    const denIsZero = !denEval.ok || denEval.value === 0;

    if (denIsZero) {
      const cause =
        substituted.find((v) => v.origin.kind === "boundary") ?? substituted[0];
      const causedBy =
        cause.origin.kind === "boundary"
          ? {
              varName: cause.origin.varName,
              value: cause.value,
              materialId: cause.origin.materialId,
            }
          : undefined;
      result.push({
        n,
        value: null,
        numStr,
        denStr,
        denIsBin: isBin(denAst),
        denomValue: 0,
        status: "divzero",
        substituted,
        causedBy,
      });
      break;
    }

    const value = (numEval.ok ? numEval.value : NaN) / denEval.value;
    values[n] = value;
    origins[n] = { kind: "computed", fromN: n };
    result.push({
      n,
      value,
      numStr,
      denStr,
      denIsBin: isBin(denAst),
      denomValue,
      status: "ok",
      substituted,
    });
  }
  return result;
}
