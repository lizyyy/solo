import { Issue, IssueType, SensitiveWord } from '../models/types';

export class TextInspector {
  private apologyKeywords: string[] = [
    '抱歉', '对不起', '不好意思', '致歉', '道歉', '深表歉意',
    '给您带来不便', '请您谅解', '请谅解', 'sorry', 'apologize'
  ];

  private refundPromiseKeywords: string[] = [
    '退款', '退费', '退钱', '返还', '退回', '赔偿', '补款',
    '给您退款', '帮您退款', '可以退款', '同意退款', '给予退款',
    'refund', 'reimburse'
  ];

  private sensitiveWords: SensitiveWord[] = [];

  constructor(initialSensitiveWords?: SensitiveWord[]) {
    if (initialSensitiveWords) {
      this.sensitiveWords = initialSensitiveWords.filter(w => w.enabled);
    }
  }

  updateSensitiveWords(words: SensitiveWord[]) {
    this.sensitiveWords = words.filter(w => w.enabled);
  }

  checkApology(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.apologyKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  checkRefundPromise(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.refundPromiseKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  findSensitiveWords(text: string): Issue[] {
    const issues: Issue[] = [];
    const lowerText = text.toLowerCase();

    for (const sensitiveWord of this.sensitiveWords) {
      const keyword = sensitiveWord.word.toLowerCase();
      let position = lowerText.indexOf(keyword);
      
      while (position !== -1) {
        issues.push({
          type: IssueType.SENSITIVE_WORD,
          description: `检测到敏感词: ${sensitiveWord.word}`,
          severity: sensitiveWord.severity,
          position: {
            start: position,
            end: position + keyword.length
          },
          matchedText: text.substring(position, position + keyword.length)
        });
        
        position = lowerText.indexOf(keyword, position + 1);
      }
    }

    return issues;
  }

  inspect(text: string): {
    hasApology: boolean;
    hasRefundPromise: boolean;
    issues: Issue[];
  } {
    const issues: Issue[] = [];
    const hasApology = this.checkApology(text);
    const hasRefundPromise = this.checkRefundPromise(text);

    if (!hasApology) {
      issues.push({
        type: IssueType.MISSING_APOLOGY,
        description: '文本中未检测到道歉用语',
        severity: 'medium'
      });
    }

    if (!hasRefundPromise) {
      issues.push({
        type: IssueType.MISSING_REFUND_PROMISE,
        description: '文本中未检测到退款承诺',
        severity: 'high'
      });
    }

    const sensitiveWordIssues = this.findSensitiveWords(text);
    issues.push(...sensitiveWordIssues);

    return {
      hasApology,
      hasRefundPromise,
      issues
    };
  }
}
