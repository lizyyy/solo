import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Report, Bond, YieldCurve } from '@/types';
import { Decimal } from 'decimal.js';

export function exportReportToExcel(report: Report, bond: Bond, curve: YieldCurve): void {
  const wb = XLSX.utils.book_new();

  const bondSheetData: (string | number)[][] = [
    ['债券基本信息', '', '', ''],
    ['债券名称', bond.name, '债券代码', bond.code],
    ['面值', bond.faceValue.toString(), '票息率', `${new Decimal(bond.couponRate).mul(100).toFixed(2)}%`],
    ['付息频率', `${bond.couponFrequency}次/年`, '计息基准', bond.dayCountConvention],
    ['发行日', bond.issueDate, '到期日', bond.maturityDate],
    ['版本号', `v${bond.version}`, '最后更新', bond.updatedAt.split('T')[0]],
    ['', '', '', ''],
    ['估值参数', '', '', ''],
    ['估值日', report.params.valuationDate, '', ''],
    ['小变动基点', `${report.params.yieldShiftBpSmall}bp`, '大变动基点', `${report.params.yieldShiftBpLarge}bp`]
  ];
  const bondSheet = XLSX.utils.aoa_to_sheet(bondSheetData);
  XLSX.utils.book_append_sheet(wb, bondSheet, '债券信息');

  const cfSheetData: (string | number)[][] = [
    ['期数', '付息日期', '票息支付', '本金支付', '合计支付', '计息天数', '异常标记']
  ];
  report.cashFlows.forEach((cf) => {
    cfSheetData.push([
      cf.period,
      cf.paymentDate,
      new Decimal(cf.couponPayment).toFixed(4),
      new Decimal(cf.principalPayment).toFixed(4),
      new Decimal(cf.totalPayment).toFixed(4),
      cf.accruedDays,
      cf.isException ? cf.exceptionMessage || '是' : '否'
    ]);
  });
  const cfSheet = XLSX.utils.aoa_to_sheet(cfSheetData);
  XLSX.utils.book_append_sheet(wb, cfSheet, '现金流明细');

  const curveSheetData = [
    ['收益率曲线信息', '', '', ''],
    ['曲线名称', curve.name, '估值日', curve.valueDate],
    ['插值方法', curve.interpolationMethod, '版本', `v${curve.version}`],
    ['', '', '', ''],
    ['期限(年)', '收益率(%)', '', '']
  ];
  curve.points.forEach((p) => {
    curveSheetData.push([p.term.toFixed(2), new Decimal(p.rate).mul(100).toFixed(4), '', '']);
  });
  const curveSheet = XLSX.utils.aoa_to_sheet(curveSheetData);
  XLSX.utils.book_append_sheet(wb, curveSheet, '收益率曲线');

  const durSheetData = [
    ['久期计算结果', '', '', ''],
    ['麦考利久期', `${report.duration.macaulayDuration.toFixed(4)} 年`, '', ''],
    ['修正久期', report.duration.modifiedDuration.toFixed(4), '', ''],
    ['有效久期', report.duration.effectiveDuration.toFixed(4), '', ''],
    ['DV01', report.duration.dv01.toFixed(4), '', ''],
    ['', '', '', ''],
    ['计算步骤', '公式', '输入', '结果']
  ];
  report.duration.calculationSteps.forEach((step) => {
    durSheetData.push([
      step.description,
      step.formula,
      JSON.stringify(step.inputs),
      step.result
    ]);
  });
  const durSheet = XLSX.utils.aoa_to_sheet(durSheetData);
  XLSX.utils.book_append_sheet(wb, durSheet, '久期计算');

  const convSheetData = [
    ['凸性计算结果', '', '', ''],
    ['凸性', report.convexity.convexity.toFixed(4), '', ''],
    ['凸性修正(100bp)', report.convexity.convexityAdjustment.toFixed(4), '', ''],
    ['货币凸性', report.convexity.dollarConvexity.toFixed(4), '', ''],
    ['符号检查', report.convexity.signCheck, '', ''],
    ['', '', '', ''],
    ['计算步骤', '公式', '输入', '结果']
  ];
  report.convexity.calculationSteps.forEach((step) => {
    convSheetData.push([
      step.description,
      step.formula,
      JSON.stringify(step.inputs),
      step.result
    ]);
  });
  const convSheet = XLSX.utils.aoa_to_sheet(convSheetData);
  XLSX.utils.book_append_sheet(wb, convSheet, '凸性计算');

  const sensSheetData = [
    ['敏感性分析', '', '', ''],
    ['基准价格', report.sensitivity.basePrice.toFixed(4), '', ''],
    ['基准收益率', `${new Decimal(report.sensitivity.baseYield).mul(100).toFixed(4)}%`, '', ''],
    ['', '', '', ''],
    ['小变动分析', `+${report.params.yieldShiftBpSmall}bp`, `-${report.params.yieldShiftBpSmall}bp`, ''],
    ['价格', report.sensitivity.smallUpPrice.toFixed(4), report.sensitivity.smallDownPrice.toFixed(4), ''],
    ['久期效应(%)', report.sensitivity.smallDurationEffect.toFixed(4), '', ''],
    ['凸性效应(%)', report.sensitivity.smallConvexityEffect.toFixed(6), '', ''],
    ['', '', '', ''],
    ['大变动分析', `+${report.params.yieldShiftBpLarge}bp`, `-${report.params.yieldShiftBpLarge}bp`, ''],
    ['价格', report.sensitivity.largeUpPrice.toFixed(4), report.sensitivity.largeDownPrice.toFixed(4), ''],
    ['久期效应(%)', report.sensitivity.largeDurationEffect.toFixed(4), '', ''],
    ['凸性效应(%)', report.sensitivity.largeConvexityEffect.toFixed(4), '', ''],
    ['', '', '', ''],
    ['差异解释', report.sensitivity.priceDiffExplanation, '', '']
  ];
  const sensSheet = XLSX.utils.aoa_to_sheet(sensSheetData);
  XLSX.utils.book_append_sheet(wb, sensSheet, '敏感性分析');

  XLSX.writeFile(wb, `久期凸性报告_${bond.code}_${report.params.valuationDate}.xlsx`);
}

export function exportReportToPDF(report: Report, bond: Bond, _curve: YieldCurve): void {
  const doc = new jsPDF();
  let yPos = 20;

  doc.setFontSize(18);
  doc.text('债券久期凸性分析报告', 105, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(10);
  doc.text(`债券: ${bond.name} (${bond.code})`, 14, yPos);
  doc.text(`估值日: ${report.params.valuationDate}`, 140, yPos);
  yPos += 8;
  doc.text(`报告状态: ${report.status}`, 14, yPos);
  doc.text(`生成时间: ${report.createdAt.split('T')[0]}`, 140, yPos);
  yPos += 15;

  doc.setFontSize(12);
  doc.text('一、计算结果摘要', 14, yPos);
  yPos += 10;

  autoTable(doc, {
    startY: yPos,
    head: [['指标', '数值']],
    body: [
      ['麦考利久期', `${report.duration.macaulayDuration.toFixed(4)} 年`],
      ['修正久期', report.duration.modifiedDuration.toFixed(4)],
      ['有效久期', report.duration.effectiveDuration.toFixed(4)],
      ['DV01', report.duration.dv01.toFixed(4) + ' 元/bp'],
      ['凸性', report.convexity.convexity.toFixed(4)],
      ['凸性修正(100bp)', report.convexity.convexityAdjustment.toFixed(4) + '%'],
      ['基准价格', report.sensitivity.basePrice.toFixed(4) + ' 元']
    ],
    theme: 'grid'
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  doc.text('二、敏感性对比分析', 14, yPos);
  yPos += 10;

  autoTable(doc, {
    startY: yPos,
    head: [['变动幅度', `+${report.params.yieldShiftBpSmall}bp (小)`, `-${report.params.yieldShiftBpSmall}bp (小)`, `+${report.params.yieldShiftBpLarge}bp (大)`, `-${report.params.yieldShiftBpLarge}bp (大)`]],
    body: [
      ['价格(元)', 
        report.sensitivity.smallUpPrice.toFixed(4),
        report.sensitivity.smallDownPrice.toFixed(4),
        report.sensitivity.largeUpPrice.toFixed(4),
        report.sensitivity.largeDownPrice.toFixed(4)],
      ['久期效应(%)', 
        report.sensitivity.smallDurationEffect.toFixed(4),
        '-',
        report.sensitivity.largeDurationEffect.toFixed(4),
        '-'],
      ['凸性效应(%)',
        report.sensitivity.smallConvexityEffect.toFixed(6),
        '-',
        report.sensitivity.largeConvexityEffect.toFixed(4),
        '-']
    ],
    theme: 'grid'
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  doc.text('三、价格差异解释', 14, yPos);
  yPos += 8;
  doc.setFontSize(9);
  const explanationLines = doc.splitTextToSize(report.sensitivity.priceDiffExplanation, 180);
  doc.text(explanationLines, 14, yPos);

  yPos += explanationLines.length * 6 + 10;
  doc.setFontSize(12);
  doc.text('四、版本信息', 14, yPos);
  yPos += 8;
  doc.setFontSize(9);
  doc.text(`债券版本: v${report.bondVersion}`, 14, yPos);
  doc.text(`收益率曲线版本: v${report.curveVersion}`, 70, yPos);
  doc.text(`报告ID: ${report.id.substring(0, 8)}...`, 130, yPos);

  doc.save(`久期凸性报告_${bond.code}_${report.params.valuationDate}.pdf`);
}
