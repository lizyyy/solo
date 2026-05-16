import { JsonPatch, ValidationResult } from "./types";

export class PatchValidator {
  private validOperations = ["add", "remove", "replace", "move", "copy", "test"];

  validatePatch(patch: JsonPatch, index: number): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!this.validOperations.includes(patch.op)) {
      errors.push({
        type: "invalid_operation",
        message: `Invalid operation "${patch.op}". Must be one of: ${this.validOperations.join(", ")}`,
        patchIndex: index,
        path: patch.path
      });
    }

    if (!patch.path || typeof patch.path !== "string") {
      errors.push({
        type: "missing_path",
        message: "Patch must have a valid path string",
        patchIndex: index
      });
    } else if (!patch.path.startsWith("/")) {
      errors.push({
        type: "invalid_path_format",
        message: `Path "${patch.path}" must start with "/"`,
        patchIndex: index,
        path: patch.path
      });
    }

    if (["add", "replace", "test"].includes(patch.op) && patch.value === undefined) {
      errors.push({
        type: "missing_value",
        message: `Operation "${patch.op}" requires a "value" field`,
        patchIndex: index,
        path: patch.path
      });
    }

    if (["move", "copy"].includes(patch.op)) {
      if (!patch.from) {
        errors.push({
          type: "missing_from",
          message: `Operation "${patch.op}" requires a "from" field`,
          patchIndex: index,
          path: patch.path
        });
      } else if (!patch.from.startsWith("/")) {
        errors.push({
          type: "invalid_from_format",
          message: `"from" path "${patch.from}" must start with "/"`,
          patchIndex: index,
          path: patch.from
        });
      }
    }

    if (patch.op === "remove" && patch.value !== undefined) {
      warnings.push({
        type: "unnecessary_value",
        message: `Operation "remove" does not need a "value" field - it will be ignored`,
        patchIndex: index,
        path: patch.path
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validatePatches(patches: JsonPatch[]): ValidationResult {
    const allErrors: any[] = [];
    const allWarnings: any[] = [];

    patches.forEach((patch, index) => {
      const result = this.validatePatch(patch, index);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    });

    return { valid: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
  }
}
