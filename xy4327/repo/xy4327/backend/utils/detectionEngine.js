function detectAll(subtitles, terms, speakers) {
  const results = [];
  
  results.push(...detectTimeOverlaps(subtitles));
  results.push(...detectMissingWords(subtitles));
  results.push(...detectSensitiveNames(subtitles, speakers));
  results.push(...detectTermInconsistency(subtitles, terms));
  results.push(...detectSubtitleIssues(subtitles));
  
  return results;
}

function detectTimeOverlaps(subtitles) {
  const overlaps = [];
  
  for (let i = 0; i < subtitles.length - 1; i++) {
    const current = subtitles[i];
    const next = subtitles[i + 1];
    
    if (current.end_seconds > next.start_seconds) {
      const overlapDuration = current.end_seconds - next.start_seconds;
      overlaps.push({
        type: 'time_overlap',
        severity: 'error',
        subtitleId: current.id,
        message: `时间轴重叠: 第 ${current.sequence} 段与第 ${next.sequence} 段重叠`,
        details: {
          currentSequence: current.sequence,
          currentStartTime: current.start_time,
          currentEndTime: current.end_time,
          nextSequence: next.sequence,
          nextStartTime: next.start_time,
          nextEndTime: next.end_time,
          overlapSeconds: overlapDuration.toFixed(3)
        }
      });
    }
  }
  
  return overlaps;
}

function detectMissingWords(subtitles) {
  const issues = [];
  const commonMissingPatterns = [
    /的$/,
    /了$/,
    /在$/,
    /是$/,
    /有$/,
    /和$/,
    /与$/,
    /或$/,
    /但$/,
    /而$/,
    /[a-zA-Z]$/
  ];
  
  subtitles.forEach(sub => {
    const text = sub.current_text || sub.original_text || '';
    
    if (text.length === 0) {
      issues.push({
        type: 'empty_subtitle',
        severity: 'warning',
        subtitleId: sub.id,
        message: `第 ${sub.sequence} 段字幕为空`,
        details: {
          sequence: sub.sequence,
          startTime: sub.start_time,
          endTime: sub.end_time
        }
      });
      return;
    }
    
    commonMissingPatterns.forEach(pattern => {
      if (pattern.test(text)) {
        issues.push({
          type: 'incomplete_sentence',
          severity: 'warning',
          subtitleId: sub.id,
          message: `第 ${sub.sequence} 段可能存在语句不完整`,
          details: {
            sequence: sub.sequence,
            text: text,
            suggestion: '请检查是否有漏字或断句问题'
          }
        });
      }
    });
    
    if (text.length > 0 && text.length < 3) {
      issues.push({
        type: 'short_subtitle',
        severity: 'info',
        subtitleId: sub.id,
        message: `第 ${sub.sequence} 段字幕过短`,
        details: {
          sequence: sub.sequence,
          text: text,
          length: text.length
        }
      });
    }
    
    const duration = sub.end_seconds - sub.start_seconds;
    const readingSpeed = text.length / duration;
    
    if (readingSpeed > 8) {
      issues.push({
        type: 'fast_reading',
        severity: 'warning',
        subtitleId: sub.id,
        message: `第 ${sub.sequence} 段阅读速度过快`,
        details: {
          sequence: sub.sequence,
          text: text,
          duration: duration.toFixed(2),
          readingSpeed: readingSpeed.toFixed(2),
          suggestion: '建议每秒钟阅读速度应控制在 5-8 字'
        }
      });
    }
  });
  
  return issues;
}

function detectSensitiveNames(subtitles, speakers) {
  const issues = [];
  const sensitiveSpeakers = speakers.filter(s => s.is_sensitive === 1 || s.is_sensitive === true);
  
  if (sensitiveSpeakers.length === 0) return issues;
  
  subtitles.forEach(sub => {
    const text = sub.current_text || sub.original_text || '';
    const speaker = sub.speaker || '';
    
    sensitiveSpeakers.forEach(sensitive => {
      const namesToCheck = [sensitive.name];
      if (sensitive.alias) {
        namesToCheck.push(...sensitive.alias.split(/[,，]/).map(a => a.trim()));
      }
      
      namesToCheck.forEach(name => {
        if (name.length < 2) return;
        
        const regex = new RegExp(escapeRegExp(name), 'g');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          issues.push({
            type: 'sensitive_name',
            severity: 'error',
            subtitleId: sub.id,
            message: `第 ${sub.sequence} 段包含敏感姓名: ${name}`,
            details: {
              sequence: sub.sequence,
              text: text,
              sensitiveName: name,
              suggestion: '请替换为代号或其他替代名称',
              position: match.index
            }
          });
        }
        
        if (speaker === name || (speaker && speaker.includes(name))) {
          issues.push({
            type: 'sensitive_speaker',
            severity: 'error',
            subtitleId: sub.id,
            message: `第 ${sub.sequence} 段说话人为敏感人物: ${speaker}`,
            details: {
              sequence: sub.sequence,
              speaker: speaker,
              sensitiveName: name,
              suggestion: '请替换说话人标识'
            }
          });
        }
      });
    });
  });
  
  return issues;
}

function detectTermInconsistency(subtitles, terms) {
  const issues = [];
  const termMappings = [];
  
  terms.forEach(term => {
    if (term.term && term.replacement && term.term !== term.replacement) {
      termMappings.push({
        searchTerm: term.term,
        preferredTerm: term.replacement,
        category: term.category
      });
    }
  });
  
  if (termMappings.length === 0) return issues;
  
  termMappings.sort((a, b) => b.searchTerm.length - a.searchTerm.length);
  
  subtitles.forEach(sub => {
    const text = sub.current_text || sub.original_text || '';
    const foundIssues = [];
    const usedPositions = new Set();
    
    termMappings.forEach(mapping => {
      const regex = new RegExp(escapeRegExp(mapping.searchTerm), 'gi');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const matchedText = text.substring(match.index, match.index + mapping.searchTerm.length);
        const matchStart = match.index;
        const matchEnd = match.index + mapping.searchTerm.length;
        
        let overlaps = false;
        for (let pos of usedPositions) {
          const [start, end] = pos;
          if (!(matchEnd <= start || matchStart >= end)) {
            overlaps = true;
            break;
          }
        }
        
        if (!overlaps && matchedText !== mapping.preferredTerm) {
          foundIssues.push({
            found: matchedText,
            expected: mapping.preferredTerm,
            category: mapping.category,
            start: matchStart,
            end: matchEnd
          });
          usedPositions.add([matchStart, matchEnd]);
        }
      }
    });
    
    foundIssues.forEach(issue => {
      issues.push({
        type: 'term_inconsistency',
        severity: 'warning',
        subtitleId: sub.id,
        message: `第 ${sub.sequence} 段术语不一致: "${issue.found}" 建议使用 "${issue.expected}"`,
        details: {
          sequence: sub.sequence,
          text: text,
          found: issue.found,
          expected: issue.expected,
          category: issue.category,
          suggestion: `建议将 "${issue.found}" 替换为 "${issue.expected}"`
        }
      });
    });
  });
  
  return issues;
}

function detectEmptySubtitles(subtitles) {
  return subtitles
    .filter(sub => !(sub.current_text || sub.original_text || '').trim())
    .map(sub => ({
      type: 'empty_subtitle',
      severity: 'warning',
      subtitleId: sub.id,
      message: `第 ${sub.sequence} 段字幕为空`,
      details: {
        sequence: sub.sequence,
        startTime: sub.start_time,
        endTime: sub.end_time
      }
    }));
}

function detectSubtitleIssues(subtitles) {
  const issues = [];
  
  subtitles.forEach((sub, index) => {
    if (index < subtitles.length - 1) {
      const next = subtitles[index + 1];
      const gap = next.start_seconds - sub.end_seconds;
      
      if (gap > 5) {
        issues.push({
          type: 'large_gap',
          severity: 'info',
          subtitleId: sub.id,
          message: `第 ${sub.sequence} 段与第 ${next.sequence} 段之间间隔过大`,
          details: {
            currentSequence: sub.sequence,
            nextSequence: next.sequence,
            gapSeconds: gap.toFixed(2),
            suggestion: '请检查是否有遗漏的字幕'
          }
        });
      }
    }
    
    const duration = sub.end_seconds - sub.start_seconds;
    if (duration < 0.5) {
      issues.push({
        type: 'too_short',
        severity: 'warning',
        subtitleId: sub.id,
        message: `第 ${sub.sequence} 段持续时间过短`,
        details: {
          sequence: sub.sequence,
          duration: duration.toFixed(2),
          suggestion: '建议至少 0.5 秒以上'
        }
      });
    }
    
    if (duration > 10) {
      issues.push({
        type: 'too_long',
        severity: 'info',
        subtitleId: sub.id,
        message: `第 ${sub.sequence} 段持续时间过长`,
        details: {
          sequence: sub.sequence,
          duration: duration.toFixed(2),
          suggestion: '建议拆分为多个字幕段'
        }
      });
    }
    
    const text = sub.current_text || sub.original_text || '';
    if (text.includes('。。') || text.includes('，，') || text.includes('、、')) {
      issues.push({
        type: 'duplicate_punctuation',
        severity: 'warning',
        subtitleId: sub.id,
        message: `第 ${sub.sequence} 段存在重复标点`,
        details: {
          sequence: sub.sequence,
          text: text,
          suggestion: '请检查并修正重复的标点符号'
        }
      });
    }
  });
  
  return issues;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateVariations(term) {
  const variations = [];
  const chars = term.split('');
  
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j <= chars.length; j++) {
      const sub = chars.slice(i, j).join('');
      if (sub.length >= 2 && sub !== term) {
        variations.push(sub.toLowerCase());
      }
    }
  }
  
  return [...new Set(variations)];
}

module.exports = {
  detectAll,
  detectTimeOverlaps,
  detectMissingWords,
  detectSensitiveNames,
  detectTermInconsistency,
  detectEmptySubtitles
};