import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';
import { FontReport, GlyphCheckResult } from '../types';
import { codePointToHex } from '../utils/unicode';

export function generateMissingGlyphsCsv(report: FontReport, outputDir: string): string {
  const missingGlyphs = report.glyphChecks.issues.filter(i => i.isMissing);

  const records = missingGlyphs.map(glyph => ({
    'Sample ID': glyph.sampleId,
    'Language': glyph.language,
    'Script': glyph.script,
    'Character': glyph.char,
    'Code Point': codePointToHex(glyph.codePoint),
    'Decimal': glyph.codePoint,
    'Sample Text': glyph.sampleText,
    'Fallback Chain': glyph.fallbackChain.join(' → '),
    'Missing In Fonts': glyph.missingInFonts.join(', ')
  }));

  const csvContent = stringify(records, {
    header: true,
    quoted: true,
    quoted_string: true
  });

  const outputPath = path.join(outputDir, 'missing_glyphs.csv');
  ensureDirectory(outputDir);
  fs.writeFileSync(outputPath, csvContent, 'utf-8');

  return outputPath;
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
