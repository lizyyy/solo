import 'reflect-metadata';
export declare const sampleUsers: {
    admin: {
        id: string;
        name: string;
    };
    zhangsan: {
        id: string;
        name: string;
    };
    lisi: {
        id: string;
        name: string;
    };
    wangwu: {
        id: string;
        name: string;
    };
    zhaoliu: {
        id: string;
        name: string;
    };
};
declare function seedNormalScenario(): Promise<void>;
declare function seedBatchScenario(): Promise<void>;
declare function seedDelayScenario(): Promise<void>;
declare function seedRiskScenario(): Promise<void>;
declare function seedExceptionScenarios(): Promise<void>;
declare function seedManualOverrideScenario(): Promise<void>;
declare function seedAll(): Promise<void>;
export { seedAll, seedNormalScenario, seedBatchScenario, seedDelayScenario, seedRiskScenario, seedExceptionScenarios, seedManualOverrideScenario };
