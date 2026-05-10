const RECENCY_WEIGHTS = {
  'within_7_days': 1.5,
  'within_30_days': 1.2,
  'within_90_days': 1.0,
  'older': 0.5
};

function getRecencyLevel(daysAgo) {
  if (daysAgo <= 7) return 'within_7_days';
  if (daysAgo <= 30) return 'within_30_days';
  if (daysAgo <= 90) return 'within_90_days';
  return 'older';
}

function validateBorrowingHistory(history) {
  const result = { valid: true, errors: [], warnings: [], validatedRecords: [] };
  
  if (!history || history.length === 0) {
    result.warnings.push({
      code: 'HISTORY_EMPTY',
      message: '无借阅历史记录',
      suggestion: '有借阅历史可以获得更个性化的推荐',
      field: 'borrowingHistory'
    });
    return result;
  }
  
  history.forEach((record, index) => {
    const recordErrors = [];
    const recordWarnings = [];
    
    if (!record.bookId) {
      recordErrors.push({
        code: 'MISSING_BOOK_ID',
        message: `第${index + 1}条记录缺少书籍ID`,
        field: `borrowingHistory[${index}].bookId`
      });
    }
    
    if (!record.borrowDate) {
      recordErrors.push({
        code: 'MISSING_BORROW_DATE',
        message: `第${index + 1}条记录缺少借阅日期`,
        field: `borrowingHistory[${index}].borrowDate`
      });
    } else {
      const date = new Date(record.borrowDate);
      if (isNaN(date.getTime())) {
        recordErrors.push({
          code: 'INVALID_DATE',
          message: `第${index + 1}条记录日期格式错误：${record.borrowDate}`,
          field: `borrowingHistory[${index}].borrowDate`,
          value: record.borrowDate
        });
      }
    }
    
    if (record.rating !== undefined) {
      if (typeof record.rating !== 'number' || record.rating < 1 || record.rating > 5) {
        recordWarnings.push({
          code: 'INVALID_RATING',
          message: `评分应为1-5的数字，实际：${record.rating}`,
          field: `borrowingHistory[${index}].rating`,
          value: record.rating
        });
      }
    }
    
    if (recordErrors.length > 0) {
      result.errors.push(...recordErrors);
      result.warnings.push({
        code: 'RECORD_SKIPPED',
        message: `第${index + 1}条借阅记录因错误将被跳过`,
        field: `borrowingHistory[${index}]`,
        value: record
      });
    } else {
      result.validatedRecords.push({
        ...record,
        warnings: recordWarnings
      });
    }
  });
  
  if (result.validatedRecords.length === 0 && history.length > 0) {
    result.valid = false;
    result.errors.push({
      code: 'ALL_RECORDS_INVALID',
      message: '所有借阅记录都无效',
      suggestion: '请检查借阅记录格式',
      field: 'borrowingHistory'
    });
  }
  
  return result;
}

function analyzeBorrowingPatterns(validatedHistory, allBooks, trace) {
  const result = {
    themeFrequency: {},
    recentThemes: [],
    dislikedThemes: [],
    preferredDifficulty: null,
    averageRating: null,
    trace: []
  };
  
  if (!validatedHistory || validatedHistory.length === 0) {
    result.trace.push({
      step: 'pattern_analysis',
      status: 'skipped',
      reason: '无有效借阅历史，跳过模式分析'
    });
    return result;
  }
  
  const now = new Date();
  const ratedRecords = validatedHistory.filter(r => r.rating !== undefined);
  
  if (ratedRecords.length > 0) {
    result.averageRating = ratedRecords.reduce((sum, r) => sum + r.rating, 0) / ratedRecords.length;
  }
  
  validatedHistory.forEach(record => {
    const borrowDate = new Date(record.borrowDate);
    const daysAgo = Math.floor((now - borrowDate) / (1000 * 60 * 60 * 24));
    const recencyLevel = getRecencyLevel(daysAgo);
    const weight = RECENCY_WEIGHTS[recencyLevel];
    
    const book = allBooks.find(b => b.id === record.bookId);
    if (!book) {
      result.trace.push({
        step: 'pattern_analysis',
        record,
        status: 'book_not_found',
        reason: `书籍ID ${record.bookId} 不在库中`
      });
      return;
    }
    
    book.themes.forEach(theme => {
      if (!result.themeFrequency[theme]) {
        result.themeFrequency[theme] = { count: 0, weightedCount: 0, ratings: [] };
      }
      result.themeFrequency[theme].count++;
      result.themeFrequency[theme].weightedCount += weight;
      if (record.rating) {
        result.themeFrequency[theme].ratings.push(record.rating);
      }
    });
    
    if (daysAgo <= 30) {
      result.recentThemes.push(...book.themes);
    }
    
    if (record.rating && record.rating <= 2) {
      result.dislikedThemes.push(...book.themes);
    }
    
    result.trace.push({
      step: 'pattern_analysis',
      bookId: record.bookId,
      bookTitle: book.title,
      borrowDate: record.borrowDate,
      daysAgo,
      recencyLevel,
      recencyWeight: weight,
      themes: book.themes,
      rating: record.rating,
      status: 'analyzed'
    });
  });
  
  result.dislikedThemes = [...new Set(result.dislikedThemes)];
  result.recentThemes = [...new Set(result.recentThemes)];
  
  return result;
}

function applyHistoryBoost(books, patterns, trace) {
  const result = { books: [], trace: [] };
  
  if (!patterns || Object.keys(patterns.themeFrequency).length === 0) {
    result.books = books;
    result.trace.push({
      step: 'history_boost',
      status: 'skipped',
      reason: '无借阅模式可应用，跳过历史加权'
    });
    return result;
  }
  
  books.forEach(book => {
    let historyScore = 1.0;
    const historyMatches = [];
    
    book.themes.forEach(theme => {
      const pattern = patterns.themeFrequency[theme];
      if (pattern) {
        historyScore *= (1 + pattern.weightedCount * 0.1);
        historyMatches.push({
          theme,
          borrowCount: pattern.count,
          weightedBoost: `+${(pattern.weightedCount * 10).toFixed(0)}%`
        });
      }
    });
    
    if (patterns.dislikedThemes.some(t => book.themes.includes(t))) {
      historyScore *= 0.5;
      historyMatches.push({
        type: 'disliked_theme_penalty',
        themes: book.themes.filter(t => patterns.dislikedThemes.includes(t)),
        penalty: 'x0.5'
      });
    }
    
    if (patterns.recentThemes.some(t => book.themes.includes(t))) {
      historyScore *= 1.1;
      historyMatches.push({
        type: 'recent_theme_boost',
        themes: book.themes.filter(t => patterns.recentThemes.includes(t)),
        boost: 'x1.1'
      });
    }
    
    result.books.push({
      ...book,
      historyScore,
      historyMatches
    });
    
    result.trace.push({
      step: 'history_boost',
      bookId: book.id,
      bookTitle: book.title,
      historyMatches,
      historyScore: historyScore.toFixed(2),
      status: historyScore !== 1 ? 'adjusted' : 'no_change'
    });
  });
  
  return result;
}

module.exports = {
  RECENCY_WEIGHTS,
  getRecencyLevel,
  validateBorrowingHistory,
  analyzeBorrowingPatterns,
  applyHistoryBoost
};
