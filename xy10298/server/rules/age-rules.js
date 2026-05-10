const AGE_TIERS = {
  '0-2': {
    name: '0-2岁 婴儿期',
    minAge: 0,
    maxAge: 2,
    cognitive: '感官探索、亲子互动、认知启蒙',
    suitableThemes: ['认知启蒙', '亲子互动', '感官刺激', '情绪安抚', '动物认知'],
    difficulty: 'simple',
    bookFeatures: '大开本、硬纸板书、触摸书、洞洞书',
    pageLimit: { min: 10, max: 30 }
  },
  '3-5': {
    name: '3-5岁 幼儿期',
    minAge: 3,
    maxAge: 5,
    cognitive: '语言发展、社交技能、想象力',
    suitableThemes: ['生活习惯', '社交友谊', '想象力', '自然科学', '故事童话', '情绪管理'],
    difficulty: 'medium',
    bookFeatures: '绘本故事、翻翻书、贴纸书',
    pageLimit: { min: 20, max: 60 }
  },
  '6-8': {
    name: '6-8岁 学龄初期',
    minAge: 6,
    maxAge: 8,
    cognitive: '自主阅读、逻辑思维、知识拓展',
    suitableThemes: ['科普知识', '历史文化', '品格塑造', '冒险故事', '桥梁书', '逻辑思维'],
    difficulty: 'medium-hard',
    bookFeatures: '桥梁书、科普绘本、章节书入门',
    pageLimit: { min: 40, max: 120 }
  },
  '9-12': {
    name: '9-12岁 学龄中期',
    minAge: 9,
    maxAge: 12,
    cognitive: '独立思考、价值观念、深度阅读',
    suitableThemes: ['成长励志', '科幻奇幻', '历史传记', '文学名著', '社会认知', '情感启蒙'],
    difficulty: 'hard',
    bookFeatures: '少儿文学、科普读物、成长小说',
    pageLimit: { min: 80, max: 300 }
  }
};

function getAgeTier(age) {
  if (age < 0) return null;
  if (age <= 2) return AGE_TIERS['0-2'];
  if (age <= 5) return AGE_TIERS['3-5'];
  if (age <= 8) return AGE_TIERS['6-8'];
  if (age <= 12) return AGE_TIERS['9-12'];
  return null;
}

function validateAge(age) {
  const result = { valid: true, errors: [], warnings: [] };
  
  if (age === undefined || age === null) {
    result.valid = false;
    result.errors.push({
      code: 'AGE_MISSING',
      message: '孩子年龄未填写',
      suggestion: '请输入孩子的实际年龄（0-12岁）',
      field: 'childAge'
    });
    return result;
  }
  
  if (typeof age !== 'number') {
    result.valid = false;
    result.errors.push({
      code: 'AGE_INVALID_TYPE',
      message: `年龄格式错误：期望数字，实际为 ${typeof age}`,
      suggestion: '年龄必须是数字格式',
      field: 'childAge',
      value: age
    });
    return result;
  }
  
  if (age < 0) {
    result.valid = false;
    result.errors.push({
      code: 'AGE_NEGATIVE',
      message: `年龄不能为负数：${age}岁`,
      suggestion: '请输入有效的年龄',
      field: 'childAge',
      value: age
    });
  }
  
  if (age > 12) {
    result.warnings.push({
      code: 'AGE_OUT_OF_RANGE',
      message: `年龄超出推荐范围：${age}岁，本系统专注0-12岁儿童`,
      suggestion: '可尝试降低年龄或使用青少年阅读系统',
      field: 'childAge',
      value: age
    });
  }
  
  return result;
}

function applyAgeFilter(books, ageTier, trace) {
  const result = { books: [], trace: [] };
  
  if (!ageTier) {
    result.trace.push({
      step: 'age_filter',
      status: 'skipped',
      reason: '年龄层级无效，跳过年龄过滤'
    });
    return result;
  }
  
  const suitableThemes = new Set(ageTier.suitableThemes);
  
  books.forEach(book => {
    const matchedThemes = book.themes.filter(t => suitableThemes.has(t));
    const ageScore = matchedThemes.length / Math.max(book.themes.length, 1);
    
    result.books.push({
      ...book,
      ageScore,
      ageTierMatch: ageTier.name,
      matchedThemes
    });
    
    result.trace.push({
      step: 'age_filter',
      bookId: book.id,
      bookTitle: book.title,
      ageTier: ageTier.name,
      suitableThemes: Array.from(suitableThemes),
      bookThemes: book.themes,
      matchedThemes,
      ageScore: ageScore.toFixed(2),
      status: ageScore > 0 ? 'matched' : 'partial_match'
    });
  });
  
  return result;
}

module.exports = {
  AGE_TIERS,
  getAgeTier,
  validateAge,
  applyAgeFilter
};
