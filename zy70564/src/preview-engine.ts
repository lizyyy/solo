import { applyPatch, deepClone } from 'fast-json-patch';
import { JsonPatch, FilePreviewResult, PatchPreview, ValidationResult, Conflict } from './types';
import { PatchValidator } from './patch-validator';
import { ConflictDetector } from './conflict-detector';

export class PreviewEngine {
  private validator = new PatchValidator();
  private conflictDetector = new ConflictDetector();

  previewFile(
    filePath: string,
    originalJson: any,
    patches: JsonPatch[]
  ): FilePreviewResult {
    const validation = this.validator.validatePatches(patches);
    const conflicts = this.conflictDetector.detectConflicts(patches, originalJson);

    const hasErrors = !validation.valid || conflicts.some(c => c.severity === 'error');
    const previews = this.generatePatchPreviews(patches, originalJson);

    let patchedJson = originalJson;
    let success = !hasErrors;

    if (!hasErrors) {
      try {
        const result = applyPatch(deepClone(originalJson), patches, true, true);
        patchedJson = result.newDocument;
      } catch (error: any) {
        success = false;
        conflicts.push({
          type: 'patch_application_error',
          path: '/',
          message: `Patch application failed: ${error.message}`,
          severity: 'error'
        });
      }
    }

    return {
      filePath,
      originalJson: deepClone(originalJson),
      patches,
      patchedJson,
      validation,
      conflicts,
      previews,
      diff: this.calculateDiff(originalJson, patchedJson),
      success
    };
  }

  private generatePatchPreviews(patches: JsonPatch[], originalJson: any): PatchPreview[] {
    const previews: PatchPreview[] = [];
    let currentJson = deepClone(originalJson);

    patches.forEach((patch, index) => {
      try {
        const originalValue = this.getValueAtPath(currentJson, patch.path);
        const result = applyPatch(currentJson, [patch], true, true);
        const newValue = this.getValueAtPath(result.newDocument, patch.path);

        previews.push({
          originalValue,
          newValue,
          path: patch.path,
          op: patch.op,
          changed: JSON.stringify(originalValue) !== JSON.stringify(newValue)
        });

        currentJson = result.newDocument;
      } catch {
        previews.push({
          originalValue: undefined,
          newValue: undefined,
          path: patch.path,
          op: patch.op,
          changed: false
        });
      }
    });

    return previews;
  }

  private calculateDiff(oldObj: any, newObj: any, path: string = ''): any[] {
    const diffs: any[] = [];

    if (JSON.stringify(oldObj) === JSON.stringify(newObj)) {
      return diffs;
    }

    if (oldObj === null || newObj === null || typeof oldObj !== typeof newObj) {
      diffs.push({
        path: path || '/',
        op: 'replace',
        oldValue: oldObj,
        newValue: newObj
      });
      return diffs;
    }

    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
      const maxLen = Math.max(oldObj.length, newObj.length);
      for (let i = 0; i < maxLen; i++) {
        const currPath = `${path}/${i}`;
        if (i >= oldObj.length) {
          diffs.push({ path: currPath, op: 'add', newValue: newObj[i] });
        } else if (i >= newObj.length) {
          diffs.push({ path: currPath, op: 'remove', oldValue: oldObj[i] });
        } else if (JSON.stringify(oldObj[i]) !== JSON.stringify(newObj[i])) {
          if (typeof oldObj[i] === 'object' && typeof newObj[i] === 'object') {
            diffs.push(...this.calculateDiff(oldObj[i], newObj[i], currPath));
          } else {
            diffs.push({
              path: currPath,
              op: 'replace',
              oldValue: oldObj[i],
              newValue: newObj[i]
            });
          }
        }
      }
      return diffs;
    }

    if (typeof oldObj === 'object' && typeof newObj === 'object') {
      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

      for (const key of allKeys) {
        const currPath = path ? `${path}/${key}` : `/${key}`;
        if (!(key in oldObj)) {
          diffs.push({ path: currPath, op: 'add', newValue: newObj[key] });
        } else if (!(key in newObj)) {
          diffs.push({ path: currPath, op: 'remove', oldValue: oldObj[key] });
        } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
          if (typeof oldObj[key] === 'object' && typeof newObj[key] === 'object') {
            diffs.push(...this.calculateDiff(oldObj[key], newObj[key], currPath));
          } else {
            diffs.push({
              path: currPath,
              op: 'replace',
              oldValue: oldObj[key],
              newValue: newObj[key]
            });
          }
        }
      }
    }

    return diffs;
  }

  private getValueAtPath(obj: any, path: string): any {
    if (path === '/') return obj;

    const parts = path.split('/').filter(p => p !== '');
    let current = obj;

    for (const part of parts) {
      const decoded = part.replace(/~1/g, '/').replace(/~0/g, '~');

      if (current === null || current === undefined) {
        return undefined;
      }

      if (Array.isArray(current)) {
        const index = parseInt(decoded, 10);
        if (isNaN(index)) {
          return undefined;
        }
        current = current[index];
      } else if (typeof current === 'object') {
        current = current[decoded];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
