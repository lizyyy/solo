import { ParsedContractLine } from '@/types';

export function parseContractText(text: string): ParsedContractLine[] {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const parsed: ParsedContractLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;

    const quantityMatch = line.match(/(\d+)\s*(张|个|份|课时)/);
    const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 0;

    let trackName = line;
    trackName = trackName.replace(/第\s*\d+\s*行/, '');
    trackName = trackName.replace(/\d+\s*(张|个|份|课时)/, '');
    trackName = trackName.replace(/备注[：:].*/, '');
    trackName = trackName.replace(/缺货|已消耗|预售|已售/g, '');
    trackName = trackName.trim();

    if (trackName.length > 0 || quantity > 0) {
      parsed.push({
        lineNumber,
        content: line,
        trackName: trackName || `未命名曲目${lineNumber}`,
        quantity
      });
    }
  }

  return parsed;
}

export function generateMockContractText(): string {
  return `第1行 夜曲 缺货5张 备注：正常预售
第2行 月光奏鸣曲 缺货3张
第3行 致爱丽丝 已消耗2张 备注：学员请假1课时
第4行 小星星变奏曲 缺货8张
第5行 匈牙利舞曲 缺货1张 备注：补课课时算入
第6行 天鹅湖 缺货6张`;
}

export function generateMockContractTextV2(): string {
  return `第1行 夜曲Nocturne 缺货5张 备注：正常预售
第2行 月光奏鸣曲 缺货4张 备注：更新数量
第3行 致爱丽丝 已消耗2张 备注：学员请假1课时 待确认
第4行 小星星变奏曲 缺货8张
第7行 新增曲目 缺货2张`;
}
