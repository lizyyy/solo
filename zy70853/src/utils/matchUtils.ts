import moment from 'moment';

const synonyms: Record<string, string[]> = {
  '手机': ['iphone', '华为', '小米', 'oppo', 'vivo', '电话', '智能机', '苹果手机', '华为手机'],
  '钱包': ['皮夹', '钱夹', '手包'],
  '身份证': ['id卡', '身份卡'],
  '钥匙': ['锁匙', '钥匙串'],
  '雨伞': ['伞', '遮阳伞'],
  '手表': ['腕表', '钟表'],
  '黑色': ['黑'],
  '棕色': ['棕', '咖啡色'],
  '蓝色': ['蓝'],
  '白色': ['白'],
  '银色': ['银']
};

export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;
  
  if (s1.includes(s2) || s2.includes(s1)) return 85;
  
  let score = 0;
  const chars1 = new Set(s1.split(''));
  const chars2 = new Set(s2.split(''));
  let charMatches = 0;
  for (const c of chars1) {
    if (chars2.has(c)) charMatches++;
  }
  const charUnion = new Set([...chars1, ...chars2]).size;
  const charSimilarity = charUnion > 0 ? (charMatches / charUnion) * 100 : 0;
  
  const tokenSimilarity = calculateTokenSimilarity(s1, s2);
  const synonymBonus = calculateSynonymBonus(s1, s2);
  
  score = (charSimilarity * 0.3) + (tokenSimilarity * 0.4) + synonymBonus;
  
  return Math.min(100, Math.round(score));
}

function calculateTokenSimilarity(s1: string, s2: string): number {
  const tokens1 = s1.split(/[\s,，、]+/).filter(t => t.length > 0);
  const tokens2 = s2.split(/[\s,，、]+/).filter(t => t.length > 0);
  
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  let matches = 0;
  for (const t1 of tokens1) {
    for (const t2 of tokens2) {
      if (t1 === t2 || t1.includes(t2) || t2.includes(t1)) {
        matches++;
        break;
      }
    }
  }
  
  const maxTokens = Math.max(tokens1.length, tokens2.length);
  return maxTokens > 0 ? (matches / maxTokens) * 100 : 0;
}

function calculateSynonymBonus(s1: string, s2: string): number {
  for (const [key, values] of Object.entries(synonyms)) {
    const allSynonyms = [key, ...values];
    const hasSynonym1 = allSynonyms.some(syn => s1.includes(syn));
    const hasSynonym2 = allSynonyms.some(syn => s2.includes(syn));
    
    if (hasSynonym1 && hasSynonym2) {
      return 30;
    }
  }
  return 0;
}

export function isSameNameItem(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  for (const [key, values] of Object.entries(synonyms)) {
    const allSynonyms = [key, ...values];
    const hasSynonym1 = allSynonyms.some(syn => n1.includes(syn));
    const hasSynonym2 = allSynonyms.some(syn => n2.includes(syn));
    if (hasSynonym1 && hasSynonym2) return true;
  }
  
  return false;
}

export function isOverdue(dateStr: string, days: number = 90): boolean {
  const date = moment(dateStr, ['YYYY-MM-DD', 'YYYY/MM/DD', 'MM-DD-YYYY']);
  return date.isValid() && moment().diff(date, 'days') > days;
}

export function getOverdueDays(dateStr: string): number {
  const date = moment(dateStr, ['YYYY-MM-DD', 'YYYY/MM/DD', 'MM-DD-YYYY']);
  return date.isValid() ? moment().diff(date, 'days') : 0;
}

export function hideSensitiveInfo(data: Record<string, any>): Record<string, any> {
  const result = { ...data };
  
  const phoneFields = ['phone', 'telephone', 'mobile', '电话', '手机'];
  for (const field of Object.keys(result)) {
    const lowerField = field.toLowerCase();
    if (phoneFields.some(p => lowerField.includes(p))) {
      const value = String(result[field]);
      if (value.length >= 7) {
        result[field] = value.slice(0, 3) + '****' + value.slice(-4);
      }
    }
  }
  
  const idFields = ['idcard', 'id_card', '身份证', '证件号'];
  for (const field of Object.keys(result)) {
    const lowerField = field.toLowerCase();
    if (idFields.some(i => lowerField.includes(i))) {
      const value = String(result[field]);
      if (value.length >= 10) {
        result[field] = value.slice(0, 4) + '**********' + value.slice(-4);
      }
    }
  }
  
  const nameFields = ['name', '姓名'];
  for (const field of Object.keys(result)) {
    const lowerField = field.toLowerCase();
    if (nameFields.some(n => lowerField.includes(n)) && lowerField !== 'itemname') {
      const value = String(result[field]);
      if (value.length >= 2) {
        result[field] = value.slice(0, 1) + '*'.repeat(value.length - 1);
      }
    }
  }
  
  return result;
}

export function generateMatchId(): string {
  return `M${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
}

export function generateBatchId(): string {
  return `B${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
}
