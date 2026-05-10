export declare const logger: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
    heading: (message: string) => void;
    bullet: (message: string) => void;
    line: () => void;
    table: (headers: string[], rows: any[][]) => void;
    json: (data: any, indent?: number) => void;
};
