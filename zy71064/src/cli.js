#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command, Option } = require('commander');
const chalk = require('chalk');

const HeadingParser = require('./heading-parser');
const OwnerMatcher = require('./owner-matcher');
const ChapterOwnerParser = require('./chapter-owner-parser');
const LinkChecker = require('./link-checker');
const ReportGenerator = require('./report-generator');

const EXIT_CODES = {
  SUCCESS: 0,
  ERROR_ARGS: 1,
  ERROR_INPUT: 2,
  ERROR_PARSE: 3,
  ERROR_ISSUES_FOUND: 4
};

async function main() {
  const program = new Command();

  program
    .name('md-chapter-owner')
    .description('Markdown 章节归属 CLI 工具 - 管理多人编辑文档的负责人、锚点链接和评审记录')
    .version('1.0.0');

  program
    .option('-c, --config <path>', '配置文件路径 (JSON)')
    .option('-f, --files <paths...>', '要分析的 Markdown 文件路径')
    .option('-d, --dir <path>', '要分析的目录（递归查找 .md 文件）')
    .option('-o, --output <path>', '输出目录', 'output')
    .option('--owners <path>', '负责人配置文件 (JSON 或 Markdown)')
    .option('--skip-links', '跳过链接检查')
    .option('--skip-external', '跳过外部链接检查')
    .option('--anchor-style <style>', '锚点生成风格: github, gitlab', 'github')
    .option('--no-color', '禁用彩色输出')
    .option('-q, --quiet', '静默模式，只输出错误')
    .option('-v, --verbose', '详细输出模式')
    .option('--json-only', '只输出 JSON 报告到 stdout')
    .option('--strict', '严格模式，任何警告都视为错误');

  program.parse();
  const options = program.opts();

  if (options.noColor) {
    chalk.level = 0;
  }

  if (options.jsonOnly) {
    options.quiet = true;
  }

  try {
    const config = await loadConfig(options);
    validateInput(config);
    
    if (!options.quiet) {
      console.log(chalk.blue('🔍 开始分析 Markdown 文档...'));
    }

    const files = resolveFiles(config);
    if (!options.quiet && !options.jsonOnly) {
      console.log(chalk.blue(`📁 找到 ${files.length} 个文件待分析`));
    }

    const result = await analyzeFiles(files, config, options);
    
    const reportGenerator = new ReportGenerator({
      outputDir: config.output || options.output,
      verbose: !options.quiet && options.verbose
    });

    const report = reportGenerator.generate(result);

    if (options.jsonOnly) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      if (!options.quiet) {
        const exitCode = reportGenerator.printTerminalSummary(report);
        reportGenerator.writeAllReports(report, 'chapter-owner-report');
      }
    }

    const hasErrors = report.summary.brokenLinks > 0 || 
                      report.summary.ownerMatchErrors > 0 ||
                      report.summary.chaptersWithoutOwner > 0 ||
                      (options.strict && report.summary.unparsedRecords > 0);

    process.exit(hasErrors ? EXIT_CODES.ERROR_ISSUES_FOUND : EXIT_CODES.SUCCESS);

  } catch (error) {
    if (options.jsonOnly) {
      console.log(JSON.stringify({ error: error.message }, null, 2));
    } else {
      console.error(chalk.red(`❌ 错误: ${error.message}`));
      if (options.verbose && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    }
    process.exit(EXIT_CODES.ERROR_INPUT);
  }
}

async function loadConfig(options) {
  let config = { ...options };

  if (options.config) {
    const configPath = path.resolve(options.config);
    if (!fs.existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }
    
    const ext = path.extname(configPath).toLowerCase();
    if (ext === '.json') {
      const content = fs.readFileSync(configPath, 'utf-8');
      const fileConfig = JSON.parse(content);
      config = { ...config, ...fileConfig };
    } else {
      throw new Error(`不支持的配置文件格式: ${ext}`);
    }
  }

  return config;
}

function validateInput(config) {
  const hasFiles = config.files && config.files.length > 0;
  const hasDir = config.dir;
  
  if (!hasFiles && !hasDir) {
    throw new Error('请指定要分析的文件 (--files) 或目录 (--dir)');
  }

  if (config.owners) {
    const ownersPath = path.resolve(config.owners);
    if (!fs.existsSync(ownersPath)) {
      throw new Error(`负责人配置文件不存在: ${ownersPath}`);
    }
  }

  if (config.anchorStyle && !['github', 'gitlab'].includes(config.anchorStyle)) {
    throw new Error(`不支持的锚点风格: ${config.anchorStyle}，请使用 github 或 gitlab`);
  }
}

function resolveFiles(config) {
  let files = [];

  if (config.files) {
    config.files.forEach(filePath => {
      const resolved = path.resolve(filePath);
      if (fs.existsSync(resolved)) {
        if (fs.statSync(resolved).isFile()) {
          files.push(resolved);
        } else if (fs.statSync(resolved).isDirectory()) {
          files = files.concat(findMarkdownFiles(resolved));
        }
      } else {
        throw new Error(`文件不存在: ${filePath}`);
      }
    });
  }

  if (config.dir) {
    const dirPath = path.resolve(config.dir);
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      throw new Error(`目录不存在: ${config.dir}`);
    }
    files = files.concat(findMarkdownFiles(dirPath));
  }

  return [...new Set(files)];
}

function findMarkdownFiles(dir) {
  const files = [];
  
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    entries.forEach(entry => {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.md' || ext === '.markdown') {
          files.push(fullPath);
        }
      }
    });
  }
  
  walk(dir);
  return files;
}

async function analyzeFiles(files, config, options) {
  const allHeadings = [];
  const allChapters = [];
  const allOwnerMatches = [];
  const allUnparsedRecords = [];
  const linkChecker = new LinkChecker({
    checkExternal: !options.skipExternal && !config.skipExternal,
    baseDir: process.cwd()
  });

  const headingParser = new HeadingParser({
    anchorStyle: config.anchorStyle || 'github'
  });

  const chapterParser = new ChapterOwnerParser();
  let ownerMatcher = null;

  if (config.owners) {
    ownerMatcher = new OwnerMatcher(path.resolve(config.owners));
  }

  files.forEach(filePath => {
    const headings = headingParser.parseFile(filePath);
    allHeadings.push(...headings);
    
    linkChecker.registerAnchors(headings, filePath);
  });

  files.forEach(filePath => {
    const fileHeadings = allHeadings.filter(h => h.filePath === filePath);
    const chapters = chapterParser.parseFile(filePath, fileHeadings);
    allChapters.push(...chapters);
    
    allUnparsedRecords.push(...chapterParser.getUnparsedRecords());
  });

  if (ownerMatcher) {
    allChapters.forEach(chapter => {
      if (chapter.owner && !chapter.owner.inherited) {
        const match = ownerMatcher.match(chapter.owner.name);
        match.source = chapter.owner.source;
        match.heading = chapter.heading.text;
        allOwnerMatches.push(match);
        
        if (match.matched) {
          chapter.owner.matched = match.canonicalName;
          chapter.owner.matchType = match.matchType;
        }
      }
      
      chapter.reviewers.forEach(reviewer => {
        const match = ownerMatcher.match(reviewer.name);
        match.source = reviewer.source;
        match.heading = chapter.heading.text;
        match.isReviewer = true;
        allOwnerMatches.push(match);
        
        if (match.matched) {
          reviewer.matched = match.canonicalName;
          reviewer.matchType = match.matchType;
        }
      });
    });
  }

  if (!options.skipLinks && !config.skipLinks) {
    files.forEach(filePath => {
      linkChecker.parseFile(filePath);
    });
    
    await linkChecker.checkAllLinks();
  }

  const brokenLinks = options.skipLinks || config.skipLinks ? [] : linkChecker.getBrokenLinks();

  return {
    files,
    headings: allHeadings,
    chapters: allChapters,
    ownerMatches: allOwnerMatches,
    brokenLinks,
    unparsedRecords: allUnparsedRecords,
    statistics: {
      linkStatistics: options.skipLinks || config.skipLinks ? null : linkChecker.getStatistics(),
      headingCount: allHeadings.length,
      chapterCount: allChapters.length
    }
  };
}

main().catch(error => {
  console.error(chalk.red(`❌ 致命错误: ${error.message}`));
  console.error(chalk.gray(error.stack));
  process.exit(EXIT_CODES.ERROR_PARSE);
});
