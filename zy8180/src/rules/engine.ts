import { 
  LinkerMap, 
  MemoryRegionsYaml, 
  FeaturesCsv, 
  BootloaderConstraints, 
  Issue,
  MemoryRegion,
  Section,
  IssueType
} from '../types';
import { parseAddress, parseSize, isOverlap, getOverlap, generateId } from '../utils';
import { yamlToMemoryRegions } from '../parsers';

export interface RuleEngineInput {
  linkerMap: LinkerMap;
  memoryRegions?: MemoryRegionsYaml;
  features?: FeaturesCsv;
  bootloaderConstraints?: BootloaderConstraints;
}

export interface RuleResult {
  issues: Issue[];
  processedRegions: Map<string, ProcessedRegion>;
  otaStatus?: OTAPartitionStatus[];
  featureStatus?: FeatureStatus;
}

export interface ProcessedRegion extends MemoryRegion {
  used: bigint;
  free: bigint;
  utilization: number;
  sections: Section[];
}

export interface OTAPartitionStatus {
  name: string;
  start: bigint;
  end: bigint;
  used: bigint;
  free: bigint;
  minRequired: bigint;
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

export interface FeatureStatus {
  enabled: {
    featureName: string;
    memoryImpact: {
      flashDelta: number;
      ramDelta: number;
    };
  }[];
  disabled: {
    featureName: string;
    memoryImpact: {
      flashDelta: number;
      ramDelta: number;
    };
  }[];
  rollbackRisk?: {
    canRollback: boolean;
    maxFlashNeeded: bigint;
    availableFlash: bigint;
    marginRequired: bigint;
    criticalFeatures: string[];
  };
}

let issueCounter = 0;

function createIssue(
  type: IssueType,
  severity: Issue['severity'],
  title: string,
  description: string,
  affectedRegion?: string,
  address?: bigint,
  size?: bigint,
  details?: Record<string, unknown>
): Issue {
  return {
    id: generateId('ISSUE', ++issueCounter),
    type,
    severity,
    title,
    description,
    affectedRegion,
    address,
    size,
    details
  };
}

export function runRules(input: RuleEngineInput): RuleResult {
  issueCounter = 0;
  const issues: Issue[] = [];
  const { linkerMap, memoryRegions, features, bootloaderConstraints } = input;
  
  const allRegions = new Map<string, ProcessedRegion>();
  
  const yamlRegions = memoryRegions ? yamlToMemoryRegions(memoryRegions) : new Map();
  
  for (const [name, region] of yamlRegions) {
    allRegions.set(name, {
      ...region,
      used: 0n,
      free: region.length,
      utilization: 0,
      sections: []
    });
  }
  
  for (const [name, region] of linkerMap.memoryRegions) {
    if (!allRegions.has(name)) {
      allRegions.set(name, {
        ...region,
        used: 0n,
        free: region.length,
        utilization: 0,
        sections: []
      });
    }
  }
  
  for (const section of linkerMap.sections) {
    assignSectionToRegion(section, allRegions, issues);
  }
  
  for (const region of allRegions.values()) {
    if (region.used > region.length) {
      const overflow = region.used - region.length;
      issues.push(createIssue(
        region.type === 'RAM' ? 'RAM_OVERFLOW' : 'FLASH_OVERFLOW',
        'CRITICAL',
        `${region.type} Memory Overflow`,
        `Region "${region.name}" overflow by ${overflow.toString()} bytes. Used: ${region.used.toString()}, Available: ${region.length.toString()}`,
        region.name,
        region.origin,
        overflow
      ));
    }
  }
  
  let otaStatus: OTAPartitionStatus[] | undefined;
  if (bootloaderConstraints?.otaPartitions) {
    otaStatus = [];
    for (const partition of bootloaderConstraints.otaPartitions) {
      const start = parseAddress(partition.start);
      const end = parseAddress(partition.end);
      const minRequired = parseSize(partition.minFreeRequired || '0');
      
      let used = 0n;
      for (const section of linkerMap.sections) {
        const sectionEnd = section.address + section.size;
        if (isOverlap(section.address, sectionEnd, start, end)) {
          const overlap = getOverlap(section.address, sectionEnd, start, end);
          if (overlap) {
            used += overlap.size;
          }
        }
      }
      
      const free = (end - start) - used;
      let status: 'OK' | 'WARNING' | 'CRITICAL' = 'OK';
      
      if (free < minRequired) {
        status = 'CRITICAL';
        issues.push(createIssue(
          'OTA_INSUFFICIENT',
          'CRITICAL',
          'OTA Partition Insufficient Space',
          `OTA partition "${partition.name}" has only ${free.toString()} bytes free, but requires at least ${minRequired.toString()} bytes. Shortfall: ${(minRequired - free).toString()} bytes`,
          partition.name,
          start,
          minRequired - free,
          { partitionStart: start, partitionEnd: end, used, free, minRequired }
        ));
      } else if (free < minRequired * 2n) {
        status = 'WARNING';
        issues.push(createIssue(
          'OTA_INSUFFICIENT',
          'LOW',
          'OTA Partition Space Warning',
          `OTA partition "${partition.name}" free space (${free.toString()} bytes) is close to the minimum requirement (${minRequired.toString()} bytes)`,
          partition.name,
          start,
          undefined,
          { partitionStart: start, partitionEnd: end, used, free, minRequired }
        ));
      }
      
      otaStatus.push({
        name: partition.name,
        start,
        end,
        used,
        free,
        minRequired,
        status
      });
    }
  }
  
  if (bootloaderConstraints?.bootloaderReserved?.flash) {
    const blStart = parseAddress(bootloaderConstraints.bootloaderReserved.flash.start);
    const blEnd = parseAddress(bootloaderConstraints.bootloaderReserved.flash.end);
    
    for (const section of linkerMap.sections) {
      const sectionEnd = section.address + section.size;
      const overlap = getOverlap(section.address, sectionEnd, blStart, blEnd);
      
      if (overlap) {
        issues.push(createIssue(
          'BOOTLOADER_OVERLAP',
          'CRITICAL',
          'Section Overlaps Bootloader Reserved Area',
          `Section "${section.name}" (${section.address.toString()} - ${sectionEnd.toString()}) overlaps with bootloader reserved area (${blStart.toString()} - ${blEnd.toString()}) by ${overlap.size.toString()} bytes`,
          'bootloader',
          overlap.start,
          overlap.size,
          { sectionName: section.name, sectionStart: section.address, sectionEnd, blStart, blEnd }
        ));
      }
    }
  }
  
  if (bootloaderConstraints?.bootloaderReserved?.ram) {
    const blStart = parseAddress(bootloaderConstraints.bootloaderReserved.ram.start);
    const blEnd = parseAddress(bootloaderConstraints.bootloaderReserved.ram.end);
    
    for (const section of linkerMap.sections) {
      const sectionEnd = section.address + section.size;
      const overlap = getOverlap(section.address, sectionEnd, blStart, blEnd);
      
      if (overlap) {
        issues.push(createIssue(
          'BOOTLOADER_OVERLAP',
          'CRITICAL',
          'Section Overlaps Bootloader RAM Reserved Area',
          `Section "${section.name}" (${section.address.toString()} - ${sectionEnd.toString()}) overlaps with bootloader RAM reserved area (${blStart.toString()} - ${blEnd.toString()}) by ${overlap.size.toString()} bytes`,
          'bootloader-ram',
          overlap.start,
          overlap.size,
          { sectionName: section.name, sectionStart: section.address, sectionEnd, blStart, blEnd }
        ));
      }
    }
  }
  
  let featureStatus: FeatureStatus | undefined;
  if (features) {
    const enabled = features.features.filter(f => f.enabled);
    const disabled = features.features.filter(f => !f.enabled);
    
    featureStatus = {
      enabled: enabled.map(f => ({
        featureName: f.featureName,
        memoryImpact: f.memoryImpact
      })),
      disabled: disabled.map(f => ({
        featureName: f.featureName,
        memoryImpact: f.memoryImpact
      }))
    };
    
    if (bootloaderConstraints?.rollbackConfig) {
      const criticalFeatures = bootloaderConstraints.rollbackConfig.criticalFeatures || [];
      const maxFlashMargin = bootloaderConstraints.rollbackConfig.maxFlashMargin 
        ? parseSize(bootloaderConstraints.rollbackConfig.maxFlashMargin) 
        : 0n;
      
      let totalFlashNeeded = 0n;
      const atRiskFeatures: string[] = [];
      
      for (const cf of criticalFeatures) {
        const feature = features.features.find(f => f.featureName === cf);
        if (feature && feature.enabled) {
          if (feature.memoryImpact.flashDelta > 0) {
            totalFlashNeeded += BigInt(feature.memoryImpact.flashDelta);
            atRiskFeatures.push(cf);
          }
        }
      }
      
      let totalAvailableFlash = 0n;
      for (const region of allRegions.values()) {
        if (region.type === 'FLASH') {
          totalAvailableFlash += region.free;
        }
      }
      
      const canRollback = totalAvailableFlash >= maxFlashMargin;
      
      featureStatus.rollbackRisk = {
        canRollback,
        maxFlashNeeded: totalFlashNeeded,
        availableFlash: totalAvailableFlash,
        marginRequired: maxFlashMargin,
        criticalFeatures: atRiskFeatures
      };
      
      if (!canRollback) {
        issues.push(createIssue(
          'ROLLBACK_RISK',
          'HIGH',
          'Feature Rollback Risk',
          `Cannot safely rollback critical features. Only ${totalAvailableFlash.toString()} bytes available, but need at least ${maxFlashMargin.toString()} bytes margin. Critical features at risk: ${atRiskFeatures.join(', ')}`,
          undefined,
          undefined,
          totalFlashNeeded,
          { criticalFeatures: atRiskFeatures, flashNeeded: totalFlashNeeded, flashAvailable: totalAvailableFlash, margin: maxFlashMargin }
        ));
      } else if (atRiskFeatures.length > 0) {
        issues.push(createIssue(
          'ROLLBACK_RISK',
          'MEDIUM',
          'Feature Rollback Warning',
          `The following critical features consume flash that would be freed on rollback: ${atRiskFeatures.join(', ')}. Total: ${totalFlashNeeded.toString()} bytes. Available flash: ${totalAvailableFlash.toString()} bytes`,
          undefined,
          undefined,
          totalFlashNeeded,
          { criticalFeatures: atRiskFeatures, flashNeeded: totalFlashNeeded, flashAvailable: totalAvailableFlash }
        ));
      }
    }
  }
  
  return {
    issues,
    processedRegions: allRegions,
    otaStatus,
    featureStatus
  };
}

function assignSectionToRegion(
  section: Section, 
  regions: Map<string, ProcessedRegion>, 
  issues: Issue[]
): void {
  const sectionEnd = section.address + section.size;
  const overlappingRegions: { name: string; region: ProcessedRegion; overlap: { start: bigint; end: bigint; size: bigint } }[] = [];
  
  for (const [name, region] of regions) {
    const regionEnd = region.origin + region.length;
    const overlap = getOverlap(section.address, sectionEnd, region.origin, regionEnd);
    
    if (overlap) {
      overlappingRegions.push({ name, region, overlap });
    }
  }
  
  if (overlappingRegions.length === 0) {
    issues.push(createIssue(
      'SECTION_OUT_OF_BOUNDS',
      'HIGH',
      'Section Outside All Memory Regions',
      `Section "${section.name}" (${section.address.toString()} - ${sectionEnd.toString()}) does not fit within any defined memory region`,
      undefined,
      section.address,
      section.size
    ));
    return;
  }
  
  let fullyContained = false;
  for (const { region, overlap } of overlappingRegions) {
    const regionEnd = region.origin + region.length;
    if (section.address >= region.origin && sectionEnd <= regionEnd) {
      fullyContained = true;
      region.used += section.size;
      region.free = region.length - region.used;
      region.utilization = Number(region.used) * 100 / Number(region.length);
      region.sections.push(section);
      break;
    }
  }
  
  if (fullyContained) {
    return;
  }
  
  if (overlappingRegions.length > 1) {
    issues.push(createIssue(
      'SECTION_CROSS_REGION',
      'HIGH',
      'Section Spans Multiple Memory Regions',
      `Section "${section.name}" (${section.address.toString()} - ${sectionEnd.toString()}) spans across ${overlappingRegions.length} memory regions: ${overlappingRegions.map(r => r.name).join(', ')}`,
      overlappingRegions.map(r => r.name).join(','),
      section.address,
      section.size,
      { regions: overlappingRegions.map(r => ({ name: r.name, overlapSize: r.overlap.size })) }
    ));
    
    for (const { region, overlap } of overlappingRegions) {
      region.used += overlap.size;
      region.free = region.length - region.used;
      region.utilization = Number(region.used) * 100 / Number(region.length);
      region.sections.push(section);
    }
  } else {
    const { region, overlap } = overlappingRegions[0];
    const regionEnd = region.origin + region.length;
    
    issues.push(createIssue(
      'SECTION_OUT_OF_BOUNDS',
      'CRITICAL',
      'Section Partially Outside Memory Region',
      `Section "${section.name}" (${section.address.toString()} - ${sectionEnd.toString()}) is not fully contained within region "${region.name}" (${region.origin.toString()} - ${regionEnd.toString()}). Overlap: ${overlap.size.toString()} bytes, outside: ${(section.size - overlap.size).toString()} bytes`,
      region.name,
      section.address,
      section.size,
      { regionName: region.name, regionStart: region.origin, regionEnd, overlapStart: overlap.start, overlapEnd: overlap.end, overlapSize: overlap.size }
    ));
    
    region.used += overlap.size;
    region.free = region.length - region.used;
    region.utilization = Number(region.used) * 100 / Number(region.length);
    region.sections.push(section);
  }
}
