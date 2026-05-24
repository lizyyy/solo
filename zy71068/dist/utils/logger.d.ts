export declare const logger: {
    info: (message: string) => void;
    success: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    debug: (message: string, verbose?: boolean) => void;
    section: (title: string) => void;
    empty: () => void;
};
export declare const riskColor: (level: string) => import("chalk").ChalkInstance;
