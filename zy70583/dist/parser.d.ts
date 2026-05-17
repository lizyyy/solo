import { Alert, Rule, Silence, ParseError } from './types';
export declare class DataParser {
    private errors;
    getParseErrors(): ParseError[];
    clearErrors(): void;
    private addError;
    parseAlerts(filePath: string): Alert[];
    parseRules(filePath: string): Rule[];
    parseSilences(filePath: string): Silence[];
    private readFile;
    private parseAlertsJson;
    private parseAlertsCsv;
    private parseRulesJson;
    private parseRulesCsv;
    private parseSilencesJson;
    private parseSilencesCsv;
    private validateAlert;
    private validateRule;
    private validateSilence;
    private parseTimestamp;
    private parseJsonField;
}
