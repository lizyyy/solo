import { ColorToken, TokenPair, ContrastResult, AnalysisReport, CliOptions, UnresolvedToken } from './types';
import { generateContrastResult, generateTokenPairs } from './wcag-contrast';
import { parseTokensFromFile, parseComponentPairs } from './token-parser';
import * as fs from 'fs';
import * as path from 'path';
import { parseColor, rgbaToHex } from './color-utils';

export interface AnalysisResult {
  report: AnalysisReport;
  exitCode: number;
}

export function analyzeTokens(options: CliOptions): AnalysisResult {
  const exitCode = {
    OK: 0,
    HAS_FAILURES: 1,
    ERROR: 2
  };
  
  try {
    const allUnresolvedTokens: UnresolvedToken[] = [];
    let colorTokens: Map<string, ColorToken>;
    
    if (options.mode === 'both') {
      const lightResult = parseTokensFromFile(options.tokens, 'light');
      const darkResult = parseTokensFromFile(options.tokens, 'dark');
      
      colorTokens = new Map([...lightResult.tokens, ...darkResult.tokens]);
      allUnresolvedTokens.push(...lightResult.unresolvedTokens, ...darkResult.unresolvedTokens);
    } else {
      const result = parseTokensFromFile(options.tokens, options.mode);
      colorTokens = result.tokens;
      allUnresolvedTokens.push(...result.unresolvedTokens);
    }
    
    let pairs: TokenPair[] = [];
    
    if (options.foreground && options.background) {
      const fgToken = colorTokens.get(options.foreground);
      const bgToken = colorTokens.get(options.background);
      
      if (fgToken && bgToken) {
        pairs.push({
          id: `${options.foreground}-on-${options.background}`,
          foreground: fgToken,
          background: bgToken,
          context: 'single-pair'
        });
      } else {
        if (!fgToken) {
          allUnresolvedTokens.push({
            name: options.foreground,
            value: '',
            reason: '未找到指定的 foreground token'
          });
        }
        if (!bgToken) {
          allUnresolvedTokens.push({
            name: options.background,
            value: '',
            reason: '未找到指定的 background token'
          });
        }
      }
    } else if (options.pairs) {
      const { pairs: componentPairs, unresolvedPairs } = parseComponentPairs(options.pairs, colorTokens);
      
      for (const pair of componentPairs) {
        if (pair.foreground && pair.background) {
          pairs.push({
            id: `${pair.foregroundToken}-on-${pair.backgroundToken}`,
            foreground: pair.foreground,
            background: pair.background,
            component: pair.component,
            variant: pair.variant,
            context: pair.context
          });
        }
      }
      
      for (const up of unresolvedPairs) {
        allUnresolvedTokens.push({
          name: `${up.foregroundToken}/${up.backgroundToken}`,
          value: '',
          reason: up.reason,
          line: up.line,
          filePath: options.pairs
        });
      }
    } else {
      pairs = generateTokenPairs(colorTokens);
    }
    
    const results: ContrastResult[] = pairs.map(pair => 
      generateContrastResult(pair, options.threshold)
    );
    
    const passed = results.filter(r => r.passes).length;
    const failed = results.filter(r => !r.passes).length;
    const warning = results.filter(r => !r.passes && r.contrastRatio >= options.threshold - 0.5).length;
    
    const tokenMap: Record<string, ColorToken> = {};
    for (const [name, token] of colorTokens) {
      tokenMap[name] = token;
    }
    
    const report: AnalysisReport = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        options
      },
      summary: {
        totalPairs: results.length,
        passed,
        failed,
        warning,
        passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0
      },
      results,
      unresolvedTokens: allUnresolvedTokens,
      tokenMap
    };
    
    return {
      report,
      exitCode: failed > 0 ? exitCode.HAS_FAILURES : exitCode.OK
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      report: {
        metadata: {
          generatedAt: new Date().toISOString(),
          version: '1.0.0',
          options
        },
        summary: {
          totalPairs: 0,
          passed: 0,
          failed: 0,
          warning: 0,
          passRate: 0
        },
        results: [],
        unresolvedTokens: [{
          name: 'ERROR',
          value: '',
          reason: `分析失败: ${errorMessage}`
        }],
        tokenMap: {}
      },
      exitCode: exitCode.ERROR
    };
  }
}

export function analyzeSingleColorPair(
  foreground: string,
  background: string,
  threshold: number = 4.5
): ContrastResult | null {
  const fgRgba = parseColor(foreground);
  const bgRgba = parseColor(background);
  
  if (!fgRgba || !bgRgba) {
    return null;
  }
  
  const fgToken: ColorToken = {
    name: 'foreground',
    path: ['foreground'],
    value: foreground,
    resolvedValue: foreground,
    isAlias: false,
    rgba: fgRgba,
    hex: rgbaToHex(fgRgba)
  };
  
  const bgToken: ColorToken = {
    name: 'background',
    path: ['background'],
    value: background,
    resolvedValue: background,
    isAlias: false,
    rgba: bgRgba,
    hex: rgbaToHex(bgRgba)
  };
  
  const pair: TokenPair = {
    id: 'custom-pair',
    foreground: fgToken,
    background: bgToken,
    context: 'direct-color-input'
  };
  
  return generateContrastResult(pair, threshold);
}
