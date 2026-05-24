const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { glob } = require('glob');

const { TemplateParser } = require('./parsers/template-parser');
const { VariableManifestParser } = require('./parsers/variable-manifest-parser');
const { SampleDataParser } = require('./parsers/sample-data-parser');
const { VariableValidator } = require('./core/variable-validator');
const { I18nComparator } = require('./core/i18n-comparator');
const { TemplateRenderer } = require('./core/template-renderer');
const { TerminalReporter } = require('./reporters/terminal-reporter');
const { JsonReporter } = require('./reporters/json-reporter');
const { MarkdownReporter } = require('./reporters/markdown-reporter');
const { exitCodes } = require('./constants/exit-codes');

class CLI {
  constructor() {
    this.program = new Command();
    this._setupProgram();
  }

  _setupProgram() {
    this.program
      .name('email-lint')
      .description('邮件模板变量预检工具 - 检测缺失变量、多语言不一致等问题')
      .version('1.0.0');

    this.program
      .argument('[templates...]', '模板文件路径，支持 glob 模式')
      .option('-m, --manifest <path>', '变量清单 JSON 文件路径')
      .option('-s, --sample-data <path>', '样例数据 JSON 文件路径')
      .option('-l, --locale <locale>', '指定语言版本（如 en-US, zh-CN）')
      .option('-o, --output-dir <dir>', '输出报告目录', './reports')
      .option('-f, --formats <formats>', '输出格式: terminal,json,markdown', 'terminal,json,markdown')
      .option('--case-sensitive', '大小写敏感模式')
      .option('--no-color', '禁用彩色输出')
      .option('-v, --verbose', '详细输出模式')
      .option('--render', '渲染样例预览')
      .action(async (templates, options) => {
        await this._execute(templates, options);
      });
  }

  async run(argv) {
    try {
      await this.program.parseAsync(argv);
      return { exitCode: this._exitCode || exitCodes.SUCCESS };
    } catch (error) {
      console.error('错误:', error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      return { exitCode: exitCodes.FATAL_ERROR };
    }
  }

  async _execute(templatePatterns, options) {
    const config = this._buildConfig(templatePatterns, options);
    const validationErrors = this._validateConfig(config);

    if (validationErrors.length > 0) {
      console.error('输入参数错误:');
      validationErrors.forEach(err => console.error(`  - ${err}`));
      this._exitCode = exitCodes.INVALID_INPUT;
      return;
    }

    const report = await this._runChecks(config);
    this._exitCode = report.exitCode;

    await this._generateReports(report, config);
  }

  _buildConfig(templatePatterns, options) {
    return {
      templatePatterns: templatePatterns.length > 0 ? templatePatterns : ['templates/**/*.html'],
      manifestPath: options.manifest,
      sampleDataPath: options.sampleData,
      locale: options.locale,
      outputDir: path.resolve(options.outputDir),
      formats: (options.formats || '').split(',').map(f => f.trim()),
      caseSensitive: options.caseSensitive || false,
      color: options.color !== false,
      verbose: options.verbose || false,
      render: options.render || false
    };
  }

  _validateConfig(config) {
    const errors = [];

    if (config.templatePatterns.length === 0) {
      errors.push('未指定模板文件路径');
    }

    if (config.manifestPath && !fs.existsSync(config.manifestPath)) {
      errors.push(`变量清单文件不存在: ${config.manifestPath}`);
    }

    if (config.sampleDataPath && !fs.existsSync(config.sampleDataPath)) {
      errors.push(`样例数据文件不存在: ${config.sampleDataPath}`);
    }

    const validFormats = ['terminal', 'json', 'markdown'];
    config.formats.forEach(format => {
      if (!validFormats.includes(format)) {
        errors.push(`无效的输出格式: ${format} (支持: ${validFormats.join(', ')})`);
      }
    });

    return errors;
  }

  async _runChecks(config) {
    const templateFiles = await this._findTemplateFiles(config.templatePatterns);

    if (templateFiles.length === 0) {
      console.error('未找到匹配的模板文件');
      this._exitCode = exitCodes.FILE_NOT_FOUND;
      return { summary: {}, exitCode: exitCodes.FILE_NOT_FOUND };
    }

    const parserOptions = { caseSensitive: config.caseSensitive };

    const manifest = config.manifestPath
      ? VariableManifestParser.parseFile(config.manifestPath, parserOptions)
      : null;

    const sampleData = config.sampleDataPath
      ? SampleDataParser.parseFile(config.sampleDataPath)
      : null;

    const templateResults = this._analyzeTemplates(
      templateFiles,
      manifest,
      sampleData,
      config
    );

    const i18nComparison = this._compareI18n(templateResults, parserOptions);
    const renderedSamples = config.render
      ? this._renderSamples(templateFiles, sampleData, config)
      : [];

    const summary = this._buildSummary(templateResults, i18nComparison);
    const exitCode = this._determineExitCode(templateResults, i18nComparison);

    return {
      summary,
      templateResults,
      i18nComparison,
      renderedSamples,
      exitCode,
      config
    };
  }

  async _findTemplateFiles(patterns) {
    const allFiles = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, { nodir: true });
      allFiles.push(...files);
    }

    return [...new Set(allFiles)].map(f => path.resolve(f));
  }

  _analyzeTemplates(templateFiles, manifest, sampleData, config) {
    const validator = new VariableValidator({ caseSensitive: config.caseSensitive });

    return templateFiles.map(filePath => {
      const analysis = TemplateParser.parseFile(filePath, { caseSensitive: config.caseSensitive });
      const locale = this._extractLocaleFromPath(filePath);
      const validation = validator.validate(analysis, manifest, sampleData, locale);

      return {
        templatePath: filePath,
        locale,
        analysis,
        validation
      };
    });
  }

  _compareI18n(templateResults, options) {
    const withLocale = templateResults.filter(r => r.locale);

    if (withLocale.length < 2) {
      return {
        issues: [],
        summary: { total: 0, errors: 0, warnings: 0 },
        localeVariables: {}
      };
    }

    const comparator = new I18nComparator(options);
    return comparator.compare(withLocale.map(r => ({ ...r.analysis, locale: r.locale })));
  }

  _renderSamples(templateFiles, sampleData, config) {
    if (!sampleData) {
      return [];
    }

    const renderer = new TemplateRenderer({
      caseSensitive: config.caseSensitive,
      strictMode: false
    });

    const results = [];

    templateFiles.forEach(filePath => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const templateLocale = this._extractLocaleFromPath(filePath);

      const locales = templateLocale
        ? [templateLocale]
        : Object.keys(sampleData.data).filter(k => /^[a-z]{2}(-[A-Z]{2})?$/.test(k));

      locales.forEach(locale => {
        const data = sampleData.data[locale] || sampleData.data;
        const renderResult = renderer.render(content, data);

        const previewPath = path.join(
          config.outputDir,
          'previews',
          `${path.basename(filePath, path.extname(filePath))}_${locale}.html`
        );

        if (!fs.existsSync(path.dirname(previewPath))) {
          fs.mkdirSync(path.dirname(previewPath), { recursive: true });
        }
        fs.writeFileSync(previewPath, renderResult.content, 'utf-8');

        results.push({
          templatePath: filePath,
          locale,
          renderResult,
          previewPath
        });
      });
    });

    return results;
  }

  _extractLocaleFromPath(filePath) {
    const basename = path.basename(filePath);
    const match = basename.match(/\.([a-z]{2}(?:-[A-Z]{2})?)\./i);
    return match ? match[1] : null;
  }

  _buildSummary(templateResults, i18nComparison) {
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalVariables = 0;

    templateResults.forEach(result => {
      totalErrors += result.validation.summary.errors;
      totalWarnings += result.validation.summary.warnings;
      totalVariables += result.validation.templateVariables.length;
    });

    if (i18nComparison) {
      totalErrors += i18nComparison.summary.errors;
      totalWarnings += i18nComparison.summary.warnings;
    }

    const locales = new Set(templateResults.filter(r => r.locale).map(r => r.locale));

    return {
      templatesScanned: templateResults.length,
      totalVariables,
      localesCount: locales.size,
      errors: totalErrors,
      warnings: totalWarnings,
      info: 0
    };
  }

  _determineExitCode(templateResults, i18nComparison) {
    const hasErrors = templateResults.some(r => r.validation.summary.errors > 0)
      || (i18nComparison && i18nComparison.summary.errors > 0);

    const hasWarnings = templateResults.some(r => r.validation.summary.warnings > 0)
      || (i18nComparison && i18nComparison.summary.warnings > 0);

    if (hasErrors) {
      return exitCodes.ERRORS;
    } else if (hasWarnings) {
      return exitCodes.WARNINGS;
    }

    return exitCodes.SUCCESS;
  }

  async _generateReports(report, config) {
    if (config.formats.includes('terminal')) {
      const reporter = new TerminalReporter({
        verbose: config.verbose,
        color: config.color
      });
      console.log(reporter.generate(report));
    }

    if (config.formats.includes('json')) {
      const reporter = new JsonReporter();
      const filePath = path.join(config.outputDir, 'report.json');
      reporter.writeToFile(report, filePath);
      if (config.verbose) {
        console.log(`JSON报告已写入: ${filePath}`);
      }
    }

    if (config.formats.includes('markdown')) {
      const reporter = new MarkdownReporter();
      const filePath = path.join(config.outputDir, 'report.md');
      reporter.writeToFile(report, filePath);
      if (config.verbose) {
        console.log(`Markdown报告已写入: ${filePath}`);
      }
    }
  }
}

module.exports = { CLI };
