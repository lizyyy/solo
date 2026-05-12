import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { loadState, saveState, generateId, calculateChecksum, isInitialized } from '../store';
import { parseFile, parseSRT, parseVTT } from '../parser';
import { SubtitleFile, SensitiveWord, TermItem, VideoMetadata } from '../types';
import { isSubtitleFile } from '../utils';

export interface ImportOptions {
  subtitle?: string;
  language?: 'zh' | 'en' | 'bilingual';
  metadata?: string;
  sensitive?: string;
  terms?: string;
  operator?: string;
}

interface ImportResult {
  type: string;
  name: string;
  count: number;
  status: 'success' | 'skipped' | 'error';
  message?: string;
}

export async function handleImport(options: ImportOptions): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('项目未初始化，请先运行: subtitle-qc init'));
    process.exit(1);
  }
  
  const state = loadState();
  const results: ImportResult[] = [];
  
  const operator = options.operator || 'system';
  if (!state.operators.includes(operator)) {
    state.operators.push(operator);
  }
  
  if (options.subtitle) {
    const spinner = ora(`正在导入字幕文件: ${options.subtitle}`).start();
    
    try {
      const filePath = path.resolve(options.subtitle);
      if (!fs.existsSync(filePath)) {
        spinner.fail(chalk.red(`字幕文件不存在: ${filePath}`));
        process.exit(1);
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const checksum = calculateChecksum(content);
      
      const existing = Object.values(state.subtitles).find(s => s.checksum === checksum);
      if (existing) {
        spinner.info(chalk.yellow(`字幕文件已存在，跳过导入: ${existing.name}`));
        results.push({
          type: 'subtitle',
          name: existing.name,
          count: existing.cues.length,
          status: 'skipped',
          message: '文件内容相同，已存在',
        });
      } else {
        const parsed = parseFile(filePath);
        
        if (parsed.errors.length > 0) {
          spinner.warn(chalk.yellow(`解析时发现 ${parsed.errors.length} 个错误`));
          for (const err of parsed.errors.slice(0, 5)) {
            console.log(chalk.gray(`  - ${err}`));
          }
          if (parsed.errors.length > 5) {
            console.log(chalk.gray(`  ... 还有 ${parsed.errors.length - 5} 个错误`));
          }
        }
        
        const language: 'zh' | 'en' | 'bilingual' = 
          (options.language as 'zh' | 'en' | 'bilingual') || 
          (parsed.cues.some(c => /[\u4e00-\u9fa5]/.test(c.text)) ? 'zh' : 'en');
        
        const subtitle: SubtitleFile = {
          id: generateId('subtitle'),
          name: path.basename(filePath),
          path: filePath,
          format: parsed.format,
          language,
          cues: parsed.cues,
          importTime: Date.now(),
          checksum,
        };
        
        state.subtitles[subtitle.id] = subtitle;
        saveState(state);
        
        spinner.succeed(chalk.green(`字幕导入成功: ${subtitle.name}`));
        results.push({
          type: 'subtitle',
          name: subtitle.name,
          count: subtitle.cues.length,
          status: 'success',
          message: `语言: ${language}`,
        });
      }
    } catch (error) {
      spinner.fail(chalk.red(`导入字幕失败: ${error}`));
      process.exit(1);
    }
  }
  
  if (options.sensitive) {
    const spinner = ora(`正在导入敏感词表: ${options.sensitive}`).start();
    
    try {
      const filePath = path.resolve(options.sensitive);
      if (!fs.existsSync(filePath)) {
        spinner.fail(chalk.red(`敏感词文件不存在: ${filePath}`));
        process.exit(1);
      }
      
      let words: SensitiveWord[] = [];
      
      if (filePath.endsWith('.json')) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(data)) {
          words = data;
        } else if (data.words && Array.isArray(data.words)) {
          words = data.words;
        }
      } else {
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const parts = trimmed.split(/[,\t]/);
            words.push({
              id: generateId('sw'),
              word: parts[0].trim(),
              category: parts[1]?.trim() || 'general',
              level: (parts[2]?.trim() as 'high' | 'medium' | 'low') || 'medium',
              replacement: parts[3]?.trim(),
            });
          }
        }
      }
      
      let imported = 0;
      for (const w of words) {
        const normalizedWord = w.word.toLowerCase();
        const existing = Object.values(state.sensitiveWords).find(
          s => s.word.toLowerCase() === normalizedWord
        );
        if (!existing) {
          const sw: SensitiveWord = {
            id: w.id || generateId('sw'),
            word: w.word,
            category: w.category || 'general',
            level: w.level || 'medium',
            replacement: w.replacement,
            description: w.description,
          };
          state.sensitiveWords[sw.id] = sw;
          imported++;
        }
      }
      
      saveState(state);
      spinner.succeed(chalk.green(`敏感词导入完成: 新增 ${imported} 个，总计 ${Object.keys(state.sensitiveWords).length} 个`));
      
      results.push({
        type: 'sensitive',
        name: path.basename(filePath),
        count: imported,
        status: 'success',
      });
    } catch (error) {
      spinner.fail(chalk.red(`导入敏感词失败: ${error}`));
      process.exit(1);
    }
  }
  
  if (options.terms) {
    const spinner = ora(`正在导入术语表: ${options.terms}`).start();
    
    try {
      const filePath = path.resolve(options.terms);
      if (!fs.existsSync(filePath)) {
        spinner.fail(chalk.red(`术语表文件不存在: ${filePath}`));
        process.exit(1);
      }
      
      let items: TermItem[] = [];
      
      if (filePath.endsWith('.json')) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(data)) {
          items = data;
        } else if (data.terms && Array.isArray(data.terms)) {
          items = data.terms;
        }
      } else {
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const parts = trimmed.split(/[,\t]/);
            if (parts.length >= 2) {
              items.push({
                id: generateId('term'),
                source: parts[0].trim(),
                target: parts[1].trim(),
                category: parts[2]?.trim() || 'general',
                language: (parts[3]?.trim() as 'zh' | 'en') || 'zh',
              });
            }
          }
        }
      }
      
      let imported = 0;
      for (const item of items) {
        const existing = Object.values(state.terms).find(
          t => t.source === item.source && t.target === item.target
        );
        if (!existing) {
          const term: TermItem = {
            id: item.id || generateId('term'),
            source: item.source,
            target: item.target,
            category: item.category || 'general',
            language: item.language || 'zh',
          };
          state.terms[term.id] = term;
          imported++;
        }
      }
      
      saveState(state);
      spinner.succeed(chalk.green(`术语导入完成: 新增 ${imported} 个，总计 ${Object.keys(state.terms).length} 个`));
      
      results.push({
        type: 'terms',
        name: path.basename(filePath),
        count: imported,
        status: 'success',
      });
    } catch (error) {
      spinner.fail(chalk.red(`导入术语表失败: ${error}`));
      process.exit(1);
    }
  }
  
  if (options.metadata) {
    const spinner = ora(`正在导入视频元数据: ${options.metadata}`).start();
    
    try {
      const filePath = path.resolve(options.metadata);
      if (!fs.existsSync(filePath)) {
        spinner.fail(chalk.red(`元数据文件不存在: ${filePath}`));
        process.exit(1);
      }
      
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      const meta: VideoMetadata = {
        id: generateId('meta'),
        videoId: data.videoId || data.id || path.basename(filePath, path.extname(filePath)),
        title: data.title || 'Untitled',
        duration: data.duration || 0,
        durationStr: data.durationStr || '',
        format: data.format || 'MP4',
        importTime: Date.now(),
      };
      
      state.metadata[meta.id] = meta;
      saveState(state);
      
      spinner.succeed(chalk.green(`元数据导入成功: ${meta.title}`));
      results.push({
        type: 'metadata',
        name: meta.title,
        count: 1,
        status: 'success',
      });
    } catch (error) {
      spinner.fail(chalk.red(`导入元数据失败: ${error}`));
      process.exit(1);
    }
  }
  
  if (results.length > 0) {
    console.log('');
    const table = new Table({
      head: [chalk.bold('类型'), chalk.bold('名称'), chalk.bold('数量'), chalk.bold('状态')],
      colWidths: [12, 30, 10, 12],
    });
    
    for (const r of results) {
      table.push([
        r.type,
        r.name,
        r.count.toString(),
        r.status === 'success' ? chalk.green('成功') : 
        r.status === 'skipped' ? chalk.yellow('已跳过') : chalk.red('失败'),
      ]);
    }
    
    console.log(table.toString());
  } else {
    console.log(chalk.yellow('未指定任何导入参数，使用 --help 查看帮助'));
  }
}
