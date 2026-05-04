const fs = require('fs');
const path = require('path');
const { VoicePartValidator, VersionValidator, WalkthroughValidator } = require('../validators');
const DatabaseManager = require('../db');
const config = require('../config');

class Inspector {
  constructor(dbPath) {
    this.db = new DatabaseManager(dbPath);
    this.voicePartValidator = new VoicePartValidator();
    this.versionValidator = new VersionValidator();
    this.walkthroughValidator = new WalkthroughValidator();
  }
  
  scanDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`目录不存在: ${dirPath}`);
    }
    
    if (!fs.statSync(dirPath).isDirectory()) {
      throw new Error(`路径不是目录: ${dirPath}`);
    }
    
    const files = [];
    const scan = (currentPath, basePath = currentPath) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          scan(fullPath, basePath);
        } else if (entry.isFile()) {
          const stats = fs.statSync(fullPath);
          const relativePath = path.relative(dirPath, fullPath);
          
          files.push({
            name: entry.name,
            path: fullPath,
            relativePath,
            size: stats.size,
            modifiedAt: stats.mtime.toISOString(),
            type: this.getFileType(entry.name)
          });
        }
      }
    };
    
    scan(dirPath);
    return files;
  }
  
  getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const typeMap = {
      '.pdf': 'score',
      '.mp3': 'audio',
      '.wav': 'audio',
      '.aac': 'audio',
      '.ogg': 'audio',
      '.m4a': 'audio',
      '.csv': 'data',
      '.xlsx': 'data',
      '.xls': 'data',
      '.txt': 'document',
      '.doc': 'document',
      '.docx': 'document'
    };
    return typeMap[ext] || 'other';
  }
  
  getPackageInfo(dirPath) {
    const stats = fs.statSync(dirPath);
    const files = this.scanDirectory(dirPath);
    const packageName = path.basename(dirPath);
    
    return {
      name: packageName,
      path: dirPath,
      createdAt: stats.birthtime ? stats.birthtime.toISOString() : null,
      modifiedAt: stats.mtime.toISOString(),
      fileCount: files.length,
      files
    };
  }
  
  async runValidation(files, inspectionId) {
    const results = {
      voicePart: null,
      version: null,
      walkthrough: null,
      allRisks: []
    };
    
    results.voicePart = this.voicePartValidator.validate(files);
    for (const risk of results.voicePart.risks) {
      const riskId = this.db.createRisk(inspectionId, risk);
      risk.id = riskId;
      results.allRisks.push(risk);
    }
    
    results.version = this.versionValidator.validate(files);
    for (const risk of results.version.risks) {
      const riskId = this.db.createRisk(inspectionId, risk);
      risk.id = riskId;
      results.allRisks.push(risk);
    }
    
    results.walkthrough = await this.walkthroughValidator.validate(files);
    for (const risk of results.walkthrough.risks) {
      const riskId = this.db.createRisk(inspectionId, risk);
      risk.id = riskId;
      results.allRisks.push(risk);
    }
    
    return results;
  }
  
  async inspect(dirPath, options = {}) {
    const packageInfo = this.getPackageInfo(dirPath);
    
    const inspection = this.db.createInspection(
      packageInfo.name,
      packageInfo.path
    );
    
    const packageId = this.db.createPackage(inspection.id, {
      name: packageInfo.name,
      path: packageInfo.path,
      createdAt: packageInfo.createdAt,
      modifiedAt: packageInfo.modifiedAt,
      fileCount: packageInfo.fileCount
    });
    
    for (const file of packageInfo.files) {
      this.db.createFile(packageId, {
        name: file.name,
        path: file.path,
        size: file.size,
        type: file.type,
        version: this.versionValidator.extractVersion(file.name),
        voicePart: this.voicePartValidator.detectVoicePart(file.name),
        modifiedAt: file.modifiedAt
      });
    }
    
    const validationResults = await this.runValidation(packageInfo.files, inspection.id);
    
    const criticalCount = validationResults.allRisks.filter(r => 
      r.severity === 'critical'
    ).length;
    
    const warningCount = validationResults.allRisks.filter(r => 
      r.severity === 'warning'
    ).length;
    
    const status = criticalCount > 0 ? 'failed' : 
                   warningCount > 0 ? 'warning' : 'passed';
    
    const updatedInspection = this.db.updateInspectionStatus(
      inspection.id,
      status,
      {
        total: validationResults.allRisks.length,
        critical: criticalCount,
        warning: warningCount
      }
    );
    
    return {
      inspection: updatedInspection,
      package: {
        id: packageId,
        ...packageInfo
      },
      validation: validationResults,
      summary: {
        status,
        totalRisks: validationResults.allRisks.length,
        criticalRisks: criticalCount,
        warningRisks: warningCount
      }
    };
  }
  
  getInspectionDetails(inspectionId) {
    const inspection = this.db.getInspectionById(inspectionId);
    if (!inspection) {
      return null;
    }
    
    const risks = this.db.getRisksByInspection(inspectionId);
    const notes = this.db.getNotesByInspection(inspectionId);
    
    return {
      inspection,
      risks,
      notes
    };
  }
  
  listInspections(limit = 50, offset = 0) {
    return this.db.getInspections(limit, offset);
  }
  
  addNote(inspectionId, content, createdBy = 'system') {
    return this.db.createNote(inspectionId, {
      content,
      createdBy
    });
  }
  
  resolveRisk(riskId) {
    return this.db.resolveRisk(riskId);
  }
  
  close() {
    this.db.close();
  }
}

module.exports = Inspector;
