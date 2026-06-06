import { ReworkDetectionResult, BoundaryRules } from '../types';
import { getReworkDetectionRules } from './boundaryRules';

export function detectReworkReason(
  remark: string,
  customRules?: BoundaryRules['reworkDetection']
): ReworkDetectionResult {
  const rules = customRules || getReworkDetectionRules();
  const matchedKeywords: string[] = [];

  if (!remark || remark.trim().length === 0) {
    return {
      hasRework: false,
      matchedKeywords: [],
      detectionTime: new Date(),
    };
  }

  const targetText = rules.caseSensitive ? remark : remark.toLowerCase();

  for (const keyword of rules.keywords) {
    const targetKeyword = rules.caseSensitive ? keyword : keyword.toLowerCase();

    if (rules.useRegex) {
      try {
        const regex = new RegExp(targetKeyword, rules.caseSensitive ? '' : 'i');
        if (regex.test(targetText)) {
          matchedKeywords.push(keyword);
        }
      } catch {
        if (targetText.includes(targetKeyword)) {
          matchedKeywords.push(keyword);
        }
      }
    } else {
      if (targetText.includes(targetKeyword)) {
        matchedKeywords.push(keyword);
      }
    }
  }

  return {
    hasRework: matchedKeywords.length > 0,
    matchedKeywords,
    detectionTime: new Date(),
  };
}

export function shouldSendForReview(
  remark: string,
  customRules?: BoundaryRules['reworkDetection']
): boolean {
  const result = detectReworkReason(remark, customRules);
  return result.hasRework;
}

export function getMatchedKeywordsText(keywords: string[]): string {
  if (keywords.length === 0) return '无';
  return keywords.join('、');
}
