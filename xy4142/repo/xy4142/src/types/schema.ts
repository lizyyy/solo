export interface JSONSchema {
  $schema?: string;
  $id?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  items?: JSONSchema | JSONSchema[];
  enum?: unknown[];
  const?: unknown;
  oneOf?: JSONSchema[];
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  not?: JSONSchema;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  format?: string;
  default?: unknown;
  examples?: unknown[];
  definitions?: Record<string, JSONSchema>;
  $defs?: Record<string, JSONSchema>;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaError[];
  warnings: SchemaWarning[];
  schemaId: string;
  validatedAt: number;
}

export interface SchemaError {
  path: string;
  keyword: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
  params: Record<string, unknown>;
}

export interface SchemaWarning {
  path: string;
  message: string;
  level: 'info' | 'warning';
}

export interface VersionConstraint {
  minVersion?: string;
  maxVersion?: string;
  compatibleVersions?: string[];
}

export interface VersionCompatibilityResult {
  compatible: boolean;
  pluginVersion: string;
  systemVersion: string;
  reason?: string;
  recommendedAction?: string;
}
