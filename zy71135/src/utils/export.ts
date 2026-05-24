import { Bay, Cargo, CenterOfGravity, Alert, LoadRecord } from '../types';
import { cargoTypeNames, dangerLevelNames } from './sampleData';

export function generateReport(
  bays: Bay[],
  cargoList: Cargo[],
  centerOfGravity: CenterOfGravity,
  alerts: Alert[],
  loadHistory: LoadRecord[]
): string {
  const loadedBays = bays.filter((bay) => bay.occupiedBy);
  const unloadedCargo = cargoList.filter(
    (cargo) => !bays.some((bay) => bay.occupiedBy === cargo.id)
  );
  const totalWeight = loadedBays.reduce((sum, bay) => {
    const cargo = cargoList.find((c) => c.id === bay.occupiedBy);
    return sum + (cargo?.weight || 0);
  }, 0);

  const reportLines: string[] = [];
  const date = new Date().toLocaleString('zh-CN');

  reportLines.push('='.repeat(60));
  reportLines.push('           船舱装载平衡报告');
  reportLines.push('='.repeat(60));
  reportLines.push(`生成时间: ${date}`);
  reportLines.push('');

  reportLines.push('【装载概览】');
  reportLines.push('-'.repeat(40));
  reportLines.push(`舱位总数: ${bays.length}`);
  reportLines.push(`已装载舱位: ${loadedBays.length} (${((loadedBays.length / bays.length) * 100).toFixed(1)}%)`);
  reportLines.push(`货物总数: ${cargoList.length}`);
  reportLines.push(`待装货物: ${unloadedCargo.length}`);
  reportLines.push(`总装载重量: ${totalWeight.toFixed(1)} 吨`);
  reportLines.push('');

  reportLines.push('【重心信息】');
  reportLines.push('-'.repeat(40));
  reportLines.push(`重心坐标: X=${centerOfGravity.x.toFixed(2)}, Y=${centerOfGravity.y.toFixed(2)}, Z=${centerOfGravity.z.toFixed(2)}`);
  reportLines.push(`偏移程度: ${(centerOfGravity.offset * 100).toFixed(1)}%`);
  reportLines.push(`状态: ${centerOfGravity.isWarning ? '⚠️  偏移警告' : '✓ 正常'}`);
  reportLines.push('');

  reportLines.push('【已装载货物清单】');
  reportLines.push('-'.repeat(40));
  loadedBays.forEach((bay, index) => {
    const cargo = cargoList.find((c) => c.id === bay.occupiedBy);
    if (!cargo) return;
    
    const typeName = cargoTypeNames[cargo.type];
    const powerInfo = cargo.requiresPower ? ' [需供电]' : '';
    const dangerInfo = cargo.dangerLevel ? ` [${dangerLevelNames[cargo.dangerLevel]}]` : '';
    
    reportLines.push(`${index + 1}. ${cargo.name}`);
    reportLines.push(`   类型: ${typeName}${powerInfo}${dangerInfo}`);
    reportLines.push(`   重量: ${cargo.weight} 吨`);
    reportLines.push(`   舱位: ${bay.id} (行${bay.position.row}, 层${bay.position.tier}, 列${bay.position.stack})`);
    reportLines.push('');
  });

  if (unloadedCargo.length > 0) {
    reportLines.push('【待装货物清单】');
    reportLines.push('-'.repeat(40));
    unloadedCargo.forEach((cargo, index) => {
      const typeName = cargoTypeNames[cargo.type];
      const powerInfo = cargo.requiresPower ? ' [需供电]' : '';
      const dangerInfo = cargo.dangerLevel ? ` [${dangerLevelNames[cargo.dangerLevel]}]` : '';
      
      reportLines.push(`${index + 1}. ${cargo.name}`);
      reportLines.push(`   类型: ${typeName}${powerInfo}${dangerInfo}`);
      reportLines.push(`   重量: ${cargo.weight} 吨`);
      reportLines.push('');
    });
  }

  reportLines.push('【告警信息】');
  reportLines.push('-'.repeat(40));
  if (alerts.length === 0) {
    reportLines.push('✓ 无告警，装载状态良好');
  } else {
    const errors = alerts.filter((a) => a.severity === 'error');
    const warnings = alerts.filter((a) => a.severity === 'warning');
    
    reportLines.push(`错误: ${errors.length} 项, 警告: ${warnings.length} 项`);
    reportLines.push('');
    
    alerts.forEach((alert, index) => {
      const severityIcon = alert.severity === 'error' ? '❌' : '⚠️';
      reportLines.push(`${severityIcon} [${index + 1}] ${alert.message}`);
    });
  }
  reportLines.push('');

  reportLines.push('【装载步骤历史】');
  reportLines.push('-'.repeat(40));
  loadHistory.forEach((record, index) => {
    const cargo = cargoList.find((c) => c.id === record.cargoId);
    const time = new Date(record.timestamp).toLocaleTimeString('zh-CN');
    const action = record.action === 'load' ? '装载' : '卸载';
    reportLines.push(`${index + 1}. [${time}] ${action}: ${cargo?.name || record.cargoId} -> ${record.bayId}`);
  });

  reportLines.push('');
  reportLines.push('='.repeat(60));
  reportLines.push('                  报告结束');
  reportLines.push('='.repeat(60));

  return reportLines.join('\n');
}

export function downloadReport(report: string): void {
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `船舱装载报告_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
