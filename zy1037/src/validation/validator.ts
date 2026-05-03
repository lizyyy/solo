import * as fs from 'fs-extra';
import * as path from 'path';
import {
  Manifest,
  ValidationIssue,
  ValidationResult,
  AudioInfo,
  LoudnessResult,
  SilenceDetection,
} from '../types';
import { parseTime, formatTime, isValidTimeFormat } from '../utils/time';

let issueCounter = 0;
function generateIssueId(): string {
  issueCounter++;
  return `ISSUE-${String(issueCounter).padStart(4, '0')}`;
}

export function resetIssueCounter(): void {
  issueCounter = 0;
}

export interface ValidationContext {
  manifest: Manifest;
  baseDir: string;
  audioInfos?: Map<string, {
    info: AudioInfo;
    loudness?: LoudnessResult;
    silence?: SilenceDetection;
  }>;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: ValidationIssue['category'];
  severity: ValidationIssue['severity'];
  validate: (context: ValidationContext) => ValidationIssue[];
}

export function createFileExistsRule(): ValidationRule {
  return {
    id: 'file-exists',
    name: '文件存在性检查',
    description: '检查 manifest 中引用的音频文件是否存在',
    category: 'file',
    severity: 'error',
    validate: (context: ValidationContext): ValidationIssue[] => {
      const issues: ValidationIssue[] = [];
      const { manifest, baseDir } = context;

      for (const audioFile of manifest.audioFiles) {
        const filePath = path.isAbsolute(audioFile.path)
          ? audioFile.path
          : path.resolve(baseDir, audioFile.path);

        const exists = fs.pathExistsSync(filePath);
        
        if (!exists) {
          issues.push({
            id: generateIssueId(),
            severity: 'error',
            category: 'file',
            message: `音频文件不存在: ${audioFile.path}`,
            detail: `文件路径: ${filePath}`,
            suggestion: '检查文件路径是否正确，或确认文件已存在于指定位置',
            context: {
              audioId: audioFile.id,
              role: audioFile.role,
              expectedPath: filePath,
            },
          });
        }
      }

      return issues;
    },
  };
}

export function createNamingRule(): ValidationRule {
  return {
    id: 'naming-convention',
    name: '命名规则检查',
    description: '检查文件名是否符合指定的命名规则',
    category: 'naming',
    severity: 'warning',
    validate: (context: ValidationContext): ValidationIssue[] => {
      const issues: ValidationIssue[] = [];
      const { manifest } = context;

      if (!manifest.namingRules?.pattern) {
        return issues;
      }

      let regex: RegExp;
      try {
        regex = new RegExp(manifest.namingRules.pattern);
      } catch {
        issues.push({
          id: generateIssueId(),
          severity: 'error',
          category: 'naming',
          message: '命名规则正则表达式无效',
          detail: `正则表达式: ${manifest.namingRules.pattern}`,
          suggestion: '检查正则表达式语法是否正确',
          context: { pattern: manifest.namingRules.pattern },
        });
        return issues;
      }

      for (const audioFile of manifest.audioFiles) {
        const fileName = path.basename(audioFile.path);
        
        if (!regex.test(fileName)) {
          issues.push({
            id: generateIssueId(),
            severity: 'warning',
            category: 'naming',
            message: `文件名不符合命名规则: ${fileName}`,
            detail: `期望模式: ${manifest.namingRules.pattern}\n${manifest.namingRules.description || ''}`,
            suggestion: manifest.namingRules.examples?.length
              ? `参考示例: ${manifest.namingRules.examples.join(', ')}`
              : '请重命名文件以符合规范',
            context: {
              audioId: audioFile.id,
              fileName,
              pattern: manifest.namingRules.pattern,
            },
          });
        }
      }

      return issues;
    },
  };
}

export function createChapterTimingRule(): ValidationRule {
  return {
    id: 'chapter-timing',
    name: '章节时间检查',
    description: '检查章节时间是否有效且不超出音频长度',
    category: 'chapter',
    severity: 'error',
    validate: (context: ValidationContext): ValidationIssue[] => {
      const issues: ValidationIssue[] = [];
      const { manifest, audioInfos } = context;

      if (!manifest.chapters || manifest.chapters.length === 0) {
        return issues;
      }

      for (const chapter of manifest.chapters) {
        if (!isValidTimeFormat(chapter.startTime)) {
          issues.push({
            id: generateIssueId(),
            severity: 'error',
            category: 'chapter',
            message: `章节时间格式无效: ${chapter.title}`,
            detail: `时间值: ${chapter.startTime}`,
            suggestion: '使用有效的时间格式: HH:MM:SS.mmm, MM:SS.mmm, 或 SS.mmm',
            context: {
              chapterId: chapter.id,
              title: chapter.title,
              startTime: chapter.startTime,
            },
          });
          continue;
        }

        try {
          const startTimeSeconds = parseTime(chapter.startTime);

          if (startTimeSeconds < 0) {
            issues.push({
              id: generateIssueId(),
              severity: 'error',
              category: 'chapter',
              message: `章节时间不能为负数: ${chapter.title}`,
              detail: `时间值: ${chapter.startTime} (${startTimeSeconds} 秒)`,
              suggestion: '修正章节开始时间',
              context: {
                chapterId: chapter.id,
                title: chapter.title,
                startTime: chapter.startTime,
                startTimeSeconds,
              },
            });
          }

          if (chapter.audioRef && audioInfos) {
            const audioData = audioInfos.get(chapter.audioRef);
            if (audioData?.info?.exists && audioData.info.duration > 0) {
              if (startTimeSeconds > audioData.info.duration) {
                issues.push({
                  id: generateIssueId(),
                  severity: 'error',
                  category: 'chapter',
                  message: `章节时间超出音频长度: ${chapter.title}`,
                  detail: `章节开始时间: ${chapter.startTime} (${formatTime(startTimeSeconds)})\n音频长度: ${formatTime(audioData.info.duration)}`,
                  suggestion: '将章节时间调整到音频长度范围内',
                  context: {
                    chapterId: chapter.id,
                    title: chapter.title,
                    audioRef: chapter.audioRef,
                    startTimeSeconds,
                    audioDuration: audioData.info.duration,
                  },
                });
              }
            }
          }
        } catch (error) {
          issues.push({
            id: generateIssueId(),
            severity: 'error',
            category: 'chapter',
            message: `解析章节时间失败: ${chapter.title}`,
            detail: `时间值: ${chapter.startTime}`,
            suggestion: '检查时间格式是否正确',
            context: {
              chapterId: chapter.id,
              title: chapter.title,
              startTime: chapter.startTime,
            },
          });
        }
      }

      const sortedChapters = [...manifest.chapters].sort((a, b) => {
        try {
          return parseTime(a.startTime) - parseTime(b.startTime);
        } catch {
          return 0;
        }
      });

      for (let i = 1; i < sortedChapters.length; i++) {
        try {
          const prevTime = parseTime(sortedChapters[i - 1].startTime);
          const currTime = parseTime(sortedChapters[i].startTime);

          if (Math.abs(prevTime - currTime) < 0.001) {
            issues.push({
              id: generateIssueId(),
              severity: 'warning',
              category: 'chapter',
              message: `多个章节具有相同的开始时间`,
              detail: `章节: ${sortedChapters[i - 1].title} 和 ${sortedChapters[i].title}\n时间: ${sortedChapters[i - 1].startTime}`,
              suggestion: '检查章节时间是否重复',
              context: {
                chapters: [sortedChapters[i - 1].id, sortedChapters[i].id],
                startTime: sortedChapters[i - 1].startTime,
              },
            });
          }
        } catch {
          continue;
        }
      }

      return issues;
    },
  };
}

export function createFormatConsistencyRule(): ValidationRule {
  return {
    id: 'format-consistency',
    name: '音频格式一致性检查',
    description: '检查所有音频文件是否具有一致的采样率、声道数等格式',
    category: 'format',
    severity: 'warning',
    validate: (context: ValidationContext): ValidationIssue[] => {
      const issues: ValidationIssue[] = [];
      const { manifest, audioInfos } = context;

      if (!audioInfos || audioInfos.size === 0) {
        return issues;
      }

      const expectedSampleRate = manifest.settings.sampleRate;
      const expectedChannels = manifest.settings.channels;

      const formatInfos: Array<{
        audioId: string;
        role: string;
        sampleRate: number;
        channels: number;
        bitsPerSample: number;
      }> = [];

      for (const [audioId, data] of audioInfos.entries()) {
        if (data.info.exists && data.info.format === 'WAV') {
          formatInfos.push({
            audioId,
            role: manifest.audioFiles.find(f => f.id === audioId)?.role || 'unknown',
            sampleRate: data.info.sampleRate,
            channels: data.info.channels,
            bitsPerSample: data.info.bitsPerSample,
          });
        }
      }

      if (formatInfos.length < 2) {
        return issues;
      }

      const sampleRates = new Set(formatInfos.map(f => f.sampleRate));
      const channels = new Set(formatInfos.map(f => f.channels));

      if (sampleRates.size > 1) {
        issues.push({
          id: generateIssueId(),
          severity: 'warning',
          category: 'format',
          message: '音频文件采样率不一致',
          detail: `发现的采样率: ${Array.from(sampleRates).join(', ')} Hz\n文件信息:\n${formatInfos.map(f => `  - ${f.role} (${f.audioId}): ${f.sampleRate} Hz`).join('\n')}`,
          suggestion: '建议将所有音频文件统一到相同的采样率（通常 44100 Hz 或 48000 Hz）',
          context: {
            sampleRates: Array.from(sampleRates),
            files: formatInfos,
          },
        });
      }

      if (channels.size > 1) {
        issues.push({
          id: generateIssueId(),
          severity: 'warning',
          category: 'format',
          message: '音频文件声道数不一致',
          detail: `发现的声道数: ${Array.from(channels).join(', ')}\n文件信息:\n${formatInfos.map(f => `  - ${f.role} (${f.audioId}): ${f.channels} 声道`).join('\n')}`,
          suggestion: '建议将所有音频文件统一到相同的声道数（播客通常使用单声道 1 或立体声 2）',
          context: {
            channels: Array.from(channels),
            files: formatInfos,
          },
        });
      }

      if (expectedSampleRate) {
        for (const info of formatInfos) {
          if (info.sampleRate !== expectedSampleRate && info.sampleRate > 0) {
            issues.push({
              id: generateIssueId(),
              severity: 'warning',
              category: 'format',
              message: `音频采样率不符合期望: ${info.role}`,
              detail: `期望: ${expectedSampleRate} Hz\n实际: ${info.sampleRate} Hz`,
              suggestion: '重新导出音频为期望的采样率',
              context: {
                audioId: info.audioId,
                role: info.role,
                expectedSampleRate,
                actualSampleRate: info.sampleRate,
              },
            });
          }
        }
      }

      if (expectedChannels) {
        for (const info of formatInfos) {
          if (info.channels !== expectedChannels && info.channels > 0) {
            issues.push({
              id: generateIssueId(),
              severity: 'warning',
              category: 'format',
              message: `音频声道数不符合期望: ${info.role}`,
              detail: `期望: ${expectedChannels} 声道\n实际: ${info.channels} 声道`,
              suggestion: '重新导出音频为期望的声道数',
              context: {
                audioId: info.audioId,
                role: info.role,
                expectedChannels,
                actualChannels: info.channels,
              },
            });
          }
        }
      }

      return issues;
    },
  };
}

export function createLoudnessRule(): ValidationRule {
  return {
    id: 'loudness-check',
    name: '响度检查',
    description: '检查音频文件响度是否在目标范围内',
    category: 'loudness',
    severity: 'warning',
    validate: (context: ValidationContext): ValidationIssue[] => {
      const issues: ValidationIssue[] = [];
      const { manifest, audioInfos } = context;

      if (!audioInfos || audioInfos.size === 0) {
        return issues;
      }

      const targetLoudness = manifest.settings.targetLoudness;
      const tolerance = manifest.settings.loudnessTolerance;
      const minLoudness = targetLoudness - tolerance;
      const maxLoudness = targetLoudness + tolerance;

      for (const [audioId, data] of audioInfos.entries()) {
        if (!data.loudness || !data.info.exists) {
          continue;
        }

        const rmsDb = data.loudness.rmsDb;
        const audioFile = manifest.audioFiles.find(f => f.id === audioId);

        if (!isFinite(rmsDb)) {
          issues.push({
            id: generateIssueId(),
            severity: 'warning',
            category: 'loudness',
            message: `无法分析音频响度: ${audioFile?.role || audioId}`,
            detail: '音频可能是静音或格式不支持',
            suggestion: '检查音频文件是否包含有效音频内容',
            context: { audioId, role: audioFile?.role },
          });
          continue;
        }

        if (rmsDb < minLoudness || rmsDb > maxLoudness) {
          const diff = rmsDb - targetLoudness;
          const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);

          let severity: ValidationIssue['severity'] = 'warning';
          if (Math.abs(diff) > tolerance * 2) {
            severity = 'error';
          }

          issues.push({
            id: generateIssueId(),
            severity,
            category: 'loudness',
            message: `响度偏离目标范围: ${audioFile?.name || audioFile?.role || audioId}`,
            detail: `目标响度: ${targetLoudness} dB RMS (容差 ±${tolerance} dB)\n当前响度: ${rmsDb} dB RMS (偏差 ${diffStr} dB)\n可接受范围: ${minLoudness} ~ ${maxLoudness} dB RMS`,
            suggestion: diff < 0
              ? `音频音量偏低，建议提升约 ${Math.abs(diff).toFixed(1)} dB`
              : `音频音量偏高，建议降低约 ${diff.toFixed(1)} dB`,
            context: {
              audioId,
              role: audioFile?.role,
              targetLoudness,
              actualLoudness: rmsDb,
              tolerance,
              deviation: diff,
            },
          });
        }

        if (data.loudness.peakDb > -1) {
          issues.push({
            id: generateIssueId(),
            severity: 'warning',
            category: 'loudness',
            message: `音频峰值较高可能导致削波: ${audioFile?.role || audioId}`,
            detail: `峰值: ${data.loudness.peakDb} dB\n建议峰值低于 -1 dB 以避免削波`,
            suggestion: '检查音频是否有削波，必要时使用限制器',
            context: {
              audioId,
              role: audioFile?.role,
              peakDb: data.loudness.peakDb,
            },
          });
        }
      }

      const loudnessValues: number[] = [];
      for (const data of audioInfos.values()) {
        if (data.loudness && isFinite(data.loudness.rmsDb)) {
          loudnessValues.push(data.loudness.rmsDb);
        }
      }

      if (loudnessValues.length >= 2) {
        const minDb = Math.min(...loudnessValues);
        const maxDb = Math.max(...loudnessValues);
        const range = maxDb - minDb;

        if (range > tolerance * 2) {
          issues.push({
            id: generateIssueId(),
            severity: 'warning',
            category: 'loudness',
            message: '各音频段响度差异较大',
            detail: `响度范围: ${minDb.toFixed(1)} ~ ${maxDb.toFixed(1)} dB RMS\n差异: ${range.toFixed(1)} dB`,
            suggestion: '建议统一各音频段的响度，以提供更一致的收听体验',
            context: {
              minDb,
              maxDb,
              range,
            },
          });
        }
      }

      return issues;
    },
  };
}

export function createSilenceRule(): ValidationRule {
  return {
    id: 'silence-check',
    name: '静音检查',
    description: '检查音频开头和结尾的静音是否过长',
    category: 'silence',
    severity: 'warning',
    validate: (context: ValidationContext): ValidationIssue[] => {
      const issues: ValidationIssue[] = [];
      const { manifest, audioInfos } = context;

      if (!audioInfos || audioInfos.size === 0) {
        return issues;
      }

      const maxStartSilence = manifest.settings.maxSilenceAtStart;
      const maxEndSilence = manifest.settings.maxSilenceAtEnd;

      for (const [audioId, data] of audioInfos.entries()) {
        if (!data.silence || !data.info.exists) {
          continue;
        }

        const audioFile = manifest.audioFiles.find(f => f.id === audioId);

        if (data.silence.hasLongSilenceAtStart) {
          const excess = data.silence.startSilenceDuration - maxStartSilence;
          
          issues.push({
            id: generateIssueId(),
            severity: 'warning',
            category: 'silence',
            message: `开头静音过长: ${audioFile?.name || audioFile?.role || audioId}`,
            detail: `实际开头静音: ${data.silence.startSilenceDuration.toFixed(3)} 秒\n最大允许: ${maxStartSilence} 秒\n超出: ${excess.toFixed(3)} 秒`,
            suggestion: '修剪开头的静音部分，或调整 maxSilenceAtStart 设置',
            context: {
              audioId,
              role: audioFile?.role,
              actualSilence: data.silence.startSilenceDuration,
              maxAllowed: maxStartSilence,
              excess,
              position: 'start',
            },
          });
        }

        if (data.silence.hasLongSilenceAtEnd) {
          const excess = data.silence.endSilenceDuration - maxEndSilence;
          
          issues.push({
            id: generateIssueId(),
            severity: 'warning',
            category: 'silence',
            message: `结尾静音过长: ${audioFile?.name || audioFile?.role || audioId}`,
            detail: `实际结尾静音: ${data.silence.endSilenceDuration.toFixed(3)} 秒\n最大允许: ${maxEndSilence} 秒\n超出: ${excess.toFixed(3)} 秒`,
            suggestion: '修剪结尾的静音部分，或调整 maxSilenceAtEnd 设置',
            context: {
              audioId,
              role: audioFile?.role,
              actualSilence: data.silence.endSilenceDuration,
              maxAllowed: maxEndSilence,
              excess,
              position: 'end',
            },
          });
        }
      }

      return issues;
    },
  };
}

export function getDefaultRules(): ValidationRule[] {
  return [
    createFileExistsRule(),
    createNamingRule(),
    createChapterTimingRule(),
    createFormatConsistencyRule(),
    createLoudnessRule(),
    createSilenceRule(),
  ];
}

export async function runValidation(
  context: ValidationContext,
  rules: ValidationRule[] = getDefaultRules()
): Promise<ValidationResult> {
  resetIssueCounter();

  const allIssues: ValidationIssue[] = [];

  for (const rule of rules) {
    try {
      const issues = rule.validate(context);
      allIssues.push(...issues);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      allIssues.push({
        id: generateIssueId(),
        severity: 'error',
        category: 'file',
        message: `验证规则执行失败: ${rule.name}`,
        detail: errorMsg,
        suggestion: '这可能是工具内部错误，请报告此问题',
        context: { ruleId: rule.id, ruleName: rule.name },
      });
    }
  }

  const errors = allIssues.filter(i => i.severity === 'error').length;
  const warnings = allIssues.filter(i => i.severity === 'warning').length;
  const infos = allIssues.filter(i => i.severity === 'info').length;

  return {
    success: errors === 0,
    totalIssues: allIssues.length,
    errors,
    warnings,
    infos,
    issues: allIssues,
  };
}
