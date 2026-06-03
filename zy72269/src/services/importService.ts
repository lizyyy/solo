import type { InspectionMark, MaterialType, SelfCheckReport } from '@/types';
import { parseCSVFile, parseExcelFile, readFileContent, parseRawContent } from '@/utils/fileParser';
import { findDuplicates } from '@/utils/comparison';
import { generateUUID } from '@/utils/coordinate';

export async function parseInspectionFile(
  file: File,
  materialType: MaterialType,
  taskId: string
) {
  let rawContent = '';
  const fileType = file.name.toLowerCase().split('.').pop();

  if (fileType === 'csv') {
    rawContent = await parseCSVFile(file);
  } else if (fileType === 'xlsx' || fileType === 'xls') {
    rawContent = await parseExcelFile(file);
  } else if (fileType === 'json') {
    rawContent = await readFileContent(file);
  } else {
    rawContent = await readFileContent(file);
  }

  const preview = parseRawContent(rawContent, materialType, taskId);

  preview.marks = preview.marks.map(mark => ({
    ...mark,
    originalNotes: mark.originalNotes.map(note => ({
      ...note,
      sourceFile: file.name
    }))
  }));

  return {
    ...preview,
    rawMaterial: {
      id: generateUUID(),
      fileType: (fileType || 'unknown') as 'csv' | 'xlsx' | 'json',
      fileName: file.name,
      materialType,
      uploadedAt: new Date().toISOString(),
      rawContent
    }
  };
}

export async function validateBeforeImport(
  marks: InspectionMark[],
  existingMarks: InspectionMark[]
): Promise<SelfCheckReport[]> {
  const reports: SelfCheckReport[] = [];
  const now = new Date().toISOString();

  const duplicates = findDuplicates(marks);
  const crossDuplicates = findDuplicates([...existingMarks, ...marks]).filter(
    m => marks.find(nm => nm.id === m.id)
  );

  if (duplicates.length > 0) {
    reports.push({
      id: generateUUID(),
      taskId: '',
      checkType: 'duplicate_import',
      result: 'warning',
      details: `本次导入材料中发现 ${duplicates.length} 条重复记录`,
      rawDataSnapshot: { duplicates: duplicates.map(d => ({ id: d.id, sequenceNo: d.sequenceNo, x: d.x, y: d.y, z: d.z })) },
      executedAt: now
    });
  }

  if (crossDuplicates.length > 0) {
    reports.push({
      id: generateUUID(),
      taskId: '',
      checkType: 'duplicate_import',
      result: 'fail',
      details: `发现 ${crossDuplicates.length} 条记录与已有数据重复，导入将被阻止`,
      rawDataSnapshot: { crossDuplicates: crossDuplicates.map(d => ({ id: d.id, sequenceNo: d.sequenceNo })) },
      executedAt: now
    });
  }

  const invalidCoordinates = marks.filter(m =>
    isNaN(m.x) || isNaN(m.y) || isNaN(m.z) ||
    !isFinite(m.x) || !isFinite(m.y) || !isFinite(m.z)
  );

  if (invalidCoordinates.length > 0) {
    reports.push({
      id: generateUUID(),
      taskId: '',
      checkType: 'duplicate_import',
      result: 'fail',
      details: `发现 ${invalidCoordinates.length} 条记录坐标无效`,
      rawDataSnapshot: { invalid: invalidCoordinates.map(d => ({ id: d.id, sequenceNo: d.sequenceNo })) },
      executedAt: now
    });
  }

  if (reports.length === 0) {
    reports.push({
      id: generateUUID(),
      taskId: '',
      checkType: 'duplicate_import',
      result: 'pass',
      details: '导入前自检通过，未发现问题',
      rawDataSnapshot: { markCount: marks.length },
      executedAt: now
    });
  }

  return reports;
}

export function canImport(reports: SelfCheckReport[]): boolean {
  return !reports.some(r => r.result === 'fail');
}
