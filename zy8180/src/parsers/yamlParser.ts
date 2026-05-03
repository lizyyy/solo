import * as yaml from 'js-yaml';
import { MemoryRegionsYaml, ParseResult, MemoryRegion } from '../types';
import { parseAddress, parseSize } from '../utils';

export function parseMemoryRegionsYaml(content: string): ParseResult<MemoryRegionsYaml> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const parsed = yaml.load(content) as MemoryRegionsYaml;
    
    if (!parsed.memoryRegions || !Array.isArray(parsed.memoryRegions)) {
      errors.push('Invalid YAML: missing or invalid "memoryRegions" array');
      return { success: false, errors, warnings };
    }
    
    for (const region of parsed.memoryRegions) {
      if (!region.name) {
        errors.push('Memory region missing "name" field');
        continue;
      }
      if (!region.origin) {
        errors.push(`Memory region "${region.name}" missing "origin" field`);
        continue;
      }
      if (!region.length) {
        errors.push(`Memory region "${region.name}" missing "length" field`);
        continue;
      }
      if (!region.type) {
        warnings.push(`Memory region "${region.name}" missing "type" field, defaulting to FLASH`);
      }
      
      try {
        parseAddress(region.origin);
      } catch (e) {
        errors.push(`Memory region "${region.name}" has invalid origin: ${region.origin}`);
      }
      
      try {
        parseSize(region.length);
      } catch (e) {
        errors.push(`Memory region "${region.name}" has invalid length: ${region.length}`);
      }
    }
    
    return {
      success: errors.length === 0,
      data: parsed,
      errors,
      warnings
    };
  } catch (e) {
    errors.push(`YAML parse error: ${e}`);
    return { success: false, errors, warnings };
  }
}

export function yamlToMemoryRegions(yamlData: MemoryRegionsYaml): Map<string, MemoryRegion> {
  const regions = new Map<string, MemoryRegion>();
  
  for (const config of yamlData.memoryRegions) {
    const region: MemoryRegion = {
      name: config.name,
      origin: parseAddress(config.origin),
      length: parseSize(config.length),
      type: config.type || 'FLASH',
      attributes: config.attributes
    };
    regions.set(config.name, region);
  }
  
  return regions;
}
