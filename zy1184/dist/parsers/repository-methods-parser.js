"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryMethodsParser = void 0;
exports.parseRepositoryMethods = parseRepositoryMethods;
const id_generator_1 = require("../utils/id-generator");
class RepositoryMethodsParser {
    parse(content) {
        try {
            const yaml = require('yaml');
            const data = yaml.parse(content);
            return this.parseConfig(data);
        }
        catch {
            try {
                const data = JSON.parse(content);
                return this.parseConfig(data);
            }
            catch {
                return {
                    version: '1.0.0',
                    repositories: [],
                };
            }
        }
    }
    parseConfig(data) {
        return {
            version: data.version || '1.0.0',
            repositories: (data.repositories || data.repositoryMethods || []).map((repo) => this.parseRepository(repo)),
        };
    }
    parseRepository(data) {
        return {
            name: data.name || data.repositoryName || '',
            tableName: data.tableName || data.table || '',
            methods: (data.methods || []).map((method) => this.parseMethod(method, data.name, data.tableName || data.table)),
        };
    }
    parseMethod(data, repositoryName, tableName) {
        const operationType = this.parseOperationType(data.operationType || data.type);
        return {
            id: data.id || (0, id_generator_1.generateId)(),
            repositoryName,
            methodName: data.methodName || data.name || '',
            description: data.description,
            tableName: data.tableName || tableName,
            operationType,
            sqlTemplate: data.sqlTemplate || data.sql,
            expectedParameters: (data.parameters || data.expectedParameters || []).map((p) => this.parseParameter(p)),
            selectFields: data.selectFields || data.fields,
            joinTables: (data.joinTables || data.joins || []).map((j) => this.parseJoin(j)),
            whereConditions: (data.whereConditions || data.conditions || data.where || []).map((c) => this.parseCondition(c)),
            orderBy: (data.orderBy || data.sort || []).map((o) => this.parseOrderBy(o)),
            pagination: data.pagination ? this.parsePagination(data.pagination) : undefined,
            preloadAssociations: (data.preloadAssociations || data.preloads || data.eagerLoads || []).map((p) => this.parsePreload(p)),
            isBatchOperation: data.isBatchOperation || data.batch || operationType === 'BATCH',
            batchSize: data.batchSize,
            tags: data.tags,
            examples: (data.examples || []).map((e) => this.parseExample(e)),
        };
    }
    parseOperationType(type) {
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
    parseParameter(data) {
        return {
            name: data.name || data.parameterName || '',
            type: data.type || data.dataType || 'string',
            required: data.required ?? data.isRequired ?? true,
            description: data.description,
            defaultValue: data.defaultValue,
        };
    }
    parseJoin(data) {
        return {
            tableName: data.tableName || data.table || '',
            joinType: this.parseJoinType(data.joinType || data.type),
            onCondition: data.onCondition || data.on || '',
            alias: data.alias,
        };
    }
    parseJoinType(type) {
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
    parseCondition(data) {
        return {
            column: data.column || data.field || '',
            operator: data.operator || '=',
            parameterName: data.parameterName || data.param,
            value: data.value,
        };
    }
    parseOrderBy(data) {
        if (typeof data === 'string') {
            const parts = data.split(/\s+/);
            return {
                column: parts[0],
                direction: (parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'),
            };
        }
        return {
            column: data.column || data.field || '',
            direction: (data.direction || data.order || 'ASC').toUpperCase(),
        };
    }
    parsePagination(data) {
        return {
            type: (data.type || 'offset').toLowerCase(),
            defaultLimit: data.defaultLimit,
            maxLimit: data.maxLimit,
            cursorColumn: data.cursorColumn,
        };
    }
    parsePreload(data) {
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
    parseExample(data) {
        return {
            description: data.description,
            parameters: data.parameters || data.params || {},
            expectedSql: data.expectedSql,
            expectedResult: data.expectedResult,
        };
    }
}
exports.RepositoryMethodsParser = RepositoryMethodsParser;
function parseRepositoryMethods(content) {
    const parser = new RepositoryMethodsParser();
    return parser.parse(content);
}
//# sourceMappingURL=repository-methods-parser.js.map