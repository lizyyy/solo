export function calculateSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase()
  const bLower = b.toLowerCase()

  if (aLower === bLower) return 1.0

  const wordsA = new Set(aLower.split(/\s+/).filter(w => w.length > 0))
  const wordsB = new Set(bLower.split(/\s+/).filter(w => w.length > 0))

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0

  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)))
  const union = new Set([...wordsA, ...wordsB])

  const jaccard = intersection.size / union.size

  const editDistance = levenshtein(aLower, bLower)
  const maxLen = Math.max(aLower.length, bLower.length)
  const normalizedEdit = maxLen > 0 ? 1 - editDistance / maxLen : 0

  const linesA = aLower.split('\n').filter(l => l.trim().length > 0)
  const linesB = bLower.split('\n').filter(l => l.trim().length > 0)
  let lineMatches = 0
  for (const line of linesA) {
    if (linesB.some(l => l.includes(line) || line.includes(l))) {
      lineMatches++
    }
  }
  const lineSimilarity = Math.max(linesA.length, linesB.length) > 0
    ? lineMatches / Math.max(linesA.length, linesB.length)
    : 0

  return Math.round((jaccard * 0.4 + normalizedEdit * 0.3 + lineSimilarity * 0.3) * 100) / 100
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length

  if (m === 0) return n
  if (n === 0) return m

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }

  return dp[m][n]
}

export function generateSnippet(content: string, query: string, maxLength: number = 200): string {
  const contentLower = content.toLowerCase()
  const queryLower = query.toLowerCase()

  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0)

  let bestIndex = -1
  let bestScore = -1

  for (const word of queryWords) {
    let index = contentLower.indexOf(word)
    while (index !== -1) {
      let score = 0
      const window = contentLower.substring(
        Math.max(0, index - 50),
        Math.min(contentLower.length, index + 50)
      )
      for (const w of queryWords) {
        if (window.includes(w)) score++
      }
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
      index = contentLower.indexOf(word, index + 1)
    }
  }

  if (bestIndex === -1) {
    const snippet = content.substring(0, maxLength)
    return snippet.length < content.length ? snippet + '...' : snippet
  }

  const start = Math.max(0, bestIndex - maxLength / 3)
  const end = Math.min(content.length, start + maxLength)
  const snippet = content.substring(start, end)

  const prefix = start > 0 ? '...' : ''
  const suffix = end < content.length ? '...' : ''

  return prefix + snippet + suffix
}
