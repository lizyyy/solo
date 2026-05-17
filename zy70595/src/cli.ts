import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { PathResolver } from './resolver';
import { ImportParser } from './import-parser';
import { ConflictDetector } from './conflict-detector';
import { ReportGenerator } from './report-generator';
import { DiagnosticReport, EnvironmentResolution } from './types';

const program = new Command();

program
  .name('tsconfig-paths-cli')
  .description('TypeScript Path Alias Diagnostic Tool')
  .version('1.0.0');

program
  .command('check')
  .description('Check path alias resolutions')
  .option('-p, --project <path>', 'Path to tsconfig.json', './tsconfig.json')
  .option('-s, --source <path>', 'Source file or directory to scan')
  .option('-i, --imports <path>', 'File with import paths to check')
  .option('-e, --env <name...>', 'Environment names for multi-env comparison')
  .option('-o, --output <dir>', 'Output directory for reports', './reports')
  .option('--json-only', 'Only output machine-readable JSON')
  .action(async (options) => {
    try {
      const report = await runCheck(options);
      const reportGenerator = new ReportGenerator();

      if (!options.jsonOnly) {
        console.log(reportGenerator.generateTerminalReport(report));
      }

      const outputDir = path.resolve(options.output);
      reportGenerator.generateMachineReadableReport(report, path.join(outputDir, 'report.json'));
      reportGenerator.generateHumanReadableReport(report, path.join(outputDir, 'report.md'));

      console.log(`\n📄 Reports saved to: ${outputDir}/`);
      console.log(`   - report.json (machine-readable)`);
      console.log(`   - report.md (human-readable)\n`);

      process.exit(reportGenerator.getExitCode(report));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

async function runCheck(options: any): Promise<DiagnosticReport> {
  const tsconfigPath = path.resolve(options.project);
  const resolver = new PathResolver(tsconfigPath);
  const importParser = new ImportParser();
  const conflictDetector = new ConflictDetector();

  let imports: string[] = [];
  let dirtyLines = [];

  if (options.source) {
    const sourcePath = path.resolve(options.source);
    if (fs.existsSync(sourcePath)) {
      if (fs.statSync(sourcePath).isDirectory()) {
        const files = findSourceFiles(sourcePath);
        for (const file of files) {
          const result = importParser.parseFile(file);
          imports.push(...result.imports.map(i => i.importPath));
          dirtyLines.push(...result.dirtyLines);
        }
      } else {
        const result = importParser.parseFile(sourcePath);
        imports.push(...result.imports.map(i => i.importPath));
        dirtyLines.push(...result.dirtyLines);
      }
    } else {
      throw new Error(`Source path not found: ${sourcePath}`);
    }
  }

  if (options.imports) {
    const importsPath = path.resolve(options.imports);
    if (fs.existsSync(importsPath)) {
      const content = fs.readFileSync(importsPath, 'utf-8');
      const result = importParser.parseImportList(content);
      imports.push(...result.imports);
      dirtyLines.push(...result.dirtyLines);
    } else {
      throw new Error(`Imports file not found: ${importsPath}`);
    }
  }

  if (imports.length === 0) {
    throw new Error('No import paths found. Please provide --source or --imports option.');
  }

  const environments = options.env || ['default'];
  const resolutions: EnvironmentResolution[] = [];

  for (const env of environments) {
    const envResults = imports.map(importPath => resolver.resolve(importPath));
    resolutions.push({
      environment: env,
      results: envResults,
    });
  }

  const conflicts = conflictDetector.detectConflicts(resolutions);

  const validImports = imports.length;
  const totalImports = validImports + dirtyLines.length;

  return {
    summary: {
      totalImports,
      validImports,
      dirtyLines: dirtyLines.length,
      conflicts: conflicts.length,
    },
    paths: resolver.getPaths(),
    resolutions,
    conflicts,
    dirtyLines,
    timestamp: new Date().toISOString(),
  };
}

function findSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...findSourceFiles(fullPath));
      }
    } else if (entry.isFile()) {
      if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

program.parse();