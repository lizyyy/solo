function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function categoryScore(lostCategory, foundCategory) {
  if (!lostCategory || !foundCategory) return 0.5;
  return lostCategory === foundCategory ? 1 : 0;
}

function colorScore(lostColor, foundColor) {
  if (!lostColor || !foundColor) return 0.5;
  const lostColors = new Set(lostColor.split(','));
  const foundColors = new Set(foundColor.split(','));
  const intersection = new Set([...lostColors].filter(x => foundColors.has(x)));
  return intersection.size > 0 ? 0.8 : 0.2;
}

function lineScore(lostLine, foundLine) {
  if (!lostLine || !foundLine) return 0.5;
  const lostLines = new Set(lostLine.split(','));
  const foundLines = new Set(foundLine.split(','));
  const intersection = new Set([...lostLines].filter(x => foundLines.has(x)));
  return intersection.size > 0 ? 1 : 0.3;
}

function stationScore(lostStation, foundStation) {
  if (!lostStation || !foundStation) return 0.5;
  const lostStations = new Set(lostStation.split(','));
  const foundStations = new Set(foundStation.split(','));
  const intersection = new Set([...lostStations].filter(x => foundStations.has(x)));
  return intersection.size > 0 ? 0.9 : 0.4;
}

function dateScore(lostDate, foundDate) {
  if (!lostDate || !foundDate) return 0.5;
  if (lostDate === foundDate) return 1;
  
  const lost = new Date(lostDate);
  const found = new Date(foundDate);
  const diffDays = Math.abs((found - lost) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 1) return 0.8;
  if (diffDays <= 3) return 0.6;
  if (diffDays <= 7) return 0.4;
  return 0.2;
}

function timeScore(lostTime, foundTime) {
  if (!lostTime || !foundTime) return 0.5;
  
  const [lostH, lostM] = lostTime.split(':').map(Number);
  const [foundH, foundM] = foundTime.split(':').map(Number);
  
  const lostMinutes = lostH * 60 + lostM;
  const foundMinutes = foundH * 60 + foundM;
  
  const diffMinutes = Math.abs(foundMinutes - lostMinutes);
  
  if (diffMinutes <= 30) return 1;
  if (diffMinutes <= 60) return 0.8;
  if (diffMinutes <= 120) return 0.6;
  if (diffMinutes <= 240) return 0.4;
  return 0.2;
}

function calculateMatchScore(lostItem, foundItem) {
  const weights = {
    category: 0.25,
    color: 0.15,
    description: 0.30,
    line: 0.10,
    station: 0.10,
    date: 0.06,
    time: 0.04
  };
  
  const scores = {
    category: categoryScore(lostItem.item_category, foundItem.item_category),
    color: colorScore(lostItem.item_color, foundItem.item_color),
    description: jaccardSimilarity(
      new Set(lostItem.tokens || []),
      new Set(foundItem.tokens || [])
    ),
    line: lineScore(lostItem.lost_line, foundItem.found_line),
    station: stationScore(lostItem.lost_station, foundItem.found_station),
    date: dateScore(lostItem.lost_date, foundItem.found_date),
    time: timeScore(lostItem.lost_time, foundItem.found_time)
  };
  
  let totalScore = 0;
  for (const [key, weight] of Object.entries(weights)) {
    totalScore += scores[key] * weight;
  }
  
  return {
    score: Math.round(totalScore * 10000) / 100,
    breakdown: scores,
    weights
  };
}

function determineConfidence(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function getProcessingSuggestion(matchResult) {
  const { score, breakdown } = matchResult;
  const suggestions = [];
  
  if (breakdown.category === 0) {
    suggestions.push('物品分类不一致，请人工核对是否属于同一大类');
  }
  if (breakdown.description < 0.3) {
    suggestions.push('描述文本相似度较低，建议人工交叉验证关键字');
  }
  if (breakdown.line === 0.3) {
    suggestions.push('地铁线路不匹配，请确认失主是否记错线路');
  }
  if (breakdown.station === 0.4) {
    suggestions.push('站点信息不匹配，可能是换乘或相邻站点');
  }
  if (breakdown.date <= 0.4) {
    suggestions.push('时间跨度较大，请确认日期信息准确性');
  }
  if (score < 50) {
    suggestions.push('综合匹配度偏低，建议谨慎确认或等待更多数据');
  } else if (score >= 80) {
    suggestions.push('匹配度较高，可以优先联系双方确认');
  }
  
  return suggestions.length > 0 ? suggestions : ['匹配正常，可进入人工确认环节'];
}

function matchItems(lostItems, foundItems, options = {}) {
  const { minScore = 30, topN = 5 } = options;
  const results = [];
  
  for (const lost of lostItems) {
    const lostWithTokens = {
      ...lost,
      tokens: lost.tokens || []
    };
    
    const matches = [];
    
    for (const found of foundItems) {
      const foundWithTokens = {
        ...found,
        tokens: found.tokens || []
      };
      
      const result = calculateMatchScore(lostWithTokens, foundWithTokens);
      
      if (result.score >= minScore) {
        matches.push({
          lost_id: lost.id,
          found_id: found.id,
          score: result.score,
          confidence: determineConfidence(result.score),
          breakdown: result.breakdown,
          suggestions: getProcessingSuggestion(result)
        });
      }
    }
    
    matches.sort((a, b) => b.score - a.score);
    
    results.push({
      lost_id: lost.id,
      description: lost.description,
      matches: matches.slice(0, topN)
    });
  }
  
  return results;
}

export {
  calculateMatchScore,
  determineConfidence,
  getProcessingSuggestion,
  matchItems,
  jaccardSimilarity
};
