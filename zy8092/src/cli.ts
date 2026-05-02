#!/usr/bin/env node
import { Command } from 'commander';
import { parseArtifactsFile, parseSBOM, parseProvenance, parsePolicy, ensureOutputDir } from './parser';
import { validateArtifacts, createAuditResult } from './validator';
import { writeAuditReport } from './output';

const program = new Command();

program
  .name('release-audit')
  .description('CLI tool for auditing software artifacts before release')
  .version('1.0.0')
  .requiredOption('-a, --artifacts <path>', 'Path to artifacts.json file')
  .requiredOption('-s, --sbom <path>', 'Path to SPDX SBOM file')
  .requiredOption('-p, --provenance <path>', 'Path to SLSA provenance JSONL file')
  .requiredOption('-y, --policy <path>', 'Path to policy.yaml file')
  .option('-o, --output <dir>', 'Output directory', 'output')
  .action(async (options) => {
    try {
      console.log('Parsing input files...');
      const artifactsFile = parseArtifactsFile(options.artifacts);
      const sbom = parseSBOM(options.sbom);
      const provenances = parseProvenance(options.provenance);
      const policy = parsePolicy(options.policy);

      console.log('Validating artifacts...');
      const violations = validateArtifacts(
        artifactsFile.artifacts,
        provenances,
        sbom,
        policy
      );

      console.log('Creating audit result...');
      const auditResult = createAuditResult(
        artifactsFile.artifacts,
        provenances,
        sbom,
        policy,
        violations
      );

      console.log('Writing output files...');
      ensureOutputDir(options.output);
      writeAuditReport(auditResult, options.output);

      console.log(`Audit complete! Results saved to ${options.output}/`);
      console.log(`- ${auditResult.summary.totalArtifacts} artifacts scanned`);
      console.log(`- ${auditResult.summary.passedChecks} checks passed`);
      console.log(`- ${auditResult.summary.failedChecks} checks failed`);
      console.log(`- ${auditResult.summary.warnings} warnings`);

      if (auditResult.summary.failedChecks > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
