import { parseRefundFile } from './parser.js';
import { validateRefundRecords } from './validator.js';
import { summarizeRefunds } from './summarizer.js';
import { generateConsoleReport, generateMarkdownReport } from './reporter.js';
import fs from 'fs';
import path from 'path';

const PROCESSED_HISTORY_FILE = './data/processed-refunds.json';

export async function processRefundFile(filePath, options = {}) {
  const fileName = path.basename(filePath);
  const outputDir = options.outputDir || './reports';
  const processedRefunds = await loadProcessedRefunds();

  const parseResult = await parseRefundFile(filePath);
  if (!parseResult.success) {
    throw new Error(`文件解析失败: ${parseResult.error}`);
  }

  const validationResult = validateRefundRecords(parseResult.data, processedRefunds);

  const summary = summarizeRefunds(parseResult, validationResult, fileName);

  generateConsoleReport(summary, parseResult, validationResult);

  const reportPath = await generateMarkdownReport(summary, outputDir);
  console.log(`📄 详细报告已保存至: ${reportPath}\n`);

  await saveProcessedRefunds(parseResult.data, processedRefunds);

  return {
    summary,
    parseResult,
    validationResult,
    reportPath
  };
}

async function loadProcessedRefunds() {
  try {
    const dir = path.dirname(PROCESSED_HISTORY_FILE);
    await fs.promises.mkdir(dir, { recursive: true });
    
    const data = await fs.promises.readFile(PROCESSED_HISTORY_FILE, 'utf8');
    return new Set(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return new Set();
    }
    throw error;
  }
}

async function saveProcessedRefunds(records, existingSet) {
  const newSet = new Set(existingSet);
  for (const record of records) {
    newSet.add(record.refundNo);
  }
  
  await fs.promises.writeFile(
    PROCESSED_HISTORY_FILE,
    JSON.stringify([...newSet], null, 2),
    'utf8'
  );
}
