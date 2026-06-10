import type { LayerNameValidation } from "../../shared/types.js";
import { LAYER_NAME_REGEX } from "../store/initialData.js";

export function validateLayerName(name: string): LayerNameValidation {
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      shouldSuspend: false,
      suggestions: ["请输入图层名"],
    };
  }
  const trimmed = name.trim();
  if (LAYER_NAME_REGEX.test(trimmed)) {
    return {
      valid: true,
      shouldSuspend: false,
    };
  }
  const suggestions: string[] = [];
  suggestions.push("图层名格式建议：[栋号]-[区域]-[类型]-[编号]");
  suggestions.push("示例：A-ROOF-DRAIN-MAIN 或 D-GUTTER-DRAIN-01");
  suggestions.push("允许的类型：DRAIN、ROOF、GUTTER");
  if (!/^[A-Z]-/.test(trimmed)) {
    suggestions.push("建议以大写字母开头，例如 A-、B-、C-");
  }
  if (trimmed.toLowerCase() !== trimmed && !/^[A-Z0-9-]+$/.test(trimmed)) {
    suggestions.push("建议使用大写字母、数字和连字符");
  }
  return {
    valid: false,
    shouldSuspend: true,
    suggestions,
  };
}
