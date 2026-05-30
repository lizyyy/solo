import * as XLSX from 'xlsx';
import { CalculationResult, VersionMeta, ValidationError, ERROR_TYPE_LABELS } from '../types';

export interface ExportData {
  versionMeta: VersionMeta;
  splThreshold: number;
  frequency: number;
  speakers: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    z: number;
    power: number;
    delay: number;
    angle: number;
    source: string;
    version: string;
  }>;
  errors: ValidationError[];
  results: CalculationResult[];
}

export function verifyDataConsistency(results: CalculationResult[]): boolean {
  if (results.length === 0) return true;

  for (const result of results) {
    const totalIntensityFromIntermediates = result.intermediates.reduce(
      (sum, im) => sum + im.intensity,
      0
    );

    if (Math.abs(totalIntensityFromIntermediates - result.totalIntensity) > 1e-6) {
      if (result.phaseIntermediates.length === 0) {
        console.error(
          `Data inconsistency at point (${result.x}, ${result.y}): ` +
            `calculated intensity ${totalIntensityFromIntermediates} ` +
            `!= stored intensity ${result.totalIntensity}`
        );
        return false;
      }
    }

    for (const im of result.intermediates) {
      const expectedSpl = 10 * Math.log10(im.intensity / 1e-12);
      if (Math.abs(expectedSpl - im.spl) > 0.1) {
        console.error(
          `Data inconsistency for speaker ${im.speakerId} at (${result.x}, ${result.y}): ` +
            `calculated SPL ${expectedSpl} != stored SPL ${im.spl}`
        );
        return false;
      }
    }
  }

  return true;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportJSON(data: ExportData, meta: VersionMeta): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `声压估算_${meta.version}_${timestamp}.json`;
  const content = JSON.stringify(data, null, 2);
  downloadFile(content, filename, 'application/json');
}

export function exportCSV(
  results: CalculationResult[],
  meta: VersionMeta,
  errors: ValidationError[]
): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `声压估算_${meta.version}_${timestamp}.csv`;

  let csvContent = '';

  csvContent += '# 舞台声压叠加估算报告\n';
  csvContent += `# 版本: ${meta.version}\n`;
  csvContent += `# 来源: ${meta.source}\n`;
  csvContent += `# 计算时间: ${meta.timestamp}\n`;
  csvContent += `# 分析频率: ${meta.frequency} Hz\n`;
  csvContent += `# 声压阈值: ${meta.splThreshold} dB\n`;
  csvContent += `# 音箱数量: ${meta.speakerCount}\n`;
  csvContent += `# 测点数量: ${meta.pointCount}\n`;
  csvContent += '\n';

  if (errors.length > 0) {
    csvContent += '# === 校验错误 ===\n';
    csvContent += '# 错误类型,严重程度,影响测点数量,描述\n';
    errors.forEach((err) => {
      csvContent += `${ERROR_TYPE_LABELS[err.type]},${err.severity === 'error' ? '错误' : '警告'},${err.affectedCount},"${err.description}"\n`;
    });
    csvContent += '\n';
  }

  csvContent += '# === 计算结果明细 ===\n';
  csvContent += '测点ID,X坐标(m),Y坐标(m),总声压级(dB),总声强(W/m²),最大相位差(°),最小抵消系数,错误标记\n';

  results.forEach((result) => {
    const errorFlags = result.errors.map((e) => ERROR_TYPE_LABELS[e.type]).join(';') || '无';
    csvContent += `${result.pointId},${result.x},${result.y},${result.totalSpl.toFixed(2)},${result.totalIntensity.toExponential(6)},${result.maxPhaseDiff.toFixed(1)},${result.phaseCancelFactor.toFixed(4)},${errorFlags}\n`;
  });
  csvContent += '\n';

  csvContent += '# === 关键中间量（声压叠加）===\n';
  csvContent += '测点ID,X坐标,Y坐标,音箱名称,距离(m),声压级(dB),声强(W/m²),传播时间(s),总时间(s)\n';

  results.forEach((result) => {
    result.intermediates.forEach((im) => {
      csvContent += `${result.pointId},${result.x},${result.y},${im.speakerName},${im.distance.toFixed(3)},${im.spl.toFixed(2)},${im.intensity.toExponential(6)},${im.travelTime.toFixed(6)},${im.totalTime.toFixed(6)}\n`;
    });
  });
  csvContent += '\n';

  csvContent += '# === 关键中间量（相位估算）===\n';
  csvContent += '测点ID,X坐标,Y坐标,音箱1,音箱2,时间差(s),相位差(°),抵消系数\n';

  results.forEach((result) => {
    result.phaseIntermediates.forEach((pi) => {
      csvContent += `${result.pointId},${result.x},${result.y},${pi.speakerName1},${pi.speakerName2},${pi.timeDiff.toFixed(6)},${pi.phaseDiff.toFixed(1)},${pi.cancelFactor.toFixed(4)}\n`;
    });
  });

  downloadFile(csvContent, filename, 'text/csv;charset=utf-8-sig');
}

export function exportExcel(
  results: CalculationResult[],
  meta: VersionMeta,
  errors: ValidationError[]
): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `声压估算_${meta.version}_${timestamp}.xlsx`;

  const wb = XLSX.utils.book_new();

  const summaryData: (string | number)[][] = [
    ['舞台声压叠加估算报告'],
    ['版本', meta.version],
    ['来源', meta.source],
    ['计算时间', meta.timestamp],
    ['分析频率', `${meta.frequency} Hz`],
    ['声压阈值', `${meta.splThreshold} dB`],
    ['音箱数量', meta.speakerCount],
    ['测点数量', meta.pointCount],
    [],
  ];

  if (errors.length > 0) {
    summaryData.push(['=== 校验错误 ===']);
    summaryData.push(['错误类型', '严重程度', '影响测点数量', '描述']);
    errors.forEach((err) => {
      summaryData.push([
        ERROR_TYPE_LABELS[err.type],
        err.severity === 'error' ? '错误' : '警告',
        err.affectedCount,
        err.description,
      ]);
    });
    summaryData.push([]);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws1, '概要');

  const resultsData: (string | number)[][] = [
    ['测点ID', 'X坐标(m)', 'Y坐标(m)', '总声压级(dB)', '总声强(W/m²)', '最大相位差(°)', '最小抵消系数', '错误标记'],
  ];
  results.forEach((result) => {
    const errorFlags = result.errors.map((e) => ERROR_TYPE_LABELS[e.type]).join(';') || '无';
    resultsData.push([
      result.pointId,
      result.x,
      result.y,
      parseFloat(result.totalSpl.toFixed(2)),
      result.totalIntensity,
      parseFloat(result.maxPhaseDiff.toFixed(1)),
      parseFloat(result.phaseCancelFactor.toFixed(4)),
      errorFlags,
    ]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(resultsData);
  XLSX.utils.book_append_sheet(wb, ws2, '计算结果');

  const intermediateData: (string | number)[][] = [
    ['测点ID', 'X坐标', 'Y坐标', '音箱名称', '距离(m)', '声压级(dB)', '声强(W/m²)', '传播时间(s)', '总时间(s)'],
  ];
  results.forEach((result) => {
    result.intermediates.forEach((im) => {
      intermediateData.push([
        result.pointId,
        result.x,
        result.y,
        im.speakerName,
        parseFloat(im.distance.toFixed(3)),
        parseFloat(im.spl.toFixed(2)),
        im.intensity,
        parseFloat(im.travelTime.toFixed(6)),
        parseFloat(im.totalTime.toFixed(6)),
      ]);
    });
  });
  const ws3 = XLSX.utils.aoa_to_sheet(intermediateData);
  XLSX.utils.book_append_sheet(wb, ws3, '声压中间量');

  const phaseData: (string | number)[][] = [
    ['测点ID', 'X坐标', 'Y坐标', '音箱1', '音箱2', '时间差(s)', '相位差(°)', '抵消系数'],
  ];
  results.forEach((result) => {
    result.phaseIntermediates.forEach((pi) => {
      phaseData.push([
        result.pointId,
        result.x,
        result.y,
        pi.speakerName1,
        pi.speakerName2,
        parseFloat(pi.timeDiff.toFixed(6)),
        parseFloat(pi.phaseDiff.toFixed(1)),
        parseFloat(pi.cancelFactor.toFixed(4)),
      ]);
    });
  });
  const ws4 = XLSX.utils.aoa_to_sheet(phaseData);
  XLSX.utils.book_append_sheet(wb, ws4, '相位中间量');

  XLSX.writeFile(wb, filename);
}
