const fs = require('fs');
const path = require('path');
const config = require('../config');

class JSONExporter {
  constructor() {
    this.indent = 2;
  }
  
  buildAuditPackage(inspectionDetails, dbManager) {
    const { inspection, risks, notes } = inspectionDetails;
    
    const files = [];
    const packages = dbManager.db.prepare(`
      SELECT * FROM packages WHERE inspection_id = ?
    `).all(inspection.id);
    
    for (const pkg of packages) {
      const pkgFiles = dbManager.getFilesByPackage(pkg.id);
      for (const file of pkgFiles) {
        files.push({
          id: file.id,
          packageId: file.package_id,
          name: file.name,
          path: file.path,
          size: file.size,
          type: file.type,
          version: file.version,
          voicePart: file.voice_part,
          modifiedAt: file.modified_at
        });
      }
    }
    
    const formattedRisks = risks.map(risk => {
      let details = risk.details;
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details);
        } catch (e) {
          // 保持原样
        }
      }
      
      return {
        id: risk.id,
        inspectionId: risk.inspection_id,
        type: risk.type,
        severity: risk.severity,
        category: risk.category,
        message: risk.message,
        filePath: risk.file_path,
        details,
        isResolved: risk.is_resolved === 1,
        resolvedAt: risk.resolved_at,
        createdAt: risk.created_at
      };
    });
    
    const formattedNotes = notes.map(note => ({
      id: note.id,
      inspectionId: note.inspection_id,
      riskId: note.risk_id,
      content: note.content,
      createdBy: note.created_by,
      createdAt: note.created_at,
      updatedAt: note.updated_at
    }));
    
    const auditPackage = {
      audit: {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        toolVersion: config.app.version,
        toolName: config.app.name
      },
      inspection: {
        id: inspection.id,
        packageName: inspection.package_name,
        packagePath: inspection.package_path,
        inspectedAt: inspection.inspected_at,
        status: inspection.status,
        riskSummary: {
          total: inspection.total_risks,
          critical: inspection.critical_risks,
          warning: inspection.warning_risks
        }
      },
      files: {
        count: files.length,
        items: files
      },
      risks: {
        count: formattedRisks.length,
        bySeverity: {
          critical: formattedRisks.filter(r => r.severity === 'critical').length,
          warning: formattedRisks.filter(r => r.severity === 'warning').length,
          info: formattedRisks.filter(r => r.severity === 'info').length,
          other: formattedRisks.filter(r => 
            !['critical', 'warning', 'info'].includes(r.severity)
          ).length
        },
        items: formattedRisks
      },
      notes: {
        count: formattedNotes.length,
        items: formattedNotes
      },
      summary: {
        passed: inspection.status === 'passed',
        hasCriticalRisks: inspection.critical_risks > 0,
        hasWarningRisks: inspection.warning_risks > 0,
        recommendations: this.generateRecommendations(inspection, formattedRisks)
      }
    };
    
    return auditPackage;
  }
  
  generateRecommendations(inspection, risks) {
    const recommendations = [];
    
    const criticalRisks = risks.filter(r => r.severity === 'critical');
    
    for (const risk of criticalRisks) {
      if (risk.type === 'voice_part') {
        recommendations.push({
          priority: 'high',
          action: '补充缺失的分声部乐谱',
          details: risk.message
        });
      } else if (risk.type === 'version') {
        recommendations.push({
          priority: 'high',
          action: '统一文件版本号',
          details: risk.message
        });
      } else if (risk.type === 'walkthrough') {
        recommendations.push({
          priority: 'high',
          action: '修正走台提示中的时间越界问题',
          details: risk.message
        });
      }
    }
    
    const warningRisks = risks.filter(r => r.severity === 'warning');
    
    for (const risk of warningRisks) {
      recommendations.push({
        priority: 'medium',
        action: `检查: ${risk.category}`,
        details: risk.message
      });
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        action: '资料包检查通过',
        details: '可以正常下发给团员'
      });
    }
    
    return recommendations;
  }
  
  export(inspectionDetails, outputPath, dbManager) {
    const auditPackage = this.buildAuditPackage(inspectionDetails, dbManager);
    
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const jsonContent = JSON.stringify(auditPackage, null, this.indent);
    fs.writeFileSync(outputPath, jsonContent, 'utf8');
    
    return {
      path: outputPath,
      size: Buffer.byteLength(jsonContent, 'utf8'),
      generatedAt: new Date().toISOString(),
      inspectionId: inspectionDetails.inspection.id
    };
  }
  
  exportToBuffer(inspectionDetails, dbManager) {
    const auditPackage = this.buildAuditPackage(inspectionDetails, dbManager);
    return JSON.stringify(auditPackage, null, this.indent);
  }
}

module.exports = JSONExporter;
