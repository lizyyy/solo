const fs = require('fs');
const path = require('path');

class DocumentHistoryManager {
  constructor(historyFilePath) {
    this.historyFilePath = historyFilePath || './document-history.json';
    this.history = this.loadHistory();
  }

  loadHistory() {
    if (fs.existsSync(this.historyFilePath)) {
      const data = fs.readFileSync(this.historyFilePath, 'utf8');
      return JSON.parse(data);
    }
    return {
      documents: [],
      lastSync: null
    };
  }

  saveHistory() {
    this.history.lastSync = new Date().toISOString();
    fs.writeFileSync(
      this.historyFilePath,
      JSON.stringify(this.history, null, 2),
      'utf8'
    );
  }

  findDocument(documentId) {
    return this.history.documents.find(d => d.id === documentId);
  }

  addDocument(documentId, documentName, initialContent = {}) {
    if (this.findDocument(documentId)) {
      throw new Error(`Document ${documentId} already exists`);
    }
    
    const doc = {
      id: documentId,
      name: documentName,
      createdAt: new Date().toISOString(),
      manualModified: false,
      currentVersion: 1,
      versions: [
        {
          version: 1,
          timestamp: new Date().toISOString(),
          operator: 'system',
          changeType: 'INITIAL',
          content: initialContent,
          changeReason: '初始版本'
        }
      ]
    };
    
    this.history.documents.push(doc);
    this.saveHistory();
    return doc;
  }

  recordManualChange(documentId, operator, fieldChanges, reason) {
    const doc = this.findDocument(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }

    const previousVersion = doc.versions[doc.versions.length - 1];
    const newVersion = {
      version: doc.currentVersion + 1,
      timestamp: new Date().toISOString(),
      operator,
      changeType: 'MANUAL_MODIFICATION',
      changes: fieldChanges.map(change => ({
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue
      })),
      changeReason: reason,
      previousContent: previousVersion.content
    };

    doc.versions.push(newVersion);
    doc.currentVersion += 1;
    doc.manualModified = true;
    doc.lastModified = newVersion.timestamp;
    doc.lastModifier = operator;

    this.saveHistory();
    return newVersion;
  }

  getDocumentHistory(documentId) {
    const doc = this.findDocument(documentId);
    if (!doc) return null;

    return {
      ...doc,
      versions: doc.versions.map(v => ({
        version: v.version,
        timestamp: v.timestamp,
        operator: v.operator,
        changeType: v.changeType,
        changeReason: v.changeReason,
        changes: v.changes || []
      })).reverse()
    };
  }

  checkConsistencyWithMigrationReport(documentId, migrationConclusions) {
    const doc = this.findDocument(documentId);
    if (!doc) {
      return { consistent: false, error: 'Document not found' };
    }

    const inconsistencies = [];
    
    migrationConclusions.forEach(conclusion => {
      if (conclusion.sourceRefs) {
        const docRef = conclusion.sourceRefs.find(
          ref => ref.sourceType === 'OLD_DOCUMENT' && ref.sourceId === documentId
        );
        
        if (docRef) {
          const mentionedChanges = conclusion.history || [];
          const docChanges = doc.versions.filter(
            v => v.changeType === 'MANUAL_MODIFICATION'
          );
          
          mentionedChanges.forEach(mChange => {
            const matchingChange = docChanges.find(
              dChange => 
                dChange.changes && 
                dChange.changes.some(c => c.field === mChange.field) &&
                Math.abs(new Date(dChange.timestamp) - new Date(mChange.timestamp)) < 60000
            );
            
            if (!matchingChange && mChange.changeType === 'DOCUMENT_UPDATE') {
              inconsistencies.push({
                conclusionId: conclusion.conclusionId,
                field: mChange.field,
                issue: '迁移报告中提到的文档变更在文档历史中找不到对应记录'
              });
            }
          });
        }
      }
    });

    return {
      consistent: inconsistencies.length === 0,
      inconsistencies,
      totalManualChanges: doc.versions.filter(v => v.changeType === 'MANUAL_MODIFICATION').length
    };
  }

  generateDiff(documentId, version1, version2) {
    const doc = this.findDocument(documentId);
    if (!doc) return null;

    const v1 = doc.versions.find(v => v.version === version1);
    const v2 = doc.versions.find(v => v.version === version2);
    
    if (!v1 || !v2) return null;

    const changes = [];
    
    if (v2.changes) {
      v2.changes.forEach(change => {
        changes.push({
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          changedIn: version2
        });
      });
    }

    return {
      documentId,
      documentName: doc.name,
      fromVersion: version1,
      toVersion: version2,
      changes,
      changeCount: changes.length
    };
  }

  exportReport(documentId, format = 'json') {
    const history = this.getDocumentHistory(documentId);
    if (!history) return null;

    if (format === 'json') {
      return JSON.stringify(history, null, 2);
    } else if (format === 'markdown') {
      return this.generateMarkdownReport(history);
    }
    
    return history;
  }

  generateMarkdownReport(history) {
    let md = `# ${history.name} - 文档变更历史报告\n\n`;
    md += `- 文档ID: ${history.id}\n`;
    md += `- 创建时间: ${history.createdAt}\n`;
    md += `- 当前版本: v${history.currentVersion}\n`;
    md += `- 手工修改: ${history.manualModified ? '是' : '否'}\n\n`;
    
    md += `## 变更记录\n\n`;
    
    history.versions.forEach(v => {
      md += `### v${v.version} - ${v.timestamp}\n\n`;
      md += `- 操作人: ${v.operator}\n`;
      md += `- 变更类型: ${v.changeType}\n`;
      md += `- 变更原因: ${v.changeReason}\n\n`;
      
      if (v.changes && v.changes.length > 0) {
        md += `| 字段 | 原值 | 新值 |\n`;
        md += `|------|------|------|\n`;
        v.changes.forEach(c => {
          md += `| ${c.field} | ${c.oldValue || '-'} | ${c.newValue} |\n`;
        });
        md += '\n';
      }
    });
    
    return md;
  }
}

if (require.main === module) {
  const manager = new DocumentHistoryManager('./document-history.json');
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'add':
      const docId = args[1];
      const docName = args[2];
      manager.addDocument(docId, docName);
      console.log(`Added document: ${docId}`);
      break;
      
    case 'change':
      const changeDocId = args[1];
      const operator = args[2];
      const field = args[3];
      const oldValue = args[4];
      const newValue = args[5];
      const reason = args[6] || '手工修改';
      
      manager.recordManualChange(changeDocId, operator, [
        { field, oldValue, newValue }
      ], reason);
      console.log(`Recorded change for document: ${changeDocId}`);
      break;
      
    case 'history':
      const histDocId = args[1];
      const history = manager.getDocumentHistory(histDocId);
      console.log(JSON.stringify(history, null, 2));
      break;
      
    case 'diff':
      const diffDocId = args[1];
      const v1 = parseInt(args[2]);
      const v2 = parseInt(args[3]);
      const diff = manager.generateDiff(diffDocId, v1, v2);
      console.log(JSON.stringify(diff, null, 2));
      break;
      
    case 'export':
      const expDocId = args[1];
      const format = args[2] || 'markdown';
      const report = manager.exportReport(expDocId, format);
      if (format === 'markdown') {
        fs.writeFileSync(`./${expDocId}-history.md`, report, 'utf8');
        console.log(`Exported to ${expDocId}-history.md`);
      } else {
        console.log(report);
      }
      break;
      
    case 'check-consistency':
      const checkDocId = args[1];
      const migrationDataPath = args[2];
      const migrationData = JSON.parse(fs.readFileSync(migrationDataPath, 'utf8'));
      const result = manager.checkConsistencyWithMigrationReport(checkDocId, migrationData.conclusions || []);
      console.log(JSON.stringify(result, null, 2));
      break;
      
    default:
      console.log(`
Document History Manager

Usage:
  node document-history.js add <docId> <docName>           添加新文档
  node document-history.js change <docId> <operator> <field> <oldValue> <newValue> [reason]  记录手工修改
  node document-history.js history <docId>                 查看文档历史
  node document-history.js diff <docId> <v1> <v2>          比较两个版本差异
  node document-history.js export <docId> [markdown|json]  导出历史报告
  node document-history.js check-consistency <docId> <migrationDataPath>  检查与迁移报告一致性
      `);
  }
}

module.exports = DocumentHistoryManager;
