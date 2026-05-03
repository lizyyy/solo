import { ValidationError, FixSuggestion, ProjectValidationResult } from '../types';

function createSuggestionForError(error: ValidationError): FixSuggestion {
  const typeHandlers: Record<string, (error: ValidationError) => FixSuggestion> = {
    'time_out_of_order': handleTimeOutOfOrder,
    'time_overlap': handleTimeOverlap,
    'subtitle_overlap': handleSubtitleOverlap,
    'silence_gap_too_large': handleSilenceGap,
    'subtitle_too_long': handleSubtitleTooLong,
    'sensitive_word': handleSensitiveWord,
    'no_chapters': handleNoChapters,
    'chapter_time_out_of_order': handleChapterTimeOutOfOrder,
    'chapter_coverage_insufficient': handleChapterCoverage,
    'chapter_title_format_error': handleChapterTitleFormat,
    'chapter_before_subtitles': handleChapterBeforeSubtitles,
    'chapter_after_subtitles': handleChapterAfterSubtitles,
    'ad_point_before_subtitles': handleAdPointBeforeSubtitles,
    'ad_point_after_subtitles': handleAdPointAfterSubtitles,
    'ad_point_no_subtitle_overlap': handleAdPointNoOverlap,
    'no_subtitles_for_ad_check': handleNoSubtitlesForAdCheck
  };

  const handler = typeHandlers[error.type] || handleUnknownError;
  return handler(error);
}

function handleTimeOutOfOrder(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, fileName, cueId } = error;
  return {
    error,
    suggestion: `调整字幕时间顺序，确保字幕按时间递增排列`,
    steps: [
      `打开文件: ${fileName}`,
      `找到字幕 #${cueId} (开始时间: ${startTimeStr})`,
      `检查前一个字幕 #${details?.previousCueId} (开始时间: ${details?.previousStartTime})`,
      `将字幕 #${cueId} 的开始时间调整到 ${details?.previousStartTime} 之后`,
      `确保字幕时间按递增顺序排列`
    ],
    priority: 'high'
  };
}

function handleTimeOverlap(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, endTimeStr, fileName } = error;
  const overlapDuration = details?.overlapDuration || 0;
  
  return {
    error,
    suggestion: `修复字幕时间重叠问题，重叠时长 ${overlapDuration.toFixed(3)} 秒`,
    steps: [
      `打开文件: ${fileName}`,
      `找到时间范围 ${startTimeStr} - ${endTimeStr}`,
      `检查字幕 #${details?.cue1Id} 和 #${details?.cue2Id}`,
      `将后一个字幕的开始时间调整到前一个字幕结束时间之后`,
      `或者缩短前一个字幕的结束时间，确保两个字幕之间至少有 0.1 秒间隔`
    ],
    priority: 'high'
  };
}

function handleSubtitleOverlap(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, endTimeStr, fileName } = error;
  const cue1 = details?.cue1;
  const cue2 = details?.cue2;
  const overlapDuration = details?.overlapDuration || 0;

  return {
    error,
    suggestion: `修复字幕重叠，重叠时长 ${overlapDuration.toFixed(3)} 秒`,
    steps: [
      `打开文件: ${fileName}`,
      `检查重叠的两个字幕:`,
      `  - 字幕 #${cue1?.id}: "${cue1?.text?.substring(0, 30)}..."`,
      `  - 字幕 #${cue2?.id}: "${cue2?.text?.substring(0, 30)}..."`,
      `时间范围: ${startTimeStr} - ${endTimeStr}`,
      `建议操作:`,
      `  1. 如果是两段内容连在一起，考虑合并成一个字幕`,
      `  2. 如果是两段独立内容，确保第一个字幕结束时间小于第二个字幕开始时间`,
      `  3. 两个字幕之间建议至少保留 0.1 秒的间隔`
    ],
    priority: 'high'
  };
}

function handleSilenceGap(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, endTimeStr, fileName, cueId } = error;
  const gapDuration = details?.gapDuration || 0;
  const maxAllowed = details?.maxAllowedGap || 5;

  return {
    error,
    suggestion: `检查静音空档，当前 ${gapDuration.toFixed(1)} 秒，超过阈值 ${maxAllowed} 秒`,
    steps: [
      `打开文件: ${fileName}`,
      `检查时间范围 ${startTimeStr} - ${endTimeStr}`,
      `涉及字幕: ${cueId}`,
      `建议操作:`,
      `  1. 如果确实是长静音，可以忽略此警告`,
      `  2. 如果是字幕遗漏，请补充缺失的字幕内容`,
      `  3. 如果是时间轴问题，请调整前一个字幕的结束时间或后一个字幕的开始时间`
    ],
    priority: 'medium'
  };
}

function handleSubtitleTooLong(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, endTimeStr, fileName, cueId } = error;
  const actualLength = details?.actualLength || 0;
  const maxLength = details?.maxLength || 40;
  const text = details?.text || '';

  return {
    error,
    suggestion: `缩短字幕长度，当前 ${actualLength} 字符，限制 ${maxLength} 字符`,
    steps: [
      `打开文件: ${fileName}`,
      `找到字幕 #${cueId} (${startTimeStr} - ${endTimeStr})`,
      `原字幕内容: "${text}"`,
      `建议操作:`,
      `  1. 将长句拆分成多个短字幕`,
      `  2. 每个字幕建议控制在 ${maxLength} 字符以内`,
      `  3. 拆分时注意语义完整，不要在词语中间断开`,
      `  4. 示例: "今天天气很好，我们一起去公园散步" 可拆为:`,
      `     - "今天天气很好，"`,
      `     - "我们一起去公园散步"`
    ],
    priority: 'high'
  };
}

function handleSensitiveWord(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, endTimeStr, fileName, cueId } = error;
  const word = details?.word || '';
  const text = details?.text || '';

  return {
    error,
    suggestion: `检查敏感词 "${word}"，确认是否需要替换或删除`,
    steps: [
      `打开文件: ${fileName}`,
      `找到字幕 #${cueId} (${startTimeStr} - ${endTimeStr})`,
      `原字幕内容: "${text}"`,
      `敏感词: "${word}"`,
      `建议操作:`,
      `  1. 确认这个词是否真的需要替换`,
      `  2. 如果需要替换，使用同义词或中性表达`,
      `  3. 如果是误报，可以在配置文件中排除此词`
    ],
    priority: 'medium'
  };
}

function handleNoChapters(error: ValidationError): FixSuggestion {
  const { fileName } = error;
  return {
    error,
    suggestion: `添加章节信息`,
    steps: [
      `检查文件: ${fileName}`,
      `确认章节 CSV 文件是否存在`,
      `建议操作:`,
      `  1. 查看项目目录中是否有 chapters.csv 或类似文件`,
      `  2. 如果没有，需要创建章节 CSV 文件`,
      `  3. 章节 CSV 格式示例:`,
      `     start_time,title`,
      `     00:00:00,开场介绍`,
      `     00:05:30,第一部分：核心概念`
    ],
    priority: 'high'
  };
}

function handleChapterTimeOutOfOrder(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, fileName } = error;
  const chapter1 = details?.chapter1;
  const chapter2 = details?.chapter2;

  return {
    error,
    suggestion: `调整章节时间顺序`,
    steps: [
      `打开文件: ${fileName}`,
      `检查章节时间顺序:`,
      `  - 章节 "${chapter1?.title}" (${chapter1?.startTime})`,
      `  - 章节 "${chapter2?.title}" (${chapter2?.startTime})`,
      `问题: 后一个章节开始时间早于前一个章节`,
      `建议操作:`,
      `  1. 检查章节时间是否填写错误`,
      `  2. 确保章节按时间递增顺序排列`,
      `  3. 调整 "${chapter2?.title}" 的开始时间到 ${chapter1?.startTime} 之后`
    ],
    priority: 'high'
  };
}

function handleChapterCoverage(error: ValidationError): FixSuggestion {
  const { details, fileName } = error;
  const coverageRatio = details?.coverageRatio || 0;
  const minCoverage = details?.minCoverage || 0.9;

  return {
    error,
    suggestion: `补充章节信息以提高覆盖率`,
    steps: [
      `打开文件: ${fileName}`,
      `当前覆盖率: ${(coverageRatio * 100).toFixed(1)}%`,
      `要求覆盖率: ${(minCoverage * 100).toFixed(1)}%`,
      `建议操作:`,
      `  1. 检查视频内容，找出未被章节覆盖的时间段`,
      `  2. 添加缺失的章节`,
      `  3. 确保第一个章节从 00:00:00 开始`,
      `  4. 章节之间的间隔不要过大`
    ],
    priority: 'medium'
  };
}

function handleChapterTitleFormat(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, fileName } = error;
  const title = details?.title || '';
  const pattern = details?.expectedPattern || '';

  return {
    error,
    suggestion: `统一章节标题格式`,
    steps: [
      `打开文件: ${fileName}`,
      `问题章节: "${title}" (${startTimeStr})`,
      `预期格式模式: ${pattern}`,
      `建议操作:`,
      `  1. 参考其他章节的标题格式`,
      `  2. 确保标题符合统一的命名规范`,
      `  3. 例如: "01. 开场介绍"、"第一章：核心概念" 等格式`
    ],
    priority: 'low'
  };
}

function handleChapterBeforeSubtitles(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, endTimeStr, fileName } = error;
  const chapterTitle = details?.chapterTitle || '';
  const chapterStartTime = details?.chapterStartTime || '';
  const subtitleStartTime = details?.subtitleStartTime || '';

  return {
    error,
    suggestion: `调整章节开始时间到字幕范围之内`,
    steps: [
      `打开文件: ${fileName}`,
      `章节: "${chapterTitle}"`,
      `章节开始时间: ${chapterStartTime}`,
      `字幕开始时间: ${subtitleStartTime}`,
      `时间范围问题: ${startTimeStr} - ${endTimeStr}`,
      `建议操作:`,
      `  1. 将章节开始时间调整到 ${subtitleStartTime} 或之后`,
      `  2. 或者确认字幕开始时间是否正确`
    ],
    priority: 'medium'
  };
}

function handleChapterAfterSubtitles(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, endTimeStr, fileName } = error;
  const chapterTitle = details?.chapterTitle || '';
  const chapterEndTime = details?.chapterEndTime || '';
  const subtitleEndTime = details?.subtitleEndTime || '';

  return {
    error,
    suggestion: `调整章节结束时间到字幕范围之内`,
    steps: [
      `打开文件: ${fileName}`,
      `章节: "${chapterTitle}"`,
      `章节结束时间: ${chapterEndTime}`,
      `字幕结束时间: ${subtitleEndTime}`,
      `时间范围问题: ${startTimeStr} - ${endTimeStr}`,
      `建议操作:`,
      `  1. 将章节结束时间调整到 ${subtitleEndTime} 或之前`,
      `  2. 或者确认字幕结束时间是否正确`
    ],
    priority: 'medium'
  };
}

function handleAdPointBeforeSubtitles(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, endTimeStr, fileName } = error;
  const adDesc = details?.adDescription || '';
  const adStartTime = details?.adStartTime || '';
  const subtitleStartTime = details?.subtitleStartTime || '';

  return {
    error,
    suggestion: `调整广告点位开始时间到字幕范围之内`,
    steps: [
      `打开文件: ${fileName}`,
      `广告点位: "${adDesc}"`,
      `广告开始时间: ${adStartTime}`,
      `字幕开始时间: ${subtitleStartTime}`,
      `时间范围问题: ${startTimeStr} - ${endTimeStr}`,
      `建议操作:`,
      `  1. 将广告点位开始时间调整到 ${subtitleStartTime} 或之后`,
      `  2. 确认广告点位时间是否正确`,
      `  3. 检查字幕文件时间轴是否完整`
    ],
    priority: 'high'
  };
}

function handleAdPointAfterSubtitles(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, endTimeStr, fileName } = error;
  const adDesc = details?.adDescription || '';
  const adEndTime = details?.adEndTime || '';
  const subtitleEndTime = details?.subtitleEndTime || '';

  return {
    error,
    suggestion: `调整广告点位结束时间到字幕范围之内`,
    steps: [
      `打开文件: ${fileName}`,
      `广告点位: "${adDesc}"`,
      `广告结束时间: ${adEndTime}`,
      `字幕结束时间: ${subtitleEndTime}`,
      `时间范围问题: ${startTimeStr} - ${endTimeStr}`,
      `建议操作:`,
      `  1. 将广告点位结束时间调整到 ${subtitleEndTime} 或之前`,
      `  2. 确认广告点位时间是否正确`,
      `  3. 检查字幕文件时间轴是否完整`
    ],
    priority: 'high'
  };
}

function handleAdPointNoOverlap(error: ValidationError): FixSuggestion {
  const { details, startTimeStr, endTimeStr, fileName } = error;
  const adDesc = details?.adDescription || '';
  const adStartTime = details?.adStartTime || '';
  const adEndTime = details?.adEndTime || '';

  return {
    error,
    suggestion: `检查广告点位时间，确保与至少一个字幕时间段重叠`,
    steps: [
      `打开文件: ${fileName}`,
      `广告点位: "${adDesc}"`,
      `广告时间: ${adStartTime} - ${adEndTime}`,
      `问题: 此广告点位不与任何字幕时间段重叠`,
      `建议操作:`,
      `  1. 检查广告点位时间是否正确`,
      `  2. 确认字幕文件是否完整`,
      `  3. 调整广告点位时间，确保落在某个字幕时间段内`,
      `  4. 如果广告是在无语音的时间段，可以忽略此警告`
    ],
    priority: 'medium'
  };
}

function handleNoSubtitlesForAdCheck(error: ValidationError): FixSuggestion {
  const { fileName } = error;
  return {
    error,
    suggestion: `添加字幕文件以便验证广告点位`,
    steps: [
      `检查项目目录`,
      `当前状态: 没有找到字幕文件`,
      `影响: 无法验证广告点位是否落在字幕时间范围内`,
      `建议操作:`,
      `  1. 添加 .srt 或 .vtt 格式的字幕文件`,
      `  2. 确认字幕文件路径配置正确`,
      `  3. 如果确实不需要字幕，可以忽略此警告`
    ],
    priority: 'low'
  };
}

function handleUnknownError(error: ValidationError): FixSuggestion {
  const { fileName, startTimeStr, endTimeStr, message } = error;
  return {
    error,
    suggestion: `检查并修复问题: ${message}`,
    steps: [
      `打开文件: ${fileName}`,
      `时间范围: ${startTimeStr || '未知'} - ${endTimeStr || '未知'}`,
      `问题描述: ${message}`,
      `建议操作:`,
      `  1. 仔细检查相关内容`,
      `  2. 参考其他类似问题的修复方式`,
      `  3. 如有疑问，检查原始素材和时间轴`
    ],
    priority: 'medium'
  };
}

export function generateFixSuggestions(
  validationResult: ProjectValidationResult
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  const allErrors: ValidationError[] = [];

  for (const subtitleResult of validationResult.results.subtitles) {
    allErrors.push(...subtitleResult.errors);
  }

  if (validationResult.results.chapters) {
    allErrors.push(...validationResult.results.chapters.errors);
  }

  if (validationResult.results.adPoints) {
    allErrors.push(...validationResult.results.adPoints.errors);
  }

  for (const error of allErrors) {
    const suggestion = createSuggestionForError(error);
    suggestions.push(suggestion);
  }

  suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return suggestions;
}

export function formatSuggestionsForDisplay(suggestions: FixSuggestion[]): string {
  if (suggestions.length === 0) {
    return '✅ 未发现问题，无需修复建议。';
  }

  let output = `\n📋 修复建议 (共 ${suggestions.length} 项)\n`;
  output += '=' .repeat(60) + '\n\n';

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const suggestion of suggestions) {
    if (suggestion.priority === 'high') highCount++;
    else if (suggestion.priority === 'medium') mediumCount++;
    else lowCount++;
  }

  output += `📊 优先级统计:\n`;
  output += `   🔴 高优先级: ${highCount} 项\n`;
  output += `   🟡 中优先级: ${mediumCount} 项\n`;
  output += `   🟢 低优先级: ${lowCount} 项\n\n`;

  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    const priorityMarker = suggestion.priority === 'high' ? '🔴' : 
                           suggestion.priority === 'medium' ? '🟡' : '🟢';
    
    output += `${priorityMarker} 问题 ${i + 1}/${suggestions.length}\n`;
    output += `   问题类型: ${suggestion.error.type}\n`;
    output += `   文件: ${suggestion.error.fileName}\n`;
    if (suggestion.error.startTimeStr) {
      output += `   时间: ${suggestion.error.startTimeStr} - ${suggestion.error.endTimeStr || ''}\n`;
    }
    output += `\n   问题描述: ${suggestion.error.message}\n`;
    output += `\n   💡 修复建议:\n`;
    
    for (let j = 0; j < suggestion.steps.length; j++) {
      output += `      ${j + 1}. ${suggestion.steps[j]}\n`;
    }
    
    output += '\n' + '-'.repeat(60) + '\n\n';
  }

  return output;
}
