import { BaseGenerator } from './base';
export declare class ValidGenerator extends BaseGenerator {
    generate(index: number): {
        data: unknown;
        reason: string;
    };
    private createSeededRandom;
}
