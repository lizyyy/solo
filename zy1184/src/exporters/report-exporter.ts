import {
  AnalysisResult,
  SimulationResult,
} from '../models';

import { exportMarkdown } from './markdown-exporter';
import { exportJson } from './json-exporter';
import { exportCsv, exportSummaryCsv } from './csv-exporter';

interface ExportOptions {
  includeSql?: boolean;
  includeSuggestions?: boolean;
  format?: 'markdown' | 'json' | 'csv';
}

export function exportReport(
  analysisResults: AnalysisResult[],
  simulationResults?: SimulationResult[],
  options: ExportOptions = {}
): string {
  const { format = 'markdown', includeSql = false, includeSuggestions = true } = options;

  const exportOpts = { includeSql, includeSuggestions };

  switch (format) {
    case 'markdown':
      return exportMarkdown(analysisResults, simulationResults, exportOpts);
    case 'json':
      return exportJson(analysisResults, simulationResults, exportOpts);
    case 'csv':
      return exportCsv(analysisResults, exportOpts);
    default:
      throw new Error(`不支持的导出格式: ${format}`);
  }
}

export function exportReportsBatch(
  analysisResults: AnalysisResult[],
  simulationResults?: SimulationResult[],
  options: ExportOptions & { formats?: ('markdown' | 'json' | 'csv')[] } = {}
): Record<string, string> {
  const { formats = ['markdown'], includeSql = false, includeSuggestions = true } = options;
  const results: Record<string, string> = {};

  const exportOpts = { includeSql, includeSuggestions };

  if (formats.includes('markdown')) {
    results.markdown = exportMarkdown(analysisResults, simulationResults, exportOpts);
  }

  if (formats.includes('json')) {
    results.json = exportJson(analysisResults, simulationResults, exportOpts);
  }

  if (formats.includes('csv')) {
    results.csv = exportCsv(analysisResults, exportOpts);
    results.summaryCsv = exportSummaryCsv(analysisResults);
  }

  return results;
}

export {
  exportMarkdown,
  exportJson,
  exportCsv,
  exportSummaryCsv,
};
