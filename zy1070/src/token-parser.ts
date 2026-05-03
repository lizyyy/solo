import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TokenDefinition, TokenValue, ThemeTokens } from './types';

export class ParseError extends Error {
  constructor(message: string, public filePath?: string) {
    super(filePath ? `${message} (文件: ${filePath})` : message);
    this.name = 'ParseError';
  }
}

export class AliasError extends Error {
  constructor(message: string, public tokenName?: string) {
    super(tokenName ? `${message} (Token: ${tokenName})` : message);
    this.name = 'AliasError';
  }
}

export function flattenTokens(
  obj: any,
  parentPath: string[] = [],
  typeHint?: string
): TokenDefinition[] {
  const tokens: TokenDefinition[] = [];

  if (!obj || typeof obj !== 'object') {
    return tokens;
  }

  if (obj.$value !== undefined || obj.value !== undefined) {
    const value = obj.$value ?? obj.value;
    const type = obj.$type ?? obj.type ?? typeHint;
    const alias = obj.$alias ?? obj.alias;

    const tokenName = parentPath.join('.');
    tokens.push({
      name: tokenName,
      path: [...parentPath],
      value: String(value),
      type,
      alias,
    });
    return tokens;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$') && key !== '$value' && key !== '$type' && key !== '$alias') {
      continue;
    }

    const newPath = [...parentPath, key];
    const nestedType = typeHint || (isColorKey(key) ? 'color' : undefined);

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nestedTokens = flattenTokens(value, newPath, nestedType);
      tokens.push(...nestedTokens);
    } else if (typeof value === 'string' || typeof value === 'number') {
      const tokenName = newPath.join('.');
      tokens.push({
        name: tokenName,
        path: newPath,
        value: String(value),
        type: nestedType,
      });
    }
  }

  return tokens;
}

function isColorKey(key: string): boolean {
  const colorKeywords = ['color', 'background', 'text', 'border', 'shadow', 'fill', 'stroke'];
  return colorKeywords.some((kw) => key.toLowerCase().includes(kw));
}

export function parseTokenFile(filePath: string): TokenDefinition[] {
  if (!fs.existsSync(filePath)) {
    throw new ParseError('Token 文件不存在', filePath);
  }

  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, 'utf-8');

  try {
    if (ext === '.json') {
      const parsed = JSON.parse(content);
      return flattenTokens(parsed);
    } else if (ext === '.yaml' || ext === '.yml') {
      const parsed = yaml.load(content) as any;
      return flattenTokens(parsed);
    } else {
      throw new ParseError(`不支持的文件格式: ${ext}`, filePath);
    }
  } catch (error) {
    if (error instanceof ParseError) {
      throw error;
    }
    const err = error as Error;
    throw new ParseError(`解析失败: ${err.message}`, filePath);
  }
}

export function parseCSSVariables(content: string, filePath: string): TokenDefinition[] {
  const tokens: TokenDefinition[] = [];
  const lines = content.split('\n');

  const cssVarRegex = /--([a-zA-Z0-9_-]+):\s*([^;]+);/g;
  let match;

  const allContent = content.replace(/\s+/g, ' ');

  while ((match = cssVarRegex.exec(allContent)) !== null) {
    const varName = match[1];
    const varValue = match[2].trim();

    const lineMatch = findLineForMatch(lines, match[0]);

    tokens.push({
      name: varName,
      path: [varName],
      value: varValue,
      type: inferTypeFromValue(varValue),
    });
  }

  return tokens;
}

function findLineForMatch(lines: string[], pattern: string): number {
  const normalizedPattern = pattern.replace(/\s+/g, '\\s*');
  const regex = new RegExp(normalizedPattern);

  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      return i + 1;
    }
  }
  return 0;
}

export function inferTypeFromValue(value: string): string | undefined {
  const trimmed = value.trim().toLowerCase();

  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    return 'color';
  }
  if (/^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/i.test(trimmed)) {
    return 'color';
  }

  const colorKeywords = [
    'transparent',
    'currentcolor',
    'inherit',
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
  ];
  if (colorKeywords.includes(trimmed)) {
    return 'color';
  }

  if (/^var\(--[a-zA-Z0-9_-]+\)$/.test(trimmed)) {
    return undefined;
  }

  if (/^-?\d*\.?\d+(px|rem|em|%|vh|vw|vmin|vmax|ch|ex)?$/.test(trimmed)) {
    return 'spacing';
  }

  if (trimmed.includes('font') || trimmed.includes('family') || trimmed.includes(',')) {
    return 'font';
  }

  return undefined;
}

export function parseTailwindConfig(
  configObj: any,
  filePath: string
): TokenDefinition[] {
  const tokens: TokenDefinition[] = [];

  if (configObj.theme?.colors) {
    const colorTokens = flattenTailwindSection(configObj.theme.colors, ['colors'], 'color');
    tokens.push(...colorTokens);
  }

  if (configObj.theme?.spacing) {
    const spacingTokens = flattenTailwindSection(configObj.theme.spacing, ['spacing'], 'spacing');
    tokens.push(...spacingTokens);
  }

  if (configObj.theme?.fontSize) {
    const fontSizeTokens = flattenTailwindSection(configObj.theme.fontSize, ['fontSize'], 'font');
    tokens.push(...fontSizeTokens);
  }

  if (configObj.theme?.borderRadius) {
    const radiusTokens = flattenTailwindSection(configObj.theme.borderRadius, ['borderRadius'], 'radius');
    tokens.push(...radiusTokens);
  }

  if (configObj.theme?.boxShadow) {
    const shadowTokens = flattenTailwindSection(configObj.theme.boxShadow, ['boxShadow'], 'shadow');
    tokens.push(...shadowTokens);
  }

  return tokens;
}

function flattenTailwindSection(
  section: any,
  parentPath: string[],
  type: string
): TokenDefinition[] {
  const tokens: TokenDefinition[] = [];

  if (!section || typeof section !== 'object') {
    return tokens;
  }

  for (const [key, value] of Object.entries(section)) {
    const newPath = [...parentPath, key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nestedTokens = flattenTailwindSection(value, newPath, type);
      tokens.push(...nestedTokens);
    } else {
      let stringValue: string;
      if (Array.isArray(value)) {
        stringValue = value.join(', ');
      } else {
        stringValue = String(value);
      }

      tokens.push({
        name: newPath.join('.'),
        path: newPath,
        value: stringValue,
        type,
      });
    }
  }

  return tokens;
}

export function resolveAliases(
  tokens: TokenDefinition[],
  themeNames: string[] = ['light', 'dark']
): {
  resolved: TokenDefinition[];
  errors: AliasError[];
} {
  const resolved: TokenDefinition[] = [];
  const errors: AliasError[] = [];
  const tokenMap = new Map<string, TokenDefinition>();

  for (const token of tokens) {
    tokenMap.set(token.name, token);
  }

  for (const token of tokens) {
    try {
      const resolvedValue = resolveTokenValue(token.name, tokenMap, new Set());
      resolved.push({
        ...token,
        resolvedValue,
      });
    } catch (error) {
      if (error instanceof AliasError) {
        errors.push(error);
      } else {
        errors.push(new AliasError((error as Error).message, token.name));
      }
    }
  }

  const themeTokenMap = new Map<string, Map<string, string>>();
  for (const theme of themeNames) {
    themeTokenMap.set(theme, new Map());
  }

  for (const token of tokens) {
    const parts = token.name.split('.');
    if (themeNames.includes(parts[0])) {
      const theme = parts[0];
      const tokenBaseName = parts.slice(1).join('.');
      const map = themeTokenMap.get(theme);
      if (map) {
        map.set(tokenBaseName, token.value);
      }
    }
  }

  return { resolved, errors };
}

function resolveTokenValue(
  tokenName: string,
  tokenMap: Map<string, TokenDefinition>,
  visited: Set<string>
): string {
  if (visited.has(tokenName)) {
    throw new AliasError('循环别名引用检测', tokenName);
  }

  const token = tokenMap.get(tokenName);
  if (!token) {
    throw new AliasError('引用的 Token 不存在', tokenName);
  }

  if (token.alias) {
    visited.add(tokenName);
    return resolveTokenValue(token.alias, tokenMap, visited);
  }

  const value = token.value;
  const aliasMatch = value.match(/^\{([^}]+)\}$/);
  if (aliasMatch) {
    visited.add(tokenName);
    return resolveTokenValue(aliasMatch[1], tokenMap, visited);
  }

  const cssVarMatch = value.match(/^var\(--([a-zA-Z0-9_-]+)\)$/);
  if (cssVarMatch) {
    const cssVarName = cssVarMatch[1];
    if (tokenMap.has(cssVarName)) {
      visited.add(tokenName);
      return resolveTokenValue(cssVarName, tokenMap, visited);
    }
  }

  return value;
}

export function checkThemeConsistency(
  tokens: TokenDefinition[],
  themeNames: string[]
): {
  consistent: string[];
  missing: { token: string; missingThemes: string[] }[];
} {
  const tokenThemes = new Map<string, Set<string>>();

  for (const token of tokens) {
    const parts = token.name.split('.');
    if (themeNames.includes(parts[0])) {
      const theme = parts[0];
      const tokenBaseName = parts.slice(1).join('.');

      if (!tokenThemes.has(tokenBaseName)) {
        tokenThemes.set(tokenBaseName, new Set());
      }
      tokenThemes.get(tokenBaseName)!.add(theme);
    }
  }

  const consistent: string[] = [];
  const missing: { token: string; missingThemes: string[] }[] = [];

  for (const [tokenName, presentThemes] of tokenThemes) {
    const missingThemes = themeNames.filter((t) => !presentThemes.has(t));
    if (missingThemes.length === 0) {
      consistent.push(tokenName);
    } else {
      missing.push({ token: tokenName, missingThemes });
    }
  }

  return { consistent, missing };
}
