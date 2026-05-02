import * as fs from 'fs';
import { OtaValidationResult } from '../types';

export function generateMarkdownReport(result: OtaValidationResult, outputPath: string): void {
  let md = `# OTA Package Pre-Check Report\n\n`;
  md += `## Summary\n\n`;
  md += `| Item | Value |\n`;
  md += `|------|-------|\n`;
  md += `| Firmware Version | ${result.manifest.version} |\n`;
  md += `| Target Device Type | ${result.manifest.targetDeviceType} |\n`;
  md += `| Release Date | ${result.manifest.releaseDate} |\n`;
  md += `| Total Size | ${result.manifest.totalSize.toLocaleString()} bytes |\n`;
  md += `| Chunks Count | ${result.manifest.chunks.length} |\n`;
  md += `| Target Devices | ${result.rolloutDevices.length} |\n`;
  md += `| Total Errors | ${result.totalErrors} |\n`;
  md += `| Total Warnings | ${result.totalWarnings} |\n\n`;

  md += `## Validation Results\n\n`;
  md += `### Chunk Validation\n\n`;
  md += `**Status:** ${result.chunkValidation.isValid ? '✓ PASS' : '✗ FAIL'}\n\n`;
  
  if (result.chunkValidation.errors.length > 0) {
    md += `**Errors:**\n\n`;
    result.chunkValidation.errors.forEach(err => {
      md += `- [${err.severity.toUpperCase()}] ${err.message}\n`;
    });
  }

  if (result.chunkValidation.duplicateChunks.length > 0) {
    md += `\n**Duplicate Chunks:** ${result.chunkValidation.duplicateChunks.join(', ')}\n`;
  }

  if (result.chunkValidation.missingChunks.length > 0) {
    md += `\n**Missing Chunks:** ${result.chunkValidation.missingChunks.join(', ')}\n`;
  }

  md += `\n### Version Validation\n\n`;
  md += `**Status:** ${result.versionValidation.isValid ? '✓ PASS' : '✗ FAIL'}\n\n`;
  
  if (result.versionValidation.devicesWithHigherVersion.length > 0) {
    md += `**Devices with higher version than target:**\n\n`;
    md += `${result.versionValidation.devicesWithHigherVersion.join(', ')}\n\n`;
  }

  if (result.versionValidation.devicesBelowMinVersion.length > 0) {
    md += `**Devices below minimum supported version:**\n\n`;
    md += `${result.versionValidation.devicesBelowMinVersion.join(', ')}\n\n`;
  }

  if (result.versionValidation.errors.length > 0) {
    md += `**Errors:**\n\n`;
    result.versionValidation.errors.forEach(err => {
      md += `- [${err.severity.toUpperCase()}] ${err.message}\n`;
    });
  }

  md += `\n### Capability Validation\n\n`;
  md += `**Status:** ${result.capabilityValidation.isValid ? '✓ PASS' : '✗ FAIL'}\n\n`;
  
  if (result.capabilityValidation.errors.length > 0) {
    md += `**Errors:**\n\n`;
    result.capabilityValidation.errors.forEach(err => {
      md += `- [${err.severity.toUpperCase()}] ${err.message}\n`;
    });
  }

  md += `\n## Manifest Details\n\n`;
  md += `### Metadata\n\n`;
  md += `| Field | Value |\n`;
  md += `|-------|-------|\n`;
  md += `| Build ID | ${result.manifest.metadata.buildId} |\n`;
  md += `| Commit Hash | ${result.manifest.metadata.commitHash} |\n`;
  md += `| Signing Key | ${result.manifest.metadata.signingKey} |\n\n`;

  md += `### Chunks List\n\n`;
  md += `| Index | Filename | Size | Hash |\n`;
  md += `|-------|----------|------|------|\n`;
  result.manifest.chunks.forEach(chunk => {
    md += `| ${chunk.index} | ${chunk.filename} | ${chunk.size} | ${chunk.hash} |\n`;
  });

  md += `\n## Rollout Devices\n\n`;
  md += `| Device ID | Type | Current Version | Target Version | Priority | Region |\n`;
  md += `|-----------|------|-----------------|----------------|----------|--------|\n`;
  result.rolloutDevices.forEach(device => {
    md += `| ${device.deviceId} | ${device.deviceType} | ${device.currentVersion} | ${device.targetVersion} | ${device.priority} | ${device.region} |\n`;
  });

  md += `\n---\nGenerated at: ${new Date().toISOString()}\n`;

  fs.writeFileSync(outputPath, md);
}
