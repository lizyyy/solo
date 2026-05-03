import { DataParser } from './dataParser.js';

const parser = new DataParser();

export class RulesEngine {
  constructor(rules) {
    this.rules = rules || {
      collision: { minDistance: 0.1, checkAdjacentOnly: true },
      range: { buccal: { min: 0.05, max: 0.35 }, lingual: { min: -0.35, max: -0.05 } },
      mirror: { enableCheck: true, symmetryThreshold: 0.1 },
      missing: { enableCheck: true }
    };
  }

  validateAll(teethData, attachments, currentStep) {
    const issues = [];
    
    issues.push(...this.checkCollisions(teethData, attachments, currentStep));
    issues.push(...this.checkRangeViolations(teethData, attachments, currentStep));
    issues.push(...this.checkMirrorMismatch(teethData, attachments, currentStep));
    issues.push(...this.checkMissingTeeth(teethData, attachments, currentStep));
    
    return this.sortIssues(issues);
  }

  sortIssues(issues) {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  checkCollisions(teethData, attachments, currentStep) {
    const issues = [];
    const currentAttachments = attachments.filter(a => a.step === currentStep);
    
    for (let i = 0; i < currentAttachments.length; i++) {
      for (let j = i + 1; j < currentAttachments.length; j++) {
        const att1 = currentAttachments[i];
        const att2 = currentAttachments[j];
        
        const tooth1 = parser.getToothById(teethData, att1.toothNumber);
        const tooth2 = parser.getToothById(teethData, att2.toothNumber);
        
        if (!tooth1 || !tooth2) continue;
        
        if (this.rules.collision.checkAdjacentOnly) {
          const adjacentTeeth1 = parser.getAdjacentTeeth(teethData, att1.toothNumber);
          const isAdjacent = adjacentTeeth1.some(t => t.id === att2.toothNumber);
          if (!isAdjacent) continue;
        }
        
        const worldPos1 = this.getWorldPosition(tooth1, att1);
        const worldPos2 = this.getWorldPosition(tooth2, att2);
        
        const distance = Math.sqrt(
          Math.pow(worldPos1.x - worldPos2.x, 2) +
          Math.pow(worldPos1.y - worldPos2.y, 2) +
          Math.pow(worldPos1.z - worldPos2.z, 2)
        );
        
        const minDist = (att1.size.width + att2.size.width) / 2 + this.rules.collision.minDistance;
        
        if (distance < minDist) {
          issues.push({
            id: `collision_${att1.id}_${att2.id}`,
            type: 'collision',
            severity: 'error',
            message: `附件 #${att1.id} (牙位 ${att1.toothNumber}) 与附件 #${att2.id} (牙位 ${att2.toothNumber}) 发生碰撞`,
            affectedTeeth: [att1.toothNumber, att2.toothNumber],
            affectedAttachments: [att1.id, att2.id],
            step: currentStep,
            distance: distance.toFixed(3),
            minAllowed: minDist.toFixed(3)
          });
        }
      }
    }
    
    return issues;
  }

  checkRangeViolations(teethData, attachments, currentStep) {
    const issues = [];
    const currentAttachments = attachments.filter(a => a.step === currentStep);
    
    currentAttachments.forEach(att => {
      const tooth = parser.getToothById(teethData, att.toothNumber);
      if (!tooth) return;
      
      const posY = att.position.y;
      const isBuccal = att.side === 'buccal';
      
      if (isBuccal) {
        const { min, max } = tooth.buccalRange || this.rules.range.buccal;
        if (posY < min || posY > max) {
          issues.push({
            id: `range_${att.id}`,
            type: 'range_violation',
            severity: 'warning',
            message: `附件 #${att.id} (牙位 ${att.toothNumber}) 唇侧位置超出范围`,
            affectedTeeth: [att.toothNumber],
            affectedAttachments: [att.id],
            step: currentStep,
            side: 'buccal',
            currentValue: posY.toFixed(3),
            allowedRange: `[${min}, ${max}]`
          });
        }
      } else {
        const { min, max } = tooth.lingualRange || this.rules.range.lingual;
        if (posY < min || posY > max) {
          issues.push({
            id: `range_${att.id}`,
            type: 'range_violation',
            severity: 'warning',
            message: `附件 #${att.id} (牙位 ${att.toothNumber}) 舌侧位置超出范围`,
            affectedTeeth: [att.toothNumber],
            affectedAttachments: [att.id],
            step: currentStep,
            side: 'lingual',
            currentValue: posY.toFixed(3),
            allowedRange: `[${min}, ${max}]`
          });
        }
      }
    });
    
    return issues;
  }

  checkMirrorMismatch(teethData, attachments, currentStep) {
    if (!this.rules.mirror.enableCheck) return [];
    
    const issues = [];
    const currentAttachments = attachments.filter(a => a.step === currentStep);
    
    const mirrorMap = {
      11: 21, 12: 22, 13: 23, 14: 24, 15: 25, 16: 26, 17: 27,
      21: 11, 22: 12, 23: 13, 24: 14, 25: 15, 26: 16, 27: 17,
      31: 41, 32: 42, 33: 43, 34: 44, 35: 45, 36: 46, 37: 47,
      41: 31, 42: 32, 43: 33, 44: 34, 45: 35, 46: 36, 47: 37
    };
    
    const processed = new Set();
    
    currentAttachments.forEach(att => {
      if (processed.has(att.id)) return;
      
      const mirrorToothNumber = mirrorMap[att.toothNumber];
      if (!mirrorToothNumber) return;
      
      const mirrorAttachments = currentAttachments.filter(a => 
        a.toothNumber === mirrorToothNumber && a.type === att.type
      );
      
      if (mirrorAttachments.length === 0) {
        issues.push({
          id: `mirror_missing_${att.id}`,
          type: 'mirror_mismatch',
          severity: 'warning',
          message: `牙位 ${att.toothNumber} 有附件，但镜像牙位 ${mirrorToothNumber} 缺失`,
          affectedTeeth: [att.toothNumber, mirrorToothNumber],
          affectedAttachments: [att.id],
          step: currentStep,
          issue: 'mirror_attachment_missing'
        });
        return;
      }
      
      mirrorAttachments.forEach(mirrorAtt => {
        processed.add(mirrorAtt.id);
        
        if (att.isMirrored !== mirrorAtt.isMirrored) {
          issues.push({
            id: `mirror_flag_${att.id}_${mirrorAtt.id}`,
            type: 'mirror_mismatch',
            severity: 'error',
            message: `附件 #${att.id} (牙位 ${att.toothNumber}) 与镜像附件 #${mirrorAtt.id} (牙位 ${mirrorToothNumber}) 镜像标记不一致`,
            affectedTeeth: [att.toothNumber, mirrorToothNumber],
            affectedAttachments: [att.id, mirrorAtt.id],
            step: currentStep,
            issue: 'mirror_flag_mismatch'
          });
        }
        
        const positionDiff = Math.abs(att.position.x - (-mirrorAtt.position.x)) +
                            Math.abs(att.position.y - mirrorAtt.position.y) +
                            Math.abs(att.position.z - mirrorAtt.position.z);
        
        if (positionDiff > this.rules.mirror.symmetryThreshold) {
          issues.push({
            id: `mirror_pos_${att.id}_${mirrorAtt.id}`,
            type: 'mirror_mismatch',
            severity: 'warning',
            message: `附件 #${att.id} (牙位 ${att.toothNumber}) 与镜像附件位置不对称`,
            affectedTeeth: [att.toothNumber, mirrorToothNumber],
            affectedAttachments: [att.id, mirrorAtt.id],
            step: currentStep,
            issue: 'position_asymmetry',
            difference: positionDiff.toFixed(3)
          });
        }
      });
    });
    
    return issues;
  }

  checkMissingTeeth(teethData, attachments, currentStep) {
    if (!this.rules.missing.enableCheck) return [];
    
    const issues = [];
    const currentAttachments = attachments.filter(a => a.step === currentStep);
    
    currentAttachments.forEach(att => {
      const tooth = parser.getToothById(teethData, att.toothNumber);
      if (tooth && tooth.isMissing) {
        issues.push({
          id: `missing_tooth_${att.id}`,
          type: 'missing_tooth',
          severity: 'error',
          message: `附件 #${att.id} 放置在缺牙牙位 ${att.toothNumber} 上`,
          affectedTeeth: [att.toothNumber],
          affectedAttachments: [att.id],
          step: currentStep
        });
      }
      
      if (!tooth) {
        issues.push({
          id: `invalid_tooth_${att.id}`,
          type: 'missing_tooth',
          severity: 'error',
          message: `附件 #${att.id} 引用的牙位 ${att.toothNumber} 不存在`,
          affectedTeeth: [att.toothNumber],
          affectedAttachments: [att.id],
          step: currentStep
        });
      }
    });
    
    return issues;
  }

  getWorldPosition(tooth, attachment) {
    return {
      x: tooth.center.x + attachment.position.x,
      y: tooth.center.y + attachment.position.y,
      z: tooth.center.z + attachment.position.z
    };
  }

  getIssueSummary(issues) {
    const summary = {
      total: issues.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      infos: issues.filter(i => i.severity === 'info').length,
      byType: {}
    };
    
    issues.forEach(issue => {
      if (!summary.byType[issue.type]) {
        summary.byType[issue.type] = 0;
      }
      summary.byType[issue.type]++;
    });
    
    return summary;
  }
}
