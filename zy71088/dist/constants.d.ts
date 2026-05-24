import { ProgrammingLanguage } from './types';
export declare const VERSION = "1.0.0";
export declare const EXIT_CODES: {
    readonly SUCCESS: 0;
    readonly VALIDATION_ERROR: 1;
    readonly SCAN_ERROR: 2;
    readonly FILE_ERROR: 3;
    readonly SELF_CHECK_FAILED: 4;
    readonly FLAGS_WITH_HIGH_RISK: 5;
};
export declare const LANGUAGE_EXTENSIONS: Record<ProgrammingLanguage, string[]>;
export declare const LANGUAGE_PATTERNS: Record<ProgrammingLanguage, {
    flagChecks: RegExp[];
    negationWords: string[];
}>;
export declare const RISK_LEVEL_WEIGHTS: Record<string, number>;
export declare const DEFAULT_EXCLUDE_PATTERNS: string[];
export declare const DEFAULT_OUTPUT_DIR = "./flag-cleaner-output";
export declare const RISK_REASONS: {
    readonly DYNAMIC_NAME: "使用了动态 flag 名称，可能影响其他功能";
    readonly DEFAULT_VALUE_INVERTED: "默认值被反转，需要仔细检查逻辑";
    readonly HIGH_OCCURRENCE: "出现次数过多（>20次），改动影响范围大";
    readonly MULTIPLE_FILES: "涉及多个文件（>5个），需要协调修改";
    readonly NEGATED_USAGE: "存在否定形式的使用，清理时需注意逻辑反转";
    readonly ACTIVE_EXPERIMENT: "实验仍在进行中，不建议清理";
    readonly UNKNOWN_STATUS: "实验状态未知，需确认后再操作";
    readonly COMPLEX_LOGIC: "存在复杂的条件组合逻辑";
};
