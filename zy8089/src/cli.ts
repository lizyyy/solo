#!/usr/bin/env node

import * as figlet from 'figlet';
import chalk from 'chalk';
import { parseFirmwareManifest } from './parsers/manifestParser';
import { parseDeviceCaps } from './parsers/capsParser';
import { parseRolloutCsv } from './parsers/rolloutParser';
import { validateVersionCompatibility } from './rules/versionRules';
import { validateDeviceCapabilities } from './rules/capabilityRules';
import { validateChunks } from './chunks/chunkValidator';
import { generateMarkdownReport } from './reporters/mdReporter';
import { generateRetryPlan } from './reporters/jsonReporter';
import { generateTimelineHtml } from './reporters/htmlReporter';
import { OtaValidationResult, ValidationError } from './types';

function printHeader(): void {
  console.log(chalk.magenta(figlet.textSync('OTA PreCheck', { horizontalLayout: 'full' })));
  console.log(chalk.blue('============================================'));
  console.log(chalk.blue('      BLE Device OTA Package Pre-Checker'));
  console.log(chalk.blue('============================================\n'));
}

function parseArgs(): { manifest: string; chunks: string; caps: string; rollout: string } {
  const args = process.argv.slice(2);
  const params: { manifest?: string; chunks?: string; caps?: string; rollout?: string } = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    
    if (key === '--manifest' || key === '-m') params.manifest = value;
    if (key === '--chunks' || key === '-c') params.chunks = value;
    if (key === '--caps' || key === '-p') params.caps = value;
    if (key === '--rollout' || key === '-r') params.rollout = value;
  }

  if (!params.manifest) {
    console.error(chalk.red('Error: --manifest is required'));
    process.exit(1);
  }
  if (!params.chunks) {
    console.error(chalk.red('Error: --chunks is required'));
    process.exit(1);
  }
  if (!params.caps) {
    console.error(chalk.red('Error: --caps is required'));
    process.exit(1);
  }
  if (!params.rollout) {
    console.error(chalk.red('Error: --rollout is required'));
    process.exit(1);
  }

  return params as { manifest: string; chunks: string; caps: string; rollout: string };
}

function printErrors(errors: ValidationError[]): void {
  errors.forEach(err => {
    const color = err.severity === 'error' ? chalk.red : err.severity === 'warning' ? chalk.yellow : chalk.blue;
    console.log(color(`[${err.severity.toUpperCase()}] ${err.message}`));
  });
}

async function main(): Promise<void> {
  printHeader();
  
  const args = parseArgs();
  
  console.log(chalk.cyan('Step 1/5: Parsing firmware manifest...'));
  const { manifest, errors: manifestErrors } = parseFirmwareManifest(args.manifest);
  if (manifestErrors.length > 0) {
    printErrors(manifestErrors);
    process.exit(1);
  }
  console.log(chalk.green(`✓ Manifest loaded: ${manifest!.version}\n`));

  console.log(chalk.cyan('Step 2/5: Parsing device capabilities...'));
  const { capabilities, errors: capsErrors } = parseDeviceCaps(args.caps);
  if (capsErrors.length > 0) {
    printErrors(capsErrors);
    process.exit(1);
  }
  console.log(chalk.green(`✓ Capabilities loaded: ${capabilities.length} device types\n`));

  console.log(chalk.cyan('Step 3/5: Parsing rollout CSV...'));
  const { devices, errors: rolloutErrors } = await parseRolloutCsv(args.rollout);
  if (rolloutErrors.length > 0) {
    printErrors(rolloutErrors);
  }
  console.log(chalk.green(`✓ Rollout loaded: ${devices.length} devices\n`));

  console.log(chalk.cyan('Step 4/5: Validating chunks...'));
  const chunkValidation = validateChunks(manifest!, args.chunks);
  if (chunkValidation.errors.length > 0) {
    printErrors(chunkValidation.errors);
  }
  console.log(chalk.green(`✓ Chunk validation: ${chunkValidation.isValid ? 'PASS' : 'FAIL'}\n`));

  console.log(chalk.cyan('Step 5/5: Validating version compatibility...'));
  const versionValidation = validateVersionCompatibility(manifest!, devices);
  if (versionValidation.errors.length > 0) {
    printErrors(versionValidation.errors);
  }
  console.log(chalk.green(`✓ Version validation: ${versionValidation.isValid ? 'PASS' : 'FAIL'}\n`));

  console.log(chalk.cyan('Step 6/6: Validating device capabilities...'));
  const capabilityValidation = validateDeviceCapabilities(manifest!, capabilities, devices);
  if (capabilityValidation.errors.length > 0) {
    printErrors(capabilityValidation.errors);
  }
  console.log(chalk.green(`✓ Capability validation: ${capabilityValidation.isValid ? 'PASS' : 'FAIL'}\n`));

  const allErrors = [
    ...chunkValidation.errors,
    ...versionValidation.errors,
    ...capabilityValidation.errors
  ];
  
  const totalErrors = allErrors.filter(e => e.severity === 'error').length;
  const totalWarnings = allErrors.filter(e => e.severity === 'warning').length;

  const result: OtaValidationResult = {
    manifest: manifest!,
    deviceCaps: capabilities,
    rolloutDevices: devices,
    chunkValidation,
    versionValidation,
    capabilityValidation,
    totalErrors,
    totalWarnings
  };

  console.log(chalk.cyan('Generating reports...'));
  generateMarkdownReport(result, 'ota_report.md');
  console.log(chalk.green('✓ ota_report.md generated'));
  
  generateRetryPlan(result, 'retry_plan.json');
  console.log(chalk.green('✓ retry_plan.json generated'));
  
  generateTimelineHtml(result, 'timeline.html');
  console.log(chalk.green('✓ timeline.html generated'));

  console.log('\n' + chalk.blue('============================================'));
  if (totalErrors === 0) {
    console.log(chalk.green('SUCCESS: All validations passed!'));
  } else {
    console.log(chalk.red(`FAILED: ${totalErrors} errors found`));
    if (totalWarnings > 0) {
      console.log(chalk.yellow(`WARNING: ${totalWarnings} warnings found`));
    }
  }
  console.log(chalk.blue('============================================'));

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error(chalk.red(`Fatal error: ${err.message}`));
  process.exit(1);
});
