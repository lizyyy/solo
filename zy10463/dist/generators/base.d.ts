export declare abstract class BaseGenerator {
    protected schema: Record<string, unknown>;
    protected seed: number;
    protected random: () => number;
    constructor(schema: Record<string, unknown>, seed: number);
    protected generateValid(): unknown;
    protected getPropertyAtPath(obj: Record<string, unknown>, path: string): {
        parent: Record<string, unknown>;
        key: string;
        value: unknown;
    } | null;
    protected setPropertyAtPath(obj: Record<string, unknown>, path: string, value: unknown): void;
    abstract generate(index: number, fieldPath?: string): {
        data: unknown;
        reason: string;
    };
}
