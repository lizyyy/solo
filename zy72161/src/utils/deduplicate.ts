export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function similarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

const aliasMap: Record<string, string[]> = {
  '东门路口': ['东门口', '东门口交叉口', '东门十字', '东门红绿灯'],
  '阳光社区活动中心': ['阳光活动中心', '社区活动中心', '阳光会所'],
  '星光小学操场': ['星光小学', '星光学校操场', '小学操场'],
  '中心广场': ['社区广场', '小区广场', '中央广场'],
  '第二中学体育馆': ['二中体育馆', '第二中学', '中学体育馆']
};

export function normalizeLocationName(rawName: string): string {
  const normalized = rawName
    .trim()
    .replace(/[\]\s\-_，。、；：""''（）()【】[]/g, '')
    .replace(/路$|街$|巷$|口$|交叉口$|十字$|红绿灯$/g, '');

  for (const [standard, aliases] of Object.entries(aliasMap)) {
    if (normalized === standard || aliases.some(alias => normalized.includes(alias) || alias.includes(normalized))) {
      return standard;
    }
    const similarityScore = similarity(normalized, standard);
    if (similarityScore > 0.85) {
      return standard;
    }
  }

  return rawName;
}

export function getAliases(standardName: string): string[] {
  return aliasMap[standardName] || [];
}

export function isDuplicateReport(
  reporter1: string,
  reporter2: string,
  time1: string,
  time2: string,
  location1: string,
  location2: string
): boolean {
  if (reporter1 !== reporter2) return false;

  const t1 = new Date(time1).getTime();
  const t2 = new Date(time2).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (Math.abs(t1 - t2) > sevenDays) return false;

  const loc1 = normalizeLocationName(location1);
  const loc2 = normalizeLocationName(location2);
  return loc1 === loc2;
}
