#!/usr/bin/env node

const { Command } = require('commander');
const { LockfileParser } = require('./lockfile-parser');
const { SnapshotManager } = require('./snapshot-manager');
const { ReportGenerator } = require('./report-generator');
const { BadRowCollector } = require('./errors');
const fs = require('fs');
const path = require('path');

const program = new Command();

program
  .name('license-snapshot')
  .description('CLI tool for tracking dependency license changes across versions')
  .version('1.0.0');

program
  .command('snapshot')
  .description('Create a license snapshot from a lockfile')
  .argument('<lockfile>', 'Path to the lockfile (package-lock.json, yarn.lock, or pnpm-lock.yaml)')
  .option('-o, --output <path>', 'Output path for the snapshot file', '.license-snapshot.json')
  .option('-a, --allowed <licenses>', 'Comma-separated list of allowed licenses', '')
  .option('-d, --denied <licenses>', 'Comma-separated list of denied licenses', '')
  .option('--json', 'Output JSON to stdout instead of saving to file')
  .action(async (lockfile, options) => {
    try {
      const allowedLicenses = options.allowed ? options.allowed.split(',').map(s => s.trim()) : [];
      const deniedLicenses = options.denied ? options.denied.split(',').map(s => s.trim()) : [];

      const parser = new LockfileParser();
      const parseResult = parser.parse(lockfile);

      const snapshotManager = new SnapshotManager({
        allowedLicenses,
        deniedLicenses
      });

      const snapshot = snapshotManager.createSnapshot(parseResult.packages, {
        lockfile: path.basename(lockfile),
        format: parseResult.format
      });

      if (options.json) {
        console.log(JSON.stringify({
          snapshot,
          badRows: parseResult.badRows.getAll()
        }, null, 2));
      } else {
        snapshotManager.saveSnapshot(snapshot, options.output);
        console.log(`✅ Snapshot saved to ${options.output}`);
        console.log(`   - Total packages: ${snapshot.summary.totalPackages}`);
        console.log(`   - Unique licenses: ${snapshot.summary.uniqueLicenses}`);
        if (parseResult.badRows.getCount() > 0) {
          console.log(`   - ⚠️  Parse errors: ${parseResult.badRows.getCount()}`);
        }
      }

      if (parseResult.badRows.getCount() > 0) {
        process.exitCode = 2;
      }
    } catch (error) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('Compare current lockfile against a saved snapshot')
  .argument('<lockfile>', 'Path to the lockfile')
  .option('-s, --snapshot <path>', 'Path to the snapshot file', '.license-snapshot.json')
  .option('-o, --output <path>', 'Output path for the report (use .md or .json extension)')
  .option('-a, --allowed <licenses>', 'Comma-separated list of allowed licenses', '')
  .option('-d, --denied <licenses>', 'Comma-separated list of denied licenses', '')
  .option('--show-all', 'Show all unchanged packages in output')
  .option('--strict', 'Exit with error if any critical issues found')
  .action(async (lockfile, options) => {
    try {
      const allowedLicenses = options.allowed ? options.allowed.split(',').map(s => s.trim()) : [];
      const deniedLicenses = options.denied ? options.denied.split(',').map(s => s.trim()) : [];

      const parser = new LockfileParser();
      const parseResult = parser.parse(lockfile);

      const snapshotManager = new SnapshotManager({
        allowedLicenses,
        deniedLicenses,
        snapshotFile: options.snapshot
      });

      const oldSnapshot = snapshotManager.loadSnapshot();
      if (!oldSnapshot) {
        console.error(`❌ Snapshot file not found: ${options.snapshot}`);
        console.error(`   Run 'license-snapshot snapshot <lockfile>' first to create a snapshot`);
        process.exit(1);
        return;
      }

      const comparison = snapshotManager.compare(oldSnapshot, parseResult.packages);
      const newSnapshot = snapshotManager.createSnapshot(parseResult.packages, {
        lockfile: path.basename(lockfile),
        format: parseResult.format
      });

      const reportGenerator = new ReportGenerator({
        showAllPackages: options.showAll
      });

      console.log(reportGenerator.generateTerminalSummary(comparison, parseResult.badRows));

      if (options.output) {
        const ext = path.extname(options.output).toLowerCase();
        let content;

        if (ext === '.json') {
          content = reportGenerator.generateJSONReport(
            comparison,
            newSnapshot,
            parseResult.badRows,
            { lockfile }
          );
        } else {
          content = reportGenerator.generateMarkdownReport(
            comparison,
            newSnapshot,
            parseResult.badRows,
            { lockfile }
          );
        }

        reportGenerator.saveReport(content, options.output);
        console.log(`📄 Report saved to ${options.output}`);
      }

      let exitCode = 0;
      if (parseResult.badRows.getCount() > 0) {
        exitCode = 2;
      }

      const criticalCount = reportGenerator.countRiskLevel(comparison, 'critical');
      if (options.strict && (criticalCount > 0 || comparison.licenseChanged.length > 0)) {
        exitCode = 1;
      }

      process.exitCode = exitCode;
    } catch (error) {
      console.error(`❌ ${error.message}`);
      if (error.context) {
        console.error(`   Context:`, error.context);
      }
      process.exit(1);
    }
  });

program
  .command('update')
  .description('Update the snapshot file with current lockfile')
  .argument('<lockfile>', 'Path to the lockfile')
  .option('-s, --snapshot <path>', 'Path to the snapshot file', '.license-snapshot.json')
  .action(async (lockfile, options) => {
    try {
      const parser = new LockfileParser();
      const parseResult = parser.parse(lockfile);

      const snapshotManager = new SnapshotManager({
        snapshotFile: options.snapshot
      });

      const snapshot = snapshotManager.createSnapshot(parseResult.packages, {
        lockfile: path.basename(lockfile),
        format: parseResult.format,
        updated: new Date().toISOString()
      });

      snapshotManager.saveSnapshot(snapshot, options.snapshot);
      console.log(`✅ Snapshot updated: ${options.snapshot}`);
      console.log(`   - Total packages: ${snapshot.summary.totalPackages}`);
      console.log(`   - Unique licenses: ${snapshot.summary.uniqueLicenses}`);

      if (parseResult.badRows.getCount() > 0) {
        console.log(`   - ⚠️  Parse errors: ${parseResult.badRows.getCount()}`);
        process.exitCode = 2;
      }
    } catch (error) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all licenses from a lockfile or snapshot')
  .argument('[file]', 'Path to lockfile or snapshot file (default: look for .license-snapshot.json)')
  .option('--by-license', 'Group packages by license', false)
  .option('--dev', 'Show only dev dependencies', false)
  .option('--prod', 'Show only production dependencies', false)
  .action(async (file, options) => {
    try {
      let packages;
      let snapshot = null;
      let badRows = null;

      if (file && fs.existsSync(file)) {
        const ext = path.extname(file).toLowerCase();
        if (ext === '.json' && file.includes('snapshot')) {
          const snapshotManager = new SnapshotManager();
          snapshot = snapshotManager.loadSnapshot(file);
          packages = snapshot.packages;
        } else {
          const parser = new LockfileParser();
          const parseResult = parser.parse(file);
          packages = parseResult.packages;
          badRows = parseResult.badRows;
        }
      } else {
        const snapshotManager = new SnapshotManager();
        snapshot = snapshotManager.loadSnapshot();
        if (!snapshot) {
          console.error('❌ No snapshot file found and no lockfile specified');
          process.exit(1);
          return;
        }
        packages = snapshot.packages;
      }

      if (options.dev) {
        packages = packages.filter(p => p.dev);
      } else if (options.prod) {
        packages = packages.filter(p => !p.dev);
      }

      const snapshotManager = new SnapshotManager();

      if (options.byLicense) {
        const groups = snapshotManager.mergeLicenses(packages);
        for (const group of groups) {
          console.log(`\n📜 ${group.license} (${group.count} packages)`);
          for (const pkg of group.packages.slice(0, 20)) {
            console.log(`  - ${pkg.name}@${pkg.version}`);
          }
          if (group.packages.length > 20) {
            console.log(`  ... and ${group.packages.length - 20} more`);
          }
        }
      } else {
        console.log(`\n📦 Found ${packages.length} packages:\n`);
        for (const pkg of packages.slice(0, 100)) {
          const license = snapshotManager.normalizeLicense(pkg.license);
          const devFlag = pkg.dev ? ' [dev]' : '';
          console.log(`  ${pkg.name}@${pkg.version} - ${license}${devFlag}`);
        }
        if (packages.length > 100) {
          console.log(`\n  ... and ${packages.length - 100} more packages`);
        }
      }

      if (badRows && badRows.getCount() > 0) {
        console.log(`\n⚠️  Parse errors: ${badRows.getCount()}`);
      }

      console.log('');
    } catch (error) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
