import fs from 'fs/promises';
import path from 'path';
import { Parser } from 'json2csv';

const OUTPUT_FIELDS = [
  'childName',
  'parentPhone',
  'courseName',
  'courseType',
  'totalLessons',
  'usedLessons',
  'remainingLessons',
  'suspensionDate',
  'suspensionType',
  'suspendedDuration',
  'totalDuration',
  'compensationType',
  'compensationAmount',
  'compensationLessons',
  'status',
  'compensationStatus',
  'needsReview',
  'notes',
  'sourceFile'
];

const SPECIAL_CASE_FIELDS = [
  'childName',
  'courseName',
  'suspensionDate',
  'suspensionType',
  'notes',
  'sourceFile',
  '_recordIndex'
];

async function writeJSON(result, outputPath) {
  const output = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalRecords: result.records.length,
      partialSuspensionCount: result.partialSuspension.length,
      packageCoursesCount: result.packageCourses.length,
      reRunnableCount: result.reRunnable.length,
      successCount: result.successCount,
      failedCount: result.failedCount,
      totalFiles: result.totalFiles
    },
    partialSuspension: result.partialSuspension,
    packageCourses: result.packageCourses,
    reRunnable: result.reRunnable,
    allRecords: result.records,
    errors: result.errors
  };
  
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
}

async function writeCSV(result, outputPath) {
  const lines = [];
  
  lines.push('=== 汇总信息 ===');
  lines.push(`总记录数,${result.records.length}`);
  lines.push(`部分时段停课,${result.partialSuspension.length}`);
  lines.push(`连报课程,${result.packageCourses.length}`);
  lines.push(`可复跑输出,${result.reRunnable.length}`);
  lines.push(`成功处理文件,${result.successCount}`);
  lines.push(`处理失败文件,${result.failedCount}`);
  lines.push('');
  
  lines.push('=== 部分时段停课记录 ===');
  if (result.partialSuspension.length > 0) {
    const partialParser = new Parser({ fields: SPECIAL_CASE_FIELDS });
    lines.push(partialParser.parse(result.partialSuspension));
  } else {
    lines.push('无记录');
  }
  lines.push('');
  
  lines.push('=== 连报课程记录 ===');
  if (result.packageCourses.length > 0) {
    const packageParser = new Parser({ fields: SPECIAL_CASE_FIELDS });
    lines.push(packageParser.parse(result.packageCourses));
  } else {
    lines.push('无记录');
  }
  lines.push('');
  
  lines.push('=== 可复跑输出记录 ===');
  if (result.reRunnable.length > 0) {
    const reRunParser = new Parser({ fields: SPECIAL_CASE_FIELDS });
    lines.push(reRunParser.parse(result.reRunnable));
  } else {
    lines.push('无记录');
  }
  lines.push('');
  
  lines.push('=== 全部停课补偿记录 ===');
  const allParser = new Parser({ fields: OUTPUT_FIELDS });
  lines.push(allParser.parse(result.records));
  lines.push('');
  
  if (result.errors.length > 0) {
    lines.push('=== 处理失败文件汇总 ===');
    const errorParser = new Parser({ fields: ['file', 'error'] });
    lines.push(errorParser.parse(result.errors));
  }
  
  await fs.writeFile(outputPath, lines.join('\n'), 'utf-8');
}

async function writeMarkdown(result, outputPath) {
  const lines = [];
  
  lines.push('# 亲子游泳馆泳课停课补偿汇总报告');
  lines.push('');
  lines.push(`*生成时间: ${new Date().toLocaleString('zh-CN')}*`);
  lines.push('');
  
  lines.push('## 汇总统计');
  lines.push('');
  lines.push('| 统计项 | 数量 |');
  lines.push('|--------|------|');
  lines.push(`| 总记录数 | ${result.records.length} |`);
  lines.push(`| 部分时段停课 | ${result.partialSuspension.length} |`);
  lines.push(`| 连报课程 | ${result.packageCourses.length} |`);
  lines.push(`| 可复跑输出 | ${result.reRunnable.length} |`);
  lines.push(`| 成功处理文件 | ${result.successCount} |`);
  lines.push(`| 处理失败文件 | ${result.failedCount} |`);
  lines.push('');
  
  lines.push('## 一、部分时段停课记录');
  lines.push('');
  if (result.partialSuspension.length > 0) {
    lines.push('| 序号 | 儿童姓名 | 课程名称 | 停课日期 | 停课类型 | 备注 | 来源文件 |');
    lines.push('|------|----------|----------|----------|----------|------|----------|');
    result.partialSuspension.forEach((r, i) => {
      lines.push(`| ${i + 1} | ${r.childName} | ${r.courseName} | ${r.suspensionDate} | ${r.suspensionType} | ${r.notes || '-'} | ${r.sourceFile} |`);
    });
  } else {
    lines.push('*无部分时段停课记录*');
  }
  lines.push('');
  
  lines.push('## 二、连报课程记录');
  lines.push('');
  if (result.packageCourses.length > 0) {
    lines.push('| 序号 | 儿童姓名 | 课程名称 | 总课时 | 停课日期 | 备注 | 来源文件 |');
    lines.push('|------|----------|----------|--------|----------|------|----------|');
    result.packageCourses.forEach((r, i) => {
      lines.push(`| ${i + 1} | ${r.childName} | ${r.courseName} | ${r.totalLessons} | ${r.suspensionDate} | ${r.notes || '-'} | ${r.sourceFile} |`);
    });
  } else {
    lines.push('*无连报课程记录*');
  }
  lines.push('');
  
  lines.push('## 三、可复跑输出记录');
  lines.push('');
  if (result.reRunnable.length > 0) {
    lines.push('| 序号 | 儿童姓名 | 课程名称 | 状态 | 补偿状态 | 备注 | 来源文件 |');
    lines.push('|------|----------|----------|------|----------|------|----------|');
    result.reRunnable.forEach((r, i) => {
      lines.push(`| ${i + 1} | ${r.childName} | ${r.courseName} | ${r.status} | ${r.compensationStatus} | ${r.notes || '-'} | ${r.sourceFile} |`);
    });
  } else {
    lines.push('*无可复跑输出记录*');
  }
  lines.push('');
  
  lines.push('## 四、全部停课补偿记录');
  lines.push('');
  if (result.records.length > 0) {
    lines.push('| 序号 | 儿童姓名 | 家长电话 | 课程名称 | 总课时 | 剩余课时 | 停课日期 | 补偿方式 | 补偿课时 | 状态 | 备注 |');
    lines.push('|------|----------|----------|----------|--------|----------|----------|----------|----------|------|------|');
    result.records.forEach((r, i) => {
      lines.push(`| ${i + 1} | ${r.childName} | ${r.parentPhone} | ${r.courseName} | ${r.totalLessons} | ${r.remainingLessons} | ${r.suspensionDate} | ${r.compensationType} | ${r.compensationLessons} | ${r.status} | ${r.notes || '-'} |`);
    });
  }
  lines.push('');
  
  if (result.errors.length > 0) {
    lines.push('## 五、处理失败文件汇总');
    lines.push('');
    lines.push('| 序号 | 文件名 | 错误原因 |');
    lines.push('|------|--------|----------|');
    result.errors.forEach((e, i) => {
      lines.push(`| ${i + 1} | ${e.file} | ${e.error} |`);
    });
    lines.push('');
  }
  
  await fs.writeFile(outputPath, lines.join('\n'), 'utf-8');
}

export async function generateOutput(result, outputPath, force = false) {
  const ext = path.extname(outputPath).toLowerCase();
  
  try {
    await fs.access(outputPath);
    if (!force) {
      throw new Error(`输出文件已存在: ${outputPath}，请使用 -f/--force 参数覆盖`);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
  
  const dir = path.dirname(outputPath);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
  
  if (ext === '.json') {
    await writeJSON(result, outputPath);
  } else if (ext === '.csv') {
    await writeCSV(result, outputPath);
  } else if (ext === '.md') {
    await writeMarkdown(result, outputPath);
  } else {
    throw new Error(`不支持的输出格式: ${ext}，请使用 .csv, .json, 或 .md`);
  }
}
