import { DictSource, DiffResult } from './types';
export declare class DictionaryComparator {
    compare(sources: DictSource[]): DiffResult;
    private getAllFieldNames;
    private countCommonFields;
    private compareField;
    private determineEnumLevel;
}
