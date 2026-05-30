import type {
  Material,
  ParsedTerms,
  ObservationInterval,
  ReturnTier,
  EarlyTermination,
  ParseResult,
  EvidenceRef,
} from '../types';
import { generateId } from '../utils/hash';
import { getFieldEvidence } from './import';

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).replace(/[^\d.-]/g, ''));
  return isNaN(num) ? null : num;
}

function parseDate(value: any): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function parseBound(value: any): { bound: number; inclusive: boolean } | null {
  if (value === null || value === undefined || value === '') return null;
  
  const str = String(value).trim();
  let inclusive = true;
  let numStr = str;
  
  if (str.startsWith('(') || str.startsWith(')')) {
    inclusive = false;
    numStr = str.slice(1);
  } else if (str.startsWith('[') || str.startsWith(']')) {
    inclusive = true;
    numStr = str.slice(1);
  }
  
  if (str.endsWith(')') || str.endsWith('(')) {
    inclusive = false;
    numStr = numStr.slice(0, -1);
  } else if (str.endsWith(']') || str.endsWith('[')) {
    inclusive = true;
    numStr = numStr.slice(0, -1);
  }
  
  if (str.startsWith('>=')) {
    inclusive = true;
    numStr = str.slice(2);
  } else if (str.startsWith('<=')) {
    inclusive = true;
    numStr = str.slice(2);
  } else if (str.startsWith('>')) {
    inclusive = false;
    numStr = str.slice(1);
  } else if (str.startsWith('<')) {
    inclusive = false;
    numStr = str.slice(1);
  }
  
  const num = parseNumber(numStr);
  if (num === null) return null;
  
  return { bound: num, inclusive };
}

function parseIntervalString(
  intervalStr: string,
  material: Material,
  fieldName: string
): { interval: ObservationInterval | null; evidence: EvidenceRef | null } {
  const evidence = getFieldEvidence(material, fieldName, intervalStr);
  
  const patterns = [
    /(\d{4}-\d{2}-\d{2})\s*[~至\-]\s*(\d{4}-\d{2}-\d{2})\s*:\s*([\[\(]?\s*[\d.]+)\s*[~至\-]\s*([\d.]+[\]\)]?)/,
    /观察期\s*(\d{4}-\d{2}-\d{2})\s*[~至\-]\s*(\d{4}-\d{2}-\d{2})/,
    /价格区间\s*([\[\(]?\s*[\d.]+)\s*[~至\-]\s*([\d.]+[\]\)]?)/,
  ];
  
  for (const pattern of patterns) {
    const match = intervalStr.match(pattern);
    if (match) {
      const startDate = parseDate(match[1]);
      const endDate = parseDate(match[2]);
      const lower = parseBound(match[3]);
      const upper = parseBound(match[4]);
      
      if (startDate && endDate && lower && upper) {
        return {
          interval: {
            id: generateId('interval'),
            startDate,
            endDate,
            lowerBound: lower.bound,
            upperBound: upper.bound,
            lowerInclusive: lower.inclusive,
            upperInclusive: upper.inclusive,
          },
          evidence,
        };
      }
    }
  }
  
  return { interval: null, evidence };
}

function parseTierString(
  tierStr: string,
  material: Material,
  fieldName: string,
  index: number
): { tier: ReturnTier | null; evidence: EvidenceRef | null } {
  const evidence = getFieldEvidence(material, fieldName, tierStr);
  
  const patterns = [
    /([\[\(]?\s*[\d.]+)\s*[~至\-]\s*([\d.]+[\]\)]?)\s*[:：\s]\s*([\d.]+)%?/,
    /价格\s*[≥>]\s*([\d.]+)\s*[:：\s]\s*([\d.]+)%?/,
    /价格\s*[≤<]\s*([\d.]+)\s*[:：\s]\s*([\d.]+)%?/,
    /第\s*(\d+)\s*档\s*[:：\s]\s*([\d.]+)%?/,
  ];
  
  for (const pattern of patterns) {
    const match = tierStr.match(pattern);
    if (match) {
      let lowerBound = 0;
      let upperBound = Infinity;
      let lowerInclusive = true;
      let upperInclusive = true;
      let returnRate = 0;
      
      if (match[1] && match[2] && match[3]) {
        const lower = parseBound(match[1]);
        const upper = parseBound(match[2]);
        returnRate = parseNumber(match[3]) || 0;
        
        if (lower) {
          lowerBound = lower.bound;
          lowerInclusive = lower.inclusive;
        }
        if (upper) {
          upperBound = upper.bound;
          upperInclusive = upper.inclusive;
        }
      } else if (tierStr.includes('≥') || tierStr.includes('>')) {
        const lower = parseBound(tierStr.match(/[≥>]\s*([\d.]+)/)?.[0] || '');
        returnRate = parseNumber(match[2]) || 0;
        
        if (lower) {
          lowerBound = lower.bound;
          lowerInclusive = lower.inclusive;
        }
        upperBound = Infinity;
        upperInclusive = true;
      } else if (tierStr.includes('≤') || tierStr.includes('<')) {
        const upper = parseBound(tierStr.match(/[≤<]\s*([\d.]+)/)?.[0] || '');
        returnRate = parseNumber(match[2]) || 0;
        
        if (upper) {
          upperBound = upper.bound;
          upperInclusive = upper.inclusive;
        }
        lowerBound = -Infinity;
        lowerInclusive = true;
      } else {
        returnRate = parseNumber(match[2]) || 0;
      }
      
      return {
        tier: {
          id: generateId('tier'),
          lowerBound,
          upperBound,
          lowerInclusive,
          upperInclusive,
          returnRate: returnRate > 1 ? returnRate / 100 : returnRate,
          description: tierStr,
        },
        evidence,
      };
    }
  }
  
  const rate = parseNumber(tierStr.match(/([\d.]+)\s*%?/)?.[1]);
  if (rate !== null) {
    return {
      tier: {
        id: generateId('tier'),
        lowerBound: -Infinity,
        upperBound: Infinity,
        lowerInclusive: true,
        upperInclusive: true,
        returnRate: rate > 1 ? rate / 100 : rate,
        description: `档位${index + 1}: ${tierStr}`,
      },
      evidence,
    };
  }
  
  return { tier: null, evidence };
}

export function parseProductTerms(material: Material): ParseResult<ParsedTerms> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const evidenceRef: Record<string, EvidenceRef> = {};
  
  const c = material.content;
  
  const getValue = (possibleNames: string[]): any => {
    for (const name of possibleNames) {
      if (c[name] !== undefined && c[name] !== null && c[name] !== '') {
        return { value: c[name], name };
      }
    }
    return { value: null, name: null };
  };
  
  const productCode = getValue(['产品代码', 'productCode', 'product_code', '产品编号']);
  if (productCode.value === null) {
    errors.push('未找到产品代码');
  } else {
    const ev = getFieldEvidence(material, productCode.name, String(productCode.value));
    if (ev) evidenceRef.productCode = ev;
  }
  
  const productName = getValue(['产品名称', 'productName', 'product_name', '名称']);
  if (productName.value) {
    const ev = getFieldEvidence(material, productName.name, String(productName.value));
    if (ev) evidenceRef.productName = ev;
  }
  
  const underlying = getValue(['挂钩标的', '标的名称', 'underlying', '标的']);
  if (underlying.value === null) {
    errors.push('未找到挂钩标的');
  } else {
    const ev = getFieldEvidence(material, underlying.name, String(underlying.value));
    if (ev) evidenceRef.underlying = ev;
  }
  
  const underlyingCode = getValue(['标的代码', 'underlyingCode', '标的编码']);
  if (underlyingCode.value) {
    const ev = getFieldEvidence(material, underlyingCode.name, String(underlyingCode.value));
    if (ev) evidenceRef.underlyingCode = ev;
  }
  
  const currency = getValue(['币种', 'currency', '货币']);
  if (currency.value) {
    const ev = getFieldEvidence(material, currency.name, String(currency.value));
    if (ev) evidenceRef.currency = ev;
  }
  
  const termDays = getValue(['期限', '天数', 'termDays', '投资期限']);
  const termDaysNum = termDays.value !== null ? parseNumber(termDays.value) : null;
  if (termDaysNum !== null) {
    const ev = getFieldEvidence(material, termDays.name, String(termDays.value));
    if (ev) evidenceRef.termDays = ev;
  }
  
  const observationIntervals: ObservationInterval[] = [];
  
  const intervalStartDate = getValue(['观察起始日', '观察开始日', 'startDate', '起息日']);
  const intervalEndDate = getValue(['观察结束日', 'endDate', '到期日']);
  const lowerBound = getValue(['价格下限', '下限', 'lowerBound', '最低价格']);
  const upperBound = getValue(['价格上限', '上限', 'upperBound', '最高价格']);
  const lowerInclusive = getValue(['下限包含', 'lowerInclusive']);
  const upperInclusive = getValue(['上限包含', 'upperInclusive']);
  
  if (intervalStartDate.value && intervalEndDate.value) {
    const startDate = parseDate(intervalStartDate.value);
    const endDate = parseDate(intervalEndDate.value);
    
    if (startDate && endDate) {
      const interval: ObservationInterval = {
        id: generateId('interval'),
        startDate,
        endDate,
        lowerBound: parseNumber(lowerBound.value) ?? -Infinity,
        upperBound: parseNumber(upperBound.value) ?? Infinity,
        lowerInclusive: lowerInclusive.value !== false,
        upperInclusive: upperInclusive.value !== false,
      };
      observationIntervals.push(interval);
      
      const ev1 = getFieldEvidence(material, intervalStartDate.name, String(intervalStartDate.value));
      const ev2 = getFieldEvidence(material, intervalEndDate.name, String(intervalEndDate.value));
      if (ev1) evidenceRef['interval_startDate'] = ev1;
      if (ev2) evidenceRef['interval_endDate'] = ev2;
    }
  }
  
  const intervalField = getValue(['观察区间', 'observationInterval', '价格区间']);
  if (intervalField.value && observationIntervals.length === 0) {
    const { interval, evidence } = parseIntervalString(
      String(intervalField.value),
      material,
      intervalField.name
    );
    if (interval) {
      observationIntervals.push(interval);
      if (evidence) evidenceRef['observation_interval'] = evidence;
    } else {
      warnings.push('观察区间格式无法自动解析，请手动填写');
    }
  }
  
  const returnTiers: ReturnTier[] = [];
  
  const tierFields = ['收益档位', '档位', 'returnTiers', '收益率档位'];
  for (const fieldName of tierFields) {
    if (c[fieldName]) {
      const tierValues = Array.isArray(c[fieldName]) ? c[fieldName] : [c[fieldName]];
      tierValues.forEach((tierStr: string, index: number) => {
        const { tier, evidence } = parseTierString(String(tierStr), material, fieldName, index);
        if (tier) {
          returnTiers.push(tier);
          if (evidence) evidenceRef[`tier_${index}`] = evidence;
        }
      });
    }
  }
  
  const tier1Rate = getValue(['第一档收益率', '档1收益率', 'tier1Rate', '最低收益率']);
  const tier2Rate = getValue(['第二档收益率', '档2收益率', 'tier2Rate']);
  const tier3Rate = getValue(['第三档收益率', '档3收益率', 'tier3Rate', '最高收益率']);
  
  if (returnTiers.length === 0 && (tier1Rate.value || tier2Rate.value || tier3Rate.value)) {
    if (tier1Rate.value !== null) {
      const rate = parseNumber(tier1Rate.value);
      if (rate !== null) {
        returnTiers.push({
          id: generateId('tier'),
          lowerBound: -Infinity,
          upperBound: parseNumber(lowerBound.value) ?? Infinity,
          lowerInclusive: true,
          upperInclusive: false,
          returnRate: rate > 1 ? rate / 100 : rate,
          description: `第一档: ${rate}%`,
        });
        const ev = getFieldEvidence(material, tier1Rate.name, String(tier1Rate.value));
        if (ev) evidenceRef['tier_0'] = ev;
      }
    }
    if (tier2Rate.value !== null) {
      const rate = parseNumber(tier2Rate.value);
      if (rate !== null) {
        returnTiers.push({
          id: generateId('tier'),
          lowerBound: parseNumber(lowerBound.value) ?? 0,
          upperBound: parseNumber(upperBound.value) ?? Infinity,
          lowerInclusive: true,
          upperInclusive: true,
          returnRate: rate > 1 ? rate / 100 : rate,
          description: `第二档: ${rate}%`,
        });
        const ev = getFieldEvidence(material, tier2Rate.name, String(tier2Rate.value));
        if (ev) evidenceRef['tier_1'] = ev;
      }
    }
    if (tier3Rate.value !== null) {
      const rate = parseNumber(tier3Rate.value);
      if (rate !== null) {
        returnTiers.push({
          id: generateId('tier'),
          lowerBound: parseNumber(upperBound.value) ?? 0,
          upperBound: Infinity,
          lowerInclusive: true,
          upperInclusive: true,
          returnRate: rate > 1 ? rate / 100 : rate,
          description: `第三档: ${rate}%`,
        });
        const ev = getFieldEvidence(material, tier3Rate.name, String(tier3Rate.value));
        if (ev) evidenceRef['tier_2'] = ev;
      }
    }
  }
  
  if (returnTiers.length === 0) {
    errors.push('未找到收益档位设置');
  }
  
  let earlyTermination: EarlyTermination | null = null;
  const earlyTerm = getValue(['提前终止', '是否可提前终止', 'earlyTermination', '赎回条款']);
  if (earlyTerm.value && String(earlyTerm.value) !== '否' && String(earlyTerm.value) !== 'false') {
    const etDates = getValue(['提前终止观察日', '赎回观察日']);
    const etTrigger = getValue(['提前终止触发条件', '触发条件']);
    const etLevel = getValue(['提前终止触发水平', '触发水平']);
    const etRate = getValue(['提前终止收益率', '赎回收益率']);
    
    earlyTermination = {
      enabled: true,
      observationDates: etDates.value
        ? String(etDates.value).split(/[,，;；\s]+/).filter(Boolean).map(d => parseDate(d) || d)
        : [],
      triggerCondition: etTrigger.value ? String(etTrigger.value) : '',
      triggerLevel: parseNumber(etLevel.value) ?? 0,
      returnRate: parseNumber(etRate.value) ?? 0,
    };
    
    const ev = getFieldEvidence(material, earlyTerm.name, String(earlyTerm.value));
    if (ev) evidenceRef['earlyTermination'] = ev;
  }
  
  if (errors.length > 0) {
    return {
      success: false,
      errors,
      warnings,
    };
  }
  
  return {
    success: true,
    data: {
      id: generateId('terms'),
      batchId: material.batchId,
      productCode: String(productCode.value || ''),
      productName: String(productName.value || ''),
      underlying: String(underlying.value || ''),
      underlyingCode: String(underlyingCode.value || ''),
      currency: String(currency.value || 'CNY'),
      termDays: termDaysNum || 0,
      observationIntervals,
      returnTiers: returnTiers.sort((a, b) => a.lowerBound - b.lowerBound),
      earlyTermination,
      evidenceRef,
      parsedAt: new Date(),
      manuallyModified: false,
    },
    errors,
    warnings,
  };
}

export function parseCustomerPosition(material: Material): ParseResult<any[]> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const rows = material.content.rows || [material.content];
  const positions: any[] = [];
  
  rows.forEach((row: any, index: number) => {
    if (!row || Object.keys(row).length === 0) return;
    
    const getVal = (possibleNames: string[]): any => {
      for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
          return { value: row[name], name };
        }
      }
      return { value: null, name: null };
    };
    
    const customerId = getVal(['客户编号', 'customerId', '客户ID', '证件号']);
    const customerName = getVal(['客户名称', 'customerName', '姓名', '客户']);
    const productCode = getVal(['产品代码', 'productCode', '产品编号']);
    const principal = getVal(['持有金额', '本金', 'principal', '金额']);
    const startDate = getVal(['起息日', '开始日期', 'startDate', '购买日期']);
    const endDate = getVal(['到期日', '结束日期', 'endDate']);
    
    if (customerName.value === null) {
      errors.push(`第${index + 1}行: 缺少客户名称`);
      return;
    }
    if (principal.value === null) {
      errors.push(`第${index + 1}行: 缺少持有金额`);
      return;
    }
    
    const principalNum = parseNumber(principal.value);
    if (principalNum === null || principalNum <= 0) {
      errors.push(`第${index + 1}行: 持有金额格式不正确`);
      return;
    }
    
    const evidenceRef = getFieldEvidence(material, principal.name, String(principal.value));
    
    positions.push({
      id: generateId('pos'),
      batchId: material.batchId,
      customerId: String(customerId.value || ''),
      customerName: String(customerName.value),
      productCode: String(productCode.value || ''),
      principal: principalNum,
      startDate: parseDate(startDate.value) || '',
      endDate: parseDate(endDate.value) || '',
      evidenceRef,
    });
  });
  
  if (positions.length === 0) {
    errors.push('未解析到有效的客户持仓数据');
  }
  
  return {
    success: errors.length === 0,
    data: positions,
    errors,
    warnings,
  };
}

export function parseUnderlyingPrices(material: Material): ParseResult<any[]> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const rows = material.content.rows || [material.content];
  const prices: any[] = [];
  
  rows.forEach((row: any, index: number) => {
    if (!row || Object.keys(row).length === 0) return;
    
    const getVal = (possibleNames: string[]): any => {
      for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
          return { value: row[name], name };
        }
      }
      return { value: null, name: null };
    };
    
    const date = getVal(['日期', 'date', '观察日', '交易日']);
    const price = getVal(['价格', 'price', '收盘价', '标的价格']);
    
    if (date.value === null) {
      errors.push(`第${index + 1}行: 缺少日期`);
      return;
    }
    if (price.value === null) {
      errors.push(`第${index + 1}行: 缺少价格`);
      return;
    }
    
    const dateStr = parseDate(date.value);
    const priceNum = parseNumber(price.value);
    
    if (!dateStr) {
      errors.push(`第${index + 1}行: 日期格式不正确`);
      return;
    }
    if (priceNum === null || priceNum <= 0) {
      errors.push(`第${index + 1}行: 价格格式不正确`);
      return;
    }
    
    prices.push({
      date: dateStr,
      price: priceNum,
      source: material.filename,
    });
  });
  
  if (prices.length === 0) {
    errors.push('未解析到有效的标的价格数据');
  }
  
  return {
    success: errors.length === 0,
    data: prices,
    errors,
    warnings,
  };
}
