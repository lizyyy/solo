import fs from 'fs/promises';
import path from 'path';
import csv from 'csv-parser';
import { Readable } from 'stream';

async function parseCSV(filePath) {
  const records = [];
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  
  if (lines.length === 0) {
    throw new Error('CSV文件为空');
  }
  
  const headerLine = lines[0];
  const hasComma = headerLine.includes(',');
  const expectedFields = ['childName', 'parentPhone', 'courseName', '儿童姓名', '家长电话', '课程名称'];
  const hasValidHeader = expectedFields.some(field => headerLine.includes(field));
  
  if (!hasComma || (!hasValidHeader && lines.length <= 2)) {
    throw new Error('CSV文件格式错误：缺少有效表头或分隔符');
  }
  
  const stream = Readable.from(content);
  
  return new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (data) => records.push(data))
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

async function parseJSON(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : [data];
}

function detectSpecialCases(records, sourceFile) {
  const partialSuspension = [];
  const packageCourses = [];
  const reRunnable = [];

  records.forEach((record, index) => {
    const enrichedRecord = {
      ...record,
      _sourceFile: sourceFile,
      _recordIndex: index,
      _processedAt: new Date().toISOString()
    };

    const isPartial = record.suspensionType === 'partial' || 
                      (record.suspendedDuration && parseInt(record.suspendedDuration) < parseInt(record.totalDuration || 0)) ||
                      (record.notes && record.notes.includes('部分时段')) ||
                      (record.notes && record.notes.includes('部分停课'));
    if (isPartial) {
      partialSuspension.push(enrichedRecord);
    }

    const isPackage = record.courseType === 'package' || 
                      (record.courseName && record.courseName.includes('连报')) ||
                      (record.courseName && record.courseName.includes('套餐')) ||
                      (record.totalLessons && parseInt(record.totalLessons) >= 20);
    if (isPackage) {
      packageCourses.push(enrichedRecord);
    }

    const isReRunnable = record.status === 'pending' || 
                         record.needsReview === 'true' ||
                         (record.compensationStatus && record.compensationStatus !== 'completed') ||
                         (record.notes && record.notes.includes('待确认')) ||
                         (record.notes && record.notes.includes('复跑'));
    if (isReRunnable) {
      reRunnable.push(enrichedRecord);
    }
  });

  return { partialSuspension, packageCourses, reRunnable };
}

function normalizeRecord(record, fileName) {
  return {
    childName: record.childName || record.儿童姓名 || record.name || '',
    parentPhone: record.parentPhone || record.家长电话 || record.phone || '',
    courseName: record.courseName || record.课程名称 || record.course || '',
    courseType: record.courseType || record.课程类型 || 'regular',
    totalLessons: parseInt(record.totalLessons || record.总课时 || record.lessons || 0),
    usedLessons: parseInt(record.usedLessons || record.已用课时 || 0),
    remainingLessons: parseInt(record.remainingLessons || record.剩余课时 || 
                               (parseInt(record.totalLessons || 0) - parseInt(record.usedLessons || 0))),
    suspensionDate: record.suspensionDate || record.停课日期 || '',
    suspensionType: record.suspensionType || record.停课类型 || 'full',
    suspendedDuration: record.suspendedDuration || record.停课时长 || '',
    totalDuration: record.totalDuration || record.总时长 || '',
    compensationType: record.compensationType || record.补偿方式 || 'makeup',
    compensationAmount: parseFloat(record.compensationAmount || record.补偿金额 || 0),
    compensationLessons: parseInt(record.compensationLessons || record.补偿课时 || 0),
    status: record.status || record.状态 || 'pending',
    compensationStatus: record.compensationStatus || record.补偿状态 || 'pending',
    needsReview: record.needsReview || record.需审核 || 'false',
    notes: record.notes || record.备注 || '',
    sourceFile: fileName
  };
}

async function processSingleFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  
  let rawRecords;
  
  try {
    if (ext === '.csv') {
      rawRecords = await parseCSV(filePath);
    } else if (ext === '.json') {
      rawRecords = await parseJSON(filePath);
    } else {
      throw new Error(`不支持的文件格式: ${ext}`);
    }

    const normalizedRecords = rawRecords.map(r => normalizeRecord(r, fileName));
    const specialCases = detectSpecialCases(normalizedRecords, fileName);

    return {
      success: true,
      records: normalizedRecords,
      ...specialCases
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function processFiles(inputPath) {
  const allRecords = [];
  const allPartialSuspension = [];
  const allPackageCourses = [];
  const allReRunnable = [];
  const errors = [];
  
  let successCount = 0;
  let failedCount = 0;

  const stats = await fs.stat(inputPath);
  
  let filesToProcess = [];
  
  if (stats.isFile()) {
    filesToProcess.push(inputPath);
  } else if (stats.isDirectory()) {
    const files = await fs.readdir(inputPath);
    filesToProcess = files
      .filter(f => f.endsWith('.csv') || f.endsWith('.json'))
      .map(f => path.join(inputPath, f));
  }

  for (const filePath of filesToProcess) {
    const result = await processSingleFile(filePath);
    
    if (result.success) {
      allRecords.push(...result.records);
      allPartialSuspension.push(...result.partialSuspension);
      allPackageCourses.push(...result.packageCourses);
      allReRunnable.push(...result.reRunnable);
      successCount++;
    } else {
      errors.push({
        file: path.basename(filePath),
        error: result.error
      });
      failedCount++;
    }
  }

  return {
    records: allRecords,
    partialSuspension: allPartialSuspension,
    packageCourses: allPackageCourses,
    reRunnable: allReRunnable,
    errors,
    successCount,
    failedCount,
    totalFiles: filesToProcess.length
  };
}
