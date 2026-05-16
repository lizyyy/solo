const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const { parseFile, resolveLink, generateAnchor } = require('./parser');

function levenshteinDistance(s1, s2) {
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;
  
  const matrix = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      const cost = s2[i - 1] === s1[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  return matrix[s2.length][s1.length];
}

function commonPrefixLength(s1, s2) {
  let i = 0;
  while (i < s1.length && i < s2.length && s1[i] === s2[i]) {
    i++;
  }
  return i;
}

function commonSuffixLength(s1, s2) {
  let i = 0;
  while (i < s1.length && i < s2.length && s1[s1.length - 1 - i] === s2[s2.length - 1 - i]) {
    i++;
  }
  return i;
}

function containsSubstring(s1, s2) {
  return s1.includes(s2) || s2.includes(s1);
}

function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().replace(/-/g, ' ');
  const s2 = str2.toLowerCase().replace(/-/g, ' ');
  
  if (s1 === s2) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  if (maxLength === 0) return 1;
  
  let similarity = 1 - (distance / maxLength);
  
  const prefixLen = commonPrefixLength(s1, s2);
  const suffixLen = commonSuffixLength(s1, s2);
  
  if (prefixLen >= 2) {
    similarity += prefixLen / maxLength * 0.2;
  }
  if (suffixLen >= 2) {
    similarity += suffixLen / maxLength * 0.1;
  }
  
  if (containsSubstring(s1, s2)) {
    similarity += 0.2;
  }
  
  return Math.min(similarity, 1);
}

function findBestAnchorMatch(brokenAnchor, availableAnchors) {
  const candidates = availableAnchors.map(anchor => {
    const anchorSimilarity = calculateSimilarity(brokenAnchor, anchor.anchor);
    const titleSimilarity = calculateSimilarity(brokenAnchor, anchor.title);
    const maxSimilarity = Math.max(anchorSimilarity, titleSimilarity);
    
    return {
      anchor,
      similarity: maxSimilarity,
      matchedBy: titleSimilarity > anchorSimilarity ? 'title' : 'anchor'
    };
  });
  
  candidates.sort((a, b) => b.similarity - a.similarity);
  
  if (candidates.length > 0 && candidates[0].similarity > 0.4) {
    return candidates[0];
  }
  
  return null;
}

async function findAllFiles(inputPath, pattern, excludePatterns) {
  const stats = fs.statSync(inputPath);
  
  if (stats.isFile()) {
    return [inputPath];
  }
  
  const files = await glob(pattern, {
    cwd: inputPath,
    absolute: true,
    ignore: excludePatterns.map(p => `**/${p}/**`).concat(excludePatterns)
  });
  
  return files;
}

async function analyzeLinks(files) {
  const parseResults = new Map();
  const allAnchors = new Map();
  
  for (const file of files) {
    try {
      const result = await parseFile(file);
      parseResults.set(file, result);
      
      result.anchors.forEach(anchor => {
        const fileAnchors = allAnchors.get(file) || [];
        fileAnchors.push(anchor);
        allAnchors.set(file, fileAnchors);
      });
    } catch (error) {
      console.error(`解析文件失败 ${file}:`, error.message);
    }
  }
  
  const brokenLinks = [];
  const validLinks = [];
  const unhandledLinks = [];
  
  for (const [file, result] of parseResults) {
    for (const link of result.links) {
      const { targetFile, targetAnchor } = resolveLink(file, link.url);
      
      if (!targetFile || !targetAnchor) {
        unhandledLinks.push({
          ...link,
          reason: '无法解析的链接格式',
          targetFile,
          targetAnchor
        });
        continue;
      }
      
      if (!fs.existsSync(targetFile)) {
        unhandledLinks.push({
          ...link,
          reason: '目标文件不存在',
          targetFile,
          targetAnchor
        });
        continue;
      }
      
      const fileAnchors = allAnchors.get(targetFile) || [];
      const foundAnchor = fileAnchors.find(a => a.anchor === targetAnchor);
      
      if (foundAnchor) {
        validLinks.push({
          ...link,
          targetFile,
          targetAnchor,
          targetTitle: foundAnchor.title
        });
      } else {
        const bestMatch = findBestAnchorMatch(targetAnchor, fileAnchors);
        
        brokenLinks.push({
          ...link,
          targetFile,
          targetAnchor,
          availableAnchors: fileAnchors.map(a => ({ anchor: a.anchor, title: a.title })),
          suggestedFix: bestMatch ? {
            newAnchor: bestMatch.anchor.anchor,
            newTitle: bestMatch.anchor.title,
            confidence: Math.round(bestMatch.similarity * 100)
          } : null
        });
      }
    }
  }
  
  return {
    files: Array.from(parseResults.keys()),
    parseResults: Object.fromEntries(parseResults),
    allAnchors: Object.fromEntries(allAnchors),
    validLinks,
    brokenLinks,
    unhandledLinks
  };
}

module.exports = {
  findAllFiles,
  analyzeLinks,
  calculateSimilarity
};
