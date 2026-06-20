import type { MaterialSource, MaterialItem } from '../types';

export interface ParsedRemark {
  sampleSize?: number;
  confidenceLevel?: number;
  hasBoundaryWarning: boolean;
  hasCaliberMismatch: boolean;
  hasTitleMismatch: boolean;
  extrapolationInfo?: {
    method: string;
    direction: string;
    originalRange: [number, number];
    extrapolatedValue: number;
  };
  keywords: string[];
  extractedItems: Array<{
    name: string;
    value: number;
    unit: string;
    context: string;
  }>;
}

export class RemarkParser {
  private static sampleSizePatterns = [
    /样本量\s*[=:：]?\s*n?\s*[=:：]?\s*(\d+)/i,
    /n\s*[=:：]\s*(\d+)/i,
    /共\s*(\d+)\s*(户|笔|个)/i,
    /合计\s*(\d+)\s*(户|笔|个)/i,
  ];

  private static confidencePatterns = [
    /置信度\s*[=:：]?\s*(\d+\.?\d*)%?/i,
    /置信水平\s*[=:：]?\s*(\d+\.?\d*)%?/i,
  ];

  private static valuePatterns = [
    /([\u4e00-\u9fa5A-Za-z]+)\s*[=:：]\s*(\d+\.?\d*)\s*([%\u4e00-\u9fa5]+)/g,
    /([\u4e00-\u9fa5A-Za-z]+)：\s*(\d+\.?\d*)\s*([%\u4e00-\u9fa5]+)/g,
  ];

  static parse(materials: MaterialSource[], scoreRemark: string, oralNote: string): ParsedRemark {
    const result: ParsedRemark = {
      hasBoundaryWarning: false,
      hasCaliberMismatch: false,
      hasTitleMismatch: false,
      keywords: [],
      extractedItems: []
    };

    const allContent = [
      ...materials.map((m) => m.content),
      scoreRemark,
      oralNote
    ].join('\n');

    for (const pattern of this.sampleSizePatterns) {
      const match = allContent.match(pattern);
      if (match) {
        result.sampleSize = parseInt(match[1], 10);
        break;
      }
    }

    for (const pattern of this.confidencePatterns) {
      const match = allContent.match(pattern);
      if (match) {
        result.confidenceLevel = parseFloat(match[1]);
        break;
      }
    }

    const boundaryKeywords = ['边界', '尾部', '阈值', '接近上限', '接近下限', '临界', '边缘'];
    for (const keyword of boundaryKeywords) {
      if (allContent.includes(keyword)) {
        result.hasBoundaryWarning = true;
        result.keywords.push(keyword);
      }
    }

    const caliberKeywords = ['旧口径', '新口径', '口径变更', '口径调整', 'v1', 'v2', '版本'];
    for (const keyword of caliberKeywords) {
      if (allContent.toLowerCase().includes(keyword.toLowerCase())) {
        result.hasCaliberMismatch = true;
        result.keywords.push(keyword);
      }
    }

    const titleMismatchPatterns = ['标题', '明细', '不一致', '不符', '矛盾'];
    for (const pattern of titleMismatchPatterns) {
      if (allContent.includes(pattern)) {
        result.hasTitleMismatch = true;
        result.keywords.push(pattern);
      }
    }

    const extrapolationMatch = allContent.match(/外推.*?(?:方向|method)[:：]\s*(向上|向下|up|down)/i);
    const rangeMatch = allContent.match(/原始数据范围[:：]\s*(\d+\.?\d*)%?\s*[-~到]\s*(\d+\.?\d*)%?/i);
    const extrapolatedMatch = allContent.match(/外推至[:：]\s*(\d+\.?\d*)%?/i);
    const methodMatch = allContent.match(/(极端值理论|EVT|外推法|extrapolation)/i);

    if (extrapolationMatch || rangeMatch || extrapolatedMatch) {
      result.extrapolationInfo = {
        method: methodMatch ? methodMatch[1] : '外推法',
        direction: extrapolationMatch ? extrapolationMatch[1] : '未知',
        originalRange: rangeMatch ? [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])] : [0, 0],
        extrapolatedValue: extrapolatedMatch ? parseFloat(extrapolatedMatch[1]) : 0
      };
    }

    for (const pattern of this.valuePatterns) {
      let match;
      while ((match = pattern.exec(allContent)) !== null) {
        result.extractedItems.push({
          name: match[1],
          value: parseFloat(match[2]),
          unit: match[3],
          context: match[0]
        });
      }
    }

    const warningKeywords = ['警告', '风险', '关注', '审慎', '重点', '超标', '异常'];
    for (const keyword of warningKeywords) {
      if (allContent.includes(keyword) && !result.keywords.includes(keyword)) {
        result.keywords.push(keyword);
      }
    }

    return result;
  }

  static extractItemsFromContent(content: string): MaterialItem[] {
    const items: MaterialItem[] = [];
    const patterns = [
      /([\u4e00-\u9fa5A-Za-z]+(?:\s*\([^)]+\))?)\s*[=:：]\s*(\d+\.?\d*)\s*([%\u4e00-\u9fa5a-zA-Z]+)/g,
    ];

    let idCounter = 0;
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1].trim();
        const value = parseFloat(match[2]);
        const unit = match[3].trim();

        if (!isNaN(value) && unit.length > 0 && unit.length < 10) {
          items.push({
            id: `extracted-${Date.now()}-${idCounter++}`,
            objectName: name,
            value,
            unit,
            sourceIndex: 0,
            confidence: 0.8
          });
        }
      }
    }

    return items;
  }

  static parseFileContent(content: string): {
    title: string;
    items: MaterialItem[];
    hasIssues: boolean;
    issueDescription?: string;
  } {
    const lines = content.split('\n');
    const title = lines[0]?.trim() || '未命名材料';
    
    const firstLine = lines[0] || '';
    const restContent = lines.slice(1).join('\n');
    
    let hasIssues = false;
    let issueDescription: string | undefined;

    if (firstLine.includes('资产池') || firstLine.includes('客户')) {
      const restHasDifferentName = restContent.includes('消费贷') && !firstLine.includes('消费贷');
      if (restHasDifferentName) {
        hasIssues = true;
        issueDescription = '标题与明细内容不一致，标题未包含明细中的"消费贷"数据';
      }
    }

    const items = this.extractItemsFromContent(content);

    return {
      title,
      items,
      hasIssues,
      issueDescription
    };
  }
}
