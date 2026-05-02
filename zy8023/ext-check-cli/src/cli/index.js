#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const ManifestParser = require('../manifest/parser');
const PermissionChecker = require('../permissions/checker');
const AssetValidator = require('../assets/validator');
const ReportExporter = require('../reports/exporter');

class ExtCheckCLI {
  constructor() {
    this.args = this.parseArgs();
  }

  parseArgs() {
    const args = {};
    const rawArgs = process.argv.slice(2);

    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];
      if (arg === '--dir' || arg === '-d') {
        args.dir = rawArgs[++i];
      } else if (arg === '--manifest' || arg === '-m') {
        args.manifest = rawArgs[++i];
      } else if (arg === '--whitelist' || arg === '-w') {
        args.whitelist = rawArgs[++i];
      } else if (arg === '--changelog' || arg === '-c') {
        args.changelog = rawArgs[++i];
      } else if (arg === '--output' || arg === '-o') {
        args.output = rawArgs[++i];
      } else if (arg === '--help' || arg === '-h') {
        args.help = true;
      } else if (arg === '--verbose' || arg === '-v') {
        args.verbose = true;
      }
    }

    return args;
  }

  run() {
    if (this.args.help) {
      this.printHelp();
      process.exit(0);
    }

    console.log('🔍 Extension Publishing Pre-Check CLI\n');

    const extDir = this.resolveExtDir();
    console.log(`📁 Extension Directory: ${extDir}`);

    if (!fs.existsSync(extDir)) {
      console.error(`❌ Error: Extension directory not found: ${extDir}`);
      process.exit(1);
    }

    const outputDir = this.args.output || path.join(extDir, '..', 'out');
    console.log(`📤 Output Directory: ${outputDir}\n`);

    let changelog = '';
    if (this.args.changelog && fs.existsSync(this.args.changelog)) {
      changelog = fs.readFileSync(this.args.changelog, 'utf-8');
      console.log(`📝 Changelog loaded from: ${this.args.changelog}\n`);
    }

    const findings = [];

    console.log('📋 Running checks...\n');

    console.log('  1/4: Parsing manifest.json...');
    const manifestParser = new ManifestParser(extDir);
    let manifestData;
    try {
      manifestData = manifestParser.parse();
      findings.push(...manifestData.findings);
      console.log(`     ✓ Manifest V${manifestData.manifestVersion} parsed`);
      if (this.args.verbose) {
        console.log(`     Version: ${manifestData.version}`);
      }
    } catch (err) {
      console.error(`     ✗ Failed to parse manifest: ${err.message}`);
      process.exit(1);
    }

    console.log('  2/4: Checking permissions...');
    const permissionChecker = new PermissionChecker(extDir, this.args.whitelist);
    const permissionFindings = permissionChecker.check(manifestData);
    findings.push(...permissionFindings);
    console.log(`     ✓ ${permissionFindings.length} permission issues found`);

    console.log('  3/4: Validating assets...');
    const assetValidator = new AssetValidator(extDir);
    const assetFindings = assetValidator.validate(manifestData);
    findings.push(...assetFindings);
    console.log(`     ✓ ${assetFindings.length} asset issues found`);

    console.log('  4/4: Generating reports...');
    const reportExporter = new ReportExporter(outputDir);
    const { findingsPath, reportPath, checklistPath } = reportExporter.export(findings, {
      extDir: extDir,
      version: manifestData.version,
      manifestVersion: manifestData.manifestVersion,
      changelog: changelog
    });

    console.log('\n' + '─'.repeat(50));
    console.log('\n📊 Summary:\n');

    const errors = findings.filter(f => f.severity === 'error');
    const warnings = findings.filter(f => f.severity === 'warning');

    if (errors.length > 0) {
      console.log(`  🔴 Errors: ${errors.length}`);
    }
    if (warnings.length > 0) {
      console.log(`  🟡 Warnings: ${warnings.length}`);
    }
    if (errors.length === 0 && warnings.length === 0) {
      console.log('  ✅ No issues found!');
    }

    console.log('\n📄 Generated Reports:\n');
    console.log(`  - ${findingsPath}`);
    console.log(`  - ${reportPath}`);
    console.log(`  - ${checklistPath}`);

    console.log('\n' + '─'.repeat(50));

    if (errors.length > 0) {
      console.log('\n❌ Extension has errors that must be fixed before publishing.\n');
      process.exit(1);
    } else if (warnings.length > 0) {
      console.log('\n⚠️  Extension has warnings. Review the report before publishing.\n');
      process.exit(0);
    } else {
      console.log('\n✅ Extension is ready for publishing!\n');
      process.exit(0);
    }
  }

  resolveExtDir() {
    if (this.args.dir) {
      if (path.isAbsolute(this.args.dir)) {
        return this.args.dir;
      }
      return path.resolve(process.cwd(), this.args.dir);
    }

    if (this.args.manifest) {
      const manifestPath = path.isAbsolute(this.args.manifest)
        ? this.args.manifest
        : path.resolve(process.cwd(), this.args.manifest);
      return path.dirname(manifestPath);
    }

    return process.cwd();
  }

  printHelp() {
    console.log(`
Browser Extension Publishing Pre-Check CLI

Usage:
  ext-check [options]

Options:
  -d, --dir <path>       Extension source directory
  -m, --manifest <path>  Path to manifest.json
  -w, --whitelist <path> Path to permission whitelist YAML
  -c, --changelog <path> Path to changelog file
  -o, --output <path>    Output directory for reports
  -v, --verbose          Verbose output
  -h, --help             Show this help message

Examples:
  ext-check -d ./my-extension -w ./whitelist.yaml -o ./out
  ext-check --manifest ./my-extension/manifest.json
`);
  }
}

if (require.main === module) {
  const cli = new ExtCheckCLI();
  cli.run();
}

module.exports = ExtCheckCLI;
