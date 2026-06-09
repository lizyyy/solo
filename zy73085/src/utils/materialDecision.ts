import { MaterialBatch, ModelAnnotation, MaterialDecision, StructuralImportance } from "@/types";

export function evaluateMaterialDecision(
  annotation: ModelAnnotation,
  materials: MaterialBatch[]
): MaterialDecision {
  const related = materials.filter((m) => m.annotationId === annotation.id);
  const hasMissing = related.some((m) => m.isMissing);
  const missingMaterials = related.filter((m) => m.isMissing);

  if (!hasMissing) {
    return {
      decision: null,
      reason: `材料齐全，共 ${related.length} 项批次`,
      impactLevel: "none",
    };
  }

  const missingTypes = missingMaterials.map((m) => m.materialType || "未命名材料").join("、");
  const location = annotation.locationCode || annotation.area;

  const decisionMatrix: Record<StructuralImportance, MaterialDecision> = {
    critical: {
      decision: "hold",
      reason: `关键结构部位【${location}】${missingTypes}批次缺失，直接影响结构安全，必须挂起待补全`,
      impactLevel: "blocking",
    },
    normal: {
      decision: "evaluate",
      reason: `普通部位【${location}】${missingTypes}缺失，如不影响主结构受力，可评估后放行`,
      impactLevel: "warning",
    },
    minor: {
      decision: "release",
      reason: `次要装饰部位【${location}】${missingTypes}缺失，不影响结构安全，可先放行后续补录`,
      impactLevel: "warning",
    },
  };

  return decisionMatrix[annotation.structuralImportance];
}

export const DECISION_LABEL: Record<string, { text: string; color: string }> = {
  hold: { text: "建议挂起", color: "danger" },
  release: { text: "可放行", color: "safe" },
  evaluate: { text: "需评估", color: "warn" },
};
