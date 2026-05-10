const STOPWORDS = new Set([
  '的', '了', '和', '是', '在', '我', '有', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
  '这', '那', '之', '把', '给', '让', '被', '叫', '跟', '与', '向', '从', '于', '等', '及', '或', '但', '并', '而', '还',
  '啊', '哦', '嗯', '唉', '吧', '呢', '吗', '呀', '么', '嘛', '啦', '喽', '嘞', '喏', '咦', '哇', '哈', '呀'
]);

const LINE_PATTERNS = [
  /\d+号线/, /[一二三四五六七八九十]+号线/, /[A-Za-z]线/, /[A-Za-z]\d+线/
];

const STATION_KEYWORDS = ['站', '路', '桥', '门', '口', '楼', '场', '馆', '园', '街', '道', '村', '庄', '镇', '市', '区'];

const CATEGORY_KEYWORDS = {
  '身份证件': ['身份证', '驾照', '护照', '通行证', '工作证', '学生证', '银行卡', '社保卡', '医保卡'],
  '电子产品': ['手机', '电脑', '笔记本', '平板', 'ipad', '耳机', '相机', '充电宝', '充电器', '数据线', '手表', '智能手表'],
  '钱包': ['钱包', '皮夹', '卡包', '现金', '钱'],
  '钥匙': ['钥匙', '锁匙', '钥匙串'],
  '箱包': ['包', '背包', '书包', '手提包', '行李箱', '拉杆箱', '旅行箱', '公文包', '电脑包'],
  '衣物': ['衣服', '外套', '大衣', '夹克', '毛衣', '裤子', '鞋子', '帽子', '围巾', '手套'],
  '雨伞': ['雨伞', '遮阳伞', '伞'],
  '文件': ['文件', '文档', '合同', '票据', '发票', '收据', '快递', '包裹', '邮件'],
  '食品': ['食品', '零食', '水果', '饮料', '水', '牛奶', '咖啡', '茶', '酒'],
  '药品': ['药品', '药', '保健品', '化妆品', '护肤品'],
  '书籍': ['书', '书籍', '杂志', '报纸', '笔记本', '作业本'],
  '玩具': ['玩具', '玩偶', '模型', '游戏机'],
  '饰品': ['项链', '戒指', '耳环', '手镯', '手链', '手表', '眼镜', '墨镜', '首饰']
};

const COLOR_KEYWORDS = {
  '黑色': ['黑色', '黑', '深黑', '纯黑'],
  '白色': ['白色', '白', '米白', '乳白', '纯白'],
  '红色': ['红色', '红', '大红', '深红', '粉红', '玫红', '橘红'],
  '蓝色': ['蓝色', '蓝', '浅蓝', '深蓝', '天蓝', '宝蓝', '藏蓝'],
  '绿色': ['绿色', '绿', '浅绿', '深绿', '草绿', '墨绿', '翠绿'],
  '黄色': ['黄色', '黄', '金黄', '土黄', '柠檬黄', '橘黄'],
  '紫色': ['紫色', '紫', '深紫', '浅紫', '淡紫'],
  '粉色': ['粉色', '粉', '桃红', '玫瑰粉'],
  '橙色': ['橙色', '橙', '橘色', '桔色'],
  '灰色': ['灰色', '灰', '深灰', '浅灰', '银灰'],
  '棕色': ['棕色', '棕', '褐色', '咖啡色'],
  '花色': ['花色', '花纹', '图案', '印花', '格子', '条纹', '迷彩']
};

const DATE_PATTERNS = [
  /(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})[日号]?/,
  /(\d{1,2})[-\/月](\d{1,2})[日号]/,
  /今天/, /昨天/, /前天/, /明天/, /后天/
];

const TIME_PATTERNS = [
  /(\d{1,2})[:点时](\d{2})[分]?/,
  /(\d{1,2})[:点时]半/,
  /早上/, /上午/, /中午/, /下午/, /晚上/, /凌晨/
];

function normalizeText(text) {
  if (!text) return '';
  let result = text.toLowerCase().trim();
  result = result.replace(/[，。！？；：、（）【】《》「」『』〈〉〔〕]/g, ' ');
  result = result.replace(/[,.!?;:()\[\]{}<>"'`]/g, ' ');
  result = result.replace(/\s+/g, ' ');
  return result.trim();
}

function extractLines(text) {
  const lines = [];
  for (const pattern of LINE_PATTERNS) {
    const matches = text.match(new RegExp(pattern, 'g'));
    if (matches) {
      lines.push(...matches);
    }
  }
  return [...new Set(lines)];
}

function extractStations(text) {
  const stations = [];
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (const keyword of STATION_KEYWORDS) {
      if (word.includes(keyword) && word.length >= 2) {
        stations.push(word);
        break;
      }
    }
  }
  return [...new Set(stations)];
}

function extractCategory(text) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }
  return null;
}

function extractColor(text) {
  const colors = [];
  for (const [color, keywords] of Object.entries(COLOR_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        colors.push(color);
        break;
      }
    }
  }
  return colors.length > 0 ? colors.join(',') : null;
}

function extractFeatures(text) {
  const features = [];
  if (/品牌|牌子|logo|标志|商标/.test(text)) {
    features.push('有品牌标识');
  }
  if (/新|全新|九成新|八成新/.test(text)) {
    features.push('较新');
  }
  if (/旧|破旧|损坏|破损/.test(text)) {
    features.push('较旧/有损坏');
  }
  if (/透明|塑料|皮质|皮革|布制|帆布|金属/.test(text)) {
    const materialMatch = text.match(/透明|塑料|皮质|皮革|布制|帆布|金属/);
    if (materialMatch) features.push(`材质:${materialMatch[0]}`);
  }
  return features.length > 0 ? features.join(';') : null;
}

function normalizeDate(text) {
  const today = new Date();
  if (text.includes('今天')) {
    return today.toISOString().split('T')[0];
  }
  if (text.includes('昨天')) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  if (text.includes('前天')) {
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);
    return dayBefore.toISOString().split('T')[0];
  }
  
  const match1 = text.match(/(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})/);
  if (match1) {
    return `${match1[1]}-${match1[2].padStart(2, '0')}-${match1[3].padStart(2, '0')}`;
  }
  
  const match2 = text.match(/(\d{1,2})[-\/月](\d{1,2})/);
  if (match2) {
    const year = today.getFullYear();
    return `${year}-${match2[1].padStart(2, '0')}-${match2[2].padStart(2, '0')}`;
  }
  
  return null;
}

function normalizeTime(text) {
  const match1 = text.match(/(\d{1,2})[:点时](\d{2})/);
  if (match1) {
    return `${match1[1].padStart(2, '0')}:${match1[2].padStart(2, '0')}`;
  }
  const match2 = text.match(/(\d{1,2})[:点时]半/);
  if (match2) {
    return `${match2[1].padStart(2, '0')}:30`;
  }
  if (text.includes('早上') || text.includes('上午')) return '08:00';
  if (text.includes('中午')) return '12:00';
  if (text.includes('下午')) return '14:00';
  if (text.includes('晚上')) return '19:00';
  if (text.includes('凌晨')) return '02:00';
  return null;
}

function tokenize(text) {
  if (!text) return [];
  const tokens = [];
  const normalized = normalizeText(text);
  
  const chineseRegex = /[\u4e00-\u9fa5]+/g;
  const matches = normalized.match(chineseRegex);
  
  if (matches) {
    for (const match of matches) {
      for (let len = 2; len <= Math.min(match.length, 4); len++) {
        for (let i = 0; i <= match.length - len; i++) {
          const token = match.slice(i, i + len);
          if (!STOPWORDS.has(token)) {
            tokens.push(token);
          }
        }
      }
    }
  }
  
  const englishWords = normalized.match(/[a-zA-Z0-9]+/g);
  if (englishWords) {
    tokens.push(...englishWords.map(w => w.toLowerCase()));
  }
  
  return [...new Set(tokens)];
}

function cleanLostItem(rawItem) {
  const text = normalizeText(rawItem.description || '');
  const cleaned = {
    ...rawItem,
    cleaned_description: text,
    item_category: rawItem.item_category || extractCategory(text),
    item_color: rawItem.item_color || extractColor(text),
    item_features: rawItem.item_features || extractFeatures(text),
    lost_line: rawItem.lost_line || extractLines(text).join(',') || null,
    lost_station: rawItem.lost_station || extractStations(text).join(',') || null,
    lost_date: rawItem.lost_date || normalizeDate(text),
    lost_time: rawItem.lost_time || normalizeTime(text),
    tokens: tokenize(text)
  };
  return cleaned;
}

function cleanFoundItem(rawItem) {
  const text = normalizeText(rawItem.description || '');
  const cleaned = {
    ...rawItem,
    cleaned_description: text,
    item_category: rawItem.item_category || extractCategory(text),
    item_color: rawItem.item_color || extractColor(text),
    item_features: rawItem.item_features || extractFeatures(text),
    found_line: rawItem.found_line || extractLines(text).join(',') || null,
    found_station: rawItem.found_station || extractStations(text).join(',') || null,
    found_date: rawItem.found_date || normalizeDate(text),
    found_time: rawItem.found_time || normalizeTime(text),
    tokens: tokenize(text)
  };
  return cleaned;
}

export {
  normalizeText,
  tokenize,
  cleanLostItem,
  cleanFoundItem,
  CATEGORY_KEYWORDS,
  COLOR_KEYWORDS
};
