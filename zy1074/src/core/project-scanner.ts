import fs from 'fs-extra';
import path from 'path';
import { ProjectFiles, ProjectConfig } from '../types';

export interface ScanOptions {
  subtitleExtensions?: string[];
  chapterPatterns?: string[];
  adPointPatterns?: string[];
  configFileName?: string;
  deliveryDirName?: string;
}

const DEFAULT_OPTIONS: Required<ScanOptions> = {
  subtitleExtensions: ['.srt', '.vtt'],
  chapterPatterns: ['chapters', '章节', 'chapter'],
  adPointPatterns: ['ads', '广告', 'ad-points', 'ad'],
  configFileName: 'health-check.config.json',
  deliveryDirName: 'delivery'
};

export class ProjectScanner {
  private options: Required<ScanOptions>;

  constructor(options?: ScanOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async scan(projectPath: string): Promise<ProjectFiles> {
    if (!await fs.pathExists(projectPath)) {
      throw new Error(`项目目录不存在: ${projectPath}`);
    }

    const stats = await fs.stat(projectPath);
    if (!stats.isDirectory()) {
      throw new Error(`路径不是目录: ${projectPath}`);
    }

    const subtitleFiles = await this.findSubtitleFiles(projectPath);
    const chapterFile = await this.findChapterFile(projectPath);
    const adPointFile = await this.findAdPointFile(projectPath);
    const config = await this.loadConfig(projectPath);
    const deliveryFiles = await this.findDeliveryFiles(projectPath);

    return {
      subtitles: subtitleFiles,
      chapters: chapterFile,
      adPoints: adPointFile,
      config,
      deliveryFiles
    };
  }

  private async findSubtitleFiles(projectPath: string): Promise<ProjectFiles['subtitles']> {
    const subtitleFiles: ProjectFiles['subtitles'] = [];
    
    const items = await fs.readdir(projectPath);
    
    for (const item of items) {
      const fullPath = path.join(projectPath, item);
      const ext = path.extname(item).toLowerCase();
      
      const stats = await fs.stat(fullPath);
      
      if (stats.isFile() && this.options.subtitleExtensions.includes(ext)) {
        subtitleFiles.push({
          path: fullPath,
          format: ext === '.srt' ? 'srt' : 'vtt'
        });
      }
    }

    const subtitlesDir = path.join(projectPath, 'subtitles');
    if (await fs.pathExists(subtitlesDir)) {
      const subItems = await fs.readdir(subtitlesDir);
      for (const item of subItems) {
        const fullPath = path.join(subtitlesDir, item);
        const ext = path.extname(item).toLowerCase();
        
        const stats = await fs.stat(fullPath);
        
        if (stats.isFile() && this.options.subtitleExtensions.includes(ext)) {
          const alreadyExists = subtitleFiles.some(f => f.path === fullPath);
          if (!alreadyExists) {
            subtitleFiles.push({
              path: fullPath,
              format: ext === '.srt' ? 'srt' : 'vtt'
            });
          }
        }
      }
    }

    return subtitleFiles;
  }

  private async findChapterFile(projectPath: string): Promise<string | null> {
    const items = await fs.readdir(projectPath);
    
    for (const item of items) {
      const fullPath = path.join(projectPath, item);
      const ext = path.extname(item).toLowerCase();
      const name = path.basename(item, ext).toLowerCase();
      
      const stats = await fs.stat(fullPath);
      
      if (stats.isFile() && ext === '.csv') {
        for (const pattern of this.options.chapterPatterns) {
          if (name.includes(pattern.toLowerCase())) {
            return fullPath;
          }
        }
      }
    }

    const standardNames = ['chapters.csv', '章节.csv', 'chapter.csv'];
    for (const name of standardNames) {
      const fullPath = path.join(projectPath, name);
      if (await fs.pathExists(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  private async findAdPointFile(projectPath: string): Promise<string | null> {
    const items = await fs.readdir(projectPath);
    
    for (const item of items) {
      const fullPath = path.join(projectPath, item);
      const ext = path.extname(item).toLowerCase();
      const name = path.basename(item, ext).toLowerCase();
      
      const stats = await fs.stat(fullPath);
      
      if (stats.isFile() && ext === '.csv') {
        for (const pattern of this.options.adPointPatterns) {
          if (name.includes(pattern.toLowerCase())) {
            return fullPath;
          }
        }
      }
    }

    const standardNames = ['ads.csv', '广告.csv', 'ad-points.csv', 'ad.csv'];
    for (const name of standardNames) {
      const fullPath = path.join(projectPath, name);
      if (await fs.pathExists(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  private async loadConfig(projectPath: string): Promise<ProjectConfig> {
    const configPath = path.join(projectPath, this.options.configFileName);
    
    if (!await fs.pathExists(configPath)) {
      return {};
    }

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      return this.validateConfig(config);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`配置文件 JSON 格式错误: ${configPath}`);
      }
      throw error;
    }
  }

  private validateConfig(config: any): ProjectConfig {
    const validated: ProjectConfig = {};

    if (config.maxSubtitleLength !== undefined) {
      if (typeof config.maxSubtitleLength !== 'number' || config.maxSubtitleLength < 1) {
        throw new Error('配置错误: maxSubtitleLength 必须是大于 0 的数字');
      }
      validated.maxSubtitleLength = config.maxSubtitleLength;
    }

    if (config.maxSilenceGap !== undefined) {
      if (typeof config.maxSilenceGap !== 'number' || config.maxSilenceGap < 0) {
        throw new Error('配置错误: maxSilenceGap 必须是大于等于 0 的数字');
      }
      validated.maxSilenceGap = config.maxSilenceGap;
    }

    if (config.minChapterCoverage !== undefined) {
      if (typeof config.minChapterCoverage !== 'number' || 
          config.minChapterCoverage < 0 || 
          config.minChapterCoverage > 1) {
        throw new Error('配置错误: minChapterCoverage 必须是 0 到 1 之间的数字');
      }
      validated.minChapterCoverage = config.minChapterCoverage;
    }

    if (config.sensitiveWords !== undefined) {
      if (!Array.isArray(config.sensitiveWords)) {
        throw new Error('配置错误: sensitiveWords 必须是数组');
      }
      for (const word of config.sensitiveWords) {
        if (typeof word !== 'string') {
          throw new Error('配置错误: sensitiveWords 中的元素必须是字符串');
        }
      }
      validated.sensitiveWords = config.sensitiveWords;
    }

    if (config.chapterTitlePattern !== undefined) {
      if (typeof config.chapterTitlePattern !== 'string') {
        throw new Error('配置错误: chapterTitlePattern 必须是字符串');
      }
      validated.chapterTitlePattern = config.chapterTitlePattern;
    }

    return validated;
  }

  private async findDeliveryFiles(projectPath: string): Promise<string[]> {
    const deliveryFiles: string[] = [];
    
    const deliveryDir = path.join(projectPath, this.options.deliveryDirName);
    
    if (await fs.pathExists(deliveryDir)) {
      const stats = await fs.stat(deliveryDir);
      if (stats.isDirectory()) {
        const items = await fs.readdir(deliveryDir);
        for (const item of items) {
          const fullPath = path.join(deliveryDir, item);
          const itemStats = await fs.stat(fullPath);
          if (itemStats.isFile()) {
            deliveryFiles.push(fullPath);
          }
        }
      }
    }

    return deliveryFiles;
  }
}

export async function scanProject(
  projectPath: string,
  options?: ScanOptions
): Promise<ProjectFiles> {
  const scanner = new ProjectScanner(options);
  return scanner.scan(projectPath);
}
