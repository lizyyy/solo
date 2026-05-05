import { RepositoryMethodsConfig, RepositoryDefinition, RepositoryMethod, ParameterDefinition, JoinDefinition, ConditionDefinition, OrderByDefinition, PaginationDefinition, PreloadDefinition, MethodExample } from '../models';
import { generateId } from '../utils/id-generator';

export class RepositoryMethodsParser {
  parse(content: string): RepositoryMethodsConfig {
    try {
      const yaml = require('yaml');
      const data = yaml.parse(content);
      return this.parseConfig(data);
    } catch {
      try {
        const data = JSON.parse(content);
        return this.parseConfig(data);
      } catch {
        return {
          version: '1.0.0',
          repositories: [],
        };
      }
    }
  }

  private parseConfig(data: any): RepositoryMethodsConfig {
    return {
      version: data.version || '1.0.0',
      repositories: (data.repositories || data.repositoryMethods || []).map((repo: any) => 
        this.parseRepository(repo)
      ),
    };
  }

  private parseRepository(data: any): RepositoryDefinition {
    return {
      name: data.name || data.repositoryName || '',
      tableName: data.tableName || data.table || '',
      methods: (data.methods || []).map((method: any) => 
        this.parseMethod(method, data.name, data.tableName || data.table)
      ),
    };
  }

  private parseMethod(data: any, repositoryName: string, tableName: string): RepositoryMethod {
    const operationType = this.parseOperationType(data.operationType || data.type);

    return {
      id: data.id || generateId(),
      repositoryName,
      methodName: data.methodName || data.name || '',
      description: data.description,
      tableName: data.tableName || tableName,
      operationType,
      sqlTemplate: data.sqlTemplate || data.sql,
      expectedParameters: (data.parameters || data.expectedParameters || []).map((p: any) => 
        this.parseParameter(p)
      ),
      selectFields: data.selectFields || data.fields,
      joinTables: (data.joinTables || data.joins || []).map((j: any) => 
        this.parseJoin(j)
      ),
      whereConditions: (data.whereConditions || data.conditions || data.where || []).map((c: any) => 
        this.parseCondition(c)
      ),
      orderBy: (data.orderBy || data.sort || []).map((o: any) => 
        this.parseOrderBy(o)
      ),
      pagination: data.pagination ? this.parsePagination(data.pagination) : undefined,
      preloadAssociations: (data.preloadAssociations || data.preloads || data.eagerLoads || []).map((p: any) => 
        this.parsePreload(p)
      ),
      isBatchOperation: data.isBatchOperation || data.batch || operationType === 'BATCH',
      batchSize: data.batchSize,
      tags: data.tags,
      examples: (data.examples || []).map((e: any) => 
        this.parseExample(e)
      ),
    };
  }

  private parseOperationType(type: string): RepositoryMethod['operationType'] {
    const upperType = type?.toUpperCase();
    switch (upperType) {
      case 'SELECT':
      case 'INSERT':
      case 'UPDATE':
      case 'DELETE':
      case 'BATCH':
        return upperType;
      default:
        return 'SELECT';
    }
  }

  private parseParameter(data: any): ParameterDefinition {
    return {
      name: data.name || data.parameterName || '',
      type: data.type || data.dataType || 'string',
      required: data.required ?? data.isRequired ?? true,
      description: data.description,
      defaultValue: data.defaultValue,
    };
  }

  private parseJoin(data: any): JoinDefinition {
    return {
      tableName: data.tableName || data.table || '',
      joinType: this.parseJoinType(data.joinType || data.type),
      onCondition: data.onCondition || data.on || '',
      alias: data.alias,
    };
  }

  private parseJoinType(type: string): JoinDefinition['joinType'] {
    const upperType = type?.toUpperCase();
    switch (upperType) {
      case 'INNER':
      case 'LEFT':
      case 'RIGHT':
      case 'FULL':
        return upperType;
      default:
        return 'LEFT';
    }
  }

  private parseCondition(data: any): ConditionDefinition {
    return {
      column: data.column || data.field || '',
      operator: data.operator || '=',
      parameterName: data.parameterName || data.param,
      value: data.value,
    };
  }

  private parseOrderBy(data: any): OrderByDefinition {
    if (typeof data === 'string') {
      const parts = data.split(/\s+/);
      return {
        column: parts[0],
        direction: (parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC') as 'ASC' | 'DESC',
      };
    }

    return {
      column: data.column || data.field || '',
      direction: (data.direction || data.order || 'ASC').toUpperCase() as 'ASC' | 'DESC',
    };
  }

  private parsePagination(data: any): PaginationDefinition {
    return {
      type: (data.type || 'offset').toLowerCase() as 'offset' | 'cursor',
      defaultLimit: data.defaultLimit,
      maxLimit: data.maxLimit,
      cursorColumn: data.cursorColumn,
    };
  }

  private parsePreload(data: any): PreloadDefinition {
    if (typeof data === 'string') {
      return {
        association: data,
      };
    }

    return {
      association: data.association || data.name || '',
      foreignKey: data.foreignKey,
      batch: data.batch,
      subQuery: data.subQuery,
    };
  }

  private parseExample(data: any): MethodExample {
    return {
      description: data.description,
      parameters: data.parameters || data.params || {},
      expectedSql: data.expectedSql,
      expectedResult: data.expectedResult,
    };
  }
}

export function parseRepositoryMethods(content: string): RepositoryMethodsConfig {
  const parser = new RepositoryMethodsParser();
  return parser.parse(content);
}
