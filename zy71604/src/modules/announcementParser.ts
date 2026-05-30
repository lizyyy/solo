import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Decimal } from 'decimal.js';
import { DividendAnnouncement, SourceReference } from '../types/models';
import { parseDate, formatDate } from '../utils/dateUtils';
import { parseNumber, parsePercent } from '../utils/numberUtils';

export interface ParsedAnnouncementData {
  fundCode?: string;
  fundName?: string;
  announcementId?: string;
  announcementDate?: string;
  registrationDate?: string;
  exDividendDate?: string;
  paymentDate?: string;
  dividendPerUnit?: Decimal;
  dividendRatio?: Decimal;
  reinvestmentNav?: Decimal;
  roundingMethod?: 'round_half_up' | 'truncate' | 'bankers';
  roundingPrecision?: number;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
}

const datePatterns = {
  registration: [
    /权益登记日[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /登记日[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /R日[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /(\d{4})年(\d{1,2})月(\d{1,2})日.*权益登记日/,
  ],
  exDividend: [
    /除息日[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /除权除息日[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /X日[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /(\d{4})年(\d{1,2})月(\d{1,2})日.*除息日/,
  ],
  payment: [
    /红利发放日[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /分红发放日[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /到账日[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /(\d{4})年(\d{1,2})月(\d{1,2})日.*红利发放日/,
  ],
  announcement: [
    /公告日期[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /公告日[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/,
    /(\d{4})年(\d{1,2})月(\d{1,2})日.*公告/,
  ],
};

const amountPatterns = {
  dividendPerUnit: [
    /每10份派发红利[：:]\s*([\d.]+)\s*元/,
    /每10份分红[：:]\s*([\d.]+)\s*元/,
    /每份派发红利[：:]\s*([\d.]+)\s*元/,
    /每份分红[：:]\s*([\d.]+)\s*元/,
    /分红金额[：:]\s*([\d.]+)\s*元\/份/,
  ],
  dividendRatio: [
    /分红比例[：:]\s*([\d.]+)%/,
    /分红比例[：:]\s*([\d.]+)/,
  ],
  reinvestmentNav: [
    /红利再投资净值[：:]\s*([\d.]+)\s*元/,
    /再投资净值[：:]\s*([\d.]+)\s*元/,
    /分红再投净值[：:]\s*([\d.]+)\s*元/,
  ],
};

const fundPatterns = {
  fundCode: [
    /基金代码[：:]\s*(\d{6})/,
    /代码[：:]\s*(\d{6})/,
  ],
  fundName: [
    /基金名称[：:]\s*([^\s，。；、]+)/,
    /基金全称[：:]\s*([^\s，。；、]+)/,
  ],
  announcementId: [
    /公告编号[：:]\s*([^\s，。；、]+)/,
    /公告编码[：:]\s*([^\s，。；、]+)/,
  ],
};

export class AnnouncementParser {
  private extractByPatterns(text: string, patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  private extractDate(text: string, dateType: keyof typeof datePatterns): string | null {
    const patterns = datePatterns[dateType];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let dateStr: string;
        if (match.length === 4) {
          dateStr = `${match[1]}年${match[2]}月${match[3]}日`;
        } else {
          dateStr = match[1];
        }
        
        const parsed = parseDate(dateStr);
        if (parsed.isValid()) {
          return formatDate(parsed);
        }
      }
    }
    return null;
  }

  private extractFundInfo(text: string): { fundCode?: string; fundName?: string; announcementId?: string } {
    const result: { fundCode?: string; fundName?: string; announcementId?: string } = {};
    
    const fundCode = this.extractByPatterns(text, fundPatterns.fundCode);
    if (fundCode) result.fundCode = fundCode;
    
    const fundName = this.extractByPatterns(text, fundPatterns.fundName);
    if (fundName) result.fundName = fundName;
    
    const announcementId = this.extractByPatterns(text, fundPatterns.announcementId);
    if (announcementId) result.announcementId = announcementId;
    
    return result;
  }

  private extractAmounts(text: string): {
    dividendPerUnit?: Decimal;
    dividendRatio?: Decimal;
    reinvestmentNav?: Decimal;
  } {
    const result: {
      dividendPerUnit?: Decimal;
      dividendRatio?: Decimal;
      reinvestmentNav?: Decimal;
    } = {};

    const per10Match = text.match(/每10份派发红利[：:]\s*([\d.]+)\s*元/);
    if (per10Match) {
      result.dividendPerUnit = new Decimal(per10Match[1]).div(10);
    } else {
      const perUnitMatch = text.match(/每份派发红利[：:]\s*([\d.]+)\s*元/);
      if (perUnitMatch) {
        result.dividendPerUnit = new Decimal(perUnitMatch[1]);
      }
    }

    const ratioText = this.extractByPatterns(text, amountPatterns.dividendRatio);
    if (ratioText) {
      const ratio = parsePercent(ratioText);
      if (ratio) result.dividendRatio = ratio;
    }

    const navText = this.extractByPatterns(text, amountPatterns.reinvestmentNav);
    if (navText) {
      const nav = parseNumber(navText);
      if (nav) result.reinvestmentNav = nav;
    }

    return result;
  }

  private detectRoundingMethod(text: string): {
    method: 'round_half_up' | 'truncate' | 'bankers';
    precision: number;
  } {
    if (text.includes('四舍五入') || text.includes('四捨五入')) {
      return { method: 'round_half_up', precision: 2 };
    }
    if (text.includes('舍去') || text.includes('截断') || text.includes('取整')) {
      return { method: 'truncate', precision: 2 };
    }
    if (text.includes('银行家舍入') || text.includes('四舍六入')) {
      return { method: 'bankers', precision: 2 };
    }
    const precisionMatch = text.match(/保留(\d+)位小数/);
    if (precisionMatch) {
      return { method: 'round_half_up', precision: parseInt(precisionMatch[1], 10) };
    }
    return { method: 'round_half_up', precision: 2 };
  }

  public parse(text: string, sourceFileName?: string): ParseResult<ParsedAnnouncementData> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const result: ParsedAnnouncementData = {};

    const normalizedText = text.replace(/\s+/g, ' ').replace(/[【\]]/g, '');

    const fundInfo = this.extractFundInfo(normalizedText);
    Object.assign(result, fundInfo);

    if (!result.fundCode) {
      errors.push('未找到基金代码');
    }
    if (!result.fundName) {
      warnings.push('未找到基金名称');
    }

    result.announcementDate = this.extractDate(normalizedText, 'announcement') || undefined;
    result.registrationDate = this.extractDate(normalizedText, 'registration') || undefined;
    result.exDividendDate = this.extractDate(normalizedText, 'exDividend') || undefined;
    result.paymentDate = this.extractDate(normalizedText, 'payment') || undefined;

    if (!result.registrationDate) {
      errors.push('未找到权益登记日');
    }
    if (!result.exDividendDate) {
      warnings.push('未找到除息日');
    }
    if (!result.paymentDate) {
      warnings.push('未找到红利发放日');
    }

    if (result.registrationDate && result.exDividendDate) {
      const regDate = parseDate(result.registrationDate);
      const exDate = parseDate(result.exDividendDate);
      if (exDate.isBefore(regDate)) {
        errors.push('除息日早于权益登记日，日期逻辑异常');
      }
    }

    const amounts = this.extractAmounts(normalizedText);
    Object.assign(result, amounts);

    if (!result.dividendPerUnit) {
      errors.push('未找到分红金额');
    }
    if (!result.reinvestmentNav) {
      warnings.push('未找到红利再投资净值');
    }

    const rounding = this.detectRoundingMethod(normalizedText);
    result.roundingMethod = rounding.method;
    result.roundingPrecision = rounding.precision;

    return {
      success: errors.length === 0,
      data: result,
      errors,
      warnings,
    };
  }

  public createAnnouncement(
    fundId: string,
    parsedData: ParsedAnnouncementData,
    source: SourceReference
  ): DividendAnnouncement {
    const now = dayjs().toISOString();
    return {
      id: uuidv4(),
      fundId,
      announcementId: parsedData.announcementId || `ANN-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      announcementDate: parsedData.announcementDate || now,
      registrationDate: parsedData.registrationDate || now,
      exDividendDate: parsedData.exDividendDate || parsedData.registrationDate || now,
      paymentDate: parsedData.paymentDate || parsedData.exDividendDate || now,
      dividendPerUnit: parsedData.dividendPerUnit || new Decimal(0),
      dividendRatio: parsedData.dividendRatio || new Decimal(0),
      reinvestmentNav: parsedData.reinvestmentNav || new Decimal(1),
      roundingMethod: parsedData.roundingMethod || 'round_half_up',
      roundingPrecision: parsedData.roundingPrecision || 2,
      status: 'draft',
      source,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  public validateAnnouncement(announcement: DividendAnnouncement): ParseResult<boolean> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (announcement.dividendPerUnit.lte(0)) {
      errors.push('分红金额必须大于0');
    }
    if (announcement.reinvestmentNav.lte(0)) {
      errors.push('再投资净值必须大于0');
    }

    const regDate = parseDate(announcement.registrationDate);
    const exDate = parseDate(announcement.exDividendDate);
    const payDate = parseDate(announcement.paymentDate);

    if (!regDate.isValid()) errors.push('权益登记日无效');
    if (!exDate.isValid()) errors.push('除息日无效');
    if (!payDate.isValid()) errors.push('红利发放日无效');

    if (regDate.isValid() && exDate.isValid() && exDate.isBefore(regDate)) {
      errors.push('除息日不能早于权益登记日');
    }
    if (exDate.isValid() && payDate.isValid() && payDate.isBefore(exDate)) {
      warnings.push('红利发放日早于除息日，请确认是否正确');
    }

    return {
      success: errors.length === 0,
      data: errors.length === 0,
      errors,
      warnings,
    };
  }
}
