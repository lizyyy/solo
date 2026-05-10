const THEMES = {
  '认知启蒙': {
    id: 'cognitive',
    category: 'foundation',
    description: '基础认知、颜色、形状、数字',
    ageSuitability: ['0-2', '3-5'],
    relatedThemes: ['动物认知', '感官刺激']
  },
  '亲子互动': {
    id: 'parent_child',
    category: 'emotional',
    description: '亲子关系、家庭温情',
    ageSuitability: ['0-2', '3-5'],
    relatedThemes: ['情绪安抚', '生活习惯']
  },
  '感官刺激': {
    id: 'sensory',
    category: 'foundation',
    description: '视觉、听觉、触觉刺激',
    ageSuitability: ['0-2'],
    relatedThemes: ['认知启蒙']
  },
  '情绪安抚': {
    id: 'emotional_soothing',
    category: 'emotional',
    description: '安全感建立、情绪安抚',
    ageSuitability: ['0-2', '3-5'],
    relatedThemes: ['亲子互动', '情绪管理']
  },
  '动物认知': {
    id: 'animal',
    category: 'knowledge',
    description: '认识各种动物',
    ageSuitability: ['0-2', '3-5', '6-8'],
    relatedThemes: ['认知启蒙', '自然科学']
  },
  '生活习惯': {
    id: 'habits',
    category: 'life',
    description: '生活自理、作息习惯',
    ageSuitability: ['3-5', '6-8'],
    relatedThemes: ['社交友谊', '品格塑造']
  },
  '社交友谊': {
    id: 'social',
    category: 'social',
    description: '交朋友、合作分享',
    ageSuitability: ['3-5', '6-8'],
    relatedThemes: ['生活习惯', '情绪管理']
  },
  '想象力': {
    id: 'imagination',
    category: 'creativity',
    description: '创造力、想象力培养',
    ageSuitability: ['3-5', '6-8'],
    relatedThemes: ['故事童话', '冒险故事']
  },
  '自然科学': {
    id: 'natural_science',
    category: 'knowledge',
    description: '自然现象、科学启蒙',
    ageSuitability: ['3-5', '6-8'],
    relatedThemes: ['动物认知', '科普知识']
  },
  '故事童话': {
    id: 'fairy_tale',
    category: 'narrative',
    description: '经典童话、奇幻故事',
    ageSuitability: ['3-5', '6-8'],
    relatedThemes: ['想象力', '冒险故事']
  },
  '情绪管理': {
    id: 'emotional_management',
    category: 'emotional',
    description: '认识和管理情绪',
    ageSuitability: ['3-5', '6-8'],
    relatedThemes: ['情绪安抚', '品格塑造']
  },
  '科普知识': {
    id: 'popular_science',
    category: 'knowledge',
    description: '科普读物、百科知识',
    ageSuitability: ['6-8', '9-12'],
    relatedThemes: ['自然科学', '历史文化']
  },
  '历史文化': {
    id: 'history_culture',
    category: 'knowledge',
    description: '历史故事、传统文化',
    ageSuitability: ['6-8', '9-12'],
    relatedThemes: ['科普知识', '历史传记']
  },
  '品格塑造': {
    id: 'character',
    category: 'value',
    description: '品德教育、价值观',
    ageSuitability: ['6-8', '9-12'],
    relatedThemes: ['情绪管理', '成长励志']
  },
  '冒险故事': {
    id: 'adventure',
    category: 'narrative',
    description: '探险、冒险故事',
    ageSuitability: ['6-8', '9-12'],
    relatedThemes: ['想象力', '科幻奇幻']
  },
  '桥梁书': {
    id: 'bridge_book',
    category: 'format',
    description: '从绘本到章节书的过渡',
    ageSuitability: ['6-8'],
    relatedThemes: ['故事童话', '冒险故事']
  },
  '逻辑思维': {
    id: 'logic',
    category: 'cognitive',
    description: '逻辑推理、思维训练',
    ageSuitability: ['6-8', '9-12'],
    relatedThemes: ['科普知识', '冒险故事']
  },
  '成长励志': {
    id: 'growth',
    category: 'value',
    description: '成长故事、励志内容',
    ageSuitability: ['9-12'],
    relatedThemes: ['品格塑造', '文学名著']
  },
  '科幻奇幻': {
    id: 'sci_fi',
    category: 'narrative',
    description: '科幻、奇幻题材',
    ageSuitability: ['9-12'],
    relatedThemes: ['冒险故事', '想象力']
  },
  '历史传记': {
    id: 'biography',
    category: 'knowledge',
    description: '历史人物、名人传记',
    ageSuitability: ['9-12'],
    relatedThemes: ['历史文化', '成长励志']
  },
  '文学名著': {
    id: 'literature',
    category: 'narrative',
    description: '少儿版文学名著',
    ageSuitability: ['9-12'],
    relatedThemes: ['成长励志', '品格塑造']
  },
  '社会认知': {
    id: 'social_cognition',
    category: 'social',
    description: '社会认知、公民教育',
    ageSuitability: ['9-12'],
    relatedThemes: ['品格塑造', '历史文化']
  },
  '情感启蒙': {
    id: 'emotional_awakening',
    category: 'emotional',
    description: '青春期情感、人际关系',
    ageSuitability: ['9-12'],
    relatedThemes: ['情绪管理', '社会认知']
  }
};

function validateThemes(themes) {
  const result = { valid: true, errors: [], warnings: [], validatedThemes: [] };
  
  if (!themes || themes.length === 0) {
    result.warnings.push({
      code: 'THEMES_EMPTY',
      message: '无主题标签',
      suggestion: '建议为每本书添加1-3个主题标签',
      field: 'themes'
    });
    return result;
  }
  
  const validThemes = Object.keys(THEMES);
  
  themes.forEach((theme, index) => {
    if (typeof theme !== 'string') {
      result.errors.push({
        code: 'THEME_INVALID_TYPE',
        message: `第${index + 1}个主题格式错误`,
        field: `themes[${index}]`,
        value: theme
      });
      return;
    }
    
    if (validThemes.includes(theme)) {
      result.validatedThemes.push(theme);
    } else {
      result.warnings.push({
        code: 'THEME_UNRECOGNIZED',
        message: `未识别的主题："${theme}"`,
        suggestion: `可选主题：${validThemes.join('、')}`,
        field: `themes[${index}]`,
        value: theme
      });
    }
  });
  
  return result;
}

function calculateThemeScore(book, targetThemes) {
  const bookThemes = new Set(book.themes);
  let score = 0;
  const matches = [];
  
  targetThemes.forEach(theme => {
    if (bookThemes.has(theme)) {
      score += 1;
      matches.push(theme);
      
      const themeInfo = THEMES[theme];
      if (themeInfo && themeInfo.relatedThemes) {
        themeInfo.relatedThemes.forEach(related => {
          if (bookThemes.has(related) && !matches.includes(related)) {
            score += 0.5;
            matches.push(`相关：${related}`);
          }
        });
      }
    }
  });
  
  return {
    score,
    matches,
    coverage: score / Math.max(targetThemes.length, 1)
  };
}

module.exports = {
  THEMES,
  validateThemes,
  calculateThemeScore
};
