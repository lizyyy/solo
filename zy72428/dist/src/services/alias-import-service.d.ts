import { TrackAlias, ImportResult, MaterialSource } from '../types';
export interface AliasImportInput {
    canonicalName: string;
    aliases: string[];
    copyrightHolder: string;
    source: MaterialSource;
}
export declare class AliasImportService {
    importAliases(inputs: AliasImportInput[]): ImportResult<TrackAlias>;
    updateAlias(id: string, updates: Partial<AliasImportInput>): TrackAlias | undefined;
}
export declare const aliasImportService: AliasImportService;
