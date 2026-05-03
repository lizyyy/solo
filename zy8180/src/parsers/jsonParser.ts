import { BootloaderConstraints, ParseResult } from '../types';
import { parseAddress } from '../utils';

export function parseBootloaderConstraints(content: string): ParseResult<BootloaderConstraints> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const parsed = JSON.parse(content) as BootloaderConstraints;
    
    if (!parsed.bootloaderReserved) {
      warnings.push('Missing "bootloaderReserved" configuration');
    } else {
      if (!parsed.bootloaderReserved.flash) {
        errors.push('"bootloaderReserved.flash" is required');
      } else {
        try {
          parseAddress(parsed.bootloaderReserved.flash.start);
        } catch (e) {
          errors.push(`Invalid bootloader flash start address: ${parsed.bootloaderReserved.flash.start}`);
        }
        try {
          parseAddress(parsed.bootloaderReserved.flash.end);
        } catch (e) {
          errors.push(`Invalid bootloader flash end address: ${parsed.bootloaderReserved.flash.end}`);
        }
      }
      
      if (parsed.bootloaderReserved.ram) {
        try {
          parseAddress(parsed.bootloaderReserved.ram.start);
        } catch (e) {
          errors.push(`Invalid bootloader RAM start address: ${parsed.bootloaderReserved.ram.start}`);
        }
        try {
          parseAddress(parsed.bootloaderReserved.ram.end);
        } catch (e) {
          errors.push(`Invalid bootloader RAM end address: ${parsed.bootloaderReserved.ram.end}`);
        }
      }
    }
    
    if (!parsed.otaPartitions || !Array.isArray(parsed.otaPartitions)) {
      warnings.push('Missing or invalid "otaPartitions" array');
    } else {
      for (let i = 0; i < parsed.otaPartitions.length; i++) {
        const partition = parsed.otaPartitions[i];
        const idx = i + 1;
        
        if (!partition.name) {
          errors.push(`OTA partition ${idx}: missing "name"`);
        }
        if (!partition.start) {
          errors.push(`OTA partition ${partition.name || idx}: missing "start"`);
        } else {
          try {
            parseAddress(partition.start);
          } catch (e) {
            errors.push(`OTA partition ${partition.name || idx}: invalid start address: ${partition.start}`);
          }
        }
        if (!partition.end) {
          errors.push(`OTA partition ${partition.name || idx}: missing "end"`);
        } else {
          try {
            parseAddress(partition.end);
          } catch (e) {
            errors.push(`OTA partition ${partition.name || idx}: invalid end address: ${partition.end}`);
          }
        }
        if (!partition.minFreeRequired) {
          warnings.push(`OTA partition ${partition.name || idx}: missing "minFreeRequired", using 0`);
        }
      }
    }
    
    if (parsed.rollbackConfig) {
      if (parsed.rollbackConfig.maxFlashMargin) {
        try {
          parseAddress(parsed.rollbackConfig.maxFlashMargin);
        } catch (e) {
          warnings.push(`Invalid rollback maxFlashMargin: ${parsed.rollbackConfig.maxFlashMargin}`);
        }
      }
      if (!parsed.rollbackConfig.criticalFeatures) {
        warnings.push('rollbackConfig missing "criticalFeatures" array');
      }
    }
    
    return {
      success: errors.length === 0,
      data: parsed,
      errors,
      warnings
    };
  } catch (e) {
    errors.push(`JSON parse error: ${e}`);
    return { success: false, errors, warnings };
  }
}
