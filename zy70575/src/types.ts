export interface VariableDefinition {
  name: string;
  type?: string;
  description?: string;
  default?: any;
  hasDefault: boolean;
  filePath: string;
  line: number;
  column: number;
}

export interface VariableReference {
  variableName: string;
  filePath: string;
  line: number;
  column: number;
  context: string;
}

export interface ModuleReference {
  name: string;
  filePath: string;
  line: number;
  source?: string;
  variablesUsed: string[];
}

export interface EnvironmentOverride {
  variableName: string;
  value: any;
  source: string;
  filePath?: string;
  line?: number;
}

export interface ParseError {
  filePath: string;
  line: number;
  column: number;
  rawContent: string;
  errorMessage: string;
  errorType: 'syntax' | 'invalid_variable' | 'invalid_reference' | 'missing_value';
}

export interface VariableReport {
  variableName: string;
  defined: boolean;
  definition?: VariableDefinition;
  references: VariableReference[];
  usedInModules: ModuleReference[];
  hasDefault: boolean;
  hasEnvironmentOverride: boolean;
  environmentOverrides: EnvironmentOverride[];
  isUsed: boolean;
  issues: string[];
}

export interface AnalysisResult {
  summary: {
    totalVariables: number;
    usedVariables: number;
    unusedVariables: number;
    variablesWithDefault: number;
    variablesWithoutDefault: number;
    variablesWithOverride: number;
    totalErrors: number;
    totalWarnings: number;
  };
  variables: Map<string, VariableReport>;
  errors: ParseError[];
  warnings: string[];
  moduleReferences: ModuleReference[];
}

export interface OutputOptions {
  format: 'terminal' | 'json' | 'report' | 'all';
  outputDir?: string;
  verbose: boolean;
}
