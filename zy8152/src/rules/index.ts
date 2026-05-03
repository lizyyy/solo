import { ParsedData, FontReport, ValidationError } from '../types';
import { checkMissingGlyphs } from './glyphChecker';
import { checkEmojiRisks } from './emojiChecker';
import { checkArabicDirectionalityRisks } from './arabicChecker';
import { checkVariableAxisRanges } from './variableAxisChecker';
import { checkUnusedSubsets } from './subsetChecker';

export function runAllRules(
  data: ParsedData,
  validationErrors: ValidationError[] = []
): FontReport {
  const glyphChecks = checkMissingGlyphs(data);
  const emojiChecks = checkEmojiRisks(data);
  const arabicChecks = checkArabicDirectionalityRisks(data);
  const variableAxisChecks = checkVariableAxisRanges(data);
  const subsetChecks = checkUnusedSubsets(data);

  const allRuleResults = [glyphChecks, emojiChecks, arabicChecks, variableAxisChecks, subsetChecks];
  const passedRules = allRuleResults.filter(r => r.passed).length;
  const failedRules = allRuleResults.filter(r => !r.passed).length;

  const missingGlyphsCount = glyphChecks.issues.filter(i => i.isMissing).length;

  return {
    summary: {
      totalSamples: data.samples.length,
      totalFonts: data.fonts.size,
      totalSubsets: data.subsets.size,
      passedRules,
      failedRules,
      missingGlyphsCount,
      emojiRisksCount: emojiChecks.issues.length,
      arabicRisksCount: arabicChecks.issues.length,
      variableAxisIssuesCount: variableAxisChecks.issues.length,
      unusedSubsetsCount: subsetChecks.issues.length
    },
    glyphChecks,
    emojiChecks,
    arabicChecks,
    variableAxisChecks,
    subsetChecks,
    validationErrors
  };
}

export {
  checkMissingGlyphs,
  checkEmojiRisks,
  checkArabicDirectionalityRisks,
  checkVariableAxisRanges,
  checkUnusedSubsets
};
