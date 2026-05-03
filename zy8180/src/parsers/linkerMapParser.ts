import { LinkerMap, MemoryRegion, Section, SymbolInfo, ParseResult } from '../types';
import { parseAddress, parseSize } from '../utils';

type ParserState = 'init' | 'memoryConfig' | 'memoryRegions' | 'linkerScript' | 'sections' | 'symbols' | 'done';

export function parseLinkerMap(content: string): ParseResult<LinkerMap> {
  const lines = content.split('\n');
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const memoryRegions = new Map<string, MemoryRegion>();
  const sections: Section[] = [];
  let entryPoint: bigint | undefined;
  
  let state: ParserState = 'init';
  let currentSection: Section | null = null;
  let lineIndex = 0;
  
  try {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lineIndex = i + 1;
      
      const trimmed = line.trim();
      if (trimmed === '') {
        continue;
      }
      if (trimmed.startsWith('/*')) {
        continue;
      }
      if (/^\*\s+/.test(trimmed) || trimmed === '*') {
        continue;
      }
      
      if (state === 'init') {
        if (line.includes('Memory Configuration')) {
          state = 'memoryConfig';
          continue;
        }
        if (line.includes('Linker script and memory map')) {
          state = 'linkerScript';
          continue;
        }
        if (line.match(/^ENTRY\(/)) {
          const entryMatch = line.match(/^ENTRY\((0x[0-9a-fA-F]+|[\da-fA-F]+h?)\)/);
          if (entryMatch) {
            entryPoint = parseAddress(entryMatch[1]);
          }
          continue;
        }
        continue;
      }
      
      if (state === 'memoryConfig') {
        if (line.includes('Name') && line.includes('Origin') && line.includes('Length')) {
          state = 'memoryRegions';
          continue;
        }
        continue;
      }
      
      if (state === 'memoryRegions') {
        if (line.trim() === '' || line.includes('*default*')) {
          state = 'linkerScript';
          continue;
        }
        
        const regionMatch = line.match(/^(\*?[\w\-]+)\*?\s+(0x[0-9a-fA-F]+|[\da-fA-F]+h?|[\d]+)\s+(0x[0-9a-fA-F]+|[\da-fA-F]+h?|[\d]+)(?:\s+(\w+))?/);
        if (regionMatch) {
          const [, name, originStr, lengthStr, attr] = regionMatch;
          try {
            const origin = parseAddress(originStr);
            const length = parseSize(lengthStr);
            
            let type: MemoryRegion['type'] = 'FLASH';
            const lowerName = name.toLowerCase();
            if (lowerName.includes('ram') || lowerName.includes('sram') || lowerName.includes('dram')) {
              type = 'RAM';
            } else if (lowerName.includes('otp')) {
              type = 'OTP';
            } else if (lowerName.includes('reserved')) {
              type = 'RESERVED';
            }
            
            memoryRegions.set(name, {
              name,
              origin,
              length,
              type,
              attributes: attr
            });
          } catch (e) {
            warnings.push(`Line ${lineIndex}: Failed to parse memory region '${name}': ${e}`);
          }
        }
        continue;
      }
      
      if (state === 'linkerScript') {
        if (/^\.[\w\.\-]+\s+0x/.test(line) || /^\.[\w\.\-]+\s+[\da-fA-F]+h/.test(line)) {
          state = 'sections';
        } else {
          continue;
        }
      }
      
      if (state === 'sections') {
        const topLevelSectionMatch = line.match(/^(\.[\w\.\-]+)\s+(0x[0-9a-fA-F]+|[\da-fA-F]+h?|[\d]+)\s+(0x[0-9a-fA-F]+|[\da-fA-F]+h?|[\d]+)/);
        
        if (topLevelSectionMatch) {
          if (currentSection) {
            sections.push(currentSection);
          }
          
          const [, name, addressStr, sizeStr] = topLevelSectionMatch;
          try {
            const address = parseAddress(addressStr);
            const size = parseSize(sizeStr);
            
            let memoryRegion: string | undefined;
            for (const [regionName, region] of memoryRegions) {
              if (address >= region.origin && address < region.origin + region.length) {
                memoryRegion = regionName;
                break;
              }
            }
            
            currentSection = {
              name,
              address,
              size,
              memoryRegion,
              symbols: []
            };
          } catch (e) {
            warnings.push(`Line ${lineIndex}: Failed to parse section '${name}': ${e}`);
            currentSection = null;
          }
          continue;
        }
        
        if (currentSection && line.trim() !== '') {
          const symbolMatch = line.match(/^\s+(0x[0-9a-fA-F]+|[\da-fA-F]+h?|[\d]+)\s+(?:(0x[0-9a-fA-F]+|[\da-fA-F]+h?|[\d]+)\s+)?(\.?[\w\._\[\]@]+)/);
          if (symbolMatch) {
            const [, addressStr, sizeStr, name] = symbolMatch;
            try {
              const address = parseAddress(addressStr);
              const size = sizeStr ? parseSize(sizeStr) : 0n;
              
              let type: SymbolInfo['type'] = 'UNKNOWN';
              const lowerName = name.toLowerCase();
              if (lowerName.includes('text') || lowerName.includes('code')) {
                type = 'CODE';
              } else if (lowerName.includes('data')) {
                type = 'DATA';
              } else if (lowerName.includes('bss')) {
                type = 'BSS';
              } else if (lowerName.includes('rodata') || lowerName.includes('const')) {
                type = 'RODATA';
              }
              
              currentSection.symbols.push({
                name,
                address,
                size,
                type
              });
            } catch (e) {
              warnings.push(`Line ${lineIndex}: Failed to parse symbol '${name}': ${e}`);
            }
          }
          continue;
        }
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
  } catch (e) {
    errors.push(`Parser error at line ${lineIndex}: ${e}`);
  }
  
  return {
    success: errors.length === 0,
    data: {
      memoryRegions,
      sections,
      entryPoint
    },
    errors,
    warnings
  };
}
