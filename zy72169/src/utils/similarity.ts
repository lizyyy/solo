const DIRECTION_WORDS = ['东门', '西门', '南门', '北门', '东', '西', '南', '北', '东区', '西区', '南区', '北区']

function normalize(str: string): string {
  return str
    .replace(/[\s\u3000·\-—_()（）【】\[\]《》<>]/g, '')
    .toLowerCase()
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLen
}

const PINYIN_MAP: Record<string, string> = {
  '阳': 'y', '光': 'g', '花': 'h', '园': 'y', '小': 'x', '区': 'q',
  '新': 'x', '城': 'c', '社': 's', '苑': 'y', '居': 'j', '委': 'w',
  '碧': 'b', '桂': 'g', '金': 'j', '色': 's', '家': 'j',
  '源': 'y', '翠': 'c', '湖': 'h', '畔': 'p', '龙': 'l', '腾': 't',
  '福': 'f', '利': 'l', '华': 'h', '府': 'f', '天': 't', '悦': 'y',
  '和': 'h', '平': 'p', '安': 'a', '康': 'k', '泰': 't', '盛': 's',
  '锦': 'j', '绣': 'x', '明': 'm', '珠': 'z', '望': 'w', '京': 'j',
  '朝': 'c', '海': 'h', '淀': 'd', '丰': 'f', '台': 't',
  '石': 's', '景': 'j', '山': 's', '通': 't', '州': 'z', '顺': 's',
  '义': 'y', '大': 'd', '兴': 'x', '东': 'd', '西': 'x', '南': 'n', '北': 'b',
  '中': 'z', '路': 'l', '街': 'j', '道': 'd', '门': 'm', '口': 'k',
  '广': 'g', '场': 'c', '停': 't', '车': 'c', '桩': 'z', '充': 'c',
  '电': 'd', '站': 'z', '号': 'h', '栋': 'd', '楼': 'l', '层': 'c',
}

function getPinyinInitials(str: string): string {
  return Array.from(str)
    .map(ch => PINYIN_MAP[ch] || ch)
    .join('')
}

export function similarityScore(a: string, b: string): number {
  const normA = normalize(a)
  const normB = normalize(b)
  if (normA === normB) return 1

  const levSim = levenshteinSimilarity(normA, normB)

  const pyA = getPinyinInitials(normA)
  const pyB = getPinyinInitials(normB)
  const pySim = (pyA && pyB) ? levenshteinSimilarity(pyA, pyB) : 0

  return 0.6 * levSim + 0.4 * pySim
}

export function hasDirectionConflict(a: string, b: string): boolean {
  const normA = normalize(a)
  const normB = normalize(b)
  const dirA = DIRECTION_WORDS.find(d => normA.includes(d))
  const dirB = DIRECTION_WORDS.find(d => normB.includes(d))
  if (dirA && dirB && dirA !== dirB) return true
  if ((dirA && !dirB) || (!dirA && dirB)) return true
  return false
}

export function findMergeCandidates(
  newName: string,
  existingNames: { id: string; name: string }[],
  threshold = 0.8
): { id: string; name: string; similarity: number; hasDirectionConflict: boolean }[] {
  return existingNames
    .map(item => {
      const sim = similarityScore(newName, item.name)
      const dirConflict = hasDirectionConflict(newName, item.name)
      return { ...item, similarity: sim, hasDirectionConflict: dirConflict }
    })
    .filter(item => item.similarity >= threshold && !item.hasDirectionConflict)
    .sort((a, b) => b.similarity - a.similarity)
}
