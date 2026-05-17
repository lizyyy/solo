import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { PathResolver } from './resolver';
import { ImportParser } from './import-parser';
import { ConflictDetector } from './conflict-detector';
import { ReportGenerator } from './report-generator';
import { DiagnosticReport, EnvironmentResolution, ImportStatement, DirtyLine, EnvironmentConfig } from './types';

interface EnvironmentConfigInput {
  name: string;
  tsconfigPath: string;
}

const program = new Command();

program
  .name('tsconfig-paths-cli')
  .description('TypeScript Path Alias Diagnostic Tool')
  .version('1.0.0');

program
  .command('check')
  .description('Check path alias resolutions')
  .option('-p, --project <path>', 'Path to tsconfig.json (default env)', './tsconfig.json')
  .option('-s, --source <path>', 'Source file or directory to scan')
  .option('-i, --imports <path>', 'File with import paths to check')
  .option('-e, --env <name:path...>', 'Environment configs: name:tsconfig-path (e.g., "build:./tsconfig.build.json")')
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
  const importParser = new ImportParser();
  const conflictDetector = new ConflictDetector();

  let importStatements: ImportStatement[] = [];
  let dirtyLines: DirtyLine[] = [];

  if (options.source) {
    const sourcePath = path.resolve(options.source);
    if (fs.existsSync(sourcePath)) {
      if (fs.statSync(sourcePath).isDirectory()) {
        const files = findSourceFiles(sourcePath);
        for (const file of files) {
          const result = importParser.parseFile(file);
          importStatements.push(...result.imports);
          dirtyLines.push(...result.dirtyLines);
        }
      } else {
        const result = importParser.parseFile(sourcePath);
        importStatements.push(...result.imports);
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
      importStatements.push(...result.imports.map(importPath => ({
        lineNumber: 0,
        rawLine: importPath,
        importPath,
        isTypeImport: false,
        sourceFile: undefined,
      })));
      dirtyLines.push(...result.dirtyLines);
    } else {
      throw new Error(`Imports file not found: ${importsPath}`);
    }
  }

  if (importStatements.length === 0) {
    throw new Error('No import paths found. Please provide --source or --imports option.');
  }

  const environmentInputs = parseEnvironmentConfigs(options.env, options.project);
  const resolutions: EnvironmentResolution[] = [];
  const envConfigsWithPaths: EnvironmentConfig[] = [];

  for (const envInput of environmentInputs) {
    const resolver = new PathResolver(envInput.tsconfigPath);
    const envResults = importStatements.map(stmt => 
      resolver.resolve(stmt.importPath, stmt.sourceFile)
    );
    resolutions.push({
      environment: envInput.name,
      results: envResults,
    });
    envConfigsWithPaths.push({
      name: envInput.name,
      tsconfigPath: envInput.tsconfigPath,
      paths: resolver.getPaths(),
    });
  }

  const conflicts = conflictDetector.detectConflicts(resolutions);

  const validImports = importStatements.length;
  const totalImports = validImports + dirtyLines.length;

  return {
    summary: {
      totalImports,
      validImports,
      dirtyLines: dirtyLines.length,
      conflicts: conflicts.length,
    },
    paths: envConfigsWithPaths[0].paths,
    environmentConfigs: envConfigsWithPaths,
    resolutions,
    conflicts,
    dirtyLines,
    timestamp: new Date().toISOString(),
  };
}

function parseEnvironmentConfigs(envOptions: string[] | undefined, defaultTsconfig: string): EnvironmentConfigInput[] {
  if (!envOptions || envOptions.length === 0) {
    return [{ name: 'default', tsconfigPath: path.resolve(defaultTsconfig) }];
  }

  return envOptions.map(envOpt => {
    const parts = envOpt.split(':');
    if (parts.length === 1) {
      return { name: parts[0], tsconfigPath: path.resolve(defaultTsconfig) };
    }
    const name = parts[0];
    const tsconfigPath = parts.slice(1).join(':');
    return { name, tsconfigPath: path.resolve(tsconfigPath) };
  });
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