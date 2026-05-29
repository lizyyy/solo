import * as XLSX from 'xlsx';
import {
  ExportConfig,
  EXPORT_FIELDS,
  WorkVersion,
  ColorSample,
  ColorIssue,
  TeacherComment,
  Student,
  Class,
  Work
} from '../types';

interface ExportRow {
  studentName: string;
  className: string;
  workTitle: string;
  theme?: string;
  importedAt: string;
  versionNumber: number;
  overallScore: number;
  dominantColors?: string;
  issueCount: number;
  issueTypes?: string;
  teacherComment?: string;
  dataGaps?: string;
  warnings?: string;
  [key: string]: unknown;
}

export async function generateExportData(
  config: ExportConfig,
  getClass: (id: string) => Promise<Class | undefined>,
  getStudent: (id: string) => Promise<Student | undefined>,
  getWork: (id: string) => Promise<Work | undefined>,
  getVersionsByWork: (workId: string) => Promise<WorkVersion[]>,
  getVersionAnalysis: (versionId: string) => Promise<{
    colors: ColorSample[];
    issues: ColorIssue[];
    comment?: TeacherComment;
  } | null>
): Promise<ExportRow[]> {
  const rows: ExportRow[] = [];

  let workIds: string[] = [];

  if (config.classId) {
    const cls = await getClass(config.classId);
    if (!cls) throw new Error('班级不存在');
  }

  if (config.studentIds && config.studentIds.length > 0) {
    for (const studentId of config.studentIds) {
      const student = await getStudent(studentId);
      if (!student) continue;

      const works = await getVersionsByWork(studentId);
      workIds.push(...works.map(w => w.workId));
    }
  }

  workIds = [...new Set(workIds)];

  for (const workId of workIds) {
    const work = await getWork(workId);
    if (!work) continue;

    const student = await getStudent(work.studentId);
    if (!student) continue;

    const cls = await getClass(student.classId);
    if (!cls) continue;

    const versions = await getVersionsByWork(workId);

    for (const version of versions) {
      if (config.startDate && new Date(version.importedAt) < new Date(config.startDate)) continue;
      if (config.endDate && new Date(version.importedAt) > new Date(config.endDate)) continue;

      const analysis = await getVersionAnalysis(version.id);
      if (!analysis) continue;

      const row: ExportRow = {
        studentName: student.name,
        className: cls.name,
        workTitle: work.title,
        theme: work.theme,
        importedAt: new Date(version.importedAt).toLocaleString('zh-CN'),
        versionNumber: version.versionNumber,
        overallScore: analysis.comment?.overallScore || 0,
        issueCount: analysis.issues.length,
      };

      if (config.includeColors) {
        row.dominantColors = analysis.colors
          .filter(c => !c.isBackground && !c.isExtreme)
          .map(c => `${c.hex} (${c.percentage.toFixed(1)}%)`)
          .join('; ');
      }

      if (config.includeIssues) {
        row.issueTypes = analysis.issues
          .map(i => `${getIssueTypeLabel(i.type)}(${getSeverityLabel(i.severity)})`)
          .join('; ');
      }

      if (analysis.comment) {
        row.teacherComment = analysis.comment.content;
      }

      if (config.includeGaps) {
        row.dataGaps = version.dataGaps.missingFields.join('、') || '无';
        row.warnings = version.dataGaps.warnings.join('; ') || '无';
      }

      rows.push(row);
    }
  }

  return rows;
}

export function exportToExcel(rows: ExportRow[], filename: string = '配色点评报告'): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '配色点评数据');

  ws['!cols'] = EXPORT_FIELDS.map(() => ({ wch: 15 }));

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportToCsv(rows: ExportRow[], filename: string = '配色点评报告'): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]).join(',');
  const csvContent = [
    headers,
    ...rows.map(row =>
      Object.values(row)
        .map(v => {
          if (typeof v === 'string' && (v.includes(',') || v.includes('\n'))) {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return v;
        })
        .join(',')
    )
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function executeExport(config: ExportConfig, rows: ExportRow[]): void {
  if (config.format === 'xlsx') {
    exportToExcel(rows);
  } else {
    exportToCsv(rows);
  }
}

function getIssueTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    duplicate: '配色重复',
    gray: '画面偏灰',
    over_saturated: '色彩过饱和'
  };
  return labels[type] || type;
}

function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    low: '轻度',
    medium: '中度',
    high: '严重'
  };
  return labels[severity];
}

export function generatePreviewData(rows: ExportRow[], fields: string[]): {
  headers: string[];
  data: string[][];
} {
  const fieldLabels = EXPORT_FIELDS.filter(f => fields.includes(f.key));
  const headers = fieldLabels.map(f => f.label);

  const data = rows.slice(0, 10).map(row =>
    fieldLabels.map(f => {
      const value = row[f.key];
      if (value === null || value === undefined) return '-';
      return String(value);
    })
  );

  return { headers, data };
}
