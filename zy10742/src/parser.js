import fs from 'fs/promises';
import { parse } from 'fast-csv';

export async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.readFile(filePath, 'utf8')
      .then(content => {
        parse(content, { headers: true, ignoreEmpty: true })
          .on('error', reject)
          .on('data', row => records.push(row))
          .on('end', () => resolve(records));
      })
      .catch(reject);
  });
}

export async function parseJSON(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

export async function loadRecords(filePath) {
  if (filePath.endsWith('.json')) {
    return parseJSON(filePath);
  }
  if (filePath.endsWith('.csv')) {
    return parseCSV(filePath);
  }
  throw new Error(`不支持的文件格式: ${filePath}`);
}

export function normalizeRecord(record) {
  return {
    质检编号: record.质检编号 || record.id || record['质检ID'],
    客服工号: record.客服工号 || record.agentId || record['客服ID'],
    质检日期: record.质检日期 || record.checkDate || record['质检时间'],
    原始得分: Number(record.原始得分 || record.originalScore || record['初评分数']) || 0,
    复议得分: Number(record.复议得分 || record.reviewScore || record['复议分数']) || null,
    最终得分: Number(record.最终得分 || record.finalScore || record['最终分数']) || 0,
    复议状态: record.复议状态 || record.reviewStatus || record['状态'],
    复议轮次: Number(record.复议轮次 || record.reviewRound || record['轮次']) || 1,
    原始扣分项: parseDeductions(record.原始扣分项 || record.originalDeductions || record['初评扣分项']),
    复议扣分项: parseDeductions(record.复议扣分项 || record.reviewDeductions || record['复议扣分项']),
    最终扣分项: parseDeductions(record.最终扣分项 || record.finalDeductions || record['最终扣分项']),
    复议原因: record.复议原因 || record.reviewReason || record['复议说明'] || '',
    处理人: record.处理人 || record.handler || record['复议处理人'] || '',
    处理时间: record.处理时间 || record.handleTime || record['处理日期'] || ''
  };
}

function parseDeductions(deductions) {
  if (!deductions) return [];
  if (Array.isArray(deductions)) return deductions;
  if (typeof deductions === 'string') {
    try {
      const parsed = JSON.parse(deductions);
      return Array.isArray(parsed) ? parsed : [deductions];
    } catch {
      return deductions.split(/[,，;；]/).map(s => s.trim()).filter(Boolean);
    }
  }
  return [deductions];
}
