export interface FormSchema {
  schemaVersion: string;
  formId: string;
  formName: string;
  groups: SchemaGroup[];
  lastUpdated: string;
}

export interface SchemaGroup {
  groupId: string;
  groupName: string;
  fields: SchemaField[];
}

export interface SchemaField {
  fieldId: string;
  fieldName: string;
  type: FieldType;
  required: boolean;
  defaultValue?: unknown;
  enumValues?: EnumValue[];
  validation?: FieldValidation;
  description?: string;
  isAttachment?: boolean;
  attachmentConfig?: AttachmentConfig;
  versionRange?: VersionRange;
}

export type FieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'datetime' 
  | 'enum' 
  | 'multiselect' 
  | 'attachment' 
  | 'image' 
  | 'object' 
  | 'array';

export interface EnumValue {
  value: string;
  label: string;
  deprecated?: boolean;
  versionRange?: VersionRange;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface AttachmentConfig {
  maxSize: number;
  allowedTypes: string[];
  maxCount: number;
}

export interface VersionRange {
  since?: string;
  until?: string;
}

export interface DraftRecord {
  draftId: string;
  formId: string;
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
  attachments?: DraftAttachment[];
  status: 'draft' | 'submitted' | 'synchronized';
}

export interface DraftAttachment {
  attachmentId: string;
  fieldId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  localPath?: string;
  remoteUrl?: string;
  status: 'local' | 'uploading' | 'uploaded' | 'failed';
}

export interface EnumMapping {
  fieldId: string;
  oldValue: string;
  newValue: string;
  label: string;
  isDefault: boolean;
}

export interface MigrationRule {
  ruleId: string;
  type: MigrationRuleType;
  sourceFieldId: string;
  targetFieldId: string;
  transform?: TransformConfig;
  condition?: ConditionConfig;
  description?: string;
}

export type MigrationRuleType = 
  | 'rename' 
  | 'transform' 
  | 'copy' 
  | 'delete' 
  | 'default_value'
  | 'merge'
  | 'split';

export interface TransformConfig {
  type: TransformType;
  params?: Record<string, unknown>;
}

export type TransformType = 
  | 'upper_case' 
  | 'lower_case' 
  | 'trim' 
  | 'number_to_string' 
  | 'string_to_number'
  | 'date_format'
  | 'concat'
  | 'split'
  | 'json_parse'
  | 'json_stringify';

export interface ConditionConfig {
  type: ConditionType;
  fieldId: string;
  value?: unknown;
}

export type ConditionType = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'starts_with' 
  | 'ends_with'
  | 'is_null'
  | 'is_not_null'
  | 'greater_than'
  | 'less_than';

export interface SchemaDiff {
  addedFields: DiffField[];
  removedFields: DiffField[];
  modifiedFields: DiffField[];
  addedGroups: DiffGroup[];
  removedGroups: DiffGroup[];
}

export interface DiffField {
  fieldId: string;
  groupId: string;
  oldValue?: unknown;
  newValue?: unknown;
  changes?: FieldChange[];
}

export interface FieldChange {
  property: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface DiffGroup {
  groupId: string;
  groupName: string;
}

export interface MigrationResult {
  plan: MigrationPlan;
  issues: Issue[];
  statistics: MigrationStatistics;
}

export interface MigrationPlan {
  version: string;
  generatedAt: string;
  sourceSchemaVersion: string;
  targetSchemaVersion: string;
  steps: MigrationStep[];
}

export interface MigrationStep {
  stepId: string;
  type: StepType;
  description: string;
  affectedDrafts: string[];
  rulesApplied: string[];
}

export type StepType = 
  | 'field_rename' 
  | 'field_transform' 
  | 'enum_mapping' 
  | 'default_value' 
  | 'data_cleanup'
  | 'attachment_migration';

export interface Issue {
  issueId: string;
  type: IssueType;
  severity: Severity;
  fieldId: string;
  draftIds: string[];
  description: string;
  suggestion?: string;
  affectedValues: unknown[];
}

export type IssueType = 
  | 'missing_field'
  | 'enum_value_mismatch'
  | 'required_field_no_default'
  | 'attachment_reference_lost'
  | 'field_type_mismatch'
  | 'schema_version_lag'
  | 'validation_failed';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface MigrationStatistics {
  totalDrafts: number;
  affectedDrafts: number;
  issuesBySeverity: Record<Severity, number>;
  issuesByType: Record<string, number>;
  fieldsAdded: number;
  fieldsRemoved: number;
  fieldsModified: number;
  attachmentCount: number;
  attachmentIssues: number;
}

export interface ReportData {
  migrationPlan: MigrationPlan;
  issues: Issue[];
  statistics: MigrationStatistics;
  schemaDiff: SchemaDiff;
  inputConfig: InputConfig;
}

export interface InputConfig {
  oldSchemaPath: string;
  newSchemaPath: string;
  draftsPath: string;
  enumMappingPath?: string;
  migrationRulesPath?: string;
}
