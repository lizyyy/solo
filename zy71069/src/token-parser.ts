import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'json-source-map';
import { Token, ColorToken, UnresolvedToken, TokenFileSource } from './types';
import { parseColor, rgbaToHex } from './color-utils';

export interface ParseResult {
  tokens: Map<string, ColorToken>;
  unresolvedTokens: UnresolvedToken[];
}

export function parseTokenFile(filePath: string): { 
  rawTokens: Record<string, any>; 
  sourceMap: Record<string, TokenFileSource>;
} {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const { data, pointers } = parse(content);
  
  const sourceMap: Record<string, TokenFileSource> = {};
  
  for (const [jsonPath, location] of Object.entries(pointers)) {
    if (jsonPath.endsWith('/value')) {
      const tokenPath = jsonPath.replace(/\/value$/, '');
      sourceMap[tokenPath] = {
        filePath: absolutePath,
        line: location.value.line + 1,
        column: location.value.column + 1
      };
    }
  }
  
  return { rawTokens: data, sourceMap };
}

export function flattenTokens(
  obj: Record<string, any>,
  sourceMap: Record<string, TokenFileSource>,
  prefix: string = '',
  jsonPath: string = ''
): Map<string, Token> {
  const tokens = new Map<string, Token>();
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    const currentJsonPath = `${jsonPath}/${key}`;
    
    if (value && typeof value === 'object') {
      if ('value' in value) {
        const token: Token = {
          name: currentPath,
          path: currentPath.split('.'),
          value: String(value.value),
          resolvedValue: String(value.value),
          type: value.type,
          description: value.description,
          isAlias: false,
          aliasChain: undefined
        };
        
        const source = sourceMap[`${currentJsonPath}/value`];
        if (source) {
          token.filePath = source.filePath;
          token.line = source.line;
          token.column = source.column;
        }
        
        tokens.set(currentPath, token);
      } else {
        const nested = flattenTokens(value, sourceMap, currentPath, currentJsonPath);
        for (const [k, v] of nested) {
          tokens.set(k, v);
        }
      }
    }
  }
  
  return tokens;
}

export function isAlias(value: string): boolean {
  return /^\{.+\}$/.test(value) || value.startsWith('$') || value.startsWith('@');
}

export function resolveAliasPath(value: string): string {
  if (/^\{.+\}$/.test(value)) {
    return value.slice(1, -1).replace(/\//g, '.');
  }
  if (value.startsWith('$')) {
    return value.slice(1);
  }
  if (value.startsWith('@')) {
    return value.slice(1);
  }
  return value;
}

export function resolveAliases(tokens: Map<string, Token>): {
  resolvedTokens: Map<string, Token>;
  unresolvedTokens: UnresolvedToken[];
} {
  const resolvedTokens = new Map<string, Token>();
  const unresolvedTokens: UnresolvedToken[] = [];
  const resolutionCache = new Map<string, string>();
  
  const resolveToken = (tokenName: string, visited: Set<string> = new Set()): string | null => {
    if (resolutionCache.has(tokenName)) {
      return resolutionCache.get(tokenName)!;
    }
    
    if (visited.has(tokenName)) {
      return null;
    }
    
    const token = tokens.get(tokenName);
    if (!token) {
      return null;
    }
    
    visited.add(tokenName);
    
    const value = token.value;
    
    if (!isAlias(value)) {
      resolutionCache.set(tokenName, value);
      return value;
    }
    
    const aliasPath = resolveAliasPath(value);
    const resolved = resolveToken(aliasPath, visited);
    
    if (resolved) {
      resolutionCache.set(tokenName, resolved);
      return resolved;
    }
    
    return null;
  };
  
  const getAliasChain = (tokenName: string, chain: string[] = []): string[] => {
    if (chain.includes(tokenName)) {
      return [...chain, tokenName];
    }
    
    const token = tokens.get(tokenName);
    if (!token) {
      return chain;
    }
    
    chain.push(tokenName);
    
    if (isAlias(token.value)) {
      const aliasPath = resolveAliasPath(token.value);
      return getAliasChain(aliasPath, chain);
    }
    
    return chain;
  };
  
  for (const [name, token] of tokens) {
    const resolvedValue = resolveToken(name);
    
    if (resolvedValue) {
      const aliasChain = getAliasChain(name);
      resolvedTokens.set(name, {
        ...token,
        resolvedValue,
        isAlias: isAlias(token.value),
        aliasChain: aliasChain.length > 1 ? aliasChain : undefined
      });
    } else {
      unresolvedTokens.push({
        name,
        value: token.value,
        reason: isAlias(token.value) 
          ? `无法解析别名链: ${getAliasChain(name).join(' → ')}`
          : '无法解析 token 值',
        filePath: token.filePath,
        line: token.line,
        column: token.column
      });
    }
  }
  
  return { resolvedTokens, unresolvedTokens };
}

export function extractColorTokens(
  resolvedTokens: Map<string, Token>,
  mode?: 'light' | 'dark'
): {
  colorTokens: Map<string, ColorToken>;
  unresolvedTokens: UnresolvedToken[];
} {
  const colorTokens = new Map<string, ColorToken>();
  const unresolvedTokens: UnresolvedToken[] = [];
  
  for (const [name, token] of resolvedTokens) {
    const isColorType = token.type === 'color';
    const hasColorInName = name.toLowerCase().includes('color') || 
                          name.toLowerCase().includes('bg') || 
                          name.toLowerCase().includes('foreground') ||
                          name.toLowerCase().includes('background') ||
                          name.toLowerCase().includes('text');
    
    if (!isColorType && !hasColorInName) {
      continue;
    }
    
    if (mode) {
      const tokenNameLower = name.toLowerCase();
      if (mode === 'light' && tokenNameLower.includes('dark')) {
        continue;
      }
      if (mode === 'dark' && tokenNameLower.includes('light')) {
        continue;
      }
    }
    
    const rgba = parseColor(token.resolvedValue);
    
    if (rgba) {
      colorTokens.set(name, {
        ...token,
        rgba,
        hex: rgbaToHex(rgba)
      });
    } else {
      unresolvedTokens.push({
        name,
        value: token.resolvedValue,
        reason: '无法解析为颜色值',
        filePath: token.filePath,
        line: token.line,
        column: token.column
      });
    }
  }
  
  return { colorTokens, unresolvedTokens };
}

export function parseTokensFromFile(
  filePath: string,
  mode?: 'light' | 'dark'
): ParseResult {
  const { rawTokens, sourceMap } = parseTokenFile(filePath);
  const flatTokens = flattenTokens(rawTokens, sourceMap);
  const { resolvedTokens, unresolvedTokens: aliasUnresolved } = resolveAliases(flatTokens);
  const { colorTokens, unresolvedTokens: colorUnresolved } = extractColorTokens(resolvedTokens, mode);
  
  return {
    tokens: colorTokens,
    unresolvedTokens: [...aliasUnresolved, ...colorUnresolved]
  };
}

export function parseComponentPairs(
  pairsFilePath: string,
  colorTokens: Map<string, ColorToken>
): {
  pairs: Array<{
    foregroundToken: string;
    backgroundToken: string;
    foreground?: ColorToken;
    background?: ColorToken;
    component?: string;
    variant?: string;
    context?: string;
  }>;
  unresolvedPairs: Array<{
    foregroundToken: string;
    backgroundToken: string;
    reason: string;
    line?: number;
  }>;
} {
  const absolutePath = path.resolve(pairsFilePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const { data, pointers } = parse(content);
  
  const pairs: Array<{
    foregroundToken: string;
    backgroundToken: string;
    foreground?: ColorToken;
    background?: ColorToken;
    component?: string;
    variant?: string;
    context?: string;
  }> = [];
  
  const unresolvedPairs: Array<{
    foregroundToken: string;
    backgroundToken: string;
    reason: string;
    line?: number;
  }> = [];
  
  if (Array.isArray(data)) {
    data.forEach((item: any, index: number) => {
      const foregroundToken = item.foreground || item.foregroundToken;
      const backgroundToken = item.background || item.backgroundToken;
      
      const pointer = pointers[`/${index}`];
      const line = pointer ? pointer.value.line + 1 : undefined;
      
      if (!foregroundToken || !backgroundToken) {
        unresolvedPairs.push({
          foregroundToken,
          backgroundToken,
          reason: '缺少 foreground 或 background token',
          line
        });
        return;
      }
      
      const foreground = colorTokens.get(foregroundToken);
      const background = colorTokens.get(backgroundToken);
      
      if (!foreground || !background) {
        const missing: string[] = [];
        if (!foreground) missing.push(`foreground token "${foregroundToken}" 不存在`);
        if (!background) missing.push(`background token "${backgroundToken}" 不存在`);
        
        unresolvedPairs.push({
          foregroundToken,
          backgroundToken,
          reason: missing.join(', '),
          line
        });
        return;
      }
      
      pairs.push({
        foregroundToken,
        backgroundToken,
        foreground,
        background,
        component: item.component,
        variant: item.variant,
        context: item.context
      });
    });
  }
  
  return { pairs, unresolvedPairs };
}
