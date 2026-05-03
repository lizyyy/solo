import {
  DeliveryRule,
  SubtitleFile,
  SubtitleCue,
  ValidationIssue,
  LanguageCoverageReport
} from './types';

export class RulesEngine {
  private rules: DeliveryRule;

  constructor(rules: DeliveryRule) {
    this.rules = rules;
  }

  validateFile(file: SubtitleFile): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    issues.push(...this.validateNaming(file));
    issues.push(...this.validateTiming(file));
    issues.push(...this.validateReadingSpeed(file));
    issues.push(...this.validateText(file));
    issues.push(...this.validateForbiddenWords(file));
    
    return issues;
  }

  validateNaming(file: SubtitleFile): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const { naming } = this.rules;
    const fileName = file.fileName;
    
    const expectedPattern = naming.pattern
      .replace('{platform}', '[a-zA-Z0-9_-]+')
      .replace('{episode}', '(e|ep)?\\d{1,4}')
      .replace('{language}', '(zh|en|es|pt|ar|id|vi|th|ja|ko)(-[a-zA-Z]+)?')
      .replace('{ext}', '\\.(srt|vtt)');
    
    const regex = new RegExp(expectedPattern, 'i');
    
    if (!regex.test(fileName)) {
      issues.push({
        file: file.fileName,
        severity: 'error',
        category: 'naming',
        message: `文件名不符合规范：${fileName}`,
        suggestion: `期望格式：${naming.pattern}（示例：tiktok_ep001_zh.srt）`
      });
    }
    
    if (file.language === 'unknown') {
      issues.push({
        file: file.fileName,
        severity: 'warning',
        category: 'naming',
        message: '无法识别语言代码',
        suggestion: '请在文件名中包含有效的语言代码（如 zh, en, es 等）'
      });
    }
    
    if (file.episode === 'unknown') {
      issues.push({
        file: file.fileName,
        severity: 'warning',
        category: 'naming',
        message: '无法识别集数',
        suggestion: '请在文件名中包含集数（如 ep001, e01, 001 等）'
      });
    }
    
    if (file.platform === 'unknown') {
      issues.push({
        file: file.fileName,
        severity: 'warning',
        category: 'naming',
        message: '无法识别平台代码',
        suggestion: '请在文件名开头包含平台标识（如 tiktok, youtube 等）'
      });
    }
    
    return issues;
  }

  validateTiming(file: SubtitleFile): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const { timing } = this.rules;
    const cues = file.cues;
    
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      const duration = cue.endTime - cue.startTime;
      
      if (duration < timing.minCueDuration) {
        issues.push({
          file: file.fileName,
          severity: 'error',
          category: 'timing',
          cueId: cue.id,
          startTime: cue.startTime,
          endTime: cue.endTime,
          message: `字幕 #${cue.id} 持续时间过短：${duration}ms（最小：${timing.minCueDuration}ms）`,
          suggestion: `建议延长至至少 ${timing.minCueDuration}ms`
        });
      }
      
      if (duration > timing.maxCueDuration) {
        issues.push({
          file: file.fileName,
          severity: 'warning',
          category: 'timing',
          cueId: cue.id,
          startTime: cue.startTime,
          endTime: cue.endTime,
          message: `字幕 #${cue.id} 持续时间过长：${duration}ms（最大：${timing.maxCueDuration}ms）`,
          suggestion: `建议拆分为多个字幕或缩短至 ${timing.maxCueDuration}ms 以内`
        });
      }
      
      if (i < cues.length - 1) {
        const nextCue = cues[i + 1];
        const gap = nextCue.startTime - cue.endTime;
        
        if (!timing.allowOverlap && gap < 0) {
          issues.push({
            file: file.fileName,
            severity: 'error',
            category: 'timing',
            cueId: cue.id,
            startTime: cue.startTime,
            endTime: cue.endTime,
            message: `字幕 #${cue.id} 与 #${nextCue.id} 时间重叠，重叠时长：${Math.abs(gap)}ms`,
            suggestion: `请调整时间轴，确保字幕之间不重叠`
          });
        }
        
        if (gap > 0 && gap < timing.minGapBetweenCues) {
          issues.push({
            file: file.fileName,
            severity: 'warning',
            category: 'timing',
            cueId: cue.id,
            startTime: cue.startTime,
            endTime: cue.endTime,
            message: `字幕 #${cue.id} 与 #${nextCue.id} 间隔过小：${gap}ms（最小：${timing.minGapBetweenCues}ms）`,
            suggestion: `建议增加间隔至 ${timing.minGapBetweenCues}ms 以上`
          });
        }
      }
    }
    
    return issues;
  }

  validateReadingSpeed(file: SubtitleFile): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const { languages } = this.rules;
    const cues = file.cues;
    
    const langRule = languages.find(l => 
      file.language.startsWith(l.code) || l.code === file.language
    );
    
    if (!langRule) {
      return [
        {
          file: file.fileName,
          severity: 'warning',
          category: 'text',
          message: `未找到语言 ${file.language} 的阅读速度规则`,
          suggestion: '请在规则配置中添加该语言的阅读速度配置'
        }
      ];
    }
    
    const readingSpeed = langRule.readingSpeed;
    
    for (const cue of cues) {
      const textWithoutTags = cue.text
        .replace(/<[^>]+>/g, '')
        .replace(/\{[^}]+\}/g, '')
        .trim();
      
      if (!textWithoutTags) continue;
      
      const charCount = textWithoutTags.replace(/\s/g, '').length;
      const durationSec = (cue.endTime - cue.startTime) / 1000;
      
      const actualSpeed = charCount / durationSec;
      
      if (actualSpeed > readingSpeed) {
        issues.push({
          file: file.fileName,
          severity: 'warning',
          category: 'text',
          cueId: cue.id,
          startTime: cue.startTime,
          endTime: cue.endTime,
          message: `字幕 #${cue.id} 阅读速度过快：${actualSpeed.toFixed(1)} 字/秒（限制：${readingSpeed} 字/秒）`,
          suggestion: `当前文本：${textWithoutTags.substring(0, 50)}... 建议延长显示时间或拆分字幕`
        });
      }
      
      const lineCount = cue.text.split('\n').length;
      if (lineCount > langRule.maxLinesPerCue) {
        issues.push({
          file: file.fileName,
          severity: 'warning',
          category: 'text',
          cueId: cue.id,
          startTime: cue.startTime,
          endTime: cue.endTime,
          message: `字幕 #${cue.id} 行数过多：${lineCount} 行（限制：${langRule.maxLinesPerCue} 行）`,
          suggestion: `建议拆分为多个字幕，每个字幕不超过 ${langRule.maxLinesPerCue} 行`
        });
      }
    }
    
    return issues;
  }

  validateText(file: SubtitleFile): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const { text } = this.rules;
    const cues = file.cues;
    
    for (const cue of cues) {
      const lines = cue.text.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (!text.allowEmptyLines && line.trim() === '') {
          issues.push({
            file: file.fileName,
            severity: 'warning',
            category: 'text',
            cueId: cue.id,
            startTime: cue.startTime,
            endTime: cue.endTime,
            message: `字幕 #${cue.id} 包含空行`,
            suggestion: '请移除非必要的空行'
          });
        }
        
        if (text.maxLineLength > 0 && line.length > text.maxLineLength) {
          issues.push({
            file: file.fileName,
            severity: 'warning',
            category: 'text',
            cueId: cue.id,
            startTime: cue.startTime,
            endTime: cue.endTime,
            message: `字幕 #${cue.id} 单行过长：${line.length} 字符（限制：${text.maxLineLength}）`,
            suggestion: `建议拆分为多行或简化文本`
          });
        }
      }
      
      if (text.checkPunctuation) {
        const textWithoutTags = cue.text.replace(/<[^>]+>/g, '').trim();
        
        if (textWithoutTags.length > 0) {
          const endChar = textWithoutTags[textWithoutTags.length - 1];
          const validEndChars = ['.', '!', '?', '。', '！', '？', '…', '~', '～'];
          
          if (!validEndChars.includes(endChar) && !/[\w\d]/.test(endChar)) {
            const cnPunctuation = /[\u4e00-\u9fa5]/.test(textWithoutTags);
            
            if (cnPunctuation && !['。', '！', '？', '…'].includes(endChar)) {
              issues.push({
                file: file.fileName,
                severity: 'info',
                category: 'text',
                cueId: cue.id,
                startTime: cue.startTime,
                endTime: cue.endTime,
                message: `字幕 #${cue.id} 可能缺少中文句末标点`,
                suggestion: `中文建议使用句号、感叹号或问号结尾`
              });
            }
          }
        }
      }
    }
    
    return issues;
  }

  validateForbiddenWords(file: SubtitleFile): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const { forbiddenWords } = this.rules;
    
    if (!forbiddenWords.enabled || forbiddenWords.words.length === 0) {
      return issues;
    }
    
    const flags = forbiddenWords.caseSensitive ? 'g' : 'gi';
    
    for (const cue of file.cues) {
      for (const word of forbiddenWords.words) {
        const regex = new RegExp(this.escapeRegExp(word), flags);
        const matches = [...cue.text.matchAll(regex)];
        
        if (matches.length > 0) {
          issues.push({
            file: file.fileName,
            severity: 'error',
            category: 'forbidden-word',
            cueId: cue.id,
            startTime: cue.startTime,
            endTime: cue.endTime,
            message: `字幕 #${cue.id} 包含禁用词：${matches.map(m => m[0]).join(', ')}`,
            suggestion: '请替换或移除禁用词'
          });
        }
      }
    }
    
    return issues;
  }

  checkLanguageCoverage(
    files: SubtitleFile[],
    platforms: { name: string; code: string; requiredLanguages: string[] }[]
  ): LanguageCoverageReport[] {
    const reports: LanguageCoverageReport[] = [];
    const episodePlatformMap = new Map<string, Set<string>>();
    
    for (const file of files) {
      const key = `${file.episode}:${file.platform}`;
      if (!episodePlatformMap.has(key)) {
        episodePlatformMap.set(key, new Set());
      }
      episodePlatformMap.get(key)!.add(file.language);
    }
    
    for (const platform of platforms) {
      const platformFiles = files.filter(f => f.platform === platform.code || f.platform === platform.name);
      const episodes = new Set(platformFiles.map(f => f.episode));
      
      for (const episode of episodes) {
        const key = `${episode}:${platform.code}`;
        const presentLanguages = episodePlatformMap.get(key) || new Set();
        
        const present = Array.from(presentLanguages);
        const missing = platform.requiredLanguages.filter(lang => !presentLanguages.has(lang));
        
        reports.push({
          episode,
          platform: platform.code,
          required: platform.requiredLanguages,
          present,
          missing,
          complete: missing.length === 0
        });
      }
    }
    
    return reports;
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  updateRules(rules: DeliveryRule): void {
    this.rules = rules;
  }

  getRules(): DeliveryRule {
    return { ...this.rules };
  }
}
