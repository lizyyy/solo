import * as fs from 'fs';
import * as path from 'path';
import * as chalk from 'chalk';
import { JsonParser, CsvParser, YamlParser } from './parsers';
import { RulesEngine } from './engine';
import { ReportGenerator } from './reporters';
import { AnalysisResult, ReportOutput } from './types';

interface CliOptions {
  localeDir: string;
  routes: string;
  screenshotManifest: string;
  rules: string;
  output: string;
  referenceLocale: string;
  quiet: boolean;
}

const defaultOptions: Partial<CliOptions> = {
  referenceLocale: 'en',
  quiet: false
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: Partial<CliOptions> = { ...defaultOptions };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--localeDir':
      case '-l':
        options.localeDir = args[++i];
        break;
      case '--routes':
      case '-r':
        options.routes = args[++i];
        break;
      case '--screenshotManifest':
      case '-s':
        options.screenshotManifest = args[++i];
        break;
      case '--rules':
      case '-c':
        options.rules = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--referenceLocale':
      case '--ref':
        options.referenceLocale = args[++i];
        break;
      case '--quiet':
      case '-q':
        options.quiet = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(chalk.red(`Unknown option: ${arg}`));
        printHelp();
        process.exit(1);
    }
  }

  if (!options.localeDir) {
    console.error(chalk.red('Error: --localeDir is required'));
    printHelp();
    process.exit(1);
  }

  return options as CliOptions;
}

function printHelp(): void {
  console.log(`
i18n-preflight - Frontend ICU i18n preflight check CLI

Usage:
  i18n-preflight --localeDir <path> [options]

Options:
  --localeDir, -l <path>       Directory containing locale JSON files (required)
  --routes, -r <path>          Path to routes.csv file
  --screenshotManifest, -s <path>  Path to screenshot-manifest.json
  --rules, -c <path>           Path to rules.yaml config
  --output, -o <path>          Output directory for reports (default: ./output)
  --referenceLocale, --ref     Reference locale for comparisons (default: en)
  --quiet, -q                   Suppress console output
  --help, -h                    Show this help message

Examples:
  i18n-preflight --localeDir ./locales
  i18n-preflight -l ./locales -r ./routes.csv -s ./screenshot-manifest.json -c ./rules.yaml -o ./report
  `);
}

function log(message: string, quiet: boolean): void {
  if (!quiet) {
    console.log(message);
  }
}

export async function run(): Promise<void> {
  const options = parseArgs();
  const { localeDir, routes: routesPath, screenshotManifest: manifestPath, rules: rulesPath, output: outputPath, referenceLocale, quiet } = options;

  log(chalk.blue('🌍 i18n Preflight Check'), quiet);
  log(chalk.gray('────────────────────────────────'), quiet);

  let localeMessages;
  try {
    log(chalk.gray(`• Reading locale files from: ${localeDir}`), quiet);
    localeMessages = JsonParser.parseLocaleFiles(localeDir);
  } catch (error) {
    console.error(chalk.red(`Failed to read locale files: ${(error as Error).message}`));
    process.exit(1);
  }

  const locales = Object.keys(localeMessages);
  if (locales.length === 0) {
    console.error(chalk.red('No locale files found'));
    process.exit(1);
  }
  log(chalk.green(`  ✓ Found ${locales.length} locales: ${locales.join(', ')}`), quiet);

  const flatMessages: { [locale: string]: any } = {};
  for (const locale of locales) {
    flatMessages[locale] = JsonParser.flatten(localeMessages[locale]);
  }

  let routes: any[] = [];
  if (routesPath && fs.existsSync(routesPath)) {
    try {
      log(chalk.gray(`• Reading routes from: ${routesPath}`), quiet);
      routes = CsvParser.parseRoutes(routesPath);
      log(chalk.green(`  ✓ Found ${routes.length} routes`), quiet);
    } catch (error) {
      console.error(chalk.yellow(`  ⚠ Failed to read routes: ${(error as Error).message}`));
    }
  }

  let screenshots: any[] = [];
  if (manifestPath && fs.existsSync(manifestPath)) {
    try {
      log(chalk.gray(`• Reading screenshot manifest from: ${manifestPath}`), quiet);
      screenshots = CsvParser.parseScreenshotManifest(manifestPath);
      log(chalk.green(`  ✓ Found ${screenshots.length} screenshots`), quiet);
    } catch (error) {
      console.error(chalk.yellow(`  ⚠ Failed to read screenshot manifest: ${(error as Error).message}`));
    }
  }

  let rules;
  if (rulesPath && fs.existsSync(rulesPath)) {
    try {
      log(chalk.gray(`• Reading rules from: ${rulesPath}`), quiet);
      rules = YamlParser.parseRules(rulesPath);
      log(chalk.green(`  ✓ Rules loaded`), quiet);
    } catch (error) {
      console.error(chalk.yellow(`  ⚠ Failed to read rules: ${(error as Error).message}, using defaults`));
      rules = YamlParser.getDefaultRules();
    }
  } else {
    log(chalk.gray('• Using default rules'), quiet);
    rules = YamlParser.getDefaultRules();
  }

  log('', quiet);
  log(chalk.blue('🔍 Analyzing...'), quiet);

  const engine = new RulesEngine();
  const result = engine.analyze(
    flatMessages,
    rules,
    routes,
    screenshots,
    referenceLocale
  );

  const errors = result.issues.filter(i => i.severity === 'error').length;
  const warnings = result.issues.filter(i => i.severity === 'warning').length;
  const infos = result.issues.filter(i => i.severity === 'info').length;

  log('', quiet);
  log(chalk.blue('📊 Results:'), quiet);
  log(`  • Total keys: ${result.totalKeys}`, quiet);
  log(`  • Issues: ${chalk.red(`${errors} errors`)}, ${chalk.yellow(`${warnings} warnings`)}, ${chalk.gray(`${infos} info`)}`, quiet);

  if (Object.keys(result.missingKeys).length > 0) {
    for (const [locale, keys] of Object.entries(result.missingKeys)) {
      log(`  • Missing keys in ${locale}: ${chalk.red(keys.length)}`, quiet);
    }
  }

  const output = outputPath || './output';
  
  log('', quiet);
  log(chalk.blue('📝 Generating reports...'), quiet);

  const reporter = new ReportGenerator();
  const reports = reporter.generate(result);

  try {
    if (!fs.existsSync(output)) {
      fs.mkdirSync(output, { recursive: true });
    }

    const csvPath = path.join(output, 'issues.csv');
    fs.writeFileSync(csvPath, reports.issuesCsv);
    log(chalk.green(`  ✓ Generated: ${csvPath}`), quiet);

    const mdPath = path.join(output, 'i18n_report.md');
    fs.writeFileSync(mdPath, reports.markdownReport);
    log(chalk.green(`  ✓ Generated: ${mdPath}`), quiet);

    const htmlPath = path.join(output, 'preview.html');
    fs.writeFileSync(htmlPath, reports.htmlPreview);
    log(chalk.green(`  ✓ Generated: ${htmlPath}`), quiet);

  } catch (error) {
    console.error(chalk.red(`Failed to write reports: ${(error as Error).message}`));
    process.exit(1);
  }

  log('', quiet);
  if (errors > 0) {
    log(chalk.red(`❌ Check failed with ${errors} error(s). Please fix before release.`), quiet);
    process.exit(1);
  } else if (warnings > 0) {
    log(chalk.yellow(`⚠️ Check passed with ${warnings} warning(s).`), quiet);
  } else {
    log(chalk.green(`✅ All checks passed!`), quiet);
  }
}

if (require.main === module) {
  run().catch(error => {
    console.error(chalk.red(`Fatal error: ${error.message}`));
    console.error(error.stack);
    process.exit(1);
  });
}
