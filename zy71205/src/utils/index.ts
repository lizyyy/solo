export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const calculateFileHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (date: string | number): string => {
  const d = typeof date === 'number' ? new Date(date) : new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN');
};

export const levenshteinDistance = (a: string, b: string): number => {
  const matrix = Array.from({ length: a.length + 1 }, () => 
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
};

export const fuzzyMatchScore = (a: string, b: string): number => {
  if (!a || !b) return 0;
  const normalizedA = a.toLowerCase().trim();
  const normalizedB = b.toLowerCase().trim();
  
  if (normalizedA === normalizedB) return 100;
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return 80;
  
  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  return Math.round((1 - distance / maxLength) * 100);
};

export const roundTo = (num: number, decimals: number = 2): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

export const amountEquals = (a: number, b: number, tolerance: number = 0.01): boolean => {
  return Math.abs(a - b) < tolerance;
};

export const normalizeString = (str: string): string => {
  return str
    .replace(/\s+/g, '')
    .replace(/[，。、；：""''（）()【】\[\]《》<>\-_]/g, '')
    .toLowerCase();
};

export const extractKeywords = (text: string): string[] => {
  const normalized = normalizeString(text);
  const keywords: string[] = [];
  
  const companyPattern = /(公司|集团|有限|股份|实业|科技|贸易|服务)/g;
  let match;
  while ((match = companyPattern.exec(normalized)) !== null) {
    const start = Math.max(0, match.index - 10);
    const end = match.index + match[0].length;
    const keyword = normalized.substring(start, end);
    if (keyword.length > 3) {
      keywords.push(keyword);
    }
  }
  
  const amountPattern = /(\d+\.?\d*)/g;
  while ((match = amountPattern.exec(normalized)) !== null) {
    keywords.push(match[1]);
  }
  
  return [...new Set(keywords)];
};

export const getConflictTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    same_summary: '摘要同名误配',
    amount_mismatch: '金额不匹配',
    red_flush_occupied: '红冲后原凭证仍被占用',
    duplicate_voucher: '凭证号重复',
  };
  return labels[type] || type;
};

export const getMatchStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    unmatched: '未匹配',
    matched: '已匹配',
    pending: '待确认',
    confirmed: '已确认',
    rejected: '已拒绝',
    split: '已拆分',
    merged: '已合并',
    red_flushed: '已红冲',
  };
  return labels[status] || status;
};

export const getSourceTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    bank: '银行流水',
    voucher: '凭证',
    invoice: '发票',
    contract: '合同',
    manual: '人工',
  };
  return labels[type] || type;
};
