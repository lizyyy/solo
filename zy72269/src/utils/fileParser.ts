import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { InspectionMark, OriginalNote, MaterialType, ImportPreviewResult } from '@/types';
import { generateUUID } from './coordinate';

export async function parseCSVFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        resolve(JSON.stringify(results.data, null, 2));
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

export async function parseExcelFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellText: true, cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });
  return JSON.stringify(jsonData, null, 2);
}

export async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function parseRawContent(
  rawContent: string,
  materialType: MaterialType,
  taskId: string
): ImportPreviewResult {
  const warnings: string[] = [];
  const marks: InspectionMark[] = [];
  const rawNotes: OriginalNote[] = [];

  try {
    const data = JSON.parse(rawContent);

    if (!Array.isArray(data)) {
      throw new Error('解析后的数据不是数组格式');
    }

    const headers = data[0] as string[];
    const headerMap = headers.map(h => String(h || '').toLowerCase().trim());

    const getColIndex = (keywords: string[]): number => {
      for (const kw of keywords) {
        const idx = headerMap.findIndex(h => h.includes(kw));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const seqIdx = getColIndex(['序号', 'sequence', 'no', '编号']);
    const xIdx = getColIndex(['x', 'x坐标', '横坐标']);
    const yIdx = getColIndex(['y', 'y坐标', '纵坐标']);
    const zIdx = getColIndex(['z', 'z坐标', '深度', '标高']);
    const typeIdx = getColIndex(['管线类型', '类型', 'pipeline', 'type']);
    const diaIdx = getColIndex(['管径', '直径', 'diameter', 'dia']);
    const obsIdx = getColIndex(['障碍物', '障碍', 'obstacle']);
    const noteIdx = getColIndex(['备注', '说明', 'remark', 'note']);

    if (seqIdx === -1 || xIdx === -1 || yIdx === -1 || zIdx === -1) {
      warnings.push('未找到必要的坐标列，将尝试自动识别');
    }

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as string[];
      if (!row || row.every(cell => !cell)) continue;

      const markId = generateUUID();

      const sequenceNo = parseInt(row[seqIdx] || String(i), 10) || i;
      const x = parseFloat(row[xIdx]) || 0;
      const y = parseFloat(row[yIdx]) || 0;
      const z = parseFloat(row[zIdx]) || 0;
      const pipelineType = row[typeIdx] || '未知类型';
      const diameter = row[diaIdx] || '';
      const obstacleType = row[obsIdx] || '';
      const noteContent = row[noteIdx] || '';

      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        warnings.push(`第${i}行坐标解析失败: X=${row[xIdx]}, Y=${row[yIdx]}, Z=${row[zIdx]}`);
      }

      const mark: InspectionMark = {
        id: markId,
        taskId,
        x, y, z,
        pipelineType,
        diameter,
        obstacleType: obstacleType || undefined,
        isObstacle: !!obstacleType && obstacleType.trim() !== '',
        sequenceNo,
        materialType,
        originalNotes: [],
        createdAt: new Date().toISOString()
      };

      marks.push(mark);

      if (noteContent && noteContent.trim() !== '') {
        const note: OriginalNote = {
          id: generateUUID(),
          markId,
          content: noteContent,
          noteType: detectNoteType(noteContent),
          sourceFile: '',
          lineNumber: i,
          isAmbiguous: isAmbiguousContent(noteContent),
          createdAt: new Date().toISOString()
        };
        rawNotes.push(note);
        mark.originalNotes.push(note);
      }

      if (materialType === 'wrong_diameter') {
        warnings.push(`第${i}行: 标记为错口径材料，管径${diameter}可能不准确`);
      }

      if (materialType === 'supplementary') {
        warnings.push(`第${i}行: 标记为补录材料`);
      }
    }

  } catch (error) {
    warnings.push(`解析过程中出现错误: ${error instanceof Error ? error.message : '未知错误'}`);
  }

  return { marks, rawNotes, rawContent, warnings };
}

function detectNoteType(content: string): OriginalNote['noteType'] {
  if (content.includes('手写') || content.includes('手填') || /[\u4e00-\u9fa5]{2,}/.test(content) && content.length > 10) {
    return 'handwritten';
  }
  if (content.includes('照片') || content.includes('附图') || content.includes('见图')) {
    return 'photo';
  }
  if (content.includes('?') || content.includes('？') || content.includes('可能') || content.includes('疑似') || content.includes('待确认')) {
    return 'ambiguous';
  }
  return 'typed';
}

function isAmbiguousContent(content: string): boolean {
  const ambiguousKeywords = ['可能', '疑似', '大概', '约', '左右', '不清楚', '待确认', '?', '？', '或许', '估计'];
  return ambiguousKeywords.some(keyword => content.includes(keyword));
}

export function generateSampleData(): {
  marks: InspectionMark[];
  rawContent: string;
} {
  const sampleData = [
    ['序号', 'X坐标', 'Y坐标', 'Z坐标', '管线类型', '管径(mm)', '障碍物', '备注'],
    [1, 0, 0, -5.2, '给水管道', '200', '', '正常巡检点'],
    [2, 10, 0, -5.2, '给水管道', '200', '阀门', '此处阀门疑似漏水？待现场确认'],
    [3, 20, 0, -5.2, '给水管道', '200', '', ''],
    [4, 30, 0, 5.5, '给水管道', '200', '异径接头', 'Z轴按旧习惯写反，应为-5.5'],
    [5, 40, 0, -5.2, '给水管道', '150', '', '错口径，应为200mm'],
    [6, 50, 0, -5.2, '给水管道', '200', '弯头', ''],
    [7, 60, 0, -5.2, '给水管道', '200', '', ''],
    [8, 70, 0, -5.2, '给水管道', '200', '三通', ''],
    [9, 80, 0, -5.2, '给水管道', '200', '', ''],
    [10, 90, 0, -5.2, '给水管道', '200', '减压阀', '此处有障碍物，与草图不符，待许工确认']
  ];

  const taskId = 'sample-task-001';
  const result = parseRawContent(JSON.stringify(sampleData), 'normal', taskId);

  return {
    marks: result.marks,
    rawContent: JSON.stringify(sampleData, null, 2)
  };
}

export function getMaterialTypeLabel(type: MaterialType): string {
  const labels: Record<MaterialType, string> = {
    normal: '正常材料',
    wrong_diameter: '错口径材料',
    supplementary: '补录材料'
  };
  return labels[type];
}
