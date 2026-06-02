const pinyinMap: Record<string, string> = {
  '东': 'dong', '城': 'cheng', '区': 'qu', '和': 'he', '平': 'ping', '里': 'li',
  '街': 'jie', '道': 'dao', '号': 'hao', '院': 'yuan', '碳': 'tan', '排': 'pai',
  '放': 'fang', '点': 'dian', '七': 'qi', '节': 'jie', '能': 'neng', '监': 'jian',
  '测': 'ce', '地': 'di', '坛': 'tan', '公': 'gong', '园': 'yuan', '南': 'nan',
  '门': 'men', '绿': 'lv', '化': 'hua', '汇': 'hui', '停': 'ting', '车': 'che',
  '场': 'chang', '旁': 'pang', '安': 'an', '定': 'ding', '内': 'nei', '大': 'da',
  '前': 'qian', '三': 'san', '包': 'bao', '低': 'di', '示': 'shi',
  '范': 'fan', '小': 'xiao', '栋': 'dong', '单': 'dan', '元': 'yuan',
  '路': 'lu', '巷': 'xiang', '弄': 'nong', '室': 'shi',
};

export function getPinyin(chinese: string): string {
  return chinese
    .split('')
    .map(char => pinyinMap[char] || char)
    .join(' ');
}

export function normalizeAddress(address: string): string {
  return address
    .replace(/号/g, '號')
    .replace(/院/g, '院')
    .replace(/区/g, '區')
    .replace(/街/g, '街')
    .replace(/路/g, '路')
    .replace(/七/g, '7')
    .replace(/一/g, '1')
    .replace(/二/g, '2')
    .replace(/三/g, '3')
    .replace(/四/g, '4')
    .replace(/五/g, '5')
    .replace(/六/g, '6')
    .replace(/八/g, '8')
    .replace(/九/g, '9')
    .replace(/十/g, '10')
    .replace(/[\s\-_，,。.、\/]/g, '')
    .toLowerCase();
}

export function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const patterns = [
    /[\u4e00-\u9fa5]+[路街巷道园小区]/g,
    /\d+[号院栋单元室]/g,
    /[\u4e00-\u9fa5]+公园/g,
    /[\u4e00-\u9fa5]+广场/g,
  ];
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      keywords.push(...matches);
    }
  });
  
  return [...new Set(keywords)];
}
