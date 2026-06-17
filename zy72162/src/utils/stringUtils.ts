import levenshtein from 'fast-levenshtein';

const COMMON_SUFFIXES = ['投放点', '垃圾桶', '垃圾箱', '垃圾站', '点', '桶', '站', '箱'];

const SYNONYMS: Record<string, string[]> = {
  '北门': ['北入口', '北大门', '北侧门'],
  '南门': ['南入口', '南大门', '南侧门'],
  '东门': ['东入口', '东大门', '东侧门'],
  '西门': ['西入口', '西大门', '西侧门'],
  '小区': ['社区', '花园', '公寓', '住宅区'],
  '地铁': ['轨道交通', '地铁站'],
  '出口': ['口', '出入口'],
  '百货': ['商场', '购物中心'],
  '广场': ['小花园', '中心广场'],
  '三区': ['3区', '第三区'],
  '四区': ['4区', '第四区'],
  '西区': ['西小区', '西院'],
  '东区': ['东小区', '东院'],
};

export function normalizeName(name: string): string {
  let normalized = name.trim();
  
  normalized = normalized.replace(/[（）()【】[\]]/g, '');
  normalized = normalized.replace(/\s+/g, '');
  
  for (const suffix of COMMON_SUFFIXES) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }
  
  for (const [standard, synonyms] of Object.entries(SYNONYMS)) {
    for (const synonym of synonyms) {
      normalized = normalized.replace(new RegExp(synonym, 'g'), standard);
    }
  }
  
  normalized = normalized.replace(/[一二三四五六七八九十]/g, (match) => {
    const map: Record<string, string> = {
      '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
      '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
    };
    return map[match] || match;
  });
  
  return normalized;
}

export function calculateNameSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  
  if (norm1 === norm2) return 1.0;
  
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 0;
  
  const distance = levenshtein.get(norm1, norm2);
  const similarity = 1 - distance / maxLen;
  
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return Math.max(similarity, 0.8);
  }
  
  return Math.max(0, Math.min(1, similarity));
}

export function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const patterns = [
    /[\u4e00-\u9fa5]{2,}/g,
    /[A-Za-z0-9]+/g,
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      keywords.push(...matches.filter(k => k.length >= 2));
    }
  }
  
  return [...new Set(keywords)];
}

export function highlightConflicts(text1: string, text2: string): { text1: string; text2: string; conflicts: string[] } {
  const words1 = extractKeywords(text1);
  const words2 = extractKeywords(text2);
  
  const conflicts = words1.filter(w => !words2.includes(w))
    .concat(words2.filter(w => !words1.includes(w)))
    .filter(w => w.length >= 2);
  
  const highlight = (text: string, words: string[]) => {
    let result = text;
    for (const word of words) {
      const regex = new RegExp(`(${word})`, 'g');
      result = result.replace(regex, '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>');
    }
    return result;
  };
  
  return {
    text1: highlight(text1, conflicts),
    text2: highlight(text2, conflicts),
    conflicts,
  };
}

export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function formatDateTime(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatDate(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
