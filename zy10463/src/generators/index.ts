import * as path from 'path';
import { GeneratedSample, GeneratorOptions, GenerationSummary, SampleType } from '../types';
import { readJsonFile, writeJsonFile, generateId, ensureDir } from '../utils/helpers';
import { validator } from '../utils/validator';
import { ValidGenerator } from './valid';
import { BoundaryGenerator } from './boundary';
import { InvalidGenerator } from './invalid';

export class SampleGenerator {
  private options: GeneratorOptions;
  private schema: Record<string, unknown>;
  private samples: GeneratedSample[] = [];
  private errors: string[] = [];
  private startTime: number = 0;

  constructor(options: GeneratorOptions) {
    this.options = options;
    this.schema = readJsonFile(options.schemaPath);
    this.validateSchema();
  }

  private validateSchema(): void {
    if (!validator.isValidSchema(this.schema)) {
      throw new Error(`无效的JSON Schema: ${this.options.schemaPath}`);
    }
  }

  async generate(): Promise<GenerationSummary> {
    this.startTime = Date.now();
    this.samples = [];
    this.errors = [];

    for (const sampleType of this.options.sampleTypes) {
      await this.generateSamplesByType(sampleType);
    }

    const summary = this.buildSummary();
    await this.exportSamples();
    return summary;
  }

  private async generateSamplesByType(type: SampleType): Promise<void> {
    const generator = this.createGenerator(type);

    for (let i = 0; i < this.options.countPerType; i++) {
      try {
        const targetField = this.options.fields?.[i % this.options.fields.length];
        const result = generator.generate(i, targetField);
        const validationResult = validator.validate(this.schema, result.data);

        this.samples.push({
          metadata: {
            id: generateId(this.options.seed, i, type),
            type,
            schemaPath: this.options.schemaPath,
            fieldPath: targetField || '',
            reason: result.reason,
            index: i,
            seed: this.options.seed + i
          },
          data: result.data,
          validationResult
        });
      } catch (error) {
        this.errors.push(`生成${type}样本#${i}失败: ${(error as Error).message}`);
      }
    }
  }

  private createGenerator(type: SampleType): ValidGenerator | BoundaryGenerator | InvalidGenerator {
    switch (type) {
      case 'valid':
        return new ValidGenerator(this.schema, this.options.seed);
      case 'boundary':
        return new BoundaryGenerator(this.schema, this.options.seed);
      case 'invalid':
        return new InvalidGenerator(this.schema, this.options.seed);
      default:
        throw new Error(`未知的样本类型: ${type}`);
    }
  }

  private async exportSamples(): Promise<void> {
    const outputDir = this.options.outputDir;
    ensureDir(outputDir);

    for (const sample of this.samples) {
      const typeDir = path.join(outputDir, sample.metadata.type);
      ensureDir(typeDir);

      const fileName = `${sample.metadata.type}_${sample.metadata.id}.json`;
      const filePath = path.join(typeDir, fileName);

      writeJsonFile(filePath, {
        metadata: sample.metadata,
        data: sample.data,
        validation: sample.validationResult
      });
    }

    const index = {
      generatedAt: new Date().toISOString(),
      schema: this.options.schemaPath,
      options: this.options,
      total: this.samples.length,
      samples: this.samples.map(s => ({
        id: s.metadata.id,
        type: s.metadata.type,
        file: `${s.metadata.type}/${s.metadata.type}_${s.metadata.id}.json`,
        isValid: s.validationResult.isValid,
        reason: s.metadata.reason
      }))
    };

    writeJsonFile(path.join(outputDir, 'index.json'), index);
  }

  private buildSummary(): GenerationSummary {
    return {
      totalSamples: this.samples.length,
      validCount: this.samples.filter(s => s.metadata.type === 'valid').length,
      boundaryCount: this.samples.filter(s => s.metadata.type === 'boundary').length,
      invalidCount: this.samples.filter(s => s.metadata.type === 'invalid').length,
      errors: this.errors,
      outputPath: this.options.outputDir,
      duration: Date.now() - this.startTime
    };
  }

  getSamples(): GeneratedSample[] {
    return this.samples;
  }

  getSchema(): Record<string, unknown> {
    return this.schema;
  }
}
