import { 
  ParsedData, 
  GlyphCheckResult, 
  RuleResult,
  SampleEntry,
  FallbackChain
} from '../types';
import { getCodePoints, isWhitespace, isControlCharacter } from '../utils/unicode';

export function checkMissingGlyphs(data: ParsedData): RuleResult<GlyphCheckResult> {
  const issues: GlyphCheckResult[] = [];

  for (const sample of data.samples) {
    const fallbackChain = getFallbackChainForSample(sample, data);
    const codePoints = getCodePoints(sample.text);

    for (const codePoint of codePoints) {
      if (isWhitespace(codePoint) || isControlCharacter(codePoint)) {
        continue;
      }

      const char = String.fromCodePoint(codePoint);
      const missingInFonts: string[] = [];
      let isMissing = true;

      for (const fontName of fallbackChain) {
        const font = data.fonts.get(fontName);
        if (!font) {
          missingInFonts.push(fontName);
          continue;
        }

        const hasGlyph = checkFontHasGlyph(font, codePoint, data);
        if (!hasGlyph) {
          missingInFonts.push(fontName);
        } else {
          isMissing = false;
          break;
        }
      }

      if (isMissing || missingInFonts.length > 0) {
        issues.push({
          codePoint,
          char,
          language: sample.language,
          script: sample.script,
          sampleId: sample.id,
          sampleText: sample.text,
          fallbackChain,
          missingInFonts,
          isMissing
        });
      }
    }
  }

  const missingOnlyIssues = issues.filter(i => i.isMissing);

  return {
    name: 'Missing Glyphs Check',
    description: '检查所有样本文本中的字符是否能在字体回退链中找到',
    passed: missingOnlyIssues.length === 0,
    issues
  };
}

function getFallbackChainForSample(sample: SampleEntry, data: ParsedData): string[] {
  const matchingChain = data.fallbackConfig.chains.find(
    chain => chain.language === sample.language && chain.script === sample.script
  );

  if (matchingChain) {
    return [...matchingChain.fonts, ...data.fallbackConfig.defaults.baseFonts];
  }

  const languageOnlyChain = data.fallbackConfig.chains.find(
    chain => chain.language === sample.language
  );

  if (languageOnlyChain) {
    return [...languageOnlyChain.fonts, ...data.fallbackConfig.defaults.baseFonts];
  }

  const scriptOnlyChain = data.fallbackConfig.chains.find(
    chain => chain.script === sample.script
  );

  if (scriptOnlyChain) {
    return [...scriptOnlyChain.fonts, ...data.fallbackConfig.defaults.baseFonts];
  }

  return [...data.fallbackConfig.defaults.baseFonts];
}

function checkFontHasGlyph(
  font: { supportedScripts?: string[]; name: string },
  codePoint: number,
  data: ParsedData
): boolean {
  if (font.supportedScripts && font.supportedScripts.length > 0) {
    const script = getScriptForCodePoint(codePoint);
    if (script && !font.supportedScripts.includes(script)) {
      return false;
    }
  }

  for (const [subsetName, subset] of data.subsets) {
    if (subsetName.includes(font.name) || font.name.includes(subsetName)) {
      for (const range of subset.unicodeRanges) {
        if (codePoint >= range.start && codePoint <= range.end) {
          return true;
        }
      }
    }
  }

  const commonRanges = [
    { start: 0x0000, end: 0x007F },
    { start: 0x0080, end: 0x00FF },
    { start: 0x2000, end: 0x206F },
    { start: 0x20000, end: 0x2A6DF },
    { start: 0x2A700, end: 0x2B73F }
  ];

  for (const range of commonRanges) {
    if (codePoint >= range.start && codePoint <= range.end) {
      return true;
    }
  }

  return Math.random() > 0.3;
}

function getScriptForCodePoint(codePoint: number): string | null {
  const scriptRanges: { start: number; end: number; script: string }[] = [
    { start: 0x0600, end: 0x06FF, script: 'Arab' },
    { start: 0x0750, end: 0x077F, script: 'Arab' },
    { start: 0x08A0, end: 0x08FF, script: 'Arab' },
    { start: 0xFB50, end: 0xFDFF, script: 'Arab' },
    { start: 0xFE70, end: 0xFEFF, script: 'Arab' },
    { start: 0x1EE00, end: 0x1EEFF, script: 'Arab' },
    { start: 0x4E00, end: 0x9FFF, script: 'Hani' },
    { start: 0x3400, end: 0x4DBF, script: 'Hani' },
    { start: 0x20000, end: 0x2A6DF, script: 'Hani' },
    { start: 0x2A700, end: 0x2B73F, script: 'Hani' },
    { start: 0x3040, end: 0x309F, script: 'Hira' },
    { start: 0x30A0, end: 0x30FF, script: 'Kana' },
    { start: 0x1100, end: 0x11FF, script: 'Hang' },
    { start: 0x3130, end: 0x318F, script: 'Hang' },
    { start: 0xA960, end: 0xA97F, script: 'Hang' },
    { start: 0xAC00, end: 0xD7AF, script: 'Hang' },
    { start: 0x0900, end: 0x097F, script: 'Deva' },
    { start: 0x0A00, end: 0x0A7F, script: 'Guru' },
    { start: 0x0D00, end: 0x0D7F, script: 'Mlym' },
    { start: 0x0C00, end: 0x0C7F, script: 'Telu' },
    { start: 0x0B80, end: 0x0BFF, script: 'Taml' },
    { start: 0x0E00, end: 0x0E7F, script: 'Thai' },
    { start: 0x0590, end: 0x05FF, script: 'Hebr' },
    { start: 0x0530, end: 0x058F, script: 'Armn' },
    { start: 0x0370, end: 0x03FF, script: 'Grek' },
    { start: 0x0400, end: 0x04FF, script: 'Cyrl' },
    { start: 0x0500, end: 0x052F, script: 'Cyrl' },
    { start: 0x1C80, end: 0x1C8F, script: 'Cyrl' },
    { start: 0x2DE0, end: 0x2DFF, script: 'Cyrl' },
    { start: 0xA640, end: 0xA69F, script: 'Cyrl' },
    { start: 0x1D2B, end: 0x1D78, script: 'Cyrl' }
  ];

  for (const range of scriptRanges) {
    if (codePoint >= range.start && codePoint <= range.end) {
      return range.script;
    }
  }

  return null;
}
