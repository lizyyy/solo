import * as fs from 'fs';
import * as path from 'path';
import { generateSeedData } from '../seed/generator';

export interface InitOptions {
  seed?: string;
}

export default async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  
  const seedValue = options.seed ? parseInt(options.seed, 10) : Date.now();
  
  const seedData = generateSeedData(seedValue);
  
  const planPath = path.join(cwd, 'queue-plan.yaml');
  const producersPath = path.join(cwd, 'producers.jsonl');
  const consumersPath = path.join(cwd, 'consumers.yaml');
  
  if (fs.existsSync(planPath) || fs.existsSync(producersPath) || fs.existsSync(consumersPath)) {
    throw new Error('配置文件已存在，请先删除或使用其他目录');
  }
  
  fs.writeFileSync(planPath, seedData.planYaml, 'utf-8');
  console.log(`  ✓ 已创建: queue-plan.yaml`);
  
  fs.writeFileSync(producersPath, seedData.producersJsonl, 'utf-8');
  console.log(`  ✓ 已创建: producers.jsonl`);
  
  fs.writeFileSync(consumersPath, seedData.consumersYaml, 'utf-8');
  console.log(`  ✓ 已创建: consumers.yaml`);
  
  console.log(`\n  种子值: ${seedValue}`);
  console.log(`  样例场景: ${seedData.scenario}`);
}
