const db = require('./database');

const CATEGORIES = {
  AVAILABLE: 'available',
  NEED_DISINFECT: 'need_disinfect',
  DAMAGED: 'damaged',
  SUSPICIOUS: 'suspicious'
};

const CATEGORY_NAMES = {
  available: '可上架',
  need_disinfect: '需消毒',
  damaged: '破损待处理',
  suspicious: '疑似盗版/缺页',
  pending: '待审核'
};

const RULES = {
  keywords: {
    damaged: ['破损', '撕裂', '划痕', '污渍', '泡水', '霉斑', '缺页', '掉页', '脱胶', '散页'],
    suspicious: ['盗版', '影印', '扫描', '无ISBN', 'ISBN不一致', '印刷模糊', '纸张劣质', '缺扉页', '版权页缺失'],
    need_disinfect: ['水渍', '霉味', '异味', '蟑螂', '书虫', '霉菌', '潮湿', '污渍', '陈旧', '泛黄']
  },
  thresholds: {
    damaged_confidence: 0.6,
    suspicious_confidence: 0.5,
    need_disinfect_confidence: 0.4
  }
};

const checkKeywords = (text, keywords) => {
  if (!text) return { matches: [], count: 0 };
  const lowerText = text.toLowerCase();
  const matches = keywords.filter(kw => lowerText.includes(kw.toLowerCase()));
  return { matches, count: matches.length };
};

const analyzeDamageNote = (damageNote) => {
  const results = {
    category: null,
    reason: '',
    confidence: 0,
    risks: []
  };

  if (!damageNote || damageNote.trim() === '') {
    return results;
  }

  const damagedResult = checkKeywords(damageNote, RULES.keywords.damaged);
  const suspiciousResult = checkKeywords(damageNote, RULES.keywords.suspicious);
  const disinfectResult = checkKeywords(damageNote, RULES.keywords.need_disinfect);

  if (damagedResult.count > 0) {
    results.risks.push({
      type: 'damaged',
      detail: `检测到破损关键词: ${damagedResult.matches.join(', ')}`,
      confidence: Math.min(1, damagedResult.count * 0.2 + 0.3)
    });
  }

  if (suspiciousResult.count > 0) {
    results.risks.push({
      type: 'suspicious',
      detail: `检测到盗版/缺页关键词: ${suspiciousResult.matches.join(', ')}`,
      confidence: Math.min(1, suspiciousResult.count * 0.25 + 0.4)
    });
  }

  if (disinfectResult.count > 0) {
    results.risks.push({
      type: 'need_disinfect',
      detail: `检测到需消毒关键词: ${disinfectResult.matches.join(', ')}`,
      confidence: Math.min(1, disinfectResult.count * 0.15 + 0.2)
    });
  }

  if (results.risks.length > 0) {
    results.risks.sort((a, b) => b.confidence - a.confidence);
    const highestRisk = results.risks[0];
    results.category = highestRisk.type;
    results.reason = highestRisk.detail;
    results.confidence = highestRisk.confidence;
  }

  return results;
};

const analyzeISBN = (isbn) => {
  const results = {
    category: null,
    reason: '',
    confidence: 0,
    risks: []
  };

  if (!isbn || isbn.trim() === '') {
    results.risks.push({
      type: 'suspicious',
      detail: '书籍缺少ISBN号，疑似盗版或非正式出版物',
      confidence: 0.7
    });
    results.category = 'suspicious';
    results.reason = '书籍缺少ISBN号';
    results.confidence = 0.7;
    return results;
  }

  const cleanISBN = isbn.replace(/[- ]/g, '');
  
  if (cleanISBN.length !== 10 && cleanISBN.length !== 13) {
    results.risks.push({
      type: 'suspicious',
      detail: `ISBN长度异常，应为10或13位，实际为${cleanISBN.length}位`,
      confidence: 0.6
    });
    results.category = 'suspicious';
    results.reason = `ISBN长度异常 (${cleanISBN.length}位)`;
    results.confidence = 0.6;
  }

  if (cleanISBN.length === 13) {
    const isValidISBN13 = (isbnStr) => {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const digit = parseInt(isbnStr[i], 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      return checkDigit === parseInt(isbnStr[12], 10);
    };

    if (!isValidISBN13(cleanISBN)) {
      results.risks.push({
        type: 'suspicious',
        detail: 'ISBN-13校验码不正确，可能是伪造的ISBN',
        confidence: 0.65
      });
      results.category = 'suspicious';
      results.reason = 'ISBN校验码不正确';
      results.confidence = 0.65;
    }
  }

  return results;
};

const analyzeAppointment = (appointment) => {
  const results = {
    category: null,
    reason: '',
    confidence: 0,
    risks: []
  };

  if (!appointment) {
    return results;
  }

  if (appointment.notes) {
    const noteAnalysis = analyzeDamageNote(appointment.notes);
    if (noteAnalysis.risks.length > 0) {
      results.risks = noteAnalysis.risks;
      if (noteAnalysis.category) {
        results.category = noteAnalysis.category;
        results.reason = noteAnalysis.reason;
        results.confidence = noteAnalysis.confidence;
      }
    }
  }

  return results;
};

const aggregateAnalysis = (analyses) => {
  const allRisks = [];
  
  analyses.forEach(analysis => {
    if (analysis.risks && analysis.risks.length > 0) {
      allRisks.push(...analysis.risks);
    }
  });

  if (allRisks.length === 0) {
    return {
      category: CATEGORIES.AVAILABLE,
      reason: '未检测到任何风险项，书籍状态良好',
      confidence: 0.95,
      risks: []
    };
  }

  const riskGroups = {};
  allRisks.forEach(risk => {
    if (!riskGroups[risk.type]) {
      riskGroups[risk.type] = {
        type: risk.type,
        totalConfidence: 0,
        count: 0,
        details: []
      };
    }
    riskGroups[risk.type].totalConfidence += risk.confidence;
    riskGroups[risk.type].count++;
    riskGroups[risk.type].details.push(risk.detail);
  });

  const riskSummary = Object.values(riskGroups).map(group => ({
    type: group.type,
    avgConfidence: group.totalConfidence / group.count,
    details: group.details.join('; ')
  }));

  riskSummary.sort((a, b) => b.avgConfidence - a.avgConfidence);

  const highestRisk = riskSummary[0];
  
  return {
    category: highestRisk.type,
    reason: highestRisk.details,
    confidence: highestRisk.avgConfidence,
    risks: riskSummary
  };
};

const runScreening = async (bookId) => {
  const book = await db.getBookById(bookId);
  if (!book) {
    throw new Error(`书籍ID ${bookId} 不存在`);
  }

  const analyses = [];

  if (book.damage_note) {
    analyses.push(analyzeDamageNote(book.damage_note));
  }

  if (book.isbn) {
    analyses.push(analyzeISBN(book.isbn));
  }

  const appointment = book.requester_name ? { notes: book.appointment_info } : null;
  if (appointment) {
    analyses.push(analyzeAppointment(appointment));
  }

  const finalAnalysis = aggregateAnalysis(analyses);

  await db.addRiskReason(
    bookId,
    finalAnalysis.category,
    finalAnalysis.reason,
    finalAnalysis.confidence
  );

  finalAnalysis.risks.forEach(async (risk) => {
    if (risk.type !== finalAnalysis.category) {
      await db.addRiskReason(
        bookId,
        risk.type,
        risk.details,
        risk.avgConfidence
      );
    }
  });

  await db.updateBook(bookId, {
    ai_category: finalAnalysis.category,
    ai_reason: finalAnalysis.reason,
    ai_confidence: finalAnalysis.confidence
  });

  await db.addAuditLog({
    book_id: bookId,
    action: 'ai_screening',
    old_category: book.ai_category,
    new_category: finalAnalysis.category,
    old_reason: book.ai_reason,
    new_reason: finalAnalysis.reason,
    operator: 'system'
  });

  return {
    bookId,
    category: finalAnalysis.category,
    categoryName: CATEGORY_NAMES[finalAnalysis.category],
    reason: finalAnalysis.reason,
    confidence: finalAnalysis.confidence
  };
};

const runBatchScreening = async (batchId) => {
  const books = await db.getBooksByBatch(batchId);
  const results = [];

  for (const book of books) {
    try {
      const result = await runScreening(book.id);
      results.push(result);
    } catch (error) {
      console.error(`筛选书籍ID ${book.id} 失败:`, error);
      results.push({
        bookId: book.id,
        category: 'error',
        categoryName: '错误',
        reason: `筛选失败: ${error.message}`,
        confidence: 0
      });
    }
  }

  return results;
};

const getCategoryName = (category) => {
  return CATEGORY_NAMES[category] || category;
};

module.exports = {
  CATEGORIES,
  CATEGORY_NAMES,
  runScreening,
  runBatchScreening,
  getCategoryName
};
