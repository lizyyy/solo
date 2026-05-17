import { Placeholder } from './types.js';
export declare function extractPlaceholders(text: string): Placeholder[];
export declare function comparePlaceholders(source: Placeholder[], target: Placeholder[]): {
    missing: Placeholder[];
    extra: Placeholder[];
};
export declare function generateFixSuggestion(sourceText: string, targetText: string, missing: Placeholder[]): string;
