import { 
  SubtitleCue, 
  Chapter, 
  AdPoint, 
  ProjectConfig, 
  ValidationError, 
  ValidationResult 
} from '../types';
import { isTimeOverlapping, getOverlapDuration, formatTimeForDisplay } from '../utils/time';

const DEFAULT_CONFIG: Required<ProjectConfig> = {
  maxSubtitleLength: 40,
  maxSilenceGap: 5,
  minChapterCoverage: 0.9,
  sensitiveWords: [],
  chapterTitlePattern: ''
};

export interface ValidatorOptions {
  config?: ProjectConfig;
  fileName: string;
}

export function validateSubtitles(
  cues: SubtitleCue[],
  options: ValidatorOptions
): ValidationResult {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const errors: ValidationError[] = [];
  const fileName = options.fileName;

  errors.push(...checkTimeOrder(cues, fileName));
  errors.push(...checkOverlaps(cues, fileName));
  errors.push(...checkSilenceGaps(cues, fileName, config.maxSilenceGap));
  errors.push(...checkSubtitleLength(cues, fileName, config.maxSubtitleLength));
  
  if (config.sensitiveWords.length > 0) {
    errors.push(...checkSensitiveWords(cues, fileName, config.sensitiveWords));
  }

  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return {
    fileName,
    errors,
    passed: errorCount === 0,
    errorCount,
    warningCount
  };
}

function checkTimeOrder(cues: SubtitleCue[], fileName: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let i = 1; i < cues.length; i++) {
    const prev = cues[i - 1];
    const current = cues[i];

    if (current.startTime < prev.startTime) {
      errors.push({
        type: 'time_out_of_order',
        severity: 'error',
        message: `时间倒序：字幕 #${current.id} 开始时间(${current.startTimeStr}) 早于字幕 #${prev.id} 开始时间(${prev.startTimeStr})`,
        fileName,
        startTime: current.startTime,
        endTime: current.endTime,
        startTimeStr: current.startTimeStr,
        endTimeStr: current.endTimeStr,
        cueId: current.id,
        details: {
          previousCueId: prev.id,
          previousStartTime: prev.startTimeStr,
          currentStartTime: current.startTimeStr
        }
      });
    }

    if (current.startTime < prev.endTime) {
      const overlap = getOverlapDuration(prev.startTime, prev.endTime, current.startTime, current.endTime);
      if (overlap > 0) {
        errors.push({
          type: 'time_overlap',
          severity: 'error',
          message: `时间重叠：字幕 #${prev.id} (${prev.startTimeStr} - ${prev.endTimeStr}) 与 字幕 #${current.id} (${current.startTimeStr} - ${current.endTimeStr}) 重叠 ${overlap.toFixed(3)} 秒`,
          fileName,
          startTime: prev.startTime,
          endTime: current.endTime,
          startTimeStr: prev.startTimeStr,
          endTimeStr: current.endTimeStr,
          cueId: `${prev.id}-${current.id}`,
          details: {
            cue1Id: prev.id,
            cue2Id: current.id,
            overlapDuration: overlap
          }
        });
      }
    }
  }

  return errors;
}

function checkOverlaps(cues: SubtitleCue[], fileName: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const overlapPairs = new Set<string>();

  for (let i = 0; i < cues.length; i++) {
    for (let j = i + 1; j < cues.length; j++) {
      const cue1 = cues[i];
      const cue2 = cues[j];
      const pairKey = `${cue1.id}-${cue2.id}`;

      if (overlapPairs.has(pairKey)) continue;

      const overlap = getOverlapDuration(cue1.startTime, cue1.endTime, cue2.startTime, cue2.endTime);
      
      if (overlap > 0.01) {
        overlapPairs.add(pairKey);
        errors.push({
          type: 'subtitle_overlap',
          severity: 'error',
          message: `字幕重叠：字幕 #${cue1.id} (${cue1.startTimeStr} - ${cue1.endTimeStr}) 与 字幕 #${cue2.id} (${cue2.startTimeStr} - ${cue2.endTimeStr}) 重叠 ${overlap.toFixed(3)} 秒`,
          fileName,
          startTime: Math.min(cue1.startTime, cue2.startTime),
          endTime: Math.max(cue1.endTime, cue2.endTime),
          startTimeStr: formatTimeForDisplay(Math.min(cue1.startTime, cue2.startTime)),
          endTimeStr: formatTimeForDisplay(Math.max(cue1.endTime, cue2.endTime)),
          cueId: pairKey,
          details: {
            cue1: { id: cue1.id, text: cue1.text },
            cue2: { id: cue2.id, text: cue2.text },
            overlapDuration: overlap
          }
        });
      }
    }
  }

  return errors;
}

function checkSilenceGaps(
  cues: SubtitleCue[],
  fileName: string,
  maxGap: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let i = 1; i < cues.length; i++) {
    const prev = cues[i - 1];
    const current = cues[i];
    const gap = current.startTime - prev.endTime;

    if (gap > maxGap) {
      errors.push({
        type: 'silence_gap_too_large',
        severity: 'warning',
        message: `静音空档过长：字幕 #${prev.id} 结束(${prev.endTimeStr}) 到 字幕 #${current.id} 开始(${current.startTimeStr}) 之间有 ${gap.toFixed(1)} 秒静音，超过阈值 ${maxGap} 秒`,
        fileName,
        startTime: prev.endTime,
        endTime: current.startTime,
        startTimeStr: prev.endTimeStr,
        endTimeStr: current.startTimeStr,
        cueId: `${prev.id}-${current.id}`,
        details: {
          gapDuration: gap,
          maxAllowedGap: maxGap
        }
      });
    }
  }

  return errors;
}

function checkSubtitleLength(
  cues: SubtitleCue[],
  fileName: string,
  maxLength: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const cue of cues) {
    const lines = cue.text.split('\n');
    for (const line of lines) {
      const length = [...line].length;
      if (length > maxLength) {
        errors.push({
          type: 'subtitle_too_long',
          severity: 'error',
          message: `字幕过长：字幕 #${cue.id} 包含 ${length} 个字符，超过阈值 ${maxLength} 个字符`,
          fileName,
          startTime: cue.startTime,
          endTime: cue.endTime,
          startTimeStr: cue.startTimeStr,
          endTimeStr: cue.endTimeStr,
          cueId: cue.id,
          details: {
            text: cue.text,
            actualLength: length,
            maxLength
          }
        });
        break;
      }
    }
  }

  return errors;
}

function checkSensitiveWords(
  cues: SubtitleCue[],
  fileName: string,
  sensitiveWords: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const cue of cues) {
    for (const word of sensitiveWords) {
      if (cue.text.toLowerCase().includes(word.toLowerCase())) {
        errors.push({
          type: 'sensitive_word',
          severity: 'warning',
          message: `敏感词检测：字幕 #${cue.id} 包含敏感词 "${word}"`,
          fileName,
          startTime: cue.startTime,
          endTime: cue.endTime,
          startTimeStr: cue.startTimeStr,
          endTimeStr: cue.endTimeStr,
          cueId: cue.id,
          details: {
            word,
            text: cue.text
          }
        });
      }
    }
  }

  return errors;
}

export function validateChapters(
  chapters: Chapter[],
  totalDuration: number,
  options: ValidatorOptions & { subtitleCues?: SubtitleCue[] }
): ValidationResult {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const errors: ValidationError[] = [];
  const fileName = options.fileName;

  if (chapters.length === 0) {
    errors.push({
      type: 'no_chapters',
      severity: 'error',
      message: '未找到任何章节',
      fileName,
      details: {}
    });
  }

  errors.push(...checkChapterTimeOrder(chapters, fileName));
  errors.push(...checkChapterCoverage(chapters, totalDuration, fileName, config.minChapterCoverage));
  
  if (config.chapterTitlePattern) {
    errors.push(...checkChapterTitlePattern(chapters, fileName, config.chapterTitlePattern));
  }

  if (options.subtitleCues && options.subtitleCues.length > 0) {
    errors.push(...checkChaptersInSubtitleRange(chapters, options.subtitleCues, fileName));
  }

  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return {
    fileName,
    errors,
    passed: errorCount === 0,
    errorCount,
    warningCount
  };
}

function checkChapterTimeOrder(chapters: Chapter[], fileName: string): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let i = 1; i < chapters.length; i++) {
    const prev = chapters[i - 1];
    const current = chapters[i];

    if (current.startTime < prev.startTime) {
      errors.push({
        type: 'chapter_time_out_of_order',
        severity: 'error',
        message: `章节时间倒序：章节 "${current.title}" (${current.startTimeStr}) 开始时间早于章节 "${prev.title}" (${prev.startTimeStr})`,
        fileName,
        startTime: current.startTime,
        endTime: current.endTime,
        startTimeStr: current.startTimeStr,
        endTimeStr: current.endTimeStr,
        details: {
          chapter1: { title: prev.title, startTime: prev.startTimeStr },
          chapter2: { title: current.title, startTime: current.startTimeStr }
        }
      });
    }
  }

  return errors;
}

function checkChapterCoverage(
  chapters: Chapter[],
  totalDuration: number,
  fileName: string,
  minCoverage: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (chapters.length === 0 || totalDuration <= 0) {
    return errors;
  }

  const sortedChapters = [...chapters].sort((a, b) => a.startTime - b.startTime);
  
  let coveredDuration = 0;
  let prevEnd = 0;

  for (const chapter of sortedChapters) {
    const start = Math.max(chapter.startTime, prevEnd);
    const end = chapter.endTime > chapter.startTime ? chapter.endTime : totalDuration;
    
    if (start < end) {
      coveredDuration += end - start;
      prevEnd = end;
    }
  }

  const coverageRatio = coveredDuration / totalDuration;

  if (coverageRatio < minCoverage) {
    errors.push({
      type: 'chapter_coverage_insufficient',
      severity: 'warning',
      message: `章节覆盖率不足：当前覆盖率 ${(coverageRatio * 100).toFixed(1)}%，低于要求的 ${(minCoverage * 100).toFixed(1)}%`,
      fileName,
      details: {
        coverageRatio,
        minCoverage,
        coveredDuration,
        totalDuration
      }
    });
  }

  return errors;
}

function checkChapterTitlePattern(
  chapters: Chapter[],
  fileName: string,
  pattern: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const regex = new RegExp(pattern);

  for (const chapter of chapters) {
    if (!regex.test(chapter.title)) {
      errors.push({
        type: 'chapter_title_format_error',
        severity: 'warning',
        message: `章节标题格式不统一：章节 "${chapter.title}" 不符合要求的格式模式`,
        fileName,
        startTime: chapter.startTime,
        endTime: chapter.endTime,
        startTimeStr: chapter.startTimeStr,
        endTimeStr: chapter.endTimeStr,
        details: {
          title: chapter.title,
          expectedPattern: pattern
        }
      });
    }
  }

  return errors;
}

function checkChaptersInSubtitleRange(
  chapters: Chapter[],
  cues: SubtitleCue[],
  fileName: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (cues.length === 0) return errors;

  const subtitleStart = cues[0].startTime;
  const subtitleEnd = cues[cues.length - 1].endTime;

  for (const chapter of chapters) {
    if (chapter.startTime < subtitleStart) {
      errors.push({
        type: 'chapter_before_subtitles',
        severity: 'warning',
        message: `章节开始时间早于字幕：章节 "${chapter.title}" (${chapter.startTimeStr}) 开始于字幕开始时间 ${cues[0].startTimeStr} 之前`,
        fileName,
        startTime: chapter.startTime,
        endTime: subtitleStart,
        startTimeStr: chapter.startTimeStr,
        endTimeStr: cues[0].startTimeStr,
        details: {
          chapterTitle: chapter.title,
          chapterStartTime: chapter.startTimeStr,
          subtitleStartTime: cues[0].startTimeStr
        }
      });
    }

    const chapterEnd = chapter.endTime > chapter.startTime ? chapter.endTime : subtitleEnd;
    if (chapterEnd > subtitleEnd) {
      errors.push({
        type: 'chapter_after_subtitles',
        severity: 'warning',
        message: `章节结束时间晚于字幕：章节 "${chapter.title}" (${chapter.endTimeStr}) 结束于字幕结束时间 ${cues[cues.length - 1].endTimeStr} 之后`,
        fileName,
        startTime: subtitleEnd,
        endTime: chapterEnd,
        startTimeStr: cues[cues.length - 1].endTimeStr,
        endTimeStr: chapter.endTimeStr,
        details: {
          chapterTitle: chapter.title,
          chapterEndTime: chapter.endTimeStr,
          subtitleEndTime: cues[cues.length - 1].endTimeStr
        }
      });
    }
  }

  return errors;
}

export function validateAdPoints(
  adPoints: AdPoint[],
  subtitleCues: SubtitleCue[],
  options: ValidatorOptions
): ValidationResult {
  const errors: ValidationError[] = [];
  const fileName = options.fileName;

  if (subtitleCues.length === 0) {
    return {
      fileName,
      errors: [{
        type: 'no_subtitles_for_ad_check',
        severity: 'warning',
        message: '无法验证广告点位：没有字幕数据',
        fileName,
        details: {}
      }],
      passed: true,
      errorCount: 0,
      warningCount: 1
    };
  }

  const subtitleStart = subtitleCues[0].startTime;
  const subtitleEnd = subtitleCues[subtitleCues.length - 1].endTime;

  for (const adPoint of adPoints) {
    if (adPoint.startTime < subtitleStart) {
      errors.push({
        type: 'ad_point_before_subtitles',
        severity: 'error',
        message: `广告点位在字幕时间范围之外：广告 "${adPoint.description || adPoint.id}" (${adPoint.startTimeStr}) 开始于字幕开始时间 ${subtitleCues[0].startTimeStr} 之前`,
        fileName,
        startTime: adPoint.startTime,
        endTime: subtitleStart,
        startTimeStr: adPoint.startTimeStr,
        endTimeStr: subtitleCues[0].startTimeStr,
        details: {
          adDescription: adPoint.description,
          adStartTime: adPoint.startTimeStr,
          subtitleStartTime: subtitleCues[0].startTimeStr
        }
      });
    }

    if (adPoint.endTime > subtitleEnd) {
      errors.push({
        type: 'ad_point_after_subtitles',
        severity: 'error',
        message: `广告点位在字幕时间范围之外：广告 "${adPoint.description || adPoint.id}" (${adPoint.endTimeStr}) 结束于字幕结束时间 ${subtitleCues[subtitleCues.length - 1].endTimeStr} 之后`,
        fileName,
        startTime: subtitleEnd,
        endTime: adPoint.endTime,
        startTimeStr: subtitleCues[subtitleCues.length - 1].endTimeStr,
        endTimeStr: adPoint.endTimeStr,
        details: {
          adDescription: adPoint.description,
          adEndTime: adPoint.endTimeStr,
          subtitleEndTime: subtitleCues[subtitleCues.length - 1].endTimeStr
        }
      });
    }

    let overlapsWithSubtitle = false;
    for (const cue of subtitleCues) {
      if (isTimeOverlapping(adPoint.startTime, adPoint.endTime, cue.startTime, cue.endTime)) {
        overlapsWithSubtitle = true;
        break;
      }
    }

    if (!overlapsWithSubtitle) {
      errors.push({
        type: 'ad_point_no_subtitle_overlap',
        severity: 'warning',
        message: `广告点位未落在任何字幕时间范围内：广告 "${adPoint.description || adPoint.id}" (${adPoint.startTimeStr} - ${adPoint.endTimeStr})`,
        fileName,
        startTime: adPoint.startTime,
        endTime: adPoint.endTime,
        startTimeStr: adPoint.startTimeStr,
        endTimeStr: adPoint.endTimeStr,
        details: {
          adDescription: adPoint.description,
          adStartTime: adPoint.startTimeStr,
          adEndTime: adPoint.endTimeStr
        }
      });
    }
  }

  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return {
    fileName,
    errors,
    passed: errorCount === 0,
    errorCount,
    warningCount
  };
}
