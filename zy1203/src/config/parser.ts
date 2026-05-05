import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SimulationConfig, ProducerConfig, ConsumerGroupConfig, TopicConfig } from '../types';

export async function parsePlan(filePath: string): Promise<SimulationConfig> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`队列计划文件不存在: ${filePath}`);
  }
  
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const config = yaml.load(content) as SimulationConfig;
  
  return validatePlanConfig(config);
}

export async function parseProducers(filePath: string): Promise<ProducerConfig[]> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`生产者配置文件不存在: ${filePath}`);
  }
  
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  const producers: ProducerConfig[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    try {
      const producer = JSON.parse(lines[i]) as ProducerConfig;
      producers.push(validateProducerConfig(producer, i + 1));
    } catch (error) {
      throw new Error(`生产者配置第 ${i + 1} 行解析失败: ${(error as Error).message}`);
    }
  }
  
  if (producers.length === 0) {
    throw new Error('生产者配置文件为空');
  }
  
  return producers;
}

export async function parseConsumers(filePath: string): Promise<ConsumerGroupConfig[]> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`消费者配置文件不存在: ${filePath}`);
  }
  
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const config = yaml.load(content) as { consumerGroups: ConsumerGroupConfig[] };
  
  if (!config.consumerGroups || !Array.isArray(config.consumerGroups)) {
    throw new Error('消费者配置必须包含 consumerGroups 数组');
  }
  
  return config.consumerGroups.map((cg, idx) => validateConsumerGroupConfig(cg, idx + 1));
}

function validatePlanConfig(config: SimulationConfig): SimulationConfig {
  const errors: string[] = [];
  
  if (!config.global) {
    errors.push('缺少 global 配置');
  } else {
    if (!config.global.simulation) {
      errors.push('缺少 global.simulation 配置');
    } else {
      if (typeof config.global.simulation.duration !== 'number' || config.global.simulation.duration <= 0) {
        errors.push('global.simulation.duration 必须是正整数');
      }
      if (typeof config.global.simulation.stepInterval !== 'number' || config.global.simulation.stepInterval <= 0) {
        errors.push('global.simulation.stepInterval 必须是正整数');
      }
    }
  }
  
  if (!config.topics || !Array.isArray(config.topics)) {
    errors.push('缺少 topics 配置数组');
  } else {
    config.topics.forEach((topic: TopicConfig, idx: number) => {
      if (!topic.name || typeof topic.name !== 'string') {
        errors.push(`topics[${idx}].name 必须是非空字符串`);
      }
      if (typeof topic.partitions !== 'number' || topic.partitions <= 0) {
        errors.push(`topics[${idx}].partitions 必须是正整数`);
      }
      if (typeof topic.retention !== 'number' || topic.retention <= 0) {
        errors.push(`topics[${idx}].retention 必须是正整数`);
      }
    });
  }
  
  if (errors.length > 0) {
    throw new Error('队列计划配置错误: ' + errors.join('; '));
  }
  
  return config;
}

function validateProducerConfig(producer: ProducerConfig, lineNum: number): ProducerConfig {
  const errors: string[] = [];
  
  if (!producer.topic || typeof producer.topic !== 'string') {
    errors.push('topic 必须是非空字符串');
  }
  if (typeof producer.rate !== 'number' || producer.rate < 0) {
    errors.push('rate 必须是非负整数');
  }
  if (typeof producer.burstRate !== 'number' || producer.burstRate < producer.rate) {
    errors.push('burstRate 必须大于等于 rate');
  }
  if (typeof producer.startTime !== 'number' || producer.startTime < 0) {
    errors.push('startTime 必须是非负整数');
  }
  if (typeof producer.duration !== 'number' || producer.duration <= 0) {
    errors.push('duration 必须是正整数');
  }
  if (!producer.sequentialKeyField || typeof producer.sequentialKeyField !== 'string') {
    errors.push('sequentialKeyField 必须是非空字符串');
  }
  if (!producer.idempotentKeyField || typeof producer.idempotentKeyField !== 'string') {
    errors.push('idempotentKeyField 必须是非空字符串');
  }
  
  if (errors.length > 0) {
    throw new Error(`第 ${lineNum} 行: ` + errors.join('; '));
  }
  
  return {
    ...producer,
    duplicateProbability: producer.duplicateProbability ?? 0.01,
  };
}

function validateConsumerGroupConfig(cg: ConsumerGroupConfig, idx: number): ConsumerGroupConfig {
  const errors: string[] = [];
  const prefix = `consumerGroups[${idx}]`;
  
  if (!cg.name || typeof cg.name !== 'string') {
    errors.push(`${prefix}.name 必须是非空字符串`);
  }
  if (!cg.topics || !Array.isArray(cg.topics) || cg.topics.length === 0) {
    errors.push(`${prefix}.topics 必须是非空数组`);
  }
  if (typeof cg.consumers !== 'number' || cg.consumers <= 0) {
    errors.push(`${prefix}.consumers 必须是正整数`);
  }
  if (typeof cg.consumeRate !== 'number' || cg.consumeRate <= 0) {
    errors.push(`${prefix}.consumeRate 必须是正整数`);
  }
  if (typeof cg.maxConsumeRate !== 'number' || cg.maxConsumeRate < cg.consumeRate) {
    errors.push(`${prefix}.maxConsumeRate 必须大于等于 consumeRate`);
  }
  
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
  
  return cg;
}

export function validateConfig(
  plan: SimulationConfig,
  producers: ProducerConfig[],
  consumers: ConsumerGroupConfig[]
): string[] {
  const errors: string[] = [];
  
  const topicNames = new Set(plan.topics.map(t => t.name));
  
  producers.forEach((producer, idx) => {
    if (!topicNames.has(producer.topic)) {
      errors.push(`生产者 ${idx + 1}: topic "${producer.topic}" 未在 queue-plan.yaml 中定义`);
    }
  });
  
  consumers.forEach((cg, cgIdx) => {
    cg.topics.forEach((topic, tIdx) => {
      if (!topicNames.has(topic)) {
        errors.push(`消费者组 ${cg.name}: topic "${topic}" 未在 queue-plan.yaml 中定义`);
      }
    });
    
    const topicConfig = plan.topics.find(t => cg.topics.includes(t.name));
    if (topicConfig && cg.consumers > topicConfig.partitions) {
      errors.push(`消费者组 ${cg.name}: 消费者数量(${cg.consumers})不能大于分区数量(${topicConfig.partitions})`);
    }
  });
  
  const totalDuration = plan.global.simulation.duration;
  producers.forEach((producer, idx) => {
    if (producer.startTime + producer.duration > totalDuration) {
      errors.push(`生产者 ${idx + 1}: 生产周期(${producer.startTime}s - ${producer.startTime + producer.duration}s)超出模拟时长(${totalDuration}s)`);
    }
  });
  
  return errors;
}
