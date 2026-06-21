import { jsPDF } from 'jspdf';
import type { AppState, Drawing, NoteBlock, MaterialBatch, ValueChangeLog } from '@/types';
import { METRIC_FIELD_LABELS, STATUS_LABELS } from '@/types';
import { formatDate, formatDateTime } from './date';

const BOM = '\uFEFF';
const PAGE_W = 210, PAGE_H = 297, MARGIN = 15, CW = PAGE_W - MARGIN * 2;

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function exportCSV(state: AppState, drawingId?: string): string {
  const { drawings, versions, notes, materials, changeLogs } = state;
  const targetDrawings = drawingId
    ? drawings.filter(d => d.id === drawingId)
    : drawings;

  const headers = [
    '图纸编号(项目编号)',
    '图纸名称',
    '当前版本',
    '预审结论(状态)',
    '异常数量(碰撞+不合格)',
    '复核原因',
    '最新备注',
    '材料批次状态',
    '变更摘要',
    '材料缺料数',
    '楼栋位置',
    '最后更新时间',
  ];

  const rows = targetDrawings.map(d => {
    const dVersions = versions.filter(v => v.drawingId === d.id);
    const latest = dVersions.find(v => v.isLatest) ?? dVersions[0];
    const dNotes = notes.filter(n => n.drawingId === d.id).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const dMaterials = materials.filter(m => m.drawingId === d.id);
    const dChanges = changeLogs.filter(c => c.drawingId === d.id).sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );

    const drawingCode = `${d.projectNo}-${d.id.slice(0, 6)}`;
    const currentVersion = latest?.version ?? '-';
    const needReview = d.status === 'reviewing' || d.status === 'abnormal';
    const conclusion = `${STATUS_LABELS[d.status]}${needReview ? '（需复核）' : ''}`;
    const abnormalCount = d.metrics.collisionPoints + d.metrics.unqualifiedItems;

    const reviewNote = dNotes.find(n => n.tag === 'review');
    const reviewReason = reviewNote ? truncate(reviewNote.content, 30) : '';

    const latestNoteObj = dNotes[0];
    const latestNote = latestNoteObj
      ? `${truncate(latestNoteObj.content, 50)} [${formatDate(latestNoteObj.createdAt)}]`
      : '';

    const materialStatus = dMaterials.map(m => {
      const status = m.isMissing
        ? `缺料:${truncate(m.reviewHint ?? '', 20)}`
        : '齐备';
      return `${m.batchNo}(${status})`;
    }).join(';');

    const changeSummary = dChanges.slice(0, 3).map(c => {
      const reason = truncate(c.reason, 20);
      return `${c.fieldLabel}:${c.oldValue}→${c.newValue}:${reason}`;
    }).join(';');

    const missingCount = dMaterials.filter(m => m.isMissing).length;

    return [
      drawingCode,
      d.name,
      currentVersion,
      conclusion,
      abnormalCount,
      reviewReason,
      latestNote,
      materialStatus,
      changeSummary,
      missingCount,
      d.buildingName,
      formatDateTime(d.updatedAt),
    ];
  });

  return BOM + [headers, ...rows].map(a => a.map(csvEscape).join(',')).join('\n');
}

export interface ExportJSONItem {
  drawingCode: string;
  drawingName: string;
  currentVersion: string;
  conclusion: string;
  abnormalCount: number;
  reviewReason: string;
  latestNote: string;
  materialStatus: string;
  changeSummary: string;
  missingCount: number;
  building: string;
  updatedAt: string;
}

export function exportJSON(state: AppState, drawingId?: string): string {
  const { drawings, versions, notes, materials, changeLogs } = state;
  const targetDrawings = drawingId
    ? drawings.filter(d => d.id === drawingId)
    : drawings;

  const result: ExportJSONItem[] = targetDrawings.map(d => {
    const dVersions = versions.filter(v => v.drawingId === d.id);
    const latest = dVersions.find(v => v.isLatest) ?? dVersions[0];
    const dNotes = notes.filter(n => n.drawingId === d.id).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const dMaterials = materials.filter(m => m.drawingId === d.id);
    const dChanges = changeLogs.filter(c => c.drawingId === d.id).sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );

    const drawingCode = `${d.projectNo}-${d.id.slice(0, 6)}`;
    const currentVersion = latest?.version ?? '-';
    const needReview = d.status === 'reviewing' || d.status === 'abnormal';
    const conclusion = `${STATUS_LABELS[d.status]}${needReview ? '（需复核）' : ''}`;
    const abnormalCount = d.metrics.collisionPoints + d.metrics.unqualifiedItems;

    const reviewNote = dNotes.find(n => n.tag === 'review');
    const reviewReason = reviewNote ? truncate(reviewNote.content, 30) : '';

    const latestNoteObj = dNotes[0];
    const latestNote = latestNoteObj
      ? `${truncate(latestNoteObj.content, 50)} [${formatDate(latestNoteObj.createdAt)}]`
      : '';

    const materialStatus = dMaterials.map(m => {
      const status = m.isMissing
        ? `缺料:${truncate(m.reviewHint ?? '', 20)}`
        : '齐备';
      return `${m.batchNo}(${status})`;
    }).join(';');

    const changeSummary = dChanges.slice(0, 3).map(c => {
      const reason = truncate(c.reason, 20);
      return `${c.fieldLabel}:${c.oldValue}→${c.newValue}:${reason}`;
    }).join(';');

    const missingCount = dMaterials.filter(m => m.isMissing).length;

    return {
      drawingCode,
      drawingName: d.name,
      currentVersion,
      conclusion,
      abnormalCount,
      reviewReason,
      latestNote,
      materialStatus,
      changeSummary,
      missingCount,
      building: d.buildingName,
      updatedAt: formatDateTime(d.updatedAt),
    };
  });

  return JSON.stringify(result, null, 2);
}

function wrap(doc: jsPDF, t: string, mw: number): string[] {
  const out: string[] = [];
  for (const para of t.split('\n')) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const ch of para) {
      if (doc.getTextWidth(line + ch) > mw && line) { out.push(line); line = ch; } else line += ch;
    }
    if (line) out.push(line);
  }
  return out;
}

function np(doc: jsPDF, y: number, need: number): number {
  return y + need > PAGE_H - 35 ? (doc.addPage(), MARGIN + 25) : y;
}

export async function exportPDF(drawing: Drawing, notes: NoteBlock[], materials: MaterialBatch[], changes: ValueChangeLog[]): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const hdr = () => {
    doc.setFillColor(30, 58, 138); doc.rect(0, 0, PAGE_W, 20, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(`${drawing.projectNo} · ${drawing.name}`, MARGIN, 12);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(drawing.buildingName, MARGIN, 17);
    doc.setTextColor(200, 210, 240); doc.setFontSize(8);
    doc.text(`状态: ${STATUS_LABELS[drawing.status]}`, PAGE_W - MARGIN, 12, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const ftr = () => {
    const pc = (doc as any).internal.getNumberOfPages() as number;
    const now = formatDateTime(new Date().toISOString());
    for (let i = 1; i <= pc; i++) {
      doc.setPage(i); doc.setFontSize(7); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'italic');
      doc.text(`导出: ${now} · 日照体量碰撞预审系统`, PAGE_W / 2, PAGE_H - 8, { align: 'center' });
      doc.text(`${i}/${pc}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
    }
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
  };

  const sec = (y: number, n: number, t: string): number => {
    y = np(doc, y, 12); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.setFillColor(230, 240, 255); doc.rect(MARGIN, y, CW, 8, 'F');
    doc.text(`§${n}. ${t}`, MARGIN + 3, y + 6); doc.setFont('helvetica', 'normal');
    return y + 12;
  };

  hdr(); let y = MARGIN + 25;

  y = sec(y, 1, '指标汇总');
  for (const k of Object.keys(drawing.metrics)) {
    y = np(doc, y, 8); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(METRIC_FIELD_LABELS[k as keyof typeof METRIC_FIELD_LABELS], MARGIN + 2, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(String(drawing.metrics[k as keyof typeof METRIC_FIELD_LABELS]), MARGIN + CW / 2, y + 4);
    doc.setDrawColor(220, 220, 220); doc.line(MARGIN, y + 7, PAGE_W - MARGIN, y + 7);
    y += 8;
  }
  y += 4;

  y = sec(y, 2, '备注时间线');
  if (notes.length === 0) { doc.setFontSize(9); doc.setTextColor(120, 120, 120); doc.text('暂无备注', MARGIN + 2, y + 4); y += 10; }
  else for (const n of notes) {
    y = np(doc, y, 18); doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 90, 160);
    doc.text(`[${formatDateTime(n.createdAt)}] ${n.authorName}${n.isRawBimClue ? ' [BIM线索]' : ''}`, MARGIN + 2, y + 4);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0); y += 6; doc.setFontSize(9);
    for (const ln of wrap(doc, n.content, CW - 4)) { y = np(doc, y, 6); doc.text(ln, MARGIN + 4, y + 4); y += 5; }
    y += 4;
  }

  y = sec(y, 3, '材料批次');
  if (materials.length === 0) { doc.setFontSize(9); doc.setTextColor(120, 120, 120); doc.text('暂无材料', MARGIN + 2, y + 4); y += 10; }
  else for (const m of materials) {
    y = np(doc, y, 14); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(m.batchNo, MARGIN + 2, y + 4); doc.setFont('helvetica', 'normal'); doc.text(m.materialName, MARGIN + 40, y + 4);
    if (m.isMissing) { doc.setTextColor(220, 60, 60); doc.setFontSize(8); doc.text('● 缺料', MARGIN + CW - 15, y + 4); doc.setTextColor(0, 0, 0); }
    y += 6;
    if (m.reviewHint) { doc.setFontSize(8); doc.setTextColor(100, 100, 100); for (const ln of wrap(doc, m.reviewHint, CW - 4)) { y = np(doc, y, 5); doc.text(ln, MARGIN + 4, y + 4); y += 5; } doc.setTextColor(0, 0, 0); }
    y += 3;
  }

  y = sec(y, 4, '变更记录');
  if (changes.length === 0) { doc.setFontSize(9); doc.setTextColor(120, 120, 120); doc.text('暂无变更', MARGIN + 2, y + 4); y += 10; }
  else for (const c of changes) {
    y = np(doc, y, 20); doc.setFontSize(8); doc.setTextColor(100, 100, 100);
    doc.text(`[${formatDateTime(c.changedAt)}] ${c.operatorName}`, MARGIN + 2, y + 4);
    doc.setTextColor(0, 0, 0); y += 6; doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(c.fieldLabel, MARGIN + 2, y + 4); doc.setFont('helvetica', 'normal');
    doc.text(`${c.oldValue} → ${c.newValue}`, MARGIN + 35, y + 4); y += 6;
    doc.setFontSize(8); doc.setTextColor(80, 80, 80);
    for (const ln of wrap(doc, `原因: ${c.reason}`, CW - 4)) { y = np(doc, y, 5); doc.text(ln, MARGIN + 4, y + 4); y += 5; }
    doc.setTextColor(0, 0, 0); y += 2;
  }

  ftr();
  return doc.output('blob');
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(content: string, fileName: string, mime: string): void {
  downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), fileName);
}
