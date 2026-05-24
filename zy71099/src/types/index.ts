export interface HTTPRequest {
  method: string;
  uri: string;
  url?: string;
  path?: string;
  headers: Record<string, string | string[]>;
  body?: string | Record<string, any>;
  query?: Record<string, string | string[]>;
}

export interface HTTPResponse {
  status: {
    code: number;
    message?: string;
  };
  headers: Record<string, string | string[]>;
  body?: string | Record<string, any>;
}

export interface CassetteInteraction {
  id: string;
  request: HTTPRequest;
  response: HTTPResponse;
  recordedAt?: string;
  duration?: number;
  sourceLine?: number;
  sourceFile?: string;
}

export interface Cassette {
  version?: string;
  interactions: CassetteInteraction[];
  rawContent: string;
  filePath: string;
  format: 'yaml' | 'json';
}

export interface MaskingRule {
  field: string;
  pattern?: string;
  replacement?: string;
  type: 'body' | 'header' | 'query' | 'url';
}

export interface DiffConfig {
  ignoreOrder: boolean;
  ignoreFields: string[];
  maskingRules: MaskingRule[];
  normalizeHeaders: boolean;
  normalizeJsonKeys: boolean;
  tolerance: number;
}

export type DiffType = 
  | 'request_missing'
  | 'request_added'
  | 'request_method'
  | 'request_url'
  | 'request_header'
  | 'request_body'
  | 'request_query'
  | 'response_status'
  | 'response_header'
  | 'response_body'
  | 'masking_mismatch'
  | 'unmatched';

export interface DiffDetail {
  path: string;
  expected: any;
  actual: any;
  type: 'added' | 'removed' | 'changed';
}

export interface InteractionDiff {
  interactionId: string;
  type: DiffType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details: DiffDetail[];
  expectedSource?: {
    file: string;
    line?: number;
  };
  actualSource?: {
    file: string;
    line?: number;
  };
}

export interface DiffResult {
  summary: {
    totalInteractions: {
      expected: number;
      actual: number;
    };
    matched: number;
    added: number;
    removed: number;
    changed: number;
    errors: number;
    warnings: number;
  };
  differences: InteractionDiff[];
  config: DiffConfig;
  generatedAt: string;
  exitCode: number;
}

export interface CLIOptions {
  expected: string;
  actual: string;
  output?: string;
  config?: string;
  ignoreOrder?: boolean;
  ignoreFields?: string[];
  format?: 'text' | 'json' | 'markdown' | 'all';
  verbose?: boolean;
  quiet?: boolean;
}

export const ExitCodes = {
  SUCCESS: 0,
  DIFFERENCES_FOUND: 1,
  INPUT_ERROR: 2,
  PARSE_ERROR: 3,
  CONFIG_ERROR: 4,
  INTERNAL_ERROR: 5,
} as const;

export type ExitCode = typeof ExitCodes[keyof typeof ExitCodes];

export interface ExitCodeExplanation {
  code: number;
  name: string;
  description: string;
  action: string;
}

export const ExitCodeExplanations: ExitCodeExplanation[] = [
  {
    code: 0,
    name: 'SUCCESS',
    description: '比较完成，未发现差异',
    action: '无需操作'
  },
  {
    code: 1,
    name: 'DIFFERENCES_FOUND',
    description: '发现一个或多个差异',
    action: '查看生成的差异报告，确认是接口变更还是脱敏问题'
  },
  {
    code: 2,
    name: 'INPUT_ERROR',
    description: '输入参数错误或文件不存在',
    action: '检查命令参数和文件路径'
  },
  {
    code: 3,
    name: 'PARSE_ERROR',
    description: 'Cassette 文件解析失败',
    action: '检查文件格式是否为有效的 YAML 或 JSON'
  },
  {
    code: 4,
    name: 'CONFIG_ERROR',
    description: '配置文件加载失败或格式错误',
    action: '检查配置文件格式'
  },
  {
    code: 5,
    name: 'INTERNAL_ERROR',
    description: '程序内部错误',
    action: '请提交 Issue 并附上错误日志'
  }
];
