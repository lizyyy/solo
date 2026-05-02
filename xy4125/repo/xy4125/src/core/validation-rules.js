import * as THREE from 'three';
import { GeometryCalculator } from './geometry-calculator.js';

export const ValidationSeverity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  OK: 'ok'
};

export const ValidationType = {
  COLLISION: 'collision',
  GAP: 'gap',
  MISSING_TOOTH: 'missing_tooth',
  UNIT_SCALE: 'unit_scale',
  ATTACHMENT_POSITION: 'attachment_position',
  MOVEMENT_PATH: 'movement_path'
};

export class ValidationRules {
  constructor() {
    this.geometryCalculator = new GeometryCalculator();
    this.defaultConfig = {
      minimumGap: 0.5,
      criticalGap: 0.2,
      unit: 'mm',
      expectedScale: 1.0,
      scaleTolerance: 0.1,
      expectedTeethRange: {
        maxillary: [11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28],
        mandibular: [31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48]
      }
    };
  }

  validateAll(toothAnnotation, maxillaryModel, mandibularModel, config = {}) {
    const results = [];
    const cfg = { ...this.defaultConfig, ...config };

    results.push(...this.validateMissingTeeth(toothAnnotation, cfg));
    results.push(...this.validateUnitScale(toothAnnotation, maxillaryModel, mandibularModel, cfg));
    
    if (toothAnnotation.position === 'maxillary' && maxillaryModel) {
      results.push(...this.validateAttachmentCollisions(toothAnnotation, maxillaryModel, cfg));
    } else if (toothAnnotation.position === 'mandibular' && mandibularModel) {
      results.push(...this.validateAttachmentCollisions(toothAnnotation, mandibularModel, cfg));
    }

    results.push(...this.validateMovementPaths(toothAnnotation, cfg));

    if (maxillaryModel && mandibularModel) {
      results.push(...this.validateInterarchGap(maxillaryModel, mandibularModel, cfg));
    }

    return this.groupValidationResults(results);
  }

  validateMissingTeeth(toothAnnotation, config = {}) {
    const results = [];
    const cfg = { ...this.defaultConfig, ...config };
    
    const position = toothAnnotation.position;
    const expectedTeeth = cfg.expectedTeethRange[position] || [];
    const presentTeeth = toothAnnotation.teeth
      .filter(t => t.present)
      .map(t => t.fdiNumber);

    for (const expectedFdi of expectedTeeth) {
      if (!presentTeeth.includes(expectedFdi)) {
        results.push({
          type: ValidationType.MISSING_TOOTH,
          severity: ValidationSeverity.INFO,
          fdiNumber: expectedFdi,
          toothName: this.geometryCalculator.getToothName ? 
            (this.geometryCalculator.getToothName(expectedFdi) || `牙位 ${expectedFdi}`) :
            `牙位 ${expectedFdi}`,
          message: `牙位 ${expectedFdi} 缺失`,
          details: {
            expectedFdi,
            isMissing: true
          }
        });
      }
    }

    return results;
  }

  validateUnitScale(toothAnnotation, maxillaryModel, mandibularModel, config = {}) {
    const results = [];
    const cfg = { ...this.defaultConfig, ...config };

    const actualScale = toothAnnotation.scale || 1.0;
    const scaleDiff = Math.abs(actualScale - cfg.expectedScale);

    if (toothAnnotation.unit !== cfg.unit) {
      results.push({
        type: ValidationType.UNIT_SCALE,
        severity: ValidationSeverity.WARNING,
        message: `单位不匹配: 期望 ${cfg.unit}, 当前 ${toothAnnotation.unit}`,
        details: {
          expectedUnit: cfg.unit,
          actualUnit: toothAnnotation.unit,
          scale: actualScale
        }
      });
    }

    if (scaleDiff > cfg.scaleTolerance) {
      results.push({
        type: ValidationType.UNIT_SCALE,
        severity: ValidationSeverity.ERROR,
        message: `模型比例异常: 期望 ${cfg.expectedScale}, 当前 ${actualScale.toFixed(3)}`,
        details: {
          expectedScale: cfg.expectedScale,
          actualScale: actualScale,
          tolerance: cfg.scaleTolerance,
          difference: scaleDiff
        }
      });
    }

    if (maxillaryModel && maxillaryModel.geometry) {
      const maxBox = this.geometryCalculator.computeBoundingBoxFromGeometry(maxillaryModel.geometry);
      const maxSize = this.geometryCalculator.computeBoundingBoxSize(maxBox);
      
      if (maxSize.width < 10 || maxSize.width > 100) {
        results.push({
          type: ValidationType.UNIT_SCALE,
          severity: ValidationSeverity.WARNING,
          message: `上颌模型尺寸可能异常: 宽度 ${maxSize.width.toFixed(2)}mm`,
          details: {
            arch: 'maxillary',
            dimensions: maxSize
          }
        });
      }
    }

    if (mandibularModel && mandibularModel.geometry) {
      const mandBox = this.geometryCalculator.computeBoundingBoxFromGeometry(mandibularModel.geometry);
      const mandSize = this.geometryCalculator.computeBoundingBoxSize(mandBox);
      
      if (mandSize.width < 10 || mandSize.width > 100) {
        results.push({
          type: ValidationType.UNIT_SCALE,
          severity: ValidationSeverity.WARNING,
          message: `下颌模型尺寸可能异常: 宽度 ${mandSize.width.toFixed(2)}mm`,
          details: {
            arch: 'mandibular',
            dimensions: mandSize
          }
        });
      }
    }

    return results;
  }

  validateAttachmentCollisions(toothAnnotation, archModel, config = {}) {
    const results = [];
    const cfg = { ...this.defaultConfig, ...config };

    const teethWithAttachments = toothAnnotation.teeth.filter(t => t.hasAttachment && t.attachment);

    for (const tooth of teethWithAttachments) {
      const attachment = tooth.attachment;
      const attachmentBox = this.geometryCalculator.createAttachmentBoundingBox(
        attachment.position,
        attachment.size,
        attachment.rotation
      );

      if (archModel && archModel.geometry) {
        const archBox = this.geometryCalculator.computeBoundingBoxFromGeometry(archModel.geometry);
        
        if (this.geometryCalculator.boxIntersects(attachmentBox, archBox)) {
          results.push({
            type: ValidationType.COLLISION,
            severity: ValidationSeverity.ERROR,
            fdiNumber: tooth.fdiNumber,
            toothName: tooth.name,
            message: `${tooth.name} (${tooth.fdiNumber}) 的附件与牙列模型发生碰撞`,
            details: {
              toothId: tooth.id,
              fdiNumber: tooth.fdiNumber,
              attachmentType: attachment.type,
              attachmentPosition: {
                x: attachment.position.x,
                y: attachment.position.y,
                z: attachment.position.z
              },
              boxMin: { x: attachmentBox.min.x, y: attachmentBox.min.y, z: attachmentBox.min.z },
              boxMax: { x: attachmentBox.max.x, y: attachmentBox.max.y, z: attachmentBox.max.z }
            }
          });
        }

        const gap = this.geometryCalculator.computeBoxMinimumGap(attachmentBox, archBox);
        if (gap > 0 && gap < cfg.minimumGap) {
          results.push({
            type: ValidationType.GAP,
            severity: gap < cfg.criticalGap ? ValidationSeverity.ERROR : ValidationSeverity.WARNING,
            fdiNumber: tooth.fdiNumber,
            toothName: tooth.name,
            message: `${tooth.name} (${tooth.fdiNumber}) 的附件与牙面间隙过小: ${gap.toFixed(3)}mm`,
            details: {
              toothId: tooth.id,
              fdiNumber: tooth.fdiNumber,
              gap: gap,
              minimumGap: cfg.minimumGap,
              criticalGap: cfg.criticalGap
            }
          });
        }
      }

      for (const otherTooth of teethWithAttachments) {
        if (otherTooth.id === tooth.id) continue;

        const otherAttachment = otherTooth.attachment;
        const otherAttachmentBox = this.geometryCalculator.createAttachmentBoundingBox(
          otherAttachment.position,
          otherAttachment.size,
          otherAttachment.rotation
        );

        if (this.geometryCalculator.boxIntersects(attachmentBox, otherAttachmentBox)) {
          results.push({
            type: ValidationType.COLLISION,
            severity: ValidationSeverity.ERROR,
            fdiNumber: tooth.fdiNumber,
            otherFdiNumber: otherTooth.fdiNumber,
            toothName: tooth.name,
            otherToothName: otherTooth.name,
            message: `${tooth.name} (${tooth.fdiNumber}) 与 ${otherTooth.name} (${otherTooth.fdiNumber}) 的附件发生碰撞`,
            details: {
              tooth1: { id: tooth.id, fdiNumber: tooth.fdiNumber },
              tooth2: { id: otherTooth.id, fdiNumber: otherTooth.fdiNumber }
            }
          });
        }
      }
    }

    return results;
  }

  validateMovementPaths(toothAnnotation, config = {}) {
    const results = [];
    const cfg = { ...this.defaultConfig, ...config };

    const teethWithMovement = toothAnnotation.teeth.filter(t => t.movement);

    for (const tooth of teethWithMovement) {
      const movement = tooth.movement;
      const translationMagnitude = movement.translation.length();

      if (translationMagnitude > 10) {
        results.push({
          type: ValidationType.MOVEMENT_PATH,
          severity: ValidationSeverity.WARNING,
          fdiNumber: tooth.fdiNumber,
          toothName: tooth.name,
          message: `${tooth.name} (${tooth.fdiNumber}) 移动量较大: ${translationMagnitude.toFixed(2)}mm`,
          details: {
            toothId: tooth.id,
            fdiNumber: tooth.fdiNumber,
            translation: {
              x: movement.translation.x,
              y: movement.translation.y,
              z: movement.translation.z
            },
            magnitude: translationMagnitude
          }
        });
      }

      if (tooth.hasAttachment && tooth.attachment) {
        const originalAttachmentBox = this.geometryCalculator.createAttachmentBoundingBox(
          tooth.attachment.position,
          tooth.attachment.size,
          tooth.attachment.rotation
        );

        const movedAttachmentPosition = tooth.attachment.position.clone().add(movement.translation);
        const movedAttachmentBox = this.geometryCalculator.createAttachmentBoundingBox(
          movedAttachmentPosition,
          tooth.attachment.size,
          tooth.attachment.rotation
        );

        const combinedBox = originalAttachmentBox.clone();
        combinedBox.union(movedAttachmentBox);

        for (const otherTooth of teethWithMovement) {
          if (otherTooth.id === tooth.id) continue;

          if (otherTooth.hasAttachment && otherTooth.attachment) {
            const otherOriginalBox = this.geometryCalculator.createAttachmentBoundingBox(
              otherTooth.attachment.position,
              otherTooth.attachment.size,
              otherTooth.attachment.rotation
            );

            const otherMovedPosition = otherTooth.attachment.position.clone().add(otherTooth.movement.translation);
            const otherMovedBox = this.geometryCalculator.createAttachmentBoundingBox(
              otherMovedPosition,
              otherTooth.attachment.size,
              otherTooth.attachment.rotation
            );

            const otherCombinedBox = otherOriginalBox.clone();
            otherCombinedBox.union(otherMovedBox);

            if (this.geometryCalculator.boxIntersects(combinedBox, otherCombinedBox)) {
              results.push({
                type: ValidationType.MOVEMENT_PATH,
                severity: ValidationSeverity.ERROR,
                fdiNumber: tooth.fdiNumber,
                otherFdiNumber: otherTooth.fdiNumber,
                toothName: tooth.name,
                otherToothName: otherTooth.name,
                message: `移动路径冲突: ${tooth.name} (${tooth.fdiNumber}) 与 ${otherTooth.name} (${otherTooth.fdiNumber}) 在移动过程中可能发生碰撞`,
                details: {
                  tooth1: { 
                    id: tooth.id, 
                    fdiNumber: tooth.fdiNumber,
                    translation: {
                      x: movement.translation.x,
                      y: movement.translation.y,
                      z: movement.translation.z
                    }
                  },
                  tooth2: { 
                    id: otherTooth.id, 
                    fdiNumber: otherTooth.fdiNumber,
                    translation: {
                      x: otherTooth.movement.translation.x,
                      y: otherTooth.movement.translation.y,
                      z: otherTooth.movement.translation.z
                    }
                  }
                }
              });
            }
          }
        }
      }
    }

    return results;
  }

  validateInterarchGap(maxillaryModel, mandibularModel, config = {}) {
    const results = [];
    const cfg = { ...this.defaultConfig, ...config };

    if (!maxillaryModel || !mandibularModel) {
      return results;
    }

    let minGap = Infinity;
    
    if (maxillaryModel.vertices && mandibularModel.vertices) {
      const closestPoints = this.geometryCalculator.computeClosestPoints(
        maxillaryModel.vertices,
        mandibularModel.vertices
      );
      minGap = closestPoints.distance;
    } else if (maxillaryModel.geometry && mandibularModel.geometry) {
      const maxBox = this.geometryCalculator.computeBoundingBoxFromGeometry(maxillaryModel.geometry);
      const mandBox = this.geometryCalculator.computeBoundingBoxFromGeometry(mandibularModel.geometry);
      
      if (this.geometryCalculator.boxIntersects(maxBox, mandBox)) {
        minGap = 0;
      } else {
        minGap = this.geometryCalculator.computeBoxMinimumGap(maxBox, mandBox);
      }
    }

    if (minGap === 0) {
      results.push({
        type: ValidationType.COLLISION,
        severity: ValidationSeverity.ERROR,
        message: '上下颌模型发生咬合碰撞',
        details: {
          gap: 0,
          minimumGap: cfg.minimumGap
        }
      });
    } else if (minGap < cfg.minimumGap) {
      results.push({
        type: ValidationType.GAP,
        severity: minGap < cfg.criticalGap ? ValidationSeverity.ERROR : ValidationSeverity.WARNING,
        message: `上下颌咬合间隙过小: ${minGap.toFixed(3)}mm`,
        details: {
          gap: minGap,
          minimumGap: cfg.minimumGap,
          criticalGap: cfg.criticalGap
        }
      });
    }

    return results;
  }

  groupValidationResults(results) {
    const grouped = {
      errors: results.filter(r => r.severity === ValidationSeverity.ERROR),
      warnings: results.filter(r => r.severity === ValidationSeverity.WARNING),
      infos: results.filter(r => r.severity === ValidationSeverity.INFO),
      all: results,
      summary: {
        total: results.length,
        errors: results.filter(r => r.severity === ValidationSeverity.ERROR).length,
        warnings: results.filter(r => r.severity === ValidationSeverity.WARNING).length,
        infos: results.filter(r => r.severity === ValidationSeverity.INFO).length,
        hasErrors: results.some(r => r.severity === ValidationSeverity.ERROR),
        hasWarnings: results.some(r => r.severity === ValidationSeverity.WARNING)
      }
    };

    return grouped;
  }

  getValidationReport(results) {
    const grouped = Array.isArray(results) ? this.groupValidationResults(results) : results;
    
    return {
      timestamp: new Date().toISOString(),
      summary: grouped.summary,
      errors: grouped.errors,
      warnings: grouped.warnings,
      infos: grouped.infos,
      status: grouped.summary.hasErrors ? 'FAILED' : 
              grouped.summary.hasWarnings ? 'WARNING' : 'PASSED'
    };
  }
}

export default ValidationRules;
