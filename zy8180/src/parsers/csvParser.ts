import * as Papa from 'papaparse';
import { FeatureEntry, FeaturesCsv, ParseResult } from '../types';

export function parseFeaturesCsv(content: string): ParseResult<FeaturesCsv> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true
    });
    
    if (result.errors.length > 0) {
      for (const err of result.errors) {
        errors.push(`CSV parse error (row ${err.row}): ${err.message}`);
      }
    }
    
    const features: FeatureEntry[] = [];
    
    for (let i = 0; i < result.data.length; i++) {
      const row = result.data[i];
      const rowNum = i + 1;
      
      const featureName = row.featureName || row['feature_name'] || row.name;
      if (!featureName) {
        warnings.push(`Row ${rowNum}: Missing feature name, skipping`);
        continue;
      }
      
      const enabledStr = row.enabled || row['is_enabled'] || row.active;
      const enabled = enabledStr ? 
        enabledStr.toLowerCase() === 'true' || 
        enabledStr === '1' || 
        enabledStr.toLowerCase() === 'yes' : 
        false;
      
      const flashDeltaStr = row.flashDelta || row['flash_delta'] || row.flash || '0';
      const ramDeltaStr = row.ramDelta || row['ram_delta'] || row.ram || '0';
      
      const flashDelta = parseInt(flashDeltaStr, 10) || 0;
      const ramDelta = parseInt(ramDeltaStr, 10) || 0;
      
      const dependenciesStr = row.dependencies || row.deps;
      const dependencies = dependenciesStr ? 
        dependenciesStr.split(',').map((s: string) => s.trim()).filter(Boolean) : 
        undefined;
      
      const description = row.description || row.desc;
      
      features.push({
        featureName,
        enabled,
        memoryImpact: {
          flashDelta,
          ramDelta
        },
        dependencies,
        description
      });
    }
    
    return {
      success: errors.length === 0,
      data: { features },
      errors,
      warnings
    };
  } catch (e) {
    errors.push(`CSV parse error: ${e}`);
    return { success: false, errors, warnings };
  }
}
