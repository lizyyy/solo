import { SqlQuery, RequestGroup, Issue, IssueType, IssueSeverity, AnalysisOptions, DEFAULT_ANALYSIS_OPTIONS, TableStructure } from '../models';
import { generateId } from '../utils/id-generator';

export class UnusedFieldsDetector {
  private options: AnalysisOptions;
  private tableStructures?: TableStructure[];

  constructor(options: AnalysisOptions = {}, tableStructures?: TableStructure[]) {
    this.options = { ...DEFAULT_ANALYSIS_OPTIONS, ...options };
    this.tableStructures = tableStructures;
  }

  detect(requestGroup: RequestGroup): Issue[] {
    const issues: Issue[] = [];

    for (const query of requestGroup.sqlQueries) {
      if (this.hasUnusedFields(query)) {
        const issue = this.createUnusedFieldsIssue(query, requestGroup);
        issues.push(issue);
      }
    }

    return issues;
  }

  private hasUnusedFields(query: SqlQuery): boolean {
    if (query.operationType !== 'SELECT') return false;

    if (query.selectFields.includes('*')) {
      return true;
    }

    if (this.tableStructures && query.tableName) {
      const table = this.tableStructures.find(t => t.tableName === query.tableName);
      if (table) {
        const totalColumns = table.columns.length;
        const selectedColumns = query.selectFields.filter(f => f !== '*').length;
        
        if (selectedColumns > 0 && selectedColumns < totalColumns * 0.5) {
          return false;
        }
      }
    }

    if (query.selectFields.length > 10 && !this.isAggregateQuery(query)) {
      return true;
    }

    return false;
  }

  private isAggregateQuery(query: SqlQuery): boolean {
    const aggregateFunctions = ['COUNT(', 'SUM(', 'AVG(', 'MIN(', 'MAX(', 'GROUP_CONCAT('];
    const sqlUpper = query.sql.toUpperCase();
    
    for (const func of aggregateFunctions) {
      if (sqlUpper.includes(func)) {
        return true;
      }
    }

    if (query.groupBy && query.groupBy.length > 0) {
      return true;
    }

    return false;
  }

  private createUnusedFieldsIssue(query: SqlQuery, requestGroup: RequestGroup): Issue {
    const usesStar = query.selectFields.includes('*');
    const fieldCount = query.selectFields.length;

    const severity: IssueSeverity = usesStar ? 'MEDIUM' : 'LOW';

    const estimatedWaste = this.estimateDataWaste(query);

    return {
      id: generateId(),
      type: 'UNUSED_FIELDS',
      severity,
      title: `无用字段查询在表 ${query.tableName || 'unknown'}`,
      description: usesStar 
        ? `检测到使用 SELECT * 查询。这会加载所有字段，即使只需要其中一部分，造成不必要的网络传输和内存消耗。`
        : `检测到选择了 ${fieldCount} 个字段，可能存在未使用的字段。建议只查询需要的字段以优化性能。`,
      requestId: requestGroup.requestId,
      queries: [query],
      suggestion: {
        title: '明确指定需要的字段',
        description: usesStar
          ? `将 SELECT * 替换为明确的字段列表。只选择实际需要的字段可以减少数据传输、提高缓存效率、保护敏感数据。`
          : `检查代码中实际使用了哪些字段，只查询需要的字段。`,
        codeExample: this.generateCodeExample(query),
        expectedImprovement: {
          queryCountReduction: 0,
          durationReductionPercent: estimatedWaste.percentReduction,
          dataTransferReductionPercent: estimatedWaste.percentReduction,
        },
      },
      impact: {
        queryCountIncrease: 0,
        durationIncreaseMs: estimatedWaste.durationWaste,
        dataTransferIncreaseBytes: estimatedWaste.dataWaste,
      },
      evidence: {
        queries: [query.sql],
        parameters: [
          { 
            usesStar, 
            fieldCount,
            selectedFields: query.selectFields.slice(0, 10)
          }
        ] as any,
      },
    };
  }

  private estimateDataWaste(query: SqlQuery): {
    dataWaste: number;
    durationWaste: number;
    percentReduction: number;
  } {
    const usesStar = query.selectFields.includes('*');
    
    let estimatedFields = query.selectFields.length;
    if (usesStar) {
      estimatedFields = this.tableStructures
        ?.find(t => t.tableName === query.tableName)
        ?.columns.length || 20;
    }

    const estimatedRows = query.rowsAffected || 10;
    const bytesPerField = 50;
    const totalData = estimatedFields * estimatedRows * bytesPerField;
    
    const estimatedUsedFields = Math.min(5, estimatedFields * 0.3);
    const wasteData = totalData - (estimatedUsedFields * estimatedRows * bytesPerField);
    
    const percentReduction = usesStar ? 70 : Math.round((wasteData / totalData) * 100);
    const durationWaste = query.duration * (percentReduction / 100);

    return {
      dataWaste: Math.max(0, wasteData),
      durationWaste: Math.max(0, durationWaste),
      percentReduction,
    };
  }

  private generateCodeExample(query: SqlQuery): string {
    const tableName = query.tableName || 'table_name';
    const usesStar = query.selectFields.includes('*');
    const modelName = this.toPascalCase(tableName);

    if (usesStar) {
      return `// 优化前（使用 SELECT *）
const records = await ${modelName}.findAll({
  where: { /* 条件 */ }
  // 问题：加载所有字段，即使只需要几个
});

// 优化后（明确指定字段）
const records = await ${modelName}.findAll({
  attributes: ['id', 'name', 'email', 'created_at'],  // 只选择需要的字段
  where: { /* 条件 */ }
});

// 或使用原生 SQL
SELECT id, name, email, created_at 
FROM ${tableName} 
WHERE /* 条件 */;`;
    }

    const fields = query.selectFields.slice(0, 5).join(', ');

    return `// 当前查询选择了 ${query.selectFields.length} 个字段
const records = await ${modelName}.findAll({
  attributes: [${query.selectFields.map(f => `'${f}'`).join(', ')}],
  where: { /* 条件 */ }
});

// 建议：检查实际使用的字段，只保留需要的
// 例如，如果只需要 id, name, status：
const records = await ${modelName}.findAll({
  attributes: ['id', 'name', 'status'],  // 减少字段数量
  where: { /* 条件 */ }
});

// 字段裁剪的好处：
// 1. 减少网络传输数据量
// 2. 提高查询性能（更少的磁盘 I/O）
// 3. 更有效的缓存利用
// 4. 保护敏感数据不被意外暴露`;
  }

  private toPascalCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}

export function detectUnusedFields(
  requestGroup: RequestGroup,
  options?: AnalysisOptions,
  tableStructures?: TableStructure[]
): Issue[] {
  const detector = new UnusedFieldsDetector(options, tableStructures);
  return detector.detect(requestGroup);
}
