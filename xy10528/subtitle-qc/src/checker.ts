import { SubtitleFile, SubtitleCue, Issue, IssueType, IssueSeverity, SensitiveWord, TermItem, IssueHistory } from './types';
import { generateId } from './store';

const COMMON_TYPOS: Record<string, string> = {
  '在在': '在',
  '的的': '的',
  '是是': '是',
  '了了': '了',
  '不不': '不',
  '我我': '我',
  '你你': '你',
  '他他': '他',
  '她她': '她',
  '就就': '就',
  '这这': '这',
  '那那': '那',
  'color': 'colour',
  'favorite': 'favourite',
  'center': 'centre',
  'organization': 'organisation',
  'behavior': 'behaviour',
};

export function createIssue(params: {
  subtitleId: string;
  cueIndex?: number;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  context: Issue['context'];
}): Issue {
  const now = Date.now();
  const history: IssueHistory = {
    id: generateId('history'),
    timestamp: now,
    action: 'detected',
    operator: 'system',
  };
  
  return {
    id: generateId('issue'),
    subtitleId: params.subtitleId,
    cueIndex: params.cueIndex,
    type: params.type,
    severity: params.severity,
    status: 'open',
    message: params.message,
    context: params.context,
    createdAt: now,
    updatedAt: now,
    history: [history],
  };
}

export function checkTimelineOverlaps(subtitle: SubtitleFile): Issue[] {
  const issues: Issue[] = [];
  const cues = [...subtitle.cues].sort((a, b) => a.startTime - b.startTime);
  
  for (let i = 1; i < cues.length; i++) {
    const prev = cues[i - 1];
    const curr = cues[i];
    
    if (curr.startTime < prev.endTime) {
      const overlapMs = prev.endTime - curr.startTime;
      issues.push(createIssue({
        subtitleId: subtitle.id,
        cueIndex: curr.index,
        type: 'timeline_overlap',
        severity: 'blocker',
        message: `第 ${curr.index} 条字幕与第 ${prev.index} 条字幕重叠 ${overlapMs}ms`,
        context: {
          startTime: prev.startTimeStr,
          endTime: curr.endTimeStr,
          originalText: `前: ${prev.text.substring(0, 30)}... | 后: ${curr.text.substring(0, 30)}...`,
          suggestedFix: `建议将第 ${curr.index} 条开始时间调整为: ${prev.endTimeStr}`,
          canAutoFix: false,
          requiresHumanReview: true,
          segmentPosition: curr.index,
        },
      }));
    }
    
    const gapMs = curr.startTime - prev.endTime;
    if (gapMs > 5000 && gapMs < 60000) {
      issues.push(createIssue({
        subtitleId: subtitle.id,
        cueIndex: prev.index,
        type: 'missing_segment',
        severity: 'warning',
        message: `第 ${prev.index} 条与第 ${curr.index} 条字幕之间有 ${(gapMs / 1000).toFixed(1)}秒 间隔，可能存在漏段`,
        context: {
          startTime: prev.endTimeStr,
          endTime: curr.startTimeStr,
          canAutoFix: false,
          requiresHumanReview: true,
          segmentPosition: prev.index,
        },
      }));
    }
  }
  
  return issues;
}

export function checkEmptySegments(subtitle: SubtitleFile): Issue[] {
  const issues: Issue[] = [];
  
  for (const cue of subtitle.cues) {
    if (!cue.text || cue.text.trim() === '') {
      issues.push(createIssue({
        subtitleId: subtitle.id,
        cueIndex: cue.index,
        type: 'empty_segment',
        severity: 'warning',
        message: `第 ${cue.index} 条字幕为空`,
        context: {
          startTime: cue.startTimeStr,
          endTime: cue.endTimeStr,
          canAutoFix: false,
          requiresHumanReview: true,
          segmentPosition: cue.index,
        },
      }));
    }
  }
  
  return issues;
}

export function checkSensitiveWords(subtitle: SubtitleFile, sensitiveWords: SensitiveWord[]): Issue[] {
  const issues: Issue[] = [];
  
  for (const cue of subtitle.cues) {
    const text = cue.text.toLowerCase();
    
    for (const sw of sensitiveWords) {
      if (text.includes(sw.word.toLowerCase())) {
        const severity: IssueSeverity = 
          sw.level === 'high' ? 'blocker' : 
          sw.level === 'medium' ? 'warning' : 'info';
        
        const regex = new RegExp(sw.word, 'gi');
        const suggestedFix = sw.replacement 
          ? cue.text.replace(regex, sw.replacement)
          : undefined;
        
        issues.push(createIssue({
          subtitleId: subtitle.id,
          cueIndex: cue.index,
          type: 'sensitive_word',
          severity,
          message: `检测到敏感词 "${sw.word}" [${sw.category}]`,
          context: {
            startTime: cue.startTimeStr,
            endTime: cue.endTimeStr,
            originalText: cue.text,
            suggestedFix,
            canAutoFix: !!sw.replacement,
            requiresHumanReview: sw.level === 'high',
            segmentPosition: cue.index,
          },
        }));
      }
    }
  }
  
  return issues;
}

export function checkTermConsistency(subtitle: SubtitleFile, terms: TermItem[]): Issue[] {
  const issues: Issue[] = [];
  
  for (const cue of subtitle.cues) {
    const text = cue.text;
    
    for (const term of terms) {
      if (text.includes(term.source) && term.source !== term.target) {
        issues.push(createIssue({
          subtitleId: subtitle.id,
          cueIndex: cue.index,
          type: 'typo',
          severity: 'info',
          message: `术语不一致: 发现 "${term.source}"，建议使用 "${term.target}"`,
          context: {
            startTime: cue.startTimeStr,
            endTime: cue.endTimeStr,
            originalText: text,
            suggestedFix: text.replace(term.source, term.target),
            canAutoFix: true,
            requiresHumanReview: false,
            segmentPosition: cue.index,
          },
        }));
      }
    }
  }
  
  return issues;
}

export function checkCommonTypos(subtitle: SubtitleFile): Issue[] {
  const issues: Issue[] = [];
  
  for (const cue of subtitle.cues) {
    const text = cue.text;
    
    for (const [wrong, correct] of Object.entries(COMMON_TYPOS)) {
      if (text.includes(wrong)) {
        issues.push(createIssue({
          subtitleId: subtitle.id,
          cueIndex: cue.index,
          type: 'typo',
          severity: 'warning',
          message: `检测到可能的错别字: "${wrong}" 应为 "${correct}"`,
          context: {
            startTime: cue.startTimeStr,
            endTime: cue.endTimeStr,
            originalText: text,
            suggestedFix: text.replace(new RegExp(wrong, 'g'), correct),
            canAutoFix: true,
            requiresHumanReview: false,
            segmentPosition: cue.index,
          },
        }));
      }
    }
  }
  
  return issues;
}

export function checkBilingualMissing(subtitle1: SubtitleFile, subtitle2: SubtitleFile): Issue[] {
  const issues: Issue[] = [];
  
  const cues1 = [...subtitle1.cues].sort((a, b) => a.startTime - b.startTime);
  const cues2 = [...subtitle2.cues].sort((a, b) => a.startTime - b.startTime);
  
  if (cues1.length !== cues2.length) {
    issues.push(createIssue({
      subtitleId: subtitle1.id,
      type: 'missing_segment',
      severity: 'blocker',
      message: `双语字幕段数不匹配: ${subtitle1.name} 有 ${cues1.length} 段，${subtitle2.name} 有 ${cues2.length} 段`,
      context: {
        canAutoFix: false,
        requiresHumanReview: true,
      },
    }));
  }
  
  const maxLen = Math.min(cues1.length, cues2.length);
  for (let i = 0; i < maxLen; i++) {
    const c1 = cues1[i];
    const c2 = cues2[i];
    
    const timeDiff = Math.abs(c1.startTime - c2.startTime);
    if (timeDiff > 500) {
      issues.push(createIssue({
        subtitleId: subtitle1.id,
        cueIndex: i + 1,
        type: 'time_format_error',
        severity: 'warning',
        message: `双语字幕第 ${i + 1} 段时间轴偏差 ${timeDiff}ms`,
        context: {
          startTime: c1.startTimeStr,
          endTime: c1.endTimeStr,
          originalText: `${subtitle1.name}: ${c1.startTimeStr} | ${subtitle2.name}: ${c2.startTimeStr}`,
          canAutoFix: false,
          requiresHumanReview: true,
          segmentPosition: i + 1,
        },
      }));
    }
  }
  
  return issues;
}

export interface CheckOptions {
  checkOverlap: boolean;
  checkEmpty: boolean;
  checkSensitive: boolean;
  checkTypos: boolean;
  checkTerms: boolean;
}

export function runAllChecks(
  subtitles: SubtitleFile[],
  sensitiveWords: SensitiveWord[],
  terms: TermItem[],
  options: CheckOptions = {
    checkOverlap: true,
    checkEmpty: true,
    checkSensitive: true,
    checkTypos: true,
    checkTerms: true,
  }
): Issue[] {
  const allIssues: Issue[] = [];
  const seenIssueKeys = new Set<string>();
  
  for (const subtitle of subtitles) {
    if (options.checkOverlap) {
      allIssues.push(...checkTimelineOverlaps(subtitle));
    }
    
    if (options.checkEmpty) {
      allIssues.push(...checkEmptySegments(subtitle));
    }
    
    if (options.checkSensitive) {
      allIssues.push(...checkSensitiveWords(subtitle, sensitiveWords));
    }
    
    if (options.checkTypos) {
      allIssues.push(...checkCommonTypos(subtitle));
    }
    
    if (options.checkTerms) {
      allIssues.push(...checkTermConsistency(subtitle, terms));
    }
  }
  
  const zhSubtitle = subtitles.find(s => s.language === 'zh' || s.language === 'bilingual');
  const enSubtitle = subtitles.find(s => s.language === 'en');
  if (zhSubtitle && enSubtitle) {
    allIssues.push(...checkBilingualMissing(zhSubtitle, enSubtitle));
  }
  
  const deduplicated: Issue[] = [];
  for (const issue of allIssues) {
    const key = `${issue.subtitleId}_${issue.type}_${issue.cueIndex ?? 0}_${issue.message}`;
    if (!seenIssueKeys.has(key)) {
      seenIssueKeys.add(key);
      deduplicated.push(issue);
    }
  }
  
  return deduplicated;
}
