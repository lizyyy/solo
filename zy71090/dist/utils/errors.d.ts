export declare class CLIError extends Error {
    exitCode: number;
    constructor(message: string, exitCode?: number);
}
export declare class ValidationError extends CLIError {
    constructor(message: string);
}
export declare class FileNotFoundError extends CLIError {
    constructor(filePath: string);
}
export declare class ParseError extends CLIError {
    constructor(message: string);
}
export declare class AnalysisError extends CLIError {
    constructor(message: string);
}
export declare function formatErrorMessage(error: unknown, verbose?: boolean): string;
