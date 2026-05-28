import {
  HoistPoint,
  Equipment,
  CableSpec,
  CalculationParams,
  VerificationReport,
  ImportData,
  HoistPointResult,
} from '../types';

export function exportToJSON(
  points: HoistPoint[],
  equipment: Equipment[],
  cableSpec: CableSpec,
  params: CalculationParams
): string {
  const data: ImportData = {
    version: '1.0',
    hoistPoints: points,
    equipment,
    cableSpec,
    params,
  };
  return JSON.stringify(data, null, 2);
}

export function exportReportToJSON(report: VerificationReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportToCSV(pointResults: HoistPointResult[]): string {
  const headers = [
    '吊点名称',
    'X坐标(m)',
    'Y坐标(m)',
    '高度(m)',
    '吊装角度(°)',
    '设备总重(kg)',
    '垂直分力(kN)',
    '水平分力(kN)',
    '钢丝绳受力(kN)',
    '安全系数',
    '安全判定',
  ];

  const rows = pointResults.map((r) => [
    r.pointName,
    r.x.toFixed(2),
    r.y.toFixed(2),
    r.z.toFixed(2),
    r.angle?.toString() ?? '未设置',
    r.totalWeight.toFixed(2),
    r.verticalForce.toFixed(3),
    r.horizontalForce.toFixed(3),
    r.cableForce.toFixed(3),
    r.safetyRatio === Infinity ? '无载荷' : r.safetyRatio.toFixed(2),
    r.isSafe ? '安全' : '不安全',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return '\uFEFF' + csvContent;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
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

export function parseImportData(jsonString: string): ImportData | null {
  try {
    const data = JSON.parse(jsonString);
    if (!data.version || !data.hoistPoints || !data.equipment) {
      return null;
    }
    return data as ImportData;
  } catch {
    return null;
  }
}

export function generateReadableSummary(report: VerificationReport): string {
  const statusText: Record<string, string> = {
    safe: '安全',
    warning: '存在警告',
    danger: '存在危险',
  };

  const date = new Date(report.generatedAt).toLocaleString('zh-CN');

  let summary = `═══════════════════════════════════════════\n`;
  summary += `      舞台吊点载荷校核报告 (人读摘要)\n`;
  summary += `═══════════════════════════════════════════\n\n`;
  summary += `生成时间: ${date}\n`;
  summary += `报告版本: ${report.version}\n\n`;

  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  summary += `一、总体评估\n`;
  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  summary += `  安全状态: ${statusText[report.summary.overallStatus]}\n`;
  summary += `  吊点数量: ${report.summary.totalPoints} 个\n`;
  summary += `  设备总数: ${report.summary.totalEquipment} 台\n`;
  summary += `  设备总重: ${report.summary.totalWeight.toFixed(2)} kg\n`;
  summary += `  最大绳力: ${report.summary.maxCableForce.toFixed(3)} kN\n`;
  summary += `  最小安全系数: ${report.summary.minSafetyRatio.toFixed(2)}\n\n`;

  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  summary += `二、分项检查结果\n`;
  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const statusIcons: Record<string, string> = {
    pass: '✓',
    warning: '⚠',
    error: '✗',
  };

  report.checkResults.forEach((check, index) => {
    const icon = statusIcons[check.status];
    summary += `  ${index + 1}. [${icon}] ${check.message}\n`;
    if (check.location) {
      summary += `     位置: ${check.location}\n`;
    }
    summary += `     建议: ${check.suggestion}\n\n`;
  });

  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  summary += `三、各吊点详细结果\n`;
  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  report.pointResults.forEach((point, index) => {
    const safeIcon = point.isSafe ? '✓ 安全' : '✗ 不安全';
    summary += `  吊点 ${index + 1}: ${point.pointName} [${safeIcon}]\n`;
    summary += `    ├─ 坐标位置: (${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)}) m\n`;
    summary += `    ├─ 吊装角度: ${point.angle?.toString() ?? '未设置'}°\n`;
    summary += `    ├─ 载荷重量: ${point.totalWeight.toFixed(2)} kg\n`;
    summary += `    ├─ 垂直分力: ${point.verticalForce.toFixed(3)} kN\n`;
    summary += `    ├─ 水平分力: ${point.horizontalForce.toFixed(3)} kN\n`;
    summary += `    ├─ 绳力: ${point.cableForce.toFixed(3)} kN\n`;
    summary += `    └─ 安全系数: ${point.safetyRatio === Infinity ? '无载荷' : point.safetyRatio.toFixed(2)}\n\n`;
  });

  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  summary += `四、钢丝绳参数\n`;
  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  summary += `  直径: ${report.cableSpec.diameter} mm\n`;
  summary += `  材质: ${report.cableSpec.material}\n`;
  summary += `  破断载荷: ${report.cableSpec.breakingLoad} kN\n\n`;

  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  summary += `五、计算参数\n`;
  summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  summary += `  要求安全系数: ${report.params.safetyFactor}\n`;
  summary += `  重力加速度: ${report.params.gravity} m/s²\n\n`;

  summary += `═══════════════════════════════════════════\n`;
  summary += `           报告结束\n`;
  summary += `═══════════════════════════════════════════\n`;

  return summary;
}

export const STORAGE_KEY = 'hoist-load-verification-data';

export function saveToLocalStorage(
  points: HoistPoint[],
  equipment: Equipment[],
  cableSpec: CableSpec,
  params: CalculationParams
): void {
  const data: ImportData = {
    version: '1.0',
    hoistPoints: points,
    equipment,
    cableSpec,
    params,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadFromLocalStorage(): ImportData | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  return parseImportData(stored);
}
