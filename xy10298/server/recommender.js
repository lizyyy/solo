const BOOKS = require('./data/books');
const { getAgeTier, validateAge, applyAgeFilter } = require('./rules/age-rules');
const { validateParentGoals, applyGoalBoost, getGoalSuggestions } = require('./rules/parent-goal-rules');
const { validateBorrowingHistory, analyzeBorrowingPatterns, applyHistoryBoost } = require('./rules/borrowing-rules');
const { validateThemes, THEMES } = require('./rules/theme-rules');

function createBusinessState() {
  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    version: '1.0',
    stages: {
      input_validation: { status: 'pending', data: null, errors: [], warnings: [] },
      age_analysis: { status: 'pending', data: null, errors: [], warnings: [] },
      goal_analysis: { status: 'pending', data: null, errors: [], warnings: [] },
      history_analysis: { status: 'pending', data: null, errors: [], warnings: [] },
      recommendation: { status: 'pending', data: null, errors: [], warnings: [] }
    },
    currentStage: null,
    blockedAt: null,
    blockReason: null,
    suggestions: [],
    trace: [],
    issues: [],
    finalRecommendations: null
  };
}

function generateId() {
  return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function validateInput(input) {
  const state = createBusinessState();
  const validationStage = state.stages.input_validation;
  
  validationStage.status = 'in_progress';
  state.currentStage = 'input_validation';
  
  const errors = [];
  const warnings = [];
  const issues = [];
  
  const ageResult = validateAge(input.childAge);
  errors.push(...ageResult.errors);
  warnings.push(...ageResult.warnings);
  
  ageResult.errors.forEach(e => issues.push({
    type: 'error',
    category: 'age_validation',
    ...e,
    source: 'input.childAge'
  }));
  
  ageResult.warnings.forEach(w => issues.push({
    type: 'warning',
    category: 'age_validation',
    ...w,
    source: 'input.childAge'
  }));
  
  const goalsResult = validateParentGoals(input.parentGoals);
  errors.push(...goalsResult.errors);
  warnings.push(...goalsResult.warnings);
  
  goalsResult.errors.forEach(e => issues.push({
    type: 'error',
    category: 'goal_validation',
    ...e,
    source: 'input.parentGoals'
  }));
  
  goalsResult.warnings.forEach(w => issues.push({
    type: 'warning',
    category: 'goal_validation',
    ...w,
    source: 'input.parentGoals'
  }));
  
  const historyResult = validateBorrowingHistory(input.borrowingHistory);
  errors.push(...historyResult.errors);
  warnings.push(...historyResult.warnings);
  
  historyResult.errors.forEach(e => issues.push({
    type: 'error',
    category: 'history_validation',
    ...e,
    source: 'input.borrowingHistory'
  }));
  
  historyResult.warnings.forEach(w => issues.push({
    type: 'warning',
    category: 'history_validation',
    ...w,
    source: 'input.borrowingHistory'
  }));
  
  validationStage.data = {
    originalInput: input,
    ageValidation: ageResult,
    goalsValidation: goalsResult,
    historyValidation: historyResult
  };
  
  validationStage.errors = errors;
  validationStage.warnings = warnings;
  state.issues = issues;
  state.trace.push({
    step: 'input_validation',
    timestamp: new Date().toISOString(),
    input: input,
    errorsCount: errors.length,
    warningsCount: warnings.length,
    issuesCount: issues.length
  });
  
  if (errors.length > 0) {
    validationStage.status = 'blocked';
    state.blockedAt = 'input_validation';
    state.blockReason = '输入验证失败，存在必须修复的错误';
    state.suggestions = errors.map(e => e.suggestion).filter(Boolean);
    return { success: false, state };
  }
  
  validationStage.status = 'completed';
  return { success: true, state, validatedData: {
    age: input.childAge,
    ageTier: getAgeTier(input.childAge),
    parentGoals: goalsResult.normalizedGoals,
    borrowingHistory: historyResult.validatedRecords
  }};
}

function generateRecommendations(input) {
  const { success: inputValid, state, validatedData } = validateInput(input);
  
  if (!inputValid) {
    return state;
  }
  
  const ageStage = state.stages.age_analysis;
  ageStage.status = 'in_progress';
  state.currentStage = 'age_analysis';
  
  const ageTier = validatedData.ageTier;
  if (!ageTier) {
    ageStage.status = 'blocked';
    state.blockedAt = 'age_analysis';
    state.blockReason = '无法确定年龄分层，可能年龄超出0-12岁范围';
    state.suggestions.push('请输入0-12岁之间的年龄');
    return state;
  }
  
  const ageFilterResult = applyAgeFilter(BOOKS, ageTier);
  ageStage.data = {
    ageTier,
    ageScoreApplied: true,
    booksAfterAgeFilter: ageFilterResult.books.length,
    ageTrace: ageFilterResult.trace
  };
  ageStage.status = 'completed';
  state.trace.push(...ageFilterResult.trace);
  
  const goalStage = state.stages.goal_analysis;
  goalStage.status = 'in_progress';
  state.currentStage = 'goal_analysis';
  
  const goalBoostResult = applyGoalBoost(ageFilterResult.books, validatedData.parentGoals);
  goalStage.data = {
    parentGoals: validatedData.parentGoals,
    goalsApplied: validatedData.parentGoals.length > 0,
    goalSuggestions: getGoalSuggestions(ageTier),
    booksAfterGoalBoost: goalBoostResult.books.length,
    goalTrace: goalBoostResult.trace
  };
  goalStage.status = 'completed';
  state.trace.push(...goalBoostResult.trace);
  
  const historyStage = state.stages.history_analysis;
  historyStage.status = 'in_progress';
  state.currentStage = 'history_analysis';
  
  const patterns = analyzeBorrowingPatterns(validatedData.borrowingHistory, BOOKS);
  const historyBoostResult = applyHistoryBoost(goalBoostResult.books, patterns);
  
  historyStage.data = {
    borrowingHistory: validatedData.borrowingHistory,
    patterns,
    historyApplied: validatedData.borrowingHistory.length > 0,
    booksAfterHistoryBoost: historyBoostResult.books.length,
    historyTrace: historyBoostResult.trace,
    patternTrace: patterns.trace
  };
  historyStage.status = 'completed';
  state.trace.push(...historyBoostResult.trace);
  state.trace.push(...patterns.trace);
  
  const recStage = state.stages.recommendation;
  recStage.status = 'in_progress';
  state.currentStage = 'recommendation';
  
  const scoredBooks = historyBoostResult.books.map(book => {
    const ageScore = book.ageScore || 0;
    const goalScore = book.goalScore || 1;
    const historyScore = book.historyScore || 1;
    
    const totalScore = ageScore * goalScore * historyScore;
    
    return {
      ...book,
      finalScore: totalScore,
      scoreBreakdown: {
        age: ageScore,
        goal: goalScore,
        history: historyScore,
        total: totalScore
      }
    };
  });
  
  scoredBooks.sort((a, b) => b.finalScore - a.finalScore);
  
  const topBooks = scoredBooks.slice(0, 8);
  const themeGroups = groupByTheme(topBooks, ageTier, validatedData.parentGoals);
  
  recStage.data = {
    allScoredBooks: scoredBooks.length,
    topBooksCount: topBooks.length,
    themeGroups
  };
  recStage.status = 'completed';
  state.currentStage = 'completed';
  
  state.finalRecommendations = {
    generatedAt: new Date().toISOString(),
    summary: {
      ageTier: ageTier.name,
      parentGoals: validatedData.parentGoals.map(g => g.name),
      borrowingHistoryCount: validatedData.borrowingHistory.length,
      totalBooks: BOOKS.length,
      recommendedBooks: topBooks.length
    },
    themeGroups,
    recommendations: topBooks.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      themes: book.themes,
      ageRange: book.ageRange,
      pages: book.pages,
      difficulty: book.difficulty,
      description: book.description,
      finalScore: book.finalScore.toFixed(3),
      scoreBreakdown: {
        ageMatch: book.ageScore ? `${(book.ageScore * 100).toFixed(0)}%` : 'N/A',
        goalBoost: book.goalScore ? `x${book.goalScore.toFixed(2)}` : 'N/A',
        historyBoost: book.historyScore ? `x${book.historyScore.toFixed(2)}` : 'N/A',
        ageTierMatch: book.ageTierMatch,
        matchedThemes: book.matchedThemes || [],
        goalMatches: book.goalMatches || [],
        historyMatches: book.historyMatches || []
      },
      whyRecommended: generateWhyRecommended(book, ageTier, validatedData.parentGoals)
    })),
    trace: state.trace
  };
  
  state.suggestions = generateSuggestions(state, ageTier, validatedData.parentGoals, patterns);
  
  return state;
}

function groupByTheme(books, ageTier, parentGoals) {
  const primaryThemes = new Set();
  
  ageTier.suitableThemes.forEach(t => primaryThemes.add(t));
  parentGoals.forEach(g => {
    Object.keys(g.targetThemes || {}).forEach(t => primaryThemes.add(t));
  });
  
  const groups = {};
  
  books.forEach(book => {
    book.themes.forEach(theme => {
      if (primaryThemes.has(theme)) {
        if (!groups[theme]) {
          groups[theme] = {
            theme,
            description: THEMES[theme]?.description || '',
            books: [],
            relevance: 'primary'
          };
        }
        if (!groups[theme].books.find(b => b.id === book.id)) {
          groups[theme].books.push(book);
        }
      }
    });
  });
  
  return Object.values(groups).sort((a, b) => b.books.length - a.books.length);
}

function generateWhyRecommended(book, ageTier, parentGoals) {
  const reasons = [];
  
  if (book.matchedThemes && book.matchedThemes.length > 0) {
    reasons.push(`适合${ageTier.name}的主题：${book.matchedThemes.join('、')}`);
  }
  
  if (book.goalMatches && book.goalMatches.length > 0) {
    const goalReasons = book.goalMatches
      .filter(m => m.goal)
      .map(m => `符合"${m.goal}"目标的${m.theme}主题`);
    reasons.push(...new Set(goalReasons));
  }
  
  if (book.historyMatches && book.historyMatches.length > 0) {
    const historyReasons = book.historyMatches.map(m => {
      if (m.type === 'recent_theme_boost') return '近期关注主题';
      if (m.type === 'disliked_theme_penalty') return '（非偏好主题）';
      if (m.borrowCount) return `曾借阅${m.borrowCount}本同主题书籍`;
      return '历史借阅相关';
    });
    reasons.push(...new Set(historyReasons));
  }
  
  return reasons.length > 0 ? reasons : ['综合评分推荐'];
}

function generateSuggestions(state, ageTier, parentGoals, patterns) {
  const suggestions = [];
  
  if (parentGoals.length === 0) {
    const suggestedGoals = getGoalSuggestions(ageTier).slice(0, 3);
    suggestions.push({
      type: 'goal_suggestion',
      priority: 'medium',
      title: '建议选择发展目标',
      message: `根据${ageTier.name}，建议重点关注：${suggestedGoals.map(g => g.name).join('、')}`,
      action: '选择家长目标'
    });
  }
  
  if (patterns && Object.keys(patterns.themeFrequency).length < 3) {
    suggestions.push({
      type: 'history_suggestion',
      priority: 'low',
      title: '增加借阅历史',
      message: '更多借阅记录可以让推荐更个性化',
      action: '补充借阅历史'
    });
  }
  
  if (patterns && patterns.dislikedThemes && patterns.dislikedThemes.length > 0) {
    suggestions.push({
      type: 'preference_suggestion',
      priority: 'medium',
      title: '已记录非偏好主题',
      message: `根据低评分记录，以下主题已降低权重：${patterns.dislikedThemes.join('、')}`,
      action: '可继续反馈评分'
    });
  }
  
  return suggestions;
}

module.exports = {
  createBusinessState,
  validateInput,
  generateRecommendations,
  BOOKS
};
