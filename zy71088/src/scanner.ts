import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ProgrammingLanguage, FlagMatch, ScanOptions, FlagDefinition } from './types';
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
  const lineStart = content.lastIndexOf('\n', matchIndex) + 1;
  const lineEnd = content.indexOf('\n', matchIndex);
  const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
  
  const posInLine = matchIndex - lineStart;
  const beforeMatchInLine = currentLine.substring(0, posInLine);
  
  const exclamationRegex = /!\s*(?:isEnabled|isActive|getFlag|featureEnabled|isFeatureEnabled|[\w_]+\s*\()?\s*$/;
  if (exclamationRegex.test(beforeMatchInLine)) {
    return true;
  }
  
  if (/!\s*[^\s!]*$/.test(beforeMatchInLine)) {
    return true;
  }
  
  const patterns = LANGUAGE_PATTERNS[language];
  for (const word of patterns.negationWords) {
    if (word === '!') {
      continue;
    }
    const wordRegex = new RegExp(`\\b${word}\\b.*$`, 'i');
    if (wordRegex.test(beforeMatchInLine)) {
      return true;
    }
  }
  
  return false;
}

export function findAllFlagMatches(
  filePath: string,
  content: string,
  flagDefinitions: FlagDefinition[]
): FlagMatch[] {
  const language = detectLanguage(filePath);
  const matches: FlagMatch[] = [];
  
  flagDefinitions.forEach(flag => {
    const flagName = flag.name;
    const escapedFlagName = flagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const flagPatterns: RegExp[] = [];
    
    if (language === 'typescript' || language === 'javascript') {
      flagPatterns.push(
        new RegExp(`isEnabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'),
        new RegExp(`isActive\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'),
        new RegExp(`getFlag\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'),
        new RegExp(`featureEnabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'),
        new RegExp(`isFeatureEnabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'),
        new RegExp(`featureFlags\\s*\\.\\s*${escapedFlagName}\\b`, 'g'),
        new RegExp(`flags\\s*\\.\\s*${escapedFlagName}\\b`, 'g')
      );
    } else if (language === 'python') {
      flagPatterns.push(
        new RegExp(`is_enabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'),
        new RegExp(`is_active\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'),
        new RegExp(`get_flag\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'),
        new RegExp(`feature_enabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'),
        new RegExp(`is_feature_enabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'),
        new RegExp(`feature_flags\\s*\\[\\s*['"\`]${escapedFlagName}['"\`]\\s*\\]`, 'g'),
        new RegExp(`flags\\s*\\[\\s*['"\`]${escapedFlagName}['"\`]\\s*\\]`, 'g')
      );
    } else {
      flagPatterns.push(
        new RegExp(`isEnabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'gi'),
        new RegExp(`IsEnabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g')
      );
    }
    
    flagPatterns.forEach(regex => {
      let match;
      while ((match = regex.exec(content)) !== null) {
        const lineNumber = getLineNumber(content, match.index);
        const column = getColumn(content, match.index);
        const isNegated = isNegatedContext(content, match.index, language);
        
        if (!matches.some(m => 
          m.flagName === flagName && 
          m.lineNumber === lineNumber
        )) {
          matches.push({
            flagName,
            matchedFlagName: flagName,
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

    const lineStartRegex = new RegExp(`^.*?\\b${escapedFlagName}\\b.*$`, 'gm');
    let lineMatch;
    while ((lineMatch = lineStartRegex.exec(content)) !== null) {
      const lineNumber = getLineNumber(content, lineMatch.index);
      
      if (matches.some(m => 
        m.flagName === flagName && 
        m.lineNumber === lineNumber
      )) {
        continue;
      }
      
      const lineText = lineMatch[0];
      
      if (/^\s*\/\//.test(lineText)) {
        continue;
      }
      if (/^\s*\*/.test(lineText)) {
        continue;
      }
      if (lineText.includes('//') && lineText.indexOf('//') < lineText.indexOf(flagName)) {
        continue;
      }
      
      const flagInLineIndex = lineText.indexOf(flagName);
      const beforeFlag = lineText.substring(0, flagInLineIndex);
      
      if (!(beforeFlag.includes('if') || beforeFlag.includes('while') || 
            beforeFlag.includes('return') || beforeFlag.includes('&&') || 
            beforeFlag.includes('||') || beforeFlag.includes('?') ||
            beforeFlag.includes('=') || beforeFlag.includes('!'))) {
        continue;
      }
      
      const matchIndex = lineMatch.index + lineText.indexOf(flagName);
      const column = getColumn(content, matchIndex);
      const isNegated = isNegatedContext(content, matchIndex, language);
      
      matches.push({
        flagName,
        matchedFlagName: flagName,
        filePath,
        lineNumber,
        column,
        matchType: isNegated ? 'negated' : 'direct',
        context: extractLineContext(content, lineNumber),
        isNegated,
        language,
      });
    }

    if (flag.dynamicPattern) {
      try {
        const dynamicRegex = new RegExp(flag.dynamicPattern, 'g');
        let dynamicMatch;
        while ((dynamicMatch = dynamicRegex.exec(content)) !== null) {
          const matchedFlagName = dynamicMatch[1] || dynamicMatch[0];
          const lineNumber = getLineNumber(content, dynamicMatch.index);
          
          if (matches.some(m => 
            m.flagName === flagName && 
            m.lineNumber === lineNumber
          )) {
            continue;
          }
          
          const column = getColumn(content, dynamicMatch.index);
          const isNegated = isNegatedContext(content, dynamicMatch.index, language);
          
          matches.push({
            flagName,
            matchedFlagName: typeof matchedFlagName === 'string' ? matchedFlagName : flagName,
            filePath,
            lineNumber,
            column,
            matchType: 'dynamic',
            context: extractLineContext(content, lineNumber),
            isNegated,
            language,
          });
        }
      } catch (regexError) {
        // 忽略无效的正则表达式
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

  for (const filePath of files) {
    try {
      const content = readFileContent(filePath);
      const matches = findAllFlagMatches(filePath, content, options.flagDefinitions);
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
