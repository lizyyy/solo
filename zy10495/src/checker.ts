import {
  TranslationEntry,
  PlaceholderCheckResult,
  CheckReport,
  CLIOptions,
} from './types.js';
import {
  extractPlaceholders,
  comparePlaceholders,
  generateFixSuggestion,
} from './placeholder-extractor.js';
import {
  findTranslationFiles,
  loadTranslations,
  extractLanguageFromFilename,
  ensureOutputDir,
} from './file-reader.js';
import path from 'path';

export async function runCheck(options: CLIOptions): Promise<CheckReport> {
  await ensureOutputDir(options.outputDir);

  const sourcePath = path.resolve(options.source);
  const sourceEntries = await loadTranslations(sourcePath, options.sourceLang);

  const cwd = path.dirname(sourcePath);
  const allFiles = await findTranslationFiles(options.pattern, cwd);

  const targetFiles = allFiles.filter((f) => f !== sourcePath);

  const targetEntriesMap = new Map<string, TranslationEntry[]>();
  const filesProcessed: string[] = [sourcePath];

  for (const file of targetFiles) {
    let lang = extractLanguageFromFilename(file);

    if (options.targetLangs && options.targetLangs.length > 0) {
      if (!lang || !options.targetLangs.includes(lang)) {
        continue;
      }
    }

    if (!lang) {
      lang = path.basename(file, path.extname(file));
    }

    const entries = await loadTranslations(file, lang);
    targetEntriesMap.set(file, entries);
    filesProcessed.push(file);
  }

  const results: PlaceholderCheckResult[] = [];
  const sourceMap = new Map(sourceEntries.map((e) => [e.key, e]));

  for (const [filePath, targetEntries] of targetEntriesMap) {
    for (const targetEntry of targetEntries) {
      const sourceEntry = sourceMap.get(targetEntry.key);
      if (!sourceEntry) continue;

      const sourcePlaceholders = extractPlaceholders(sourceEntry.value);
      const targetPlaceholders = extractPlaceholders(targetEntry.value);

      const { missing, extra } = comparePlaceholders(
        sourcePlaceholders,
        targetPlaceholders
      );

      if (missing.length > 0 || extra.length > 0) {
        const hasErrors = missing.length > 0;
        const suggestion =
          missing.length > 0
            ? generateFixSuggestion(sourceEntry.value, targetEntry.value, missing)
            : undefined;

        results.push({
          key: targetEntry.key,
          sourceLanguage: options.sourceLang,
          targetLanguage: targetEntry.language,
          sourceText: sourceEntry.value,
          targetText: targetEntry.value,
          sourcePlaceholders,
          targetPlaceholders,
          missingPlaceholders: missing,
          extraPlaceholders: extra,
          filePath,
          lineNumber: targetEntry.lineNumber,
          severity: hasErrors ? 'error' : 'warning',
          suggestion,
        });
      }
    }
  }

  const errors = results.filter((r) => r.severity === 'error').length;
  const warnings = results.filter((r) => r.severity === 'warning').length;

  const targetLanguages = Array.from(
    new Set(results.map((r) => r.targetLanguage))
  );

  return {
    summary: {
      totalKeys: sourceEntries.length,
      checkedKeys: sourceEntries.length,
      errors,
      warnings,
      passed: sourceEntries.length - errors,
    },
    results,
    metadata: {
      sourceLanguage: options.sourceLang,
      targetLanguages,
      checkedAt: new Date().toISOString(),
      filesProcessed,
    },
  };
}

export function getExitCode(
  report: CheckReport,
  failOnError: boolean
): number {
  if (failOnError && report.summary.errors > 0) {
    return 1;
  }
  return 0;
}
