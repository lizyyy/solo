import { SimulationConfig, ProducerConfig, ConsumerGroupConfig, SimulationResult } from '../types';
import { parsePlan, parseProducers, parseConsumers, validateConfig } from '../config/parser';
import { SimulationEngine } from '../simulation/engine';
import { SQLiteStore } from '../store/sqlite';

export interface SimulateOptions {
  plan: string;
  producers: string;
  consumers: string;
  seed?: string;
  db: string;
}

export default async function simulateCommand(options: SimulateOptions): Promise<SimulationResult> {
  const plan: SimulationConfig = await parsePlan(options.plan);
  const producers: ProducerConfig[] = await parseProducers(options.producers);
  const consumers: ConsumerGroupConfig[] = await parseConsumers(options.consumers);
  
  const validationErrors = validateConfig(plan, producers, consumers);
  if (validationErrors.length > 0) {
    console.error('\n配置错误:');
    validationErrors.forEach((err, idx) => {
      console.error(`  ${idx + 1}. ${err}`);
    });
    throw new Error(`发现 ${validationErrors.length} 个配置错误`);
  }
  
  const seedValue = options.seed 
    ? parseInt(options.seed, 10) 
    : (plan.global.simulation.seed ?? Date.now());
  
  const store = new SQLiteStore(options.db);
  
  const engine = new SimulationEngine({
    plan,
    producers,
    consumers,
    seed: seedValue,
  });
  
  const result = await engine.run();
  
  await store.saveSimulationResult(result);
  
  return result;
}
