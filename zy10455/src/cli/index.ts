import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { CLIOptions, FuzzReport } from '../types';
import { SchemaReader } from '../schema';
import { Fuzzer } from '../fuzzer';
import { Validator } from '../validation';
import { ReportGenerator } from '../report';

const packageJson = require('../../package.json');

export class CLI {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupProgram();
  }

  private setupProgram(): void {
    this.program
      .name('openapi-fuzz')
      .description('OpenAPI Sample Fuzzer - Test schema compatibility with perturbed examples')
      .version(packageJson.version)
      .requiredOption('-i, --input <file>', 'Path to OpenAPI file (JSON or YAML)')
      .option('-o, --output <directory>', 'Output directory for reports', './fuzz-results')
      .option('-r, --rules <file>', 'Path to custom fuzz rules configuration')
      .option('-f, --format <format>', 'Output format: json, html, or both', 'both')
      .option('-v, --verbose', 'Enable verbose output')
      .option('--fail-fast', 'Stop on first validation failure');

    this.program.addHelpText('after', `
Examples:
  $ openapi-fuzz -i api-spec.yaml
  $ openapi-fuzz -i openapi.json -o ./reports -f html
  $ openapi-fuzz -i spec.yaml -r custom-rules.json --fail-fast
    `);
  }

  private validateOptions(options: CLIOptions): void {
    const errors: string[] = [];

    if (!fs.existsSync(options.input)) {
      errors.push(`Input file not found: ${options.input}`);
    } else {
      const ext = path.extname(options.input).toLowerCase();
      if (!['.json', '.yaml', '.yml'].includes(ext)) {
        errors.push(`Input file must be JSON or YAML: ${options.input}`);
      }
    }

    if (options.rules && !fs.existsSync(options.rules)) {
      errors.push(`Rules file not found: ${options.rules}`);
    }

    if (options.format && !['json', 'html', 'both'].includes(options.format)) {
      errors.push(`Invalid format: ${options.format}. Use: json, html, or both`);
    }

    if (errors.length > 0) {
      console.error(chalk.red('\nValidation errors:'));
      errors.forEach(err => console.error(chalk.red(`  ✗ ${err}`)));
      console.error('');
      process.exit(1);
    }
  }

  private ensureOutputDir(outputDir: string): void {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  async run(): Promise<void> {
    try {
      this.program.parse();
      const options = this.program.opts<CLIOptions>();

      console.log(chalk.cyan.bold('\n╔════════════════════════════════════════╗'));
      console.log(chalk.cyan.bold('║    OpenAPI Sample Fuzzer CLI          ║'));
      console.log(chalk.cyan.bold(`║    Version ${packageJson.version}                   ║`));
      console.log(chalk.cyan.bold('╚════════════════════════════════════════╝\n'));

      this.validateOptions(options);
      this.ensureOutputDir(options.output!);

      if (options.verbose) {
        console.log(chalk.gray('Options:'));
        console.log(chalk.gray(`  Input: ${options.input}`));
        console.log(chalk.gray(`  Output: ${options.output}`));
        console.log(chalk.gray(`  Format: ${options.format}`));
        console.log(chalk.gray(`  Fail Fast: ${options.failFast ? 'Yes' : 'No'}\n`));
      }

      console.log(chalk.blue('📖  Reading OpenAPI schema...'));
      const schemaReader = new SchemaReader(options.input);
      const schemas = schemaReader.extractSchemasWithExamples();
      
      if (options.verbose) {
        console.log(chalk.gray(`  Found ${schemas.length} schemas with examples\n`));
      }

      console.log(chalk.blue('🔀  Generating perturbed samples...'));
      const fuzzer = new Fuzzer(options.rules);
      const perturbedSamples = fuzzer.generatePerturbations(schemas);
      
      if (options.verbose) {
        console.log(chalk.gray(`  Generated ${perturbedSamples.length} perturbed samples\n`));
      }

      console.log(chalk.blue('✅  Validating samples against schema...'));
      const validator = new Validator(schemaReader.getOpenAPIDocument());
      const validationResults = validator.validateAll(perturbedSamples, options.failFast);
      
      const passed = validationResults.filter(r => r.valid).length;
      const failed = validationResults.filter(r => !r.valid).length;

      console.log(chalk.blue('📊  Generating reports...\n'));
      const reportGenerator = new ReportGenerator(options.output!, options);
      const report = reportGenerator.generateReport(
        validationResults,
        fuzzer.getRules(),
        fuzzer.getCoverageStats(),
        options.input
      );

      reportGenerator.printSummary(report);

      if (options.format === 'json' || options.format === 'both') {
        reportGenerator.writeJsonReport(report);
      }
      if (options.format === 'html' || options.format === 'both') {
        reportGenerator.writeHtmlReport(report);
      }

      console.log(chalk.green.bold('\n✨  Fuzzing completed!'));
      console.log(chalk.gray(`  Reports saved to: ${path.resolve(options.output!)}\n`));

      process.exit(failed > 0 ? 1 : 0);

    } catch (error: any) {
      console.error(chalk.red.bold('\n❌  Fatal error:'));
      console.error(chalk.red(`  ${error.message}`));
      if (this.program.opts().verbose) {
        console.error(chalk.gray(`\nStack trace:\n${error.stack}`));
      }
      console.error('');
      process.exit(2);
    }
  }
}
