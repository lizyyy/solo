import { RGBA, ColorToken, TokenPair, ContrastResult } from './types';
import { getLuminance, getContrastRatio, blendAlpha, rgbaToHex } from './color-utils';

export const WCAG_THRESHOLDS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3,
  AAA_NORMAL: 7,
  AAA_LARGE: 4.5
};

export function calculateContrast(
  foreground: RGBA,
  background: RGBA
): {
  ratio: number;
  blendedForeground: RGBA;
  luminanceForeground: number;
  luminanceBackground: number;
} {
  const blended = blendAlpha(foreground, background);
  const luminanceForeground = getLuminance(blended);
  const luminanceBackground = getLuminance(background);
  const ratio = getContrastRatio(luminanceForeground, luminanceBackground);
  
  return {
    ratio,
    blendedForeground: blended,
    luminanceForeground,
    luminanceBackground
  };
}

export function getWcagLevels(contrastRatio: number): {
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
} {
  return {
    aaNormal: contrastRatio >= WCAG_THRESHOLDS.AA_NORMAL,
    aaLarge: contrastRatio >= WCAG_THRESHOLDS.AA_LARGE,
    aaaNormal: contrastRatio >= WCAG_THRESHOLDS.AAA_NORMAL,
    aaaLarge: contrastRatio >= WCAG_THRESHOLDS.AAA_LARGE
  };
}

export function generateContrastResult(
  pair: TokenPair,
  threshold: number = WCAG_THRESHOLDS.AA_NORMAL
): ContrastResult {
  const notes: string[] = [];
  const foreground = pair.foreground.rgba;
  const background = pair.background.rgba;
  
  if (foreground.a < 1) {
    notes.push(`前景色有透明度 (alpha: ${foreground.a.toFixed(2)})，已与背景色混合计算对比度`);
  }
  
  if (background.a < 1) {
    notes.push(`背景色有透明度 (alpha: ${background.a.toFixed(2)})，假设背景在纯白或纯黑取决于明暗模式`);
  }
  
  const result = calculateContrast(foreground, background);
  const wcagLevels = getWcagLevels(result.ratio);
  
  return {
    pair,
    contrastRatio: Math.round(result.ratio * 100) / 100,
    wcagLevel: wcagLevels,
    passes: result.ratio >= threshold,
    threshold,
    notes,
    calculation: {
      foregroundHex: pair.foreground.hex,
      backgroundHex: pair.background.hex,
      foregroundWithAlphaBlend: rgbaToHex(result.blendedForeground),
      luminanceForeground: Math.round(result.luminanceForeground * 10000) / 10000,
      luminanceBackground: Math.round(result.luminanceBackground * 10000) / 10000
    }
  };
}

export function generateTokenPairs(
  colorTokens: Map<string, ColorToken>
): TokenPair[] {
  const pairs: TokenPair[] = [];
  const tokens = Array.from(colorTokens.values());
  
  const foregroundTokens = tokens.filter(t => 
    t.name.toLowerCase().includes('text') || 
    t.name.toLowerCase().includes('foreground') ||
    t.name.toLowerCase().includes('color')
  );
  
  const backgroundTokens = tokens.filter(t => 
    t.name.toLowerCase().includes('bg') || 
    t.name.toLowerCase().includes('background')
  );
  
  if (foregroundTokens.length > 0 && backgroundTokens.length > 0) {
    for (const fg of foregroundTokens) {
      for (const bg of backgroundTokens) {
        pairs.push({
          id: `${fg.name}-on-${bg.name}`,
          foreground: fg,
          background: bg,
          context: 'auto-generated'
        });
      }
    }
  } else {
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j < tokens.length; j++) {
        if (i !== j) {
          pairs.push({
            id: `${tokens[i].name}-on-${tokens[j].name}`,
            foreground: tokens[i],
            background: tokens[j],
            context: 'auto-generated'
          });
        }
      }
    }
  }
  
  return pairs;
}

export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

export function getLevelLabel(passes: boolean, ratio: number, threshold: number): string {
  if (passes) {
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    if (ratio >= 3) return 'AA Large';
  }
  return 'FAIL';
}
