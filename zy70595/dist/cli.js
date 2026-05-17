"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const resolver_1 = require("./resolver");
const import_parser_1 = require("./import-parser");
const conflict_detector_1 = require("./conflict-detector");
const report_generator_1 = require("./report-generator");
const program = new commander_1.Command();
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
        const reportGenerator = new report_generator_1.ReportGenerator();
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
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
});
async function runCheck(options) {
    const importParser = new import_parser_1.ImportParser();
    const conflictDetector = new conflict_detector_1.ConflictDetector();
    let importStatements = [];
    let dirtyLines = [];
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
            }
            else {
                const result = importParser.parseFile(sourcePath);
                importStatements.push(...result.imports);
                dirtyLines.push(...result.dirtyLines);
            }
        }
        else {
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
        }
        else {
            throw new Error(`Imports file not found: ${importsPath}`);
        }
    }
    if (importStatements.length === 0) {
        throw new Error('No import paths found. Please provide --source or --imports option.');
    }
    const environmentInputs = parseEnvironmentConfigs(options.env, options.project);
    const resolutions = [];
    const envConfigsWithPaths = [];
    for (const envInput of environmentInputs) {
        const resolver = new resolver_1.PathResolver(envInput.tsconfigPath);
        const envResults = importStatements.map(stmt => resolver.resolve(stmt.importPath, stmt.sourceFile));
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
function parseEnvironmentConfigs(envOptions, defaultTsconfig) {
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
function findSourceFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== 'dist') {
                files.push(...findSourceFiles(fullPath));
            }
        }
        else if (entry.isFile()) {
            if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
                files.push(fullPath);
            }
        }
    }
    return files;
}
program.parse();
