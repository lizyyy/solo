const { SimilarityResult } = require('./models');

function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1.length < 2 || s2.length < 2) {
    return s1 === s2 ? 1 : 0;
  }

  const pairs1 = getBigrams(s1);
  const pairs2 = getBigrams(s2);

  const union = pairs1.size + pairs2.size;
  if (union === 0) return 0;

  let intersection = 0;
  for (const pair of pairs1) {
    if (pairs2.has(pair)) intersection++;
  }

  return (2.0 * intersection) / union;
}

function getBigrams(str) {
  const pairs = new Set();
  for (let i = 0; i < str.length - 1; i++) {
    pairs.add(str.substring(i, i + 2));
  }
  return pairs;
}

function calculateJaccard(set1, set2) {
  if (set1.size === 0 || set2.size === 0) return 0;
  
  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }
  
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

class SimilarityEngine {
  constructor() {
    this.weights = {
      errorCode: 0.35,
      stackTrace: 0.30,
      taskName: 0.20,
      context: 0.15
    };
  }

  calculateSimilarity(newFingerprint, storedEntry) {
    const reasons = [];
    let totalScore = 0;

    const storedFp = storedEntry.fingerprint;

    if (newFingerprint.errorCode && storedFp.errorCode) {
      if (newFingerprint.errorCode === storedFp.errorCode) {
        totalScore += this.weights.errorCode;
        reasons.push({
          type: 'errorCode',
          match: 'exact',
          value: newFingerprint.errorCode,
          description: `错误码完全匹配: ${newFingerprint.errorCode}`
        });
      } else {
        const codeSim = calculateStringSimilarity(
          newFingerprint.errorCode,
          storedFp.errorCode
        );
        if (codeSim > 0.5) {
          totalScore += this.weights.errorCode * codeSim;
          reasons.push({
            type: 'errorCode',
            match: 'partial',
            value: `${newFingerprint.errorCode} ~ ${storedFp.errorCode}`,
            similarity: codeSim,
            description: `错误码部分匹配 (${(codeSim * 100).toFixed(0)}%)`
          });
        }
      }
    }

    if (newFingerprint.stackSignature && storedFp.stackSignature) {
      if (newFingerprint.stackSignature === storedFp.stackSignature) {
        totalScore += this.weights.stackTrace;
        reasons.push({
          type: 'stackTrace',
          match: 'exact',
          description: '调用堆栈签名完全匹配'
        });
      } else {
        const newStackLines = new Set(newFingerprint.stackSignature.split('|'));
        const storedStackLines = new Set(storedFp.stackSignature.split('|'));
        const stackSim = calculateJaccard(newStackLines, storedStackLines);
        
        if (stackSim > 0.3) {
          totalScore += this.weights.stackTrace * stackSim;
          reasons.push({
            type: 'stackTrace',
            match: 'partial',
            similarity: stackSim,
            description: `堆栈片段相似 (${(stackSim * 100).toFixed(0)}%)`
          });
        }
      }
    }

    if (newFingerprint.taskName && storedFp.taskName) {
      if (newFingerprint.taskName === storedFp.taskName) {
        totalScore += this.weights.taskName;
        reasons.push({
          type: 'taskName',
          match: 'exact',
          value: newFingerprint.taskName,
          description: `任务名完全匹配: ${newFingerprint.taskName}`
        });
      } else {
        const taskSim = calculateStringSimilarity(
          newFingerprint.taskName,
          storedFp.taskName
        );
        if (taskSim > 0.6) {
          totalScore += this.weights.taskName * taskSim;
          reasons.push({
            type: 'taskName',
            match: 'partial',
            value: `${newFingerprint.taskName} ~ ${storedFp.taskName}`,
            similarity: taskSim,
            description: `任务上下文相似 (${(taskSim * 100).toFixed(0)}%)`
          });
        }
      }
    }

    if (newFingerprint.contextHash && storedFp.contextHash) {
      if (newFingerprint.contextHash === storedFp.contextHash) {
        totalScore += this.weights.context;
        reasons.push({
          type: 'context',
          match: 'exact',
          description: '任务上下文完全匹配'
        });
      }
    }

    return {
      similarity: Math.min(1, totalScore),
      reasons
    };
  }

  findSimilar(newFingerprint, entries, threshold = 0.2) {
    const results = [];

    for (const entry of entries) {
      const { similarity, reasons } = this.calculateSimilarity(newFingerprint, entry);
      
      if (similarity >= threshold) {
        results.push(new SimilarityResult(entry, similarity, reasons));
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  findExactMatch(fingerprintHash, entries) {
    return entries.find(e => e.fingerprintHash === fingerprintHash);
  }
}

module.exports = {
  SimilarityEngine,
  calculateStringSimilarity,
  calculateJaccard
};
