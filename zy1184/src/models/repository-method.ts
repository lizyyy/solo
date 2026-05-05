export interface RepositoryMethod {
  id: string;
  repositoryName: string;
  methodName: string;
  description?: string;
  tableName: string;
  operationType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'BATCH';
  sqlTemplate?: string;
  expectedParameters: ParameterDefinition[];
  selectFields?: string[];
  joinTables?: JoinDefinition[];
  whereConditions?: ConditionDefinition[];
  orderBy?: OrderByDefinition[];
  pagination?: PaginationDefinition;
  preloadAssociations?: PreloadDefinition[];
  isBatchOperation: boolean;
  batchSize?: number;
  tags?: string[];
  examples?: MethodExample[];
}

export interface ParameterDefinition {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: any;
}

export interface JoinDefinition {
  tableName: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  onCondition: string;
  alias?: string;
}

export interface ConditionDefinition {
  column: string;
  operator: string;
  parameterName?: string;
  value?: any;
}

export interface OrderByDefinition {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface PaginationDefinition {
  type: 'offset' | 'cursor';
  defaultLimit?: number;
  maxLimit?: number;
  cursorColumn?: string;
}

export interface PreloadDefinition {
  association: string;
  foreignKey?: string;
  batch?: boolean;
  subQuery?: boolean;
}

export interface MethodExample {
  description: string;
  parameters: Record<string, any>;
  expectedSql?: string;
  expectedResult?: any;
}

export interface RepositoryMethodsConfig {
  version: string;
  repositories: RepositoryDefinition[];
}

export interface RepositoryDefinition {
  name: string;
  tableName: string;
  methods: RepositoryMethod[];
}
