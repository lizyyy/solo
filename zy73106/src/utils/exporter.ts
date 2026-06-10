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

export function exportCSV(state: AppState, drawingId?: string): string {
  const { drawings, versions, notes, materials, changeLogs } = state;
  const byDrawing = (id: string) => ({
    vs: versions.filter(v => v.drawingId === id),
    ns: notes.filter(n => n.drawingId === id),
    ms: materials.filter(m => m.drawingId === id),
    cs: changeLogs.filter(c => c.drawingId === id),
  });

  if (drawingId) {
    const d = drawings.find(x => x.id === drawingId);
    if (!d) return BOM;
    const { vs, ns, ms, cs } = byDrawing(drawingId);
    const latest = vs.find(v => v.isLatest);
    const nsSum = ns.slice(0, 3).map(n => `[${formatDate(n.createdAt)}]${n.authorName}:${n.content.slice(0, 20)}`).join(' | ');
    const msDet = ms.map(m => `${m.batchNo}:${m.materialName}${m.isMissing ? '(缺料)' : ''}`).join(' | ');
    const h = ['项目编号', '图纸名', '楼栋', '版本', '状态', '碰撞点数', '不合格项', '日照阴影风险', '体量偏差(%)', '备注摘要', '材料批次', '变更次数'];
    const r = [d.projectNo, d.name, d.buildingName, latest?.version ?? '-', STATUS_LABELS[d.status], d.metrics.collisionPoints, d.metrics.unqualifiedItems, d.metrics.sunShadowRisk, d.metrics.volumeDeviation, nsSum, msDet, cs.length];
    return BOM + [h, r].map(a => a.map(csvEscape).join(',')).join('\n');
  }

  const h = ['项目编号', '图纸名', '楼栋', '版本', '状态', '碰撞点数', '不合格项', '日照风险', '偏差(%)', '备注', '缺料', '变更', '创建', '更新'];
  const rows = drawings.map(d => {
    const { vs, ns, ms, cs } = byDrawing(d.id);
    const latest = vs.find(v => v.isLatest);
    return [d.projectNo, d.name, d.buildingName, latest?.version ?? '-', STATUS_LABELS[d.status], d.metrics.collisionPoints, d.metrics.unqualifiedItems, d.metrics.sunShadowRisk, d.metrics.volumeDeviation, ns.length, ms.filter(m => m.isMissing).length, cs.length, formatDateTime(d.createdAt), formatDateTime(d.updatedAt)].map(csvEscape).join(',');
  });
  return BOM + [h.map(csvEscape).join(','), ...rows].join('\n');
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
