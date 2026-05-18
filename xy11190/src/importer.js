import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import logger from './logger.js';
import { validateHeaders, validateRecord, checkDuplicates, calculateFees } from './validator.js';

async function detectEncoding(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const hasUtf8Bom = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
    
    if (hasUtf8Bom) {
      return 'utf8';
    }
    
    let isGBK = false;
    for (let i = 0; i < Math.min(buffer.length, 1000); i++) {
      if (buffer[i] > 0x7F) {
        isGBK = true;
        break;
      }
    }
    
    return isGBK ? 'gbk' : 'utf8';
  } catch (error) {
    logger.warn(`无法检测文件编码，默认使用 UTF-8: ${error.message}`);
    return 'utf8';
  }
}

export async function importFile(filePath) {
  const fileName = path.basename(filePath);
  logger.info(`开始处理文件: ${fileName}`);

  return new Promise((resolve, reject) => {
    const records = [];
    let lineNumber = 1;
    let headersValidated = false;

    const stream = fs.createReadStream(filePath)
      .on('error', (error) => {
        logger.recordError(fileName, lineNumber, `文件读取失败: ${error.message}`);
        logger.incrementFailedFiles();
        reject(error);
      });

    stream
      .pipe(csv())
      .on('headers', (headers) => {
        lineNumber++;
        headersValidated = validateHeaders(headers, fileName);
        if (!headersValidated) {
          stream.destroy();
        }
      })
      .on('data', (data) => {
        lineNumber++;
        if (headersValidated) {
          logger.incrementRecords();
          const result = validateRecord(data, lineNumber, fileName);
          if (result.isValid) {
            records.push(data);
          }
        }
      })
      .on('end', () => {
        if (headersValidated) {
          checkDuplicates(records, fileName);
          const processedRecords = calculateFees(records);
          logger.success(`文件处理完成: ${fileName}`);
          logger.incrementProcessedFiles();
          resolve(processedRecords);
        } else {
          resolve([]);
        }
      })
      .on('error', (error) => {
        logger.recordError(fileName, lineNumber, `解析错误: ${error.message}`);
        logger.incrementFailedFiles();
        reject(error);
      });
  });
}

export async function importDirectory(dirPath) {
  const files = fs.readdirSync(dirPath)
    .filter(file => file.toLowerCase().endsWith('.csv'));

  logger.incrementFiles(files.length);
  logger.info(`找到 ${files.length} 个 CSV 文件`);

  const allResults = [];

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const results = await importFile(filePath);
      allResults.push({
        file,
        records: results
      });
    } catch (error) {
      logger.error(`处理文件失败，继续处理其他文件: ${file}`, error.message);
    }
  }

  return allResults;
}

export function writeOutput(results, outputPath) {
  const output = {
    generatedAt: new Date().toISOString(),
    summary: logger.getErrorSummary(),
    files: results
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  logger.success(`结果已保存到: ${outputPath}`);
}
