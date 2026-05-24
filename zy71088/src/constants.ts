import { ProgrammingLanguage } from './types';

export const VERSION = '1.0.0';

export const EXIT_CODES = {
  SUCCESS: 0,
  VALIDATION_ERROR: 1,
  SCAN_ERROR: 2,
  FILE_ERROR: 3,
  SELF_CHECK_FAILED: 4,
  FLAGS_WITH_HIGH_RISK: 5,
} as const;

export const LANGUAGE_EXTENSIONS: Record<ProgrammingLanguage, string[]> = {
  typescript: ['.ts', '.tsx'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py'],
  go: ['.go'],
  java: ['.java'],
  kotlin: ['.kt', '.kts'],
  swift: ['.swift'],
  rust: ['.rs'],
  other: [],
};

export const LANGUAGE_PATTERNS: Record<ProgrammingLanguage, { flagChecks: RegExp[]; negationWords: string[] }> = {
  typescript: {
    flagChecks: [
      /(?:isEnabled|isActive|getFlag|featureEnabled|isFeatureEnabled)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /(?:featureFlags|flags)\s*\.\s*(\w+)/g,
      /(?:if|unless|while|&&|\|\|)\s*\(\s*([a-zA-Z_$][\w$]*)\s*(?:===|!==|==|!=)?\s*(?:true|false)?\s*\)/g,
    ],
    negationWords: ['!', 'not', 'isNot'],
  },
  javascript: {
    flagChecks: [
      /(?:isEnabled|isActive|getFlag|featureEnabled|isFeatureEnabled)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /(?:featureFlags|flags)\s*\.\s*(\w+)/g,
      /(?:if|unless|while|&&|\|\|)\s*\(\s*([a-zA-Z_$][\w$]*)\s*(?:===|!==|==|!=)?\s*(?:true|false)?\s*\)/g,
    ],
    negationWords: ['!', 'not', 'isNot'],
  },
  python: {
    flagChecks: [
      /(?:is_enabled|is_active|get_flag|feature_enabled|is_feature_enabled)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /(?:feature_flags|flags)\s*\[\s*['"`]([^'"`]+)['"`]\s*\]/g,
      /(?:if|while|and|or)\s+([a-zA-Z_]\w*)\s*(?:==|!=)?\s*(?:True|False)?\s*:/g,
    ],
    negationWords: ['not'],
  },
  go: {
    flagChecks: [
      /(?:IsEnabled|IsActive|GetFlag|FeatureEnabled|IsFeatureEnabled)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /(?:if)\s*([a-zA-Z_]\w*)\s*(?:==|!=)?\s*(?:true|false)?\s*\{/g,
    ],
    negationWords: ['!'],
  },
  java: {
    flagChecks: [
      /(?:isEnabled|isActive|getFlag|featureEnabled|isFeatureEnabled)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /(?:if)\s*\(\s*([a-zA-Z_$][\w$]*)\s*(?:==|!=)?\s*(?:true|false)?\s*\)/g,
    ],
    negationWords: ['!'],
  },
  kotlin: {
    flagChecks: [
      /(?:isEnabled|isActive|getFlag|featureEnabled|isFeatureEnabled)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /(?:if)\s*\(\s*([a-zA-Z_$][\w$]*)\s*(?:==|!=)?\s*(?:true|false)?\s*\)/g,
    ],
    negationWords: ['!'],
  },
  swift: {
    flagChecks: [
      /(?:isEnabled|isActive|getFlag|featureEnabled|isFeatureEnabled)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /(?:if)\s*([a-zA-Z_$][\w$]*)\s*(?:==|!=)?\s*(?:true|false)?\s*\{/g,
    ],
    negationWords: ['!'],
  },
  rust: {
    flagChecks: [
      /(?:is_enabled|is_active|get_flag|feature_enabled|is_feature_enabled)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /(?:if)\s*([a-zA-Z_]\w*)\s*(?:==|!=)?\s*(?:true|false)?\s*\{/g,
    ],
    negationWords: ['!'],
  },
  other: {
    flagChecks: [
      /['"`](\w+(?:[_\-.]\w+)*)['"`]/g,
    ],
    negationWords: ['!', 'not'],
  },
};

export const RISK_LEVEL_WEIGHTS: Record<string, number> = {
  safe: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/__tests__/**',
  '**/test/**',
  '**/*.d.ts',
  '**/*.min.js',
  '**/vendor/**',
  '**/third_party/**',
];

export const DEFAULT_OUTPUT_DIR = './flag-cleaner-output';

export const RISK_REASONS = {
  DYNAMIC_NAME: '使用了动态 flag 名称，可能影响其他功能',
  DEFAULT_VALUE_INVERTED: '默认值被反转，需要仔细检查逻辑',
  HIGH_OCCURRENCE: '出现次数过多（>20次），改动影响范围大',
  MULTIPLE_FILES: '涉及多个文件（>5个），需要协调修改',
  NEGATED_USAGE: '存在否定形式的使用，清理时需注意逻辑反转',
  ACTIVE_EXPERIMENT: '实验仍在进行中，不建议清理',
  UNKNOWN_STATUS: '实验状态未知，需确认后再操作',
  COMPLEX_LOGIC: '存在复杂的条件组合逻辑',
} as const;
