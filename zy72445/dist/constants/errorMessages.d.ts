export declare const errorMessages: Record<string, {
    message: string;
    suggestion: string;
}>;
export declare function getHumanReadableError(errorCode: string, fieldName?: string): {
    message: string;
    suggestion: string;
    fieldName?: string;
};
