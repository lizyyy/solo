import { BaseGenerator } from './base';

export class ValidGenerator extends BaseGenerator {
  generate(index: number): { data: unknown; reason: string } {
    this.random = this.createSeededRandom(this.seed + index);
    const data = this.generateValid();
    return {
      data,
      reason: `正常样本 #${index + 1} - 通过Schema验证`
    };
  }

  private createSeededRandom(seed: number): () => number {
    let s = seed;
    return function (): number {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }
}
