import { ParsedData, EmojiRisk, RuleResult } from '../types';
import { getCodePoints, isEmoji, isRightToLeft, codePointToHex } from '../utils/unicode';

export function checkEmojiRisks(data: ParsedData): RuleResult<EmojiRisk> {
  const issues: EmojiRisk[] = [];

  for (const sample of data.samples) {
    const codePoints = getCodePoints(sample.text);
    const hasRTL = codePoints.some(cp => isRightToLeft(cp));

    for (let i = 0; i < codePoints.length; i++) {
      const codePoint = codePoints[i];
      if (!isEmoji(codePoint)) continue;

      const char = String.fromCodePoint(codePoint);

      if (hasRTL) {
        issues.push({
          codePoint,
          char,
          sampleId: sample.id,
          sampleText: sample.text,
          riskType: 'directionality',
          description: `Emoji ${codePointToHex(codePoint)} 在 RTL 文本中可能存在方向性问题`
        });
      }

      const nextCp = codePoints[i + 1];
      if (nextCp !== undefined && isEmoji(nextCp)) {
        const hasZWJ = i + 1 < codePoints.length && codePoints[i + 1] === 0x200D;
        if (!hasZWJ && codePoints[i + 1] !== 0xFE0F) {
          issues.push({
            codePoint,
            char,
            sampleId: sample.id,
            sampleText: sample.text,
            riskType: 'color',
            description: `连续 Emoji ${codePointToHex(codePoint)} 和 ${codePointToHex(nextCp)} 可能存在颜色显示问题`
          });
        }
      }

      const emojiFont = data.fallbackConfig.defaults.emojiFont;
      if (!emojiFont) {
        issues.push({
          codePoint,
          char,
          sampleId: sample.id,
          sampleText: sample.text,
          riskType: 'missing',
          description: `Emoji ${codePointToHex(codePoint)} 存在但未配置 emoji 专用字体`
        });
      }
    }
  }

  const uniqueIssues = deduplicateEmojiRisks(issues);

  return {
    name: 'Emoji Risk Check',
    description: '检查 Emoji 在 RTL 文本、连续序列中的显示风险，以及是否配置了 Emoji 字体',
    passed: uniqueIssues.length === 0,
    issues: uniqueIssues
  };
}

function deduplicateEmojiRisks(issues: EmojiRisk[]): EmojiRisk[] {
  const seen = new Map<string, EmojiRisk>();

  for (const issue of issues) {
    const key = `${issue.sampleId}:${issue.codePoint}:${issue.riskType}`;
    if (!seen.has(key)) {
      seen.set(key, issue);
    }
  }

  return Array.from(seen.values());
}
