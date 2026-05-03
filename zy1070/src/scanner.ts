import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
  HardcodedValue,
  TokenReference,
  CSSVariable,
  TokenDefinition,
  Config,
} from './types';
import { parseCSSVariables, inferTypeFromValue } from './token-parser';

export class ScannerError extends Error {
  constructor(message: string, public filePath?: string) {
    super(filePath ? `${message} (文件: ${filePath})` : message);
    this.name = 'ScannerError';
  }
}

const COLOR_PATTERNS = [
  /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
  /\b(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([^)]+\)/gi,
];

const SPACING_PATTERNS = [
  /(?<![a-zA-Z-])\d+(\.\d+)?(px|rem|em|%|vh|vw|vmin|vmax|ch|ex)\b/g,
];

const CSS_VAR_PATTERN = /var\(--([a-zA-Z0-9_-]+)(?:,\s*([^)]+))?\)/g;

const TAILWIND_COLOR_PATTERN = /\b(text|bg|border|ring|shadow|fill|stroke)-([a-zA-Z0-9_-]+)\b/g;

const TAILWIND_SPACING_PATTERN = /\b(p|m|px|py|pl|pr|pt|pb|mx|my|ml|mr|mt|mb|gap|space-x|space-y|inset|top|right|bottom|left)-(\d+(\.\d+)?|auto|full|px)\b/g;

const STANDARD_COLORS = new Set([
  'transparent',
  'inherit',
  'currentColor',
  'currentcolor',
  'initial',
  'unset',
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'gray',
  'grey',
  'aqua',
  'cyan',
  'fuchsia',
  'lime',
  'maroon',
  'navy',
  'olive',
  'silver',
  'teal',
  'violet',
  'indigo',
  'amber',
  'emerald',
  'sky',
  'rose',
  'slate',
  'zinc',
  'stone',
]);

export async function getSourceFiles(
  sourceDirs: string[],
  ignorePatterns: string[],
  projectRoot: string
): Promise<string[]> {
  const allFiles: string[] = [];

  for (const dir of sourceDirs) {
    const fullDir = path.resolve(projectRoot, dir);
    
    if (!fs.existsSync(fullDir)) {
      continue;
    }

    const patterns = [
      `${fullDir}/**/*.{ts,tsx,js,jsx,vue,css,scss,sass,less}`,
    ];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        ignore: [
          ...ignorePatterns.map((p) => path.resolve(projectRoot, p)),
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
        ],
        absolute: true,
      });
      allFiles.push(...files);
    }
  }

  return [...new Set(allFiles)];
}

export function scanFile(
  filePath: string,
  config: Config,
  definedTokens: TokenDefinition[]
): {
  hardcoded: HardcodedValue[];
  references: TokenReference[];
  cssVariables: CSSVariable[];
} {
  if (!fs.existsSync(filePath)) {
    throw new ScannerError('文件不存在', filePath);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  const hardcoded: HardcodedValue[] = [];
  const references: TokenReference[] = [];
  const cssVariables: CSSVariable[] = [];

  if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less') {
    const cssVars = parseCSSVariables(content, filePath);
    for (const token of cssVars) {
      cssVariables.push({
        name: token.name,
        value: token.value,
        file: filePath,
        line: 0,
      });
    }
  }

  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineNum = lineIndex + 1;

    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) {
      continue;
    }

    const commentMatch = line.match(/(\/\/|\/\*)/);
    const scanUntil = commentMatch ? commentMatch.index! : line.length;
    const scanLine = line.substring(0, scanUntil);

    for (const pattern of COLOR_PATTERNS) {
      let match;
      const localPattern = new RegExp(pattern.source, pattern.flags);
      
      while ((match = localPattern.exec(scanLine)) !== null) {
        const value = match[0];
        
        if (isAllowedHardcoded(value, config.allowedHardcoded)) {
          continue;
        }

        if (STANDARD_COLORS.has(value.toLowerCase())) {
          continue;
        }

        if (isInStringLiteral(scanLine, match.index!)) {
          if (isInJSXString(scanLine, match.index!)) {
            continue;
          }
        }

        const suggestedToken = findMatchingToken(value, definedTokens, 'color');

        hardcoded.push({
          type: 'color',
          value,
          file: filePath,
          line: lineNum,
          column: match.index! + 1,
          context: line.trim(),
        });

        if (suggestedToken) {
          references.push({
            tokenName: suggestedToken,
            file: filePath,
            line: lineNum,
            column: match.index! + 1,
            context: `建议替换为: ${suggestedToken}`,
          });
        }
      }
    }

    for (const pattern of SPACING_PATTERNS) {
      let match;
      const localPattern = new RegExp(pattern.source, pattern.flags);
      
      while ((match = localPattern.exec(scanLine)) !== null) {
        const value = match[0];
        
        if (isAllowedHardcoded(value, config.allowedHardcoded)) {
          continue;
        }

        if (value.startsWith('0') && value !== '0px') {
          const numValue = parseFloat(value);
          if (numValue === 0) {
            continue;
          }
        }

        const suggestedToken = findMatchingToken(value, definedTokens, 'spacing');

        hardcoded.push({
          type: 'spacing',
          value,
          file: filePath,
          line: lineNum,
          column: match.index! + 1,
          context: line.trim(),
        });

        if (suggestedToken) {
          references.push({
            tokenName: suggestedToken,
            file: filePath,
            line: lineNum,
            column: match.index! + 1,
            context: `建议替换为: ${suggestedToken}`,
          });
        }
      }
    }

    let cssVarMatch;
    const cssVarPattern = new RegExp(CSS_VAR_PATTERN.source, CSS_VAR_PATTERN.flags);
    while ((cssVarMatch = cssVarPattern.exec(scanLine)) !== null) {
      const varName = cssVarMatch[1];
      
      references.push({
        tokenName: varName,
        file: filePath,
        line: lineNum,
        column: cssVarMatch.index! + 1,
        context: line.trim(),
      });
    }

    let twColorMatch;
    const twColorPattern = new RegExp(TAILWIND_COLOR_PATTERN.source, TAILWIND_COLOR_PATTERN.flags);
    while ((twColorMatch = twColorPattern.exec(scanLine)) !== null) {
      const prefix = twColorMatch[1];
      const colorName = twColorMatch[2];
      const tokenName = `colors.${colorName}`;
      
      references.push({
        tokenName,
        file: filePath,
        line: lineNum,
        column: twColorMatch.index! + 1,
        context: line.trim(),
      });
    }

    let twSpacingMatch;
    const twSpacingPattern = new RegExp(TAILWIND_SPACING_PATTERN.source, TAILWIND_SPACING_PATTERN.flags);
    while ((twSpacingMatch = twSpacingPattern.exec(scanLine)) !== null) {
      const prefix = twSpacingMatch[1];
      const spacingValue = twSpacingMatch[2];
      const tokenName = `spacing.${spacingValue}`;
      
      references.push({
        tokenName,
        file: filePath,
        line: lineNum,
        column: twSpacingMatch.index! + 1,
        context: line.trim(),
      });
    }
  }

  return { hardcoded, references, cssVariables };
}

function isAllowedHardcoded(value: string, allowedList: string[]): boolean {
  const lowerValue = value.toLowerCase().trim();
  return allowedList.some((allowed) => {
    const lowerAllowed = allowed.toLowerCase().trim();
    if (lowerAllowed.includes('*')) {
      const regex = new RegExp('^' + lowerAllowed.replace(/\*/g, '.*') + '$');
      return regex.test(lowerValue);
    }
    return lowerValue === lowerAllowed;
  });
}

function isInStringLiteral(line: string, index: number): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;

  for (let i = 0; i < index && i < line.length; i++) {
    const char = line[i];
    const prevChar = i > 0 ? line[i - 1] : '';

    if (prevChar === '\\') {
      continue;
    }

    if (char === "'" && !inDoubleQuote && !inTemplate) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && !inTemplate) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inTemplate = !inTemplate;
    }
  }

  return inSingleQuote || inDoubleQuote || inTemplate;
}

function isInJSXString(line: string, index: number): boolean {
  const beforeMatch = line.substring(0, index);
  
  const classNameMatch = beforeMatch.match(/(className|style|color|background|bg)\s*=\s*["']?$/);
  if (classNameMatch) {
    return true;
  }

  return false;
}

function findMatchingToken(
  value: string,
  tokens: TokenDefinition[],
  type: string
): string | undefined {
  const normalizedValue = value.toLowerCase().trim();

  for (const token of tokens) {
    if (token.type !== type && type !== 'any') {
      continue;
    }

    const tokenValue = (token.resolvedValue || token.value).toLowerCase().trim();
    
    if (tokenValue === normalizedValue) {
      return token.name;
    }

    if (normalizedValue.endsWith('px')) {
      const numValue = parseFloat(normalizedValue);
      if (!isNaN(numValue)) {
        const tokenNumValue = parseFloat(tokenValue);
        if (!isNaN(tokenNumValue) && tokenNumValue === numValue) {
          return token.name;
        }
      }
    }
  }

  return undefined;
}

export async function scanAllFiles(
  files: string[],
  config: Config,
  definedTokens: TokenDefinition[]
): Promise<{
  hardcoded: HardcodedValue[];
  references: TokenReference[];
  cssVariables: CSSVariable[];
}> {
  const allHardcoded: HardcodedValue[] = [];
  const allReferences: TokenReference[] = [];
  const allCssVariables: CSSVariable[] = [];

  for (const file of files) {
    try {
      const result = scanFile(file, config, definedTokens);
      allHardcoded.push(...result.hardcoded);
      allReferences.push(...result.references);
      allCssVariables.push(...result.cssVariables);
    } catch (error) {
      if (error instanceof ScannerError) {
        console.warn(`警告: ${error.message}`);
      } else {
        console.warn(`警告: 扫描文件 ${file} 时出错: ${(error as Error).message}`);
      }
    }
  }

  return {
    hardcoded: allHardcoded,
    references: allReferences,
    cssVariables: allCssVariables,
  };
}
