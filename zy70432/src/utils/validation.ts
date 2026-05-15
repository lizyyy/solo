import { createHash } from 'crypto';
import { SearchKeywordReport, FieldError } from '../types';

export function generateRecordHash(record: SearchKeywordReport): string {
  const data = JSON.stringify({
    keyword: record.keyword,
    searchVolume: record.searchVolume,
    clickRate: record.clickRate,
    conversionRate: record.conversionRate,
    avgPosition: record.avgPosition,
    competition: record.competition,
    category: record.category,
    region: record.region,
    reportDate: record.reportDate,
    department: record.department
  });
  return createHash('sha256').update(data).digest('hex').substring(0, 32);
}

export function validateDownloadUrl(url: string): boolean {
  if (!url || url.trim() === '') return false;
  if (url.includes('expired') || url.includes('invalid') || url.includes('404')) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateSearchKeywordReport(record: SearchKeywordReport): FieldError[] {
  const errors: FieldError[] = [];

  if (!record.keyword || record.keyword.trim() === '') {
    errors.push({
      field: 'keyword',
      value: record.keyword,
      message: '搜索词不能为空',
      failureType: 'keyword_empty'
    });
  }

  if (record.searchVolume < 0) {
    errors.push({
      field: 'searchVolume',
      value: record.searchVolume,
      message: '搜索量不能为负数',
      failureType: 'search_volume_negative'
    });
  }

  if (record.clickRate < 0 || record.clickRate > 100) {
    errors.push({
      field: 'clickRate',
      value: record.clickRate,
      message: '点击率必须在0-100范围内',
      failureType: 'click_rate_out_of_range'
    });
  }

  if (record.conversionRate < 0 || record.conversionRate > 100) {
    errors.push({
      field: 'conversionRate',
      value: record.conversionRate,
      message: '转化率必须在0-100范围内',
      failureType: 'conversion_rate_out_of_range'
    });
  }

  if (record.avgPosition <= 0 || !Number.isInteger(record.avgPosition)) {
    errors.push({
      field: 'avgPosition',
      value: record.avgPosition,
      message: '平均排名必须是正整数',
      failureType: 'avg_position_invalid'
    });
  }

  const validCompetitions = ['low', 'medium', 'high'];
  if (!validCompetitions.includes(record.competition)) {
    errors.push({
      field: 'competition',
      value: record.competition,
      message: `竞争程度必须是 ${validCompetitions.join(', ')} 之一`,
      failureType: 'competition_invalid'
    });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(record.reportDate)) {
    errors.push({
      field: 'reportDate',
      value: record.reportDate,
      message: '报告日期格式必须为 YYYY-MM-DD',
      failureType: 'date_format_invalid'
    });
  }

  if (!validateDownloadUrl(record.downloadUrl)) {
    errors.push({
      field: 'downloadUrl',
      value: record.downloadUrl,
      message: '下载链接无效或已过期',
      failureType: 'download_url_invalid'
    });
  }

  return errors;
}
