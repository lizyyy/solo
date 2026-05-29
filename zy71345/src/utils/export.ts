import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { AllData, CheckResult, DataVersion } from '../types';
import { getCheckSummary } from '../services/checkService';

export function exportToExcel(data: AllData, results: CheckResult[]): void {
  const wb = XLSX.utils.book_new();

  const partsWs = XLSX.utils.json_to_sheet(
    data.parts.map((p) => ({
      声部名称: p.name,
      声部分类: p.category,
      应发页数: p.totalPages,
      实际页数: p.pages.length,
    }))
  );
  XLSX.utils.book_append_sheet(wb, partsWs, '声部谱');

  const musiciansWs = XLSX.utils.json_to_sheet(
    data.musicians.map((m) => {
      const part = data.parts.find((p) => p.id === m.partId);
      return {
        姓名: m.name,
        声部: part?.name || '',
        角色: m.role,
      };
    })
  );
  XLSX.utils.book_append_sheet(wb, musiciansWs, '乐手名单');

  const revisionsWs = XLSX.utils.json_to_sheet(
    data.revisions.map((r) => ({
      修订页名称: r.name,
      页码: r.pageNumber,
      适用声部: r.partIds
        .map((id) => data.parts.find((p) => p.id === id)?.name)
        .join('、'),
      发布日期: r.issueDate,
      说明: r.description,
    }))
  );
  XLSX.utils.book_append_sheet(wb, revisionsWs, '修订页');

  const distributionsWs = XLSX.utils.json_to_sheet(
    data.distributions.map((d) => {
      const musician = data.musicians.find((m) => m.id === d.musicianId);
      const part = data.parts.find((p) => p.id === d.partId);
      return {
        乐手: musician?.name || '',
        声部: part?.name || '',
        收到页码: d.pagesReceived.join(', '),
        收到修订页: d.revisionIds
          .map((id) => data.revisions.find((r) => r.id === id)?.name)
          .join('、'),
        发放时间: d.distributedAt,
        发放人: d.distributedBy,
      };
    })
  );
  XLSX.utils.book_append_sheet(wb, distributionsWs, '发放记录');

  const exceptionsWs = XLSX.utils.json_to_sheet(
    results.map((r) => {
      const musician = data.musicians.find((m) => m.id === r.musicianId);
      const part = data.parts.find((p) => p.id === r.partId);
      const revision = data.revisions.find((rev) => rev.id === r.revisionId);
      return {
        类型: r.type === 'page' ? '页码' : r.type === 'distribution' ? '发放' : '修订',
        严重程度: r.severity === 'error' ? '错误' : r.severity === 'warning' ? '警告' : '信息',
        涉及声部: part?.name || '',
        涉及乐手: musician?.name || '',
        涉及修订页: revision?.name || '',
        问题描述: r.message,
        处理建议: r.suggestion,
        状态: r.status === 'open' ? '待处理' : r.status === 'resolved' ? '已解决' : '已忽略',
      };
    })
  );
  XLSX.utils.book_append_sheet(wb, exceptionsWs, '异常汇总');

  XLSX.writeFile(wb, `乐谱检查报告_${new Date().toLocaleDateString('zh-CN')}.xlsx`);
}

export function exportToPDF(data: AllData, results: CheckResult[]): void {
  const doc = new jsPDF();
  const summary = getCheckSummary(results);
  
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('管弦乐谱缺页检查报告', pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`生成时间：${new Date().toLocaleString('zh-CN')}`, margin, y);
  y += 10;
  doc.text(`声部数量：${data.parts.length}`, margin, y);
  y += 7;
  doc.text(`乐手数量：${data.musicians.length}`, margin, y);
  y += 7;
  doc.text(`修订页数量：${data.revisions.length}`, margin, y);
  y += 7;
  doc.text(`发放记录：${data.distributions.length}条`, margin, y);
  y += 15;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('检查结果汇总', margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`总异常数：${summary.total}`, margin, y);
  y += 7;
  doc.text(`  错误：${summary.errors}`, margin + 5, y);
  y += 7;
  doc.text(`  警告：${summary.warnings}`, margin + 5, y);
  y += 7;
  doc.text(`  信息：${summary.infos}`, margin + 5, y);
  y += 7;
  doc.text(`待处理：${summary.open}`, margin, y);
  y += 15;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('异常详情', margin, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  results.forEach((r, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    
    const severity = r.severity === 'error' ? '【错误】' : r.severity === 'warning' ? '【警告】' : '【信息】';
    const type = r.type === 'page' ? '[页码]' : r.type === 'distribution' ? '[发放]' : '[修订]';
    
    const lines = doc.splitTextToSize(`${index + 1}. ${severity}${type} ${r.message}`, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 3;
    
    const suggestionLines = doc.splitTextToSize(`   建议：${r.suggestion}`, pageWidth - margin * 2 - 10);
    doc.setTextColor(100);
    doc.text(suggestionLines, margin + 5, y);
    doc.setTextColor(0);
    y += suggestionLines.length * 5 + 5;
  });

  doc.save(`乐谱检查报告_${new Date().toLocaleDateString('zh-CN')}.pdf`);
}

export function exportJSON(data: AllData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `乐谱数据_${new Date().toLocaleDateString('zh-CN')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportVersionsJSON(versions: DataVersion[]): void {
  const blob = new Blob([JSON.stringify(versions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `乐谱数据版本_${new Date().toLocaleDateString('zh-CN')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
