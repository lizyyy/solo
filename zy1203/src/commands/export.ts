import * as path from 'path';
import { SQLiteStore } from '../store/sqlite';
import { Analyzer } from '../analysis/analyzer';
import { Recommender } from '../analysis/recommender';
import { exportToMarkdown } from '../export/markdown';
import { exportToJson } from '../export/json';

export interface ExportOptions {
  runId?: string;
  db: string;
  format: string;
  output?: string;
}

export default async function exportCommand(options: ExportOptions): Promise<string> {
  const store = new SQLiteStore(options.db);
  
  const result = options.runId
    ? await store.getSimulationResult(options.runId)
    : await store.getLatestSimulationResult();
  
  if (!result) {
    throw new Error('未找到模拟结果，请先运行 mq-stress simulate');
  }
  
  const analyzer = new Analyzer(result);
  const analysis = analyzer.analyze();
  
  const recommender = new Recommender(result, analysis);
  const recommendations = recommender.generate();
  
  let defaultOutput: string;
  if (options.format === 'json') {
    defaultOutput = `report-${result.runId}.json`;
  } else {
    defaultOutput = `report-${result.runId}.md`;
  }
  
  const outputPath = options.output 
    ? (path.isAbsolute(options.output) ? options.output : path.join(process.cwd(), options.output))
    : path.join(process.cwd(), defaultOutput);
  
  if (options.format === 'json') {
    await exportToJson(result, analysis, recommendations, outputPath);
  } else {
    await exportToMarkdown(result, analysis, recommendations, outputPath);
  }
  
  return outputPath;
}
