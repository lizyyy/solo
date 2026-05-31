import Papa from 'papaparse';
import { KnowledgePoint, ExportFilters, DemoScript, Part, Note } from '@/types';
import { generateExportFilename, statusToText, getCurrentTimestamp, getOperator } from './processing';

export const exportToCSV = (
  records: KnowledgePoint[],
  filters: ExportFilters,
  scripts: DemoScript[],
  parts: Part[],
  notes: Note[]
): void => {
  const processingRule = `处理口径：筛选条件=${filters.status || '全部'}, 导出时间=${getCurrentTimestamp()}, 操作人=${getOperator()}`;

  const csvData = records.map((kp) => {
    const scriptRefs = kp.scriptReferences
      .map((id) => scripts.find((s) => s.id === id)?.title || id)
      .join('; ');
    const partRefs = kp.partReferences
      .map((id) => parts.find((p) => p.id === id)?.name || id)
      .join('; ');
    const noteRefs = kp.noteReferences
      .map((id) => notes.find((n) => n.id === id)?.content.substring(0, 50) || id)
      .join('; ');

    return {
      知识点ID: kp.id,
      标题: kp.title,
      内容: kp.content,
      状态: statusToText(kp.status),
      关联演示脚本: scriptRefs,
      关联零件: partRefs,
      关联备注: noteRefs,
      创建时间: kp.createdAt,
      更新时间: kp.updatedAt,
      处理口径: kp.processingRule,
      人工修改原因: kp.manualEditReason || '',
    };
  });

  const csvContent = Papa.unparse(csvData, {
    header: true,
  });

  const fullContent = `# ${processingRule}\n${csvContent}`;

  const blob = new Blob(['\ufeff' + fullContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = generateExportFilename(filters);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const parseCSV = <T>(file: File): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as T[]);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

export const parseCSVContent = <T>(content: string): T[] => {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data as T[];
};

export const validateScriptCSV = (data: Record<string, unknown>[]): boolean => {
  if (data.length === 0) return false;
  const firstRow = data[0];
  return (
    ('stepNumber' in firstRow || '步骤编号' in firstRow) &&
    ('title' in firstRow || '标题' in firstRow) &&
    ('content' in firstRow || '内容' in firstRow)
  );
};

export const validatePartCSV = (data: Record<string, unknown>[]): boolean => {
  if (data.length === 0) return false;
  const firstRow = data[0];
  return (
    ('partNumber' in firstRow || '零件编号' in firstRow) &&
    ('name' in firstRow || '名称' in firstRow)
  );
};

export const mapCSVToScript = (row: Record<string, unknown>, sourceFile: string): Partial<DemoScript> => {
  return {
    title: String(row['title'] || row['标题'] || ''),
    content: String(row['content'] || row['内容'] || ''),
    stepNumber: parseInt(String(row['stepNumber'] || row['步骤编号'] || '0'), 10),
    sourceFile,
  };
};

export const mapCSVToPart = (row: Record<string, unknown>, sourceFile: string): Partial<Part> => {
  return {
    name: String(row['name'] || row['名称'] || ''),
    partNumber: String(row['partNumber'] || row['零件编号'] || ''),
    quantity: parseInt(String(row['quantity'] || row['数量'] || '1'), 10),
    description: String(row['description'] || row['描述'] || ''),
    category: String(row['category'] || row['分类'] || '未分类'),
    sourceFile,
  };
};
