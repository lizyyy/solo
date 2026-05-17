"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictDetector = void 0;
class ConflictDetector {
    detectConflicts(patches, originalJson) {
        const conflicts = [];
        patches.forEach((patch, index) => {
            const patchConflicts = this.detectPatchConflicts(patch, index, originalJson);
            conflicts.push(...patchConflicts);
        });
        const duplicateConflicts = this.detectDuplicatePaths(patches);
        conflicts.push(...duplicateConflicts);
        return conflicts;
    }
    detectPatchConflicts(patch, patchIndex, originalJson) {
        const conflicts = [];
        const pathExists = this.pathExists(originalJson, patch.path);
        if (!pathExists) {
            if (patch.op === "replace" || patch.op === "remove" || patch.op === "test") {
                conflicts.push({
                    type: "path_not_exists",
                    path: patch.path,
                    message: `Path "${patch.path}" does not exist in target JSON. Operation "${patch.op}" will fail.`,
                    severity: "error",
                    patchIndex
                });
            }
        }
        if (pathExists && (patch.op === "add" || patch.op === "replace")) {
            const existingValue = this.getValueAtPath(originalJson, patch.path);
            if (typeof existingValue === "object" && existingValue !== null && patch.value !== undefined) {
                if (typeof patch.value !== "object" || patch.value === null) {
                    conflicts.push({
                        type: "would_overwrite_nested",
                        path: patch.path,
                        message: `Path "${patch.path}" contains nested object/array but will be overwritten with a non-object value.`,
                        severity: "warning",
                        patchIndex,
                        existingValue,
                        newValue: patch.value
                    });
                }
            }
        }
        if (patch.op === "test" && pathExists) {
            const existingValue = this.getValueAtPath(originalJson, patch.path);
            if (JSON.stringify(existingValue) !== JSON.stringify(patch.value)) {
                conflicts.push({
                    type: "test_failure",
                    path: patch.path,
                    message: `Test operation failed at path "${patch.path}". Expected value does not match.`,
                    severity: "error",
                    patchIndex,
                    existingValue,
                    newValue: patch.value
                });
            }
        }
        return conflicts;
    }
    detectDuplicatePaths(patches) {
        const conflicts = [];
        const pathCounts = new Map();
        patches.forEach((patch, index) => {
            const existing = pathCounts.get(patch.path) || [];
            existing.push(index);
            pathCounts.set(patch.path, existing);
        });
        pathCounts.forEach((indices, path) => {
            if (indices.length > 1) {
                conflicts.push({
                    type: "duplicate_path",
                    path,
                    message: `Multiple patches target the same path "${path}". This may cause unexpected results.`,
                    severity: "warning",
                    patchIndex: indices[0]
                });
            }
        });
        return conflicts;
    }
    pathExists(obj, path) {
        if (path === "/")
            return true;
        const parts = path.split("/").filter(p => p !== "");
        let current = obj;
        for (let i = 0; i < parts.length; i++) {
            const part = this.decodePathSegment(parts[i]);
            if (current === null || current === undefined) {
                return false;
            }
            if (Array.isArray(current)) {
                const index = parseInt(part, 10);
                if (isNaN(index) || index < 0 || index >= current.length) {
                    if (i === parts.length - 1 && part === "-") {
                        return true;
                    }
                    return false;
                }
                current = current[index];
            }
            else if (typeof current === "object") {
                if (!(part in current)) {
                    return false;
                }
                current = current[part];
            }
            else {
                return false;
            }
        }
        return true;
    }
    getValueAtPath(obj, path) {
        if (path === "/")
            return obj;
        const parts = path.split("/").filter(p => p !== "");
        let current = obj;
        for (const part of parts) {
            const decoded = this.decodePathSegment(part);
            if (current === null || current === undefined) {
                return undefined;
            }
            if (Array.isArray(current)) {
                const index = parseInt(decoded, 10);
                if (isNaN(index)) {
                    return undefined;
                }
                current = current[index];
            }
            else if (typeof current === "object") {
                current = current[decoded];
            }
            else {
                return undefined;
            }
        }
        return current;
    }
    decodePathSegment(segment) {
        return segment.replace(/~1/g, "/").replace(/~0/g, "~");
    }
}
exports.ConflictDetector = ConflictDetector;
