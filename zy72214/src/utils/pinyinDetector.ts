export function isPinyinName(name: string): boolean {
  if (!name || name.trim().length === 0) return true;
  const trimmedName = name.trim();
  const chinesePattern = /[\u4e00-\u9fa5]/;
  if (chinesePattern.test(trimmedName)) return false;
  const purePinyinPattern = /^[a-zA-Z\s]+$/;
  if (!purePinyinPattern.test(trimmedName)) return false;
  const parts = trimmedName.split(/\s+/).filter(p => p.length > 0);
  if (parts.length < 2) return true;
  const commonPinyinPatterns = [
    /^(zhang|wang|li|zhao|chen|yang|huang|zhou|wu|xu|sun|ma|zhu|hu|guo|lin|he|gao|luo|zheng|liang|xie|song|tang|xu|han|feng|deng|cao|peng|yuan|cui|cheng|cai|jiang|shen|liu|lu|jia|qian|ding|wei|ye|lv|ren|sheng|jiang|yao|du|yan|fang|jin|qiu|zhong|tan|qin|dai|hou|wen|ban|xue|ye|yin|ni|he|long|shi|kong|bai|mao|shao|wan|cao|fan|liao|pang)/i
  ];
  const firstName = parts[0].toLowerCase();
  return commonPinyinPatterns.some(pattern => pattern.test(firstName));
}

export function normalizeApproverName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
