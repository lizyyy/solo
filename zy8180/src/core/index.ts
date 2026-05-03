import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import {
  parseLinkerMap,
  parseMemoryRegionsYaml,
  parseFeaturesCsv,
  parseBootloaderConstraints
} from '../parsers';
import { runRules, RuleEngineInput, RuleResult } from '../rules';
import {
  generateIssuesCsv,
  generateMemoryReportMd,
  generateLayoutHtml
} from '../reporters';
import { MemoryReport, FeaturesCsv, FeatureStatus } from '../types';

export interface PrecheckOptions {
  linkerMap: string;
  memoryRegions?: string;
  features?: string;
  bootloaderConstraints?: string;
  outputDir: string;
  verbose?: boolean;
}

export interface PrecheckResult {
  success: boolean;
  issuesCount: number;
  criticalCount: number;
  highCount: number;
  reports: {
    issuesCsv: string;
    memoryReport: string;
    layoutHtml: string;
  };
  report: MemoryReport;
}

function ensureDirExists(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    require('fs').mkdirSync(dir, { recursive: true });
  }
}

export function runMemoryPrecheck(options: PrecheckOptions): PrecheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const linkerMapContent = readFileSync(options.linkerMap, 'utf-8');
  const linkerMapResult = parseLinkerMap(linkerMapContent);
  
  if (!linkerMapResult.success) {
    errors.push(...linkerMapResult.errors);
  }
  warnings.push(...linkerMapResult.warnings);
  
  let memoryRegionsData = undefined;
  if (options.memoryRegions && existsSync(options.memoryRegions)) {
    const yamlContent = readFileSync(options.memoryRegions, 'utf-8');
    const yamlResult = parseMemoryRegionsYaml(yamlContent);
    if (!yamlResult.success) {
      errors.push(...yamlResult.errors);
    }
    warnings.push(...yamlResult.warnings);
    memoryRegionsData = yamlResult.data;
  }
  
  let featuresData = undefined;
  if (options.features && existsSync(options.features)) {
    const csvContent = readFileSync(options.features, 'utf-8');
    const csvResult = parseFeaturesCsv(csvContent);
    if (!csvResult.success) {
      errors.push(...csvResult.errors);
    }
    warnings.push(...csvResult.warnings);
    featuresData = csvResult.data;
  }
  
  let bootloaderData = undefined;
  if (options.bootloaderConstraints && existsSync(options.bootloaderConstraints)) {
    const jsonContent = readFileSync(options.bootloaderConstraints, 'utf-8');
    const jsonResult = parseBootloaderConstraints(jsonContent);
    if (!jsonResult.success) {
      errors.push(...jsonResult.errors);
    }
    warnings.push(...jsonResult.warnings);
    bootloaderData = jsonResult.data;
  }
  
  if (!linkerMapResult.data) {
    throw new Error(`Failed to parse linker map: ${errors.join('; ')}`);
  }
  
  const ruleInput: RuleEngineInput = {
    linkerMap: linkerMapResult.data,
    memoryRegions: memoryRegionsData,
    features: featuresData,
    bootloaderConstraints: bootloaderData
  };
  
  const ruleResult = runRules(ruleInput);
  
  const report = buildMemoryReport(ruleResult, featuresData);
  
  const issuesCsvPath = join(options.outputDir, 'issues.csv');
  const memoryReportPath = join(options.outputDir, 'memory_report.md');
  const layoutHtmlPath = join(options.outputDir, 'layout.html');
  
  ensureDirExists(issuesCsvPath);
  
  writeFileSync(issuesCsvPath, generateIssuesCsv(report.issues));
  writeFileSync(memoryReportPath, generateMemoryReportMd(report));
  writeFileSync(layoutHtmlPath, generateLayoutHtml(report));
  
  const criticalCount = report.issues.filter(i => i.severity === 'CRITICAL').length;
  const highCount = report.issues.filter(i => i.severity === 'HIGH').length;
  
  return {
    success: criticalCount === 0,
    issuesCount: report.issues.length,
    criticalCount,
    highCount,
    reports: {
      issuesCsv: issuesCsvPath,
      memoryReport: memoryReportPath,
      layoutHtml: layoutHtmlPath
    },
    report
  };
}

function buildMemoryReport(ruleResult: RuleResult, featuresData?: FeaturesCsv): MemoryReport {
  const generatedAt = new Date();
  
  let totalFlash = 0n;
  let usedFlash = 0n;
  let totalRam = 0n;
  let usedRam = 0n;
  
  for (const region of ruleResult.processedRegions.values()) {
    if (region.type === 'FLASH') {
      totalFlash += region.length;
      usedFlash += region.used;
    } else if (region.type === 'RAM') {
      totalRam += region.length;
      usedRam += region.used;
    }
  }
  
  const regions = Array.from(ruleResult.processedRegions.values()).map(region => ({
    name: region.name,
    type: region.type,
    origin: region.origin,
    length: region.length,
    used: region.used,
    free: region.free,
    utilization: region.utilization,
    sections: region.sections.map(s => ({
      name: s.name,
      address: s.address,
      size: s.size
    }))
  }));
  
  let otaStatus: MemoryReport['otaStatus'];
  if (ruleResult.otaStatus && ruleResult.otaStatus.length > 0) {
    otaStatus = {
      partitions: ruleResult.otaStatus
    };
  }
  
  let features: MemoryReport['features'];
  if (featuresData) {
    const enabled = featuresData.features.filter(f => f.enabled);
    const disabled = featuresData.features.filter(f => !f.enabled);
    
    features = {
      enabled,
      disabled
    };
    
    if (ruleResult.featureStatus?.rollbackRisk) {
      features.rollbackRisk = ruleResult.featureStatus.rollbackRisk;
    }
  }
  
  return {
    generatedAt,
    summary: {
      flash: {
        total: totalFlash,
        used: usedFlash,
        free: totalFlash - usedFlash,
        utilization: totalFlash > 0n ? Number(usedFlash) * 100 / Number(totalFlash) : 0
      },
      ram: {
        total: totalRam,
        used: usedRam,
        free: totalRam - usedRam,
        utilization: totalRam > 0n ? Number(usedRam) * 100 / Number(totalRam) : 0
      }
    },
    regions,
    issues: ruleResult.issues,
    features,
    otaStatus
  };
}
