export declare function getAppealDir(): string;
export declare function getDataDir(): string;
export declare function getReportsDir(): string;
export declare const CONFIG: {
    MERCHANT_PREPARE_TIMEOUT_THRESHOLD: number;
    WEATHER_AFFECTED_WINDOW_BEFORE: number;
    WEATHER_AFFECTED_WINDOW_AFTER: number;
    TRAJECTORY_GAP_THRESHOLD: number;
    MAX_ALLOWED_DELAY_RATIO: number;
    MIN_TRAJECTORY_POINTS: number;
    APPEAL_TYPES: readonly ["timeout", "bad_review", "cancellation"];
    WEATHER_TYPES: readonly ["sunny", "rain", "heavy_rain", "storm", "fog", "snow"];
    BAD_WEATHER_TYPES: readonly ["heavy_rain", "storm", "heavy_snow"];
};
//# sourceMappingURL=config.d.ts.map