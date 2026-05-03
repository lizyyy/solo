import path from 'path';
import { 
  ProjectValidationResult, 
  ValidationResult,
  SubtitleCue,
  Chapter,
  AdPoint,
  ProjectFiles,
  ProjectConfig
} from '../types';
import { parseSubtitleFile, SubtitleParseError } from '../parsers/subtitle-parser';
import { ChapterParser, AdPointParser, ParseError } from '../parsers/chapter-parser';
import { validateSubtitles, validateChapters, validateAdPoints } from '../validators/validator';

export interface HealthCheckOptions {
  config?: ProjectConfig;
  verbose?: boolean;
}

export class HealthCheckService {
  async validate(
    projectPath: string,
    projectFiles: ProjectFiles,
    options?: HealthCheckOptions
  ): Promise<ProjectValidationResult> {
    const config = { ...options?.config, ...projectFiles.config };
    
    const subtitleResults: ValidationResult[] = [];
    let allCues: SubtitleCue[] = [];
    let totalDuration = 0;

    for (const subtitleFile of projectFiles.subtitles) {
      try {
        const cues = parseSubtitleFile(subtitleFile.path);
        allCues = [...allCues, ...cues];
        
        if (cues.length > 0) {
          const lastCue = cues[cues.length - 1];
          if (lastCue.endTime > totalDuration) {
            totalDuration = lastCue.endTime;
          }
        }

        const result = validateSubtitles(cues, {
          config,
          fileName: path.basename(subtitleFile.path)
        });
        
        subtitleResults.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        const parseError = error as SubtitleParseError;
        
        subtitleResults.push({
          fileName: path.basename(subtitleFile.path),
          errors: [{
            type: 'parse_error',
            severity: 'error',
            message: `解析失败: ${errorMessage}`,
            fileName: path.basename(subtitleFile.path),
            details: {
              lineNumber: parseError.lineNumber
            }
          }],
          passed: false,
          errorCount: 1,
          warningCount: 0
        });
      }
    }

    let chaptersResult: ValidationResult | null = null;
    let chapters: Chapter[] = [];

    if (projectFiles.chapters) {
      try {
        const parser = new ChapterParser();
        chapters = parser.parseFile(projectFiles.chapters);
        
        chaptersResult = validateChapters(chapters, totalDuration, {
          config,
          fileName: path.basename(projectFiles.chapters),
          subtitleCues: allCues
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        const parseError = error as ParseError;
        
        chaptersResult = {
          fileName: path.basename(projectFiles.chapters),
          errors: [{
            type: 'parse_error',
            severity: 'error',
            message: `解析失败: ${errorMessage}`,
            fileName: path.basename(projectFiles.chapters),
            details: {
              lineNumber: parseError.lineNumber
            }
          }],
          passed: false,
          errorCount: 1,
          warningCount: 0
        };
      }
    }

    let adPointsResult: ValidationResult | null = null;

    if (projectFiles.adPoints) {
      try {
        const parser = new AdPointParser();
        const adPoints = parser.parseFile(projectFiles.adPoints);
        
        adPointsResult = validateAdPoints(adPoints, allCues, {
          config,
          fileName: path.basename(projectFiles.adPoints)
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        const parseError = error as ParseError;
        
        adPointsResult = {
          fileName: path.basename(projectFiles.adPoints),
          errors: [{
            type: 'parse_error',
            severity: 'error',
            message: `解析失败: ${errorMessage}`,
            fileName: path.basename(projectFiles.adPoints),
            details: {
              lineNumber: parseError.lineNumber
            }
          }],
          passed: false,
          errorCount: 1,
          warningCount: 0
        };
      }
    }

    const allErrors = [
      ...subtitleResults.flatMap(r => r.errors),
      ...(chaptersResult?.errors || []),
      ...(adPointsResult?.errors || [])
    ];

    const totalErrors = allErrors.filter(e => e.severity === 'error').length;
    const totalWarnings = allErrors.filter(e => e.severity === 'warning').length;
    const totalInfos = allErrors.filter(e => e.severity === 'info').length;

    let overallStatus: 'passed' | 'failed' | 'warning';
    
    if (totalErrors > 0) {
      overallStatus = 'failed';
    } else if (totalWarnings > 0) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'passed';
    }

    const result: ProjectValidationResult = {
      projectPath,
      timestamp: new Date().toLocaleString('zh-CN'),
      overallStatus,
      results: {
        subtitles: subtitleResults,
        chapters: chaptersResult,
        adPoints: adPointsResult
      },
      summary: {
        totalErrors,
        totalWarnings,
        totalInfos
      }
    };

    return result;
  }
}

export async function runHealthCheck(
  projectPath: string,
  projectFiles: ProjectFiles,
  options?: HealthCheckOptions
): Promise<ProjectValidationResult> {
  const service = new HealthCheckService();
  return service.validate(projectPath, projectFiles, options);
}
