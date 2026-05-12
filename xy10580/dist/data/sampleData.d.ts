interface SampleScenario {
    name: string;
    description: string;
    orders: any[];
    trajectories: any[];
    merchantMeals: any[];
    weatherEvents: any[];
    penalties: any[];
    appeals: any[];
}
export declare const sampleScenarios: SampleScenario[];
export declare function getAllSampleData(): {
    orders: any[];
    trajectories: any[];
    merchantMeals: any[];
    weatherEvents: any[];
    penalties: any[];
    appeals: any[];
    scenarios: SampleScenario[];
};
export {};
//# sourceMappingURL=sampleData.d.ts.map