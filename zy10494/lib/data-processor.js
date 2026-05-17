const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const yaml = require('js-yaml');

function readInputFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const errors = [];
  const recordsWithSource = [];

  let data = [];

  try {
    if (ext === '.csv') {
      data = readCSV(absolutePath, errors, recordsWithSource);
    } else if (ext === '.yaml' || ext === '.yml') {
      data = readYAML(absolutePath, errors, recordsWithSource);
    } else if (ext === '.json') {
      data = readJSON(absolutePath, errors, recordsWithSource);
    }
  } catch (e) {
    errors.push({
      line: null,
      message: `文件解析失败: ${e.message}`,
      source: absolutePath
    });
  }

  return { data, errors, recordsWithSource };
}

function readCSV(filePath, errors, recordsWithSource) {
  const results = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  if (lines.length < 2) {
    errors.push({
      line: 1,
      message: 'CSV文件为空或只有表头',
      source: filePath
    });
    return results;
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const requiredFields = ['imageTag', 'environment'];
  const missingFields = requiredFields.filter(f => !headers.includes(f));
  
  if (missingFields.length > 0) {
    errors.push({
      line: 1,
      message: `CSV缺少必需字段: ${missingFields.join(', ')}`,
      source: filePath
    });
  }

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();
    
    if (!line) continue;

    try {
      const values = line.split(',');
      const record = {};
      
      headers.forEach((header, idx) => {
        let value = values[idx] ? values[idx].trim() : '';
        if (value.toLowerCase() === 'true') {
          value = true;
        } else if (value.toLowerCase() === 'false') {
          value = false;
        } else if (value !== '' && !isNaN(value)) {
          value = Number(value);
        }
        record[header] = value;
      });

      const parsedRecord = parseRecord(record, lineNum, filePath, errors);
      if (parsedRecord) {
        results.push(parsedRecord);
        recordsWithSource.push({
          record: parsedRecord,
          source: {
            file: filePath,
            line: lineNum,
            rawContent: line
          }
        });
      }
    } catch (e) {
      errors.push({
        line: lineNum,
        message: `解析行失败: ${e.message}`,
        source: filePath
      });
    }
  }

  return results;
}

function readYAML(filePath, errors, recordsWithSource) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const doc = yaml.load(content);
  const results = [];

  let records = [];
  if (Array.isArray(doc)) {
    records = doc;
  } else if (doc.images && Array.isArray(doc.images)) {
    records = doc.images;
  } else {
    records = [doc];
  }

  records.forEach((record, idx) => {
    const lineNum = idx + 1;
    const parsedRecord = parseRecord(record, lineNum, filePath, errors);
    if (parsedRecord) {
      results.push(parsedRecord);
      recordsWithSource.push({
        record: parsedRecord,
        source: {
          file: filePath,
          line: lineNum,
          rawContent: JSON.stringify(record)
        }
      });
    }
  });

  return results;
}

function readJSON(filePath, errors, recordsWithSource) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const doc = JSON.parse(content);
  const results = [];

  let records = [];
  if (Array.isArray(doc)) {
    records = doc;
  } else if (doc.images && Array.isArray(doc.images)) {
    records = doc.images;
  } else {
    records = [doc];
  }

  records.forEach((record, idx) => {
    const lineNum = idx + 1;
    const parsedRecord = parseRecord(record, lineNum, filePath, errors);
    if (parsedRecord) {
      results.push(parsedRecord);
      recordsWithSource.push({
        record: parsedRecord,
        source: {
          file: filePath,
          line: lineNum,
          rawContent: JSON.stringify(record)
        }
      });
    }
  });

  return results;
}

function parseRecord(record, lineNum, filePath, errors) {
  const result = {
    imageTag: record.imageTag || record.image_tag || record.tag || '',
    environment: record.environment || record.env || '',
    signature: {
      signed: record.signed === true || record.signed === 'true' || record.signatureStatus === 'signed',
      signer: record.signer || record.signatureSigner || '',
      signedAt: record.signedAt || record.signatureTime || '',
      fingerprint: record.signatureFingerprint || record.fingerprint || ''
    },
    scan: {
      scanned: record.scanned === true || record.scanned === 'true',
      scanTime: record.scanTime || record.scannedAt || '',
      criticalCount: Number(record.criticalCount || record.critical || 0),
      highCount: Number(record.highCount || record.high || 0),
      mediumCount: Number(record.mediumCount || record.medium || 0),
      lowCount: Number(record.lowCount || record.low || 0),
      scanId: record.scanId || '',
      scanner: record.scanner || ''
    },
    deployment: {
      deployed: record.deployed === true || record.deployed === 'true',
      environment: record.deploymentEnv || record.environment,
      deployedAt: record.deployedAt || record.deploymentTime || '',
      deployedBy: record.deployedBy || '',
      cluster: record.cluster || '',
      namespace: record.namespace || ''
    },
    promotion: {
      previousEnv: record.previousEnv || record.fromEnv || '',
      promotionTime: record.promotionTime || '',
      promotedBy: record.promotedBy || '',
      approvalId: record.approvalId || ''
    }
  };

  if (!result.imageTag) {
    errors.push({
      line: lineNum,
      message: '缺少镜像标签 (imageTag)',
      source: filePath
    });
    return null;
  }

  if (!result.environment) {
    errors.push({
      line: lineNum,
      message: '缺少环境阶段 (environment)',
      source: filePath
    });
    return null;
  }

  return result;
}

module.exports = {
  readInputFile
};
