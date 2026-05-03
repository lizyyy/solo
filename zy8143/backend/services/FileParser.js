const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const yaml = require('yaml');

class FileParser {
  constructor() {}

  // 解析 case_manifest.json
  parseCaseManifest(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      return data;
    } catch (error) {
      throw new Error(`解析 case_manifest.json 失败: ${error.message}`);
    }
  }

  // 解析 documents.csv
  async parseDocumentsCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          // 转换数据类型
          const transformed = results.map(row => ({
            documentId: row.documentId || row.id,
            caseNumber: row.caseNumber,
            documentName: row.documentName || row.name,
            documentType: row.documentType || row.type,
            startPage: parseInt(row.startPage) || parseInt(row.start_page) || 1,
            endPage: parseInt(row.endPage) || parseInt(row.end_page) || 1,
            pageCount: parseInt(row.pageCount) || parseInt(row.page_count) || 
              (parseInt(row.endPage) || parseInt(row.end_page) || 1) - (parseInt(row.startPage) || parseInt(row.start_page) || 1) + 1,
            classification: row.classification || row.securityLevel || '普通',
            hasSignature: (row.hasSignature || row.signature) === 'true' || 
                          (row.hasSignature || row.signature) === true,
            ocrAvailable: (row.ocrAvailable || row.ocr) === 'true' || 
                         (row.ocrAvailable || row.ocr) === true,
            ...row
          }));
          resolve(transformed);
        })
        .on('error', (error) => {
          reject(new Error(`解析 documents.csv 失败: ${error.message}`));
        });
    });
  }

  // 解析 ocr_text.jsonl (JSON Lines 格式)
  parseOCRText(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');
      const results = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          try {
            const obj = JSON.parse(line);
            results.push(obj);
          } catch (e) {
            console.warn(`忽略 OCR 数据第 ${i + 1} 行的无效 JSON: ${e.message}`);
          }
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`解析 ocr_text.jsonl 失败: ${error.message}`);
    }
  }

  // 解析 signature_log.jsonl
  parseSignatureLog(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');
      const results = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          try {
            const obj = JSON.parse(line);
            results.push(obj);
          } catch (e) {
            console.warn(`忽略签名日志第 ${i + 1} 行的无效 JSON: ${e.message}`);
          }
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`解析 signature_log.jsonl 失败: ${error.message}`);
    }
  }

  // 解析 archive_rules.yaml (或 archive_rules.yml)
  parseArchiveRules(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const rules = yaml.parse(content);
      return rules;
    } catch (error) {
      throw new Error(`解析 archive_rules.yaml 失败: ${error.message}`);
    }
  }

  // 解析所有上传的文件
  async parseAllFiles(files) {
    // 查找各种类型的文件
    let caseManifestPath = null;
    let documentsCSVPath = null;
    let ocrTextPath = null;
    let signatureLogPath = null;
    let archiveRulesPath = null;

    // 遍历上传的文件
    for (const file of files) {
      const filename = path.basename(file.path || file.name).toLowerCase();
      
      if (filename === 'case_manifest.json') {
        caseManifestPath = file.path || file.tempFilePath;
      } else if (filename === 'documents.csv') {
        documentsCSVPath = file.path || file.tempFilePath;
      } else if (filename === 'ocr_text.jsonl') {
        ocrTextPath = file.path || file.tempFilePath;
      } else if (filename === 'signature_log.jsonl') {
        signatureLogPath = file.path || file.tempFilePath;
      } else if (filename === 'archive_rules.yaml' || filename === 'archive_rules.yml') {
        archiveRulesPath = file.path || file.tempFilePath;
      }
    }

    // 检查必需文件
    const missingFiles = [];
    if (!caseManifestPath) missingFiles.push('case_manifest.json');
    if (!documentsCSVPath) missingFiles.push('documents.csv');
    if (!ocrTextPath) missingFiles.push('ocr_text.jsonl');
    if (!signatureLogPath) missingFiles.push('signature_log.jsonl');
    if (!archiveRulesPath) missingFiles.push('archive_rules.yaml (或 .yml)');

    if (missingFiles.length > 0) {
      throw new Error(`缺少必需的文件: ${missingFiles.join(', ')}`);
    }

    // 解析所有文件
    const caseManifest = this.parseCaseManifest(caseManifestPath);
    const documents = await this.parseDocumentsCSV(documentsCSVPath);
    const ocrTexts = this.parseOCRText(ocrTextPath);
    const signatureLogs = this.parseSignatureLog(signatureLogPath);
    const archiveRules = this.parseArchiveRules(archiveRulesPath);

    return {
      caseManifest,
      documents,
      ocrTexts,
      signatureLogs,
      archiveRules
    };
  }
}

module.exports = FileParser;
