export * from './types';
export * from './parsers';
export * from './rules';
export * from './storage';
export * from './exporters';
export * from './samples';

import { TemperatureParser, DoorParser, VaccineParser } from './parsers';
import { RuleEngine } from './rules';
import { SessionStorage, createSession } from './storage';
import { MarkdownExporter, CSVExporter, JSONExporter } from './exporters';
import {
  generateSampleTemperatureRecords,
  generateSampleDoorRecords,
  generateSampleVaccineBatches,
} from './samples';

export async function runDemoAnalysis(): Promise<void> {
  console.log('🧪 开始演示分析...\n');

  const tempRecords = generateSampleTemperatureRecords();
  const doorRecords = generateSampleDoorRecords();
  const vaccineBatches = generateSampleVaccineBatches();

  console.log('📊 数据统计:');
  console.log(`  - 温度记录: ${tempRecords.length} 条`);
  console.log(`  - 开门记录: ${doorRecords.length} 条`);
  console.log(`  - 疫苗批次: ${vaccineBatches.length} 个\n`);

  console.log('🔍 运行规则引擎分析...\n');
  const ruleEngine = new RuleEngine();
  const analysis = ruleEngine.analyze(tempRecords, doorRecords, vaccineBatches);

  console.log('📋 分析概要:');
  console.log(`  总记录数: ${analysis.summary.totalRecords}`);
  console.log(`  异常事件: ${analysis.summary.totalAnomalies} 个`);
  console.log(`  风险片段: ${analysis.summary.totalRiskFragments} 个\n`);

  console.log('✅ 分析完成！');
}

export {
  TemperatureParser,
  DoorParser,
  VaccineParser,
  RuleEngine,
  SessionStorage,
  createSession,
  MarkdownExporter,
  CSVExporter,
  JSONExporter,
};
