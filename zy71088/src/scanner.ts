import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ProgrammingLanguage, FlagMatch, ScanOptions } from './types';
import { LANGUAGE_EXTENSIONS, LANGUAGE_PATTERNS } from './constants';

export function detectLanguage(filePath: string): ProgrammingLanguage {
  const ext = path.extname(filePath).toLowerCase();
  
  for (const [lang, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (exts.includes(ext)) {
      return lang as ProgrammingLanguage;
    }
  }
  
  return 'other';
}

export function getMatchingExtensions(languages: ProgrammingLanguage[]): string[] {
  return languages.flatMap(lang => LANGUAGE_EXTENSIONS[lang]);
}

export async function findSourceFiles(options: ScanOptions): Promise<string[]> {
  const extensions = getMatchingExtensions(options.languages);
  
  if (extensions.length === 0) {
    return [];
  }

  const patterns = extensions.map(ext => `**/*${ext}`);

  const files = await glob(patterns, {
    cwd: options.sourceDir,
    absolute: true,
    ignore: options.excludePatterns,
    nodir: true,
  });

  return files;
}

export function readFileContent(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${(error as Error).message}`);
  }
}

export function extractLineContext(content: string, lineNumber: number, contextRange: number = 2): string {
  const lines = content.split('\n');
  const start = Math.max(0, lineNumber - 1 - contextRange);
  const end = Math.min(lines.length, lineNumber + contextRange);
  
  return lines.slice(start, end).join('\n');
}

export function getLineNumber(content: string, charIndex: number): number {
  return content.substring(0, charIndex).split('\n').length;
}

export function getColumn(content: string, charIndex: number): number {
  const lines = content.substring(0, charIndex).split('\n');
  return lines[lines.length - 1].length + 1;
}

export function isNegatedContext(content: string, matchIndex: number, language: ProgrammingLanguage): boolean {
  const patterns = LANGUAGE_PATTERNS[language];
  const contextStart = Math.max(0, matchIndex - 100);
  const beforeMatch = content.substring(contextStart, matchIndex);
  
  for (const word of patterns.negationWords) {
    if (word === '!') {
      const exclamationRegex = /!\s*(?:isEnabled|isActive|getFlag|featureEnabled|isFeatureEnabled|[\w_]+\s*\(|\w+)/;
      if (exclamationRegex.test(beforeMatch)) {
        return true;
      }
    } else {
      const wordRegex = new RegExp(`\\b${word}\\b.*$`, 'i');
      if (wordRegex.test(beforeMatch)) {
        return true;
      }
    }
  }
  
  return false;
}

export function findAllFlagMatches(
  filePath: string,
  content: string,
  flagNames: string[],
  dynamicPatterns: RegExp[]
): FlagMatch[] {
  const language = detectLanguage(filePath);
  const matches: FlagMatch[] = [];
  
  flagNames.forEach(flagName => {
    const escapedFlagName = flagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = LANGUAGE_PATTERNS[language].flagChecks;
    
    patterns.forEach(pattern => {
      const regex = new RegExp(
        pattern.source.replace(
          /\(\[:\^\['"`\]\+\]\)/g, 
          `(${escapedFlagName})`
        ).replace(
          /\(\\w\+\)/g,
          `(${escapedFlagName})`
        ),
        'g'
      );
      
      let match;
      while ((match = regex.exec(content)) !== null) {
        const lineNumber = getLineNumber(content, match.index);
        const column = getColumn(content, match.index);
        const isNegated = isNegatedContext(content, match.index, language);
        
        matches.push({
          flagName,
          filePath,
          lineNumber,
          column,
          matchType: isNegated ? 'negated' : 'direct',
          context: extractLineContext(content, lineNumber),
          isNegated,
          language,
        });
      }
    });

    const directRegex = new RegExp(`\\b${escapedFlagName}\\b`, 'g');
    let directMatch: RegExpExecArray | null;
    while ((directMatch = directRegex.exec(content)) !== null) {
      const matchIndex = directMatch.index;
      if (!matches.some(m => 
        m.flagName === flagName && 
        Math.abs(m.lineNumber - getLineNumber(content, matchIndex)) <= 1
      )) {
        const lineNumber = getLineNumber(content, matchIndex);
        const column = getColumn(content, matchIndex);
        const isNegated = isNegatedContext(content, matchIndex, language);
        
        matches.push({
          flagName,
          filePath,
          lineNumber,
          column,
          matchType: isNegated ? 'negated' : 'direct',
          context: extractLineContext(content, lineNumber),
          isNegated,
          language,
        });
      }
    }
  });

  dynamicPatterns.forEach(pattern => {
    let dynamicMatch;
    while ((dynamicMatch = pattern.exec(content)) !== null) {
      const matchedFlagName = dynamicMatch[1] || dynamicMatch[0];
      const lineNumber = getLineNumber(content, dynamicMatch.index);
      
      if (!matches.some(m => 
        m.flagName === matchedFlagName && 
        m.lineNumber === lineNumber
      )) {
        const column = getColumn(content, dynamicMatch.index);
        const isNegated = isNegatedContext(content, dynamicMatch.index, language);
        
        matches.push({
          flagName: matchedFlagName,
          filePath,
          lineNumber,
          column,
          matchType: 'dynamic',
          context: extractLineContext(content, lineNumber),
          isNegated,
          language,
        });
      }
    }
  });

  return matches;
}

export async function scanSourceFiles(
  options: ScanOptions
): Promise<{ matches: FlagMatch[]; filesScanned: string[]; errors: string[] }> {
  const allMatches: FlagMatch[] = [];
  const errors: string[] = [];
  
  const files = await findSourceFiles(options);
  
  const flagNames = options.flagDefinitions.map(f => f.name);
  const dynamicPatterns = options.flagDefinitions
    .filter(f => f.dynamicPattern)
    .map(f => new RegExp(f.dynamicPattern!, 'g'));

  for (const filePath of files) {
    try {
      const content = readFileContent(filePath);
      const matches = findAllFlagMatches(filePath, content, flagNames, dynamicPatterns);
      allMatches.push(...matches);
    } catch (error) {
      errors.push(`Error scanning ${filePath}: ${(error as Error).message}`);
    }
  }

  return {
    matches: allMatches,
    filesScanned: files,
    errors,
  };
}
