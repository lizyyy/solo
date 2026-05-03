import { MemoryReport, Issue, ProcessedRegion, OTAPartitionStatus, FeatureStatus } from '../types';
import { formatHex, formatSize } from '../utils';

export function generateMemoryReportMd(report: MemoryReport): string {
  const lines: string[] = [];
  
  lines.push('# Firmware Memory Layout Pre-Check Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt.toISOString()}`);
  lines.push('');
  
  lines.push('## Summary');
  lines.push('');
  
  lines.push('### Flash Usage');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total | ${formatSize(report.summary.flash.total)} |`);
  lines.push(`| Used | ${formatSize(report.summary.flash.used)} |`);
  lines.push(`| Free | ${formatSize(report.summary.flash.free)} |`);
  lines.push(`| Utilization | ${report.summary.flash.utilization.toFixed(2)}% |`);
  lines.push('');
  
  lines.push('### RAM Usage');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total | ${formatSize(report.summary.ram.total)} |`);
  lines.push(`| Used | ${formatSize(report.summary.ram.used)} |`);
  lines.push(`| Free | ${formatSize(report.summary.ram.free)} |`);
  lines.push(`| Utilization | ${report.summary.ram.utilization.toFixed(2)}% |`);
  lines.push('');
  
  if (report.issues.length > 0) {
    lines.push('## Issues');
    lines.push('');
    
    const criticalIssues = report.issues.filter(i => i.severity === 'CRITICAL');
    const highIssues = report.issues.filter(i => i.severity === 'HIGH');
    const mediumIssues = report.issues.filter(i => i.severity === 'MEDIUM');
    const lowIssues = report.issues.filter(i => i.severity === 'LOW');
    
    if (criticalIssues.length > 0) {
      lines.push('### CRITICAL');
      lines.push('');
      for (const issue of criticalIssues) {
        lines.push(`#### ${issue.id}: ${issue.title}`);
        lines.push('');
        lines.push(`- **Type**: ${issue.type}`);
        lines.push(`- **Description**: ${issue.description}`);
        if (issue.affectedRegion) lines.push(`- **Affected Region**: ${issue.affectedRegion}`);
        if (issue.address !== undefined) lines.push(`- **Address**: ${formatHex(issue.address)}`);
        if (issue.size !== undefined) lines.push(`- **Size**: ${formatSize(issue.size)}`);
        lines.push('');
      }
    }
    
    if (highIssues.length > 0) {
      lines.push('### HIGH');
      lines.push('');
      for (const issue of highIssues) {
        lines.push(`#### ${issue.id}: ${issue.title}`);
        lines.push('');
        lines.push(`- **Type**: ${issue.type}`);
        lines.push(`- **Description**: ${issue.description}`);
        if (issue.affectedRegion) lines.push(`- **Affected Region**: ${issue.affectedRegion}`);
        if (issue.address !== undefined) lines.push(`- **Address**: ${formatHex(issue.address)}`);
        if (issue.size !== undefined) lines.push(`- **Size**: ${formatSize(issue.size)}`);
        lines.push('');
      }
    }
    
    if (mediumIssues.length > 0) {
      lines.push('### MEDIUM');
      lines.push('');
      for (const issue of mediumIssues) {
        lines.push(`#### ${issue.id}: ${issue.title}`);
        lines.push('');
        lines.push(`- **Type**: ${issue.type}`);
        lines.push(`- **Description**: ${issue.description}`);
        if (issue.affectedRegion) lines.push(`- **Affected Region**: ${issue.affectedRegion}`);
        if (issue.address !== undefined) lines.push(`- **Address**: ${formatHex(issue.address)}`);
        if (issue.size !== undefined) lines.push(`- **Size**: ${formatSize(issue.size)}`);
        lines.push('');
      }
    }
    
    if (lowIssues.length > 0) {
      lines.push('### LOW');
      lines.push('');
      for (const issue of lowIssues) {
        lines.push(`#### ${issue.id}: ${issue.title}`);
        lines.push('');
        lines.push(`- **Type**: ${issue.type}`);
        lines.push(`- **Description**: ${issue.description}`);
        if (issue.affectedRegion) lines.push(`- **Affected Region**: ${issue.affectedRegion}`);
        if (issue.address !== undefined) lines.push(`- **Address**: ${formatHex(issue.address)}`);
        if (issue.size !== undefined) lines.push(`- **Size**: ${formatSize(issue.size)}`);
        lines.push('');
      }
    }
  }
  
  lines.push('## Memory Regions');
  lines.push('');
  
  for (const region of report.regions) {
    lines.push(`### ${region.name} (${region.type})`);
    lines.push('');
    lines.push(`- **Origin**: ${formatHex(region.origin)}`);
    lines.push(`- **Length**: ${formatSize(region.length)} (${formatHex(region.length)})`);
    lines.push(`- **Used**: ${formatSize(region.used)} (${formatHex(region.used)})`);
    lines.push(`- **Free**: ${formatSize(region.free)} (${formatHex(region.free)})`);
    lines.push(`- **Utilization**: ${region.utilization.toFixed(2)}%`);
    lines.push('');
    
    if (region.sections.length > 0) {
      lines.push('#### Sections');
      lines.push('');
      lines.push('| Name | Address | Size |');
      lines.push('|------|---------|------|');
      for (const section of region.sections) {
        lines.push(`| ${section.name} | ${formatHex(section.address)} | ${formatSize(section.size)} |`);
      }
      lines.push('');
    }
  }
  
  if (report.otaStatus && report.otaStatus.partitions.length > 0) {
    lines.push('## OTA Partition Status');
    lines.push('');
    lines.push('| Partition | Start | End | Used | Free | Min Required | Status |');
    lines.push('|-----------|-------|-----|------|------|--------------|--------|');
    for (const p of report.otaStatus.partitions) {
      const statusEmoji = p.status === 'OK' ? '✅' : p.status === 'WARNING' ? '⚠️' : '❌';
      lines.push(`| ${p.name} | ${formatHex(p.start)} | ${formatHex(p.end)} | ${formatSize(p.used)} | ${formatSize(p.free)} | ${formatSize(p.minRequired)} | ${statusEmoji} ${p.status} |`);
    }
    lines.push('');
  }
  
  if (report.features) {
    lines.push('## Feature Status');
    lines.push('');
    
    if (report.features.enabled.length > 0) {
      lines.push('### Enabled Features');
      lines.push('');
      lines.push('| Feature | Flash Delta | RAM Delta |');
      lines.push('|---------|-------------|-----------|');
      for (const f of report.features.enabled) {
        lines.push(`| ${f.featureName} | ${formatSize(BigInt(f.memoryImpact.flashDelta))} | ${formatSize(BigInt(f.memoryImpact.ramDelta))} |`);
      }
      lines.push('');
    }
    
    if (report.features.disabled.length > 0) {
      lines.push('### Disabled Features');
      lines.push('');
      lines.push('| Feature | Flash Delta | RAM Delta |');
      lines.push('|---------|-------------|-----------|');
      for (const f of report.features.disabled) {
        lines.push(`| ${f.featureName} | ${formatSize(BigInt(f.memoryImpact.flashDelta))} | ${formatSize(BigInt(f.memoryImpact.ramDelta))} |`);
      }
      lines.push('');
    }
    
    if (report.features.rollbackRisk) {
      lines.push('### Rollback Risk Analysis');
      lines.push('');
      const canRollback = report.features.rollbackRisk.canRollback;
      lines.push(`- **Can Rollback**: ${canRollback ? '✅ Yes' : '❌ No'}`);
      lines.push(`- **Max Flash Needed for Rollback**: ${formatSize(report.features.rollbackRisk.maxFlashNeeded)}`);
      lines.push(`- **Available Flash**: ${formatSize(report.features.rollbackRisk.availableFlash)}`);
      if (report.features.rollbackRisk.criticalFeatures.length > 0) {
        lines.push(`- **Critical Features at Risk**: ${report.features.rollbackRisk.criticalFeatures.join(', ')}`);
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}
