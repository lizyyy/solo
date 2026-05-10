const PARENT_GOALS = {
  'language_development': {
    name: '语言发展',
    description: '提升孩子的语言表达和理解能力',
    priority: 10,
    targetThemes: {
      '故事童话': 1.5,
      '亲子互动': 1.3,
      '想象力': 1.2
    },
    keywordBoost: ['对话', '叙述', '词汇', '表达']
  },
  'emotional_management': {
    name: '情绪管理',
    description: '帮助孩子认识和管理自己的情绪',
    priority: 10,
    targetThemes: {
      '情绪管理': 1.8,
      '情绪安抚': 1.5,
      '品格塑造': 1.2
    },
    keywordBoost: ['情绪', '感受', '生气', '开心', '难过']
  },
  'social_skills': {
    name: '社交能力',
    description: '培养孩子的人际交往和合作能力',
    priority: 9,
    targetThemes: {
      '社交友谊': 1.6,
      '生活习惯': 1.2,
      '品格塑造': 1.3
    },
    keywordBoost: ['朋友', '分享', '合作', '礼貌']
  },
  'cognitive_development': {
    name: '认知发展',
    description: '促进孩子的思维和认知能力',
    priority: 9,
    targetThemes: {
      '认知启蒙': 1.7,
      '逻辑思维': 1.5,
      '科普知识': 1.3
    },
    keywordBoost: ['认知', '思考', '逻辑', '问题解决']
  },
  'knowledge_expansion': {
    name: '知识拓展',
    description: '扩展孩子的知识面和视野',
    priority: 8,
    targetThemes: {
      '科普知识': 1.8,
      '历史文化': 1.5,
      '自然科学': 1.4,
      '动物认知': 1.2
    },
    keywordBoost: ['科学', '历史', '自然', '宇宙', '动物']
  },
  'reading_habit': {
    name: '阅读习惯培养',
    description: '让孩子爱上阅读，养成良好习惯',
    priority: 10,
    targetThemes: {
      '故事童话': 1.3,
      '冒险故事': 1.3,
      '想象力': 1.2,
      '桥梁书': 1.4
    },
    keywordBoost: ['有趣', '冒险', '探索', '好奇']
  },
  'character_building': {
    name: '品格塑造',
    description: '培养孩子优秀的品德和价值观',
    priority: 9,
    targetThemes: {
      '品格塑造': 1.8,
      '成长励志': 1.5,
      '历史传记': 1.3
    },
    keywordBoost: ['勇敢', '善良', '诚实', '坚持']
  }
};

const GOAL_KEYWORDS = {
  '语言': 'language_development',
  '表达': 'language_development',
  '说话': 'language_development',
  '词汇': 'language_development',
  '情绪': 'emotional_management',
  '脾气': 'emotional_management',
  '心情': 'emotional_management',
  '社交': 'social_skills',
  '朋友': 'social_skills',
  '人际交往': 'social_skills',
  '认知': 'cognitive_development',
  '思维': 'cognitive_development',
  '智力': 'cognitive_development',
  '知识': 'knowledge_expansion',
  '科普': 'knowledge_expansion',
  '学习': 'knowledge_expansion',
  '阅读': 'reading_habit',
  '爱读书': 'reading_habit',
  '习惯': 'reading_habit',
  '品格': 'character_building',
  '品德': 'character_building',
  '性格': 'character_building'
};

function validateParentGoals(goals) {
  const result = { valid: true, errors: [], warnings: [], normalizedGoals: [] };
  
  if (!goals || goals.length === 0) {
    result.warnings.push({
      code: 'GOALS_EMPTY',
      message: '家长未设定明确目标',
      suggestion: '建议选择1-3个发展目标，推荐会更精准',
      field: 'parentGoals'
    });
    return result;
  }
  
  goals.forEach((goal, index) => {
    if (typeof goal !== 'string') {
      result.errors.push({
        code: 'GOAL_INVALID_TYPE',
        message: `第${index + 1}个目标格式错误`,
        suggestion: '目标应为文本格式',
        field: `parentGoals[${index}]`,
        value: goal
      });
      return;
    }
    
    const normalized = normalizeGoal(goal);
    if (normalized) {
      result.normalizedGoals.push(normalized);
    } else {
      result.warnings.push({
        code: 'GOAL_UNRECOGNIZED',
        message: `未识别的目标描述："${goal}"`,
        suggestion: '尝试使用更明确的目标词，如：语言发展、情绪管理、社交能力等',
        field: `parentGoals[${index}]`,
        value: goal
      });
    }
  });
  
  if (result.normalizedGoals.length === 0 && goals.length > 0) {
    result.valid = false;
    result.errors.push({
      code: 'ALL_GOALS_UNRECOGNIZED',
      message: '所有家长目标都无法识别',
      suggestion: '请从预设目标中选择，或使用标准关键词',
      field: 'parentGoals'
    });
  }
  
  return result;
}

function normalizeGoal(goalText) {
  const lowerGoal = goalText.toLowerCase();
  
  if (PARENT_GOALS[lowerGoal]) {
    return { id: lowerGoal, ...PARENT_GOALS[lowerGoal] };
  }
  
  for (const [keyword, goalId] of Object.entries(GOAL_KEYWORDS)) {
    if (lowerGoal.includes(keyword)) {
      return { id: goalId, ...PARENT_GOALS[goalId] };
    }
  }
  
  return null;
}

function applyGoalBoost(books, parentGoals, trace) {
  const result = { books: [], trace: [] };
  
  if (!parentGoals || parentGoals.length === 0) {
    result.books = books;
    result.trace.push({
      step: 'goal_boost',
      status: 'skipped',
      reason: '无有效家长目标，跳过目标加权'
    });
    return result;
  }
  
  books.forEach(book => {
    let goalScore = 1.0;
    const goalMatches = [];
    
    parentGoals.forEach(goal => {
      Object.entries(goal.targetThemes || {}).forEach(([theme, boost]) => {
        if (book.themes.includes(theme)) {
          goalScore *= boost;
          goalMatches.push({
            goal: goal.name,
            theme,
            boost: `x${boost}`
          });
        }
      });
      
      (goal.keywordBoost || []).forEach(keyword => {
        if (book.title.includes(keyword) || (book.description && book.description.includes(keyword))) {
          goalScore *= 1.1;
        }
      });
    });
    
    result.books.push({
      ...book,
      goalScore,
      goalMatches
    });
    
    result.trace.push({
      step: 'goal_boost',
      bookId: book.id,
      bookTitle: book.title,
      parentGoals: parentGoals.map(g => g.name),
      goalMatches,
      goalScore: goalScore.toFixed(2),
      status: goalScore > 1 ? 'boosted' : 'not_boosted'
    });
  });
  
  return result;
}

function getGoalSuggestions(ageTier) {
  if (!ageTier) return Object.keys(PARENT_GOALS).map(id => ({ id, name: PARENT_GOALS[id].name }));
  
  const ageToGoalPriority = {
    '0-2': ['language_development', 'emotional_management', 'cognitive_development'],
    '3-5': ['social_skills', 'emotional_management', 'language_development'],
    '6-8': ['knowledge_expansion', 'reading_habit', 'character_building'],
    '9-12': ['character_building', 'knowledge_expansion', 'reading_habit']
  };
  
  const tierKey = Object.keys({
    '0-2': 1, '3-5': 2, '6-8': 3, '9-12': 4
  }).find(k => ageTier.name.includes(k.split('-')[0]));
  
  const priorityGoals = ageToGoalPriority[tierKey] || Object.keys(PARENT_GOALS);
  
  return priorityGoals.map(id => ({
    id,
    name: PARENT_GOALS[id].name,
    description: PARENT_GOALS[id].description,
    recommended: true
  }));
}

module.exports = {
  PARENT_GOALS,
  GOAL_KEYWORDS,
  validateParentGoals,
  normalizeGoal,
  applyGoalBoost,
  getGoalSuggestions
};
