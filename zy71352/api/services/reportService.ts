import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ArtworkDetail, ReportSummary, RecordStatus } from '../../shared/types.js';
import { STATUS_LABELS, CURRENCY_SYMBOLS } from '../../shared/types.js';
import { getDb } from '../db/index.js';
import { checkGapsForArtwork } from './gapDetectorService.js';

export const getReportSummary = async (): Promise<ReportSummary> => {
  const db = await getDb();

  const total = db.data.artworks.length;
  const processed = db.data.artworks.filter(a => a.status === 'processed').length;
  const pending = db.data.artworks.filter(a => a.status === 'pending').length;
  const rejected = db.data.artworks.filter(a => a.status === 'rejected').length;

  const totalValuation = db.data.valuations.reduce((sum, v) => {
    return sum + (v.convertedAmount || v.amount);
  }, 0);

  const totalCoverage = db.data.insuranceClauses.reduce((sum, i) => {
    return sum + i.coverageAmount;
  }, 0);

  const unresolvedGaps = db.data.gapAlerts.filter(a => !a.resolved && a.severity === 'error').length;

  return {
    total,
    processed,
    pending,
    rejected,
    totalValuation,
    totalCoverage,
    gapCount: unresolvedGaps,
  };
};

export const getArtworksByStatus = async (status?: RecordStatus): Promise<ArtworkDetail[]> => {
  const db = await getDb();

  let artworks = db.data.artworks;
  if (status) {
    artworks = artworks.filter(a => a.status === status);
  }

  return Promise.all(
    artworks.map(artwork => getArtworkDetail(artwork.id))
  );
};

export const exportExcel = async (status?: RecordStatus): Promise<Buffer> => {
  const artworks = await getArtworksByStatus(status);

  const rows = artworks.map(artwork => {
    const latestValuation = artwork.valuations[artwork.valuations.length - 1];
    const latestContract = artwork.contracts.find(c => c.isLatest) || artwork.contracts[artwork.contracts.length - 1];
    const latestInsurance = artwork.insuranceClauses[artwork.insuranceClauses.length - 1];
    const transportStatus = getTransportStatus(artwork);
    const unresolvedGaps = artwork.gapAlerts.filter(g => !g.resolved && g.severity === 'error').length;

    return {
      '作品编号': artwork.artworkNo,
      '作品名称': artwork.name,
      '艺术家': artwork.artist,
      '年代': artwork.year,
      '材质': artwork.material,
      '尺寸': artwork.size,
      '状态': STATUS_LABELS[artwork.status],
      '估值金额': latestValuation ? `${CURRENCY_SYMBOLS[latestValuation.currency]}${latestValuation.amount.toLocaleString()}` : '未填写',
      '估值币种': latestValuation?.currency || '',
      '估值日期': latestValuation?.valuationDate || '',
      '估值机构': latestValuation?.institution || '',
      '合同版本': latestContract?.version || '',
      '出借方': latestContract?.lender || '',
      '出借期限': latestContract ? `${latestContract.startDate} 至 ${latestContract.endDate}` : '',
      '运输状态': transportStatus,
      '保险金额': latestInsurance ? `${CURRENCY_SYMBOLS[latestInsurance.currency]}${latestInsurance.coverageAmount.toLocaleString()}` : '未填写',
      '保险期限': latestInsurance ? `${latestInsurance.effectiveDate} 至 ${latestInsurance.expiryDate}` : '',
      '待解决问题': unresolvedGaps,
      '创建时间': formatDate(artwork.createdAt),
      '更新时间': formatDate(artwork.updatedAt),
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '保险清单');

  const colWidths = Object.keys(rows[0] || {}).map(key => ({ wch: Math.max(12, key.length + 2) }));
  ws['!cols'] = colWidths;

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buffer);
};

export const exportPDF = async (status?: RecordStatus): Promise<Buffer> => {
  const artworks = await getArtworksByStatus(status);
  const summary = await getReportSummary();

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('展览作品保险清单报告', 140, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 10, 25);
  doc.text(`状态筛选: ${status ? STATUS_LABELS[status] : '全部'}`, 10, 32);

  const summaryData = [
    ['总记录数', '已处理', '待确认', '需退回', '总估值(元)', '总保额(元)', '待解决问题'],
    [
      summary.total.toString(),
      summary.processed.toString(),
      summary.pending.toString(),
      summary.rejected.toString(),
      summary.totalValuation.toLocaleString(),
      summary.totalCoverage.toLocaleString(),
      summary.gapCount.toString(),
    ],
  ];

  autoTable(doc, {
    head: summaryData.slice(0, 1),
    body: summaryData.slice(1),
    startY: 40,
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    styles: { fontSize: 9 },
    theme: 'grid',
  });

  const tableData = artworks.map(artwork => {
    const latestValuation = artwork.valuations[artwork.valuations.length - 1];
    const latestContract = artwork.contracts.find(c => c.isLatest) || artwork.contracts[artwork.contracts.length - 1];
    const transportStatus = getTransportStatus(artwork);
    const unresolvedGaps = artwork.gapAlerts.filter(g => !g.resolved && g.severity === 'error').length;

    return [
      artwork.artworkNo,
      artwork.name,
      artwork.artist,
      STATUS_LABELS[artwork.status],
      latestValuation ? `${CURRENCY_SYMBOLS[latestValuation.currency]}${latestValuation.amount.toLocaleString()}` : '未填写',
      latestContract?.lender || '未填写',
      transportStatus,
      unresolvedGaps > 0 ? `有${unresolvedGaps}个问题` : '无',
    ];
  });

  const tableHeaders = [
    '作品编号', '作品名称', '艺术家', '状态', '估值', '出借方', '运输状态', '问题',
  ];

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10,
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    styles: { fontSize: 8 },
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 22 },
      4: { cellWidth: 28 },
      5: { cellWidth: 35 },
      6: { cellWidth: 22 },
      7: { cellWidth: 22 },
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`第 ${i} / ${pageCount} 页`, 280, 200, { align: 'right' });
    doc.text('展览作品保险清单管理系统 - 机密文件', 10, 200);
  }

  return Buffer.from(doc.output('arraybuffer'));
};

async function getArtworkDetail(artworkId: string): Promise<ArtworkDetail> {
  const db = await getDb();

  const artwork = db.data.artworks.find(a => a.id === artworkId)!;
  const valuations = db.data.valuations.filter(v => v.artworkId === artworkId);
  const contracts = db.data.loanContracts.filter(c => c.artworkId === artworkId);
  const transportNodes = db.data.transportNodes.filter(t => t.artworkId === artworkId);
  const insuranceClauses = db.data.insuranceClauses.filter(i => i.artworkId === artworkId);
  const changeLogs = db.data.changeLogs.filter(c => c.recordId === artworkId);

  const gapResult = await checkGapsForArtwork(artworkId);

  return {
    ...artwork,
    valuations,
    contracts,
    transportNodes,
    insuranceClauses,
    changeLogs,
    gapAlerts: gapResult.alerts,
  };
}

function getTransportStatus(artwork: ArtworkDetail): string {
  const destination = artwork.transportNodes.find(t => t.nodeType === 'destination');
  if (destination?.status === 'delivered') return '已签收';
  if (destination?.status === 'arrived') return '已到达';

  const inTransit = artwork.transportNodes.some(t => t.status === 'in_transit');
  if (inTransit) return '运输中';

  const origin = artwork.transportNodes.find(t => t.nodeType === 'origin');
  if (origin?.status === 'pending') return '待运输';

  return '未安排';
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
