function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  
  return dp[m][n];
}

function similarityScore(s1, s2) {
  if (!s1 || !s2) return 0;
  
  const s1Clean = s1.toLowerCase().trim();
  const s2Clean = s2.toLowerCase().trim();
  
  if (s1Clean === s2Clean) return 1;
  
  const maxLen = Math.max(s1Clean.length, s2Clean.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1Clean, s2Clean);
  return 1 - (distance / maxLen);
}

function nGramSimilarity(s1, s2, n = 2) {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  
  const getNGrams = (str, n) => {
    const grams = new Set();
    const padded = ' ' + str + ' ';
    for (let i = 0; i <= padded.length - n; i++) {
      grams.add(padded.substring(i, i + n));
    }
    return grams;
  };
  
  const grams1 = getNGrams(s1.toLowerCase(), n);
  const grams2 = getNGrams(s2.toLowerCase(), n);
  
  const intersection = new Set([...grams1].filter(x => grams2.has(x)));
  const union = new Set([...grams1, ...grams2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function combinedSimilarity(s1, s2) {
  const levScore = similarityScore(s1, s2);
  const ngramScore = nGramSimilarity(s1, s2, 2);
  const bigramScore = nGramSimilarity(s1, s2, 3);
  
  return (levScore * 0.4) + (ngramScore * 0.35) + (bigramScore * 0.25);
}

function findSimilar(text, candidates, topN = 3) {
  if (!candidates || candidates.length === 0) return [];
  
  const results = candidates.map((candidate, index) => {
    const candidateText = typeof candidate === 'string' ? candidate : (candidate.text || '');
    const score = combinedSimilarity(text, candidateText);
    
    return {
      index,
      text: candidateText,
      original: candidate,
      score: Math.round(score * 10000) / 10000
    };
  });
  
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, topN);
}

function findSimilarPairs(subtitles, threshold = 0.8) {
  const pairs = [];
  
  for (let i = 0; i < subtitles.length; i++) {
    for (let j = i + 1; j < subtitles.length; j++) {
      const sub1 = subtitles[i];
      const sub2 = subtitles[j];
      
      const text1 = sub1.current_text || sub1.original_text || '';
      const text2 = sub2.current_text || sub2.original_text || '';
      
      if (!text1.trim() || !text2.trim()) continue;
      
      const score = combinedSimilarity(text1, text2);
      
      if (score >= threshold) {
        pairs.push({
          index1: i,
          index2: j,
          sequence1: sub1.sequence,
          sequence2: sub2.sequence,
          text1,
          text2,
          similarity: Math.round(score * 10000) / 10000,
          suggestion: text1.length > text2.length ? text2 : text1
        });
      }
    }
  }
  
  pairs.sort((a, b) => b.similarity - a.similarity);
  
  return pairs;
}

function suggestCorrection(currentText, correctTexts) {
  if (!currentText || !correctTexts || correctTexts.length === 0) {
    return null;
  }
  
  const similar = findSimilar(currentText, correctTexts, 1);
  
  if (similar.length === 0 || similar[0].score < 0.5) {
    return null;
  }
  
  const bestMatch = similar[0];
  
  const findDifferences = (text1, text2) => {
    const chars1 = text1.split('');
    const chars2 = text2.split('');
    const differences = [];
    
    const minLen = Math.min(chars1.length, chars2.length);
    const maxLen = Math.max(chars1.length, chars2.length);
    
    for (let i = 0; i < maxLen; i++) {
      if (i >= minLen || chars1[i] !== chars2[i]) {
        differences.push({
          position: i,
          original: chars1[i] || '',
          suggested: chars2[i] || ''
        });
      }
    }
    
    return differences;
  };
  
  return {
    original: currentText,
    suggested: bestMatch.text,
    score: bestMatch.score,
    differences: findDifferences(currentText, bestMatch.text)
  };
}

module.exports = {
  levenshteinDistance,
  similarityScore,
  nGramSimilarity,
  combinedSimilarity,
  findSimilar,
  findSimilarPairs,
  suggestCorrection
};