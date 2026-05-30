import type { DataPoint, Simulation } from '@/types/simulation';

export function exportToCSV(dataPoints: DataPoint[], filename: string): void {
  const headers = ['时间(s)', '位置(m)', '速度(m/s)', '势能(J)', '动能(J)', '摩擦损耗(J)', '空气阻力损耗(J)', '总能量(J)', '补录'];
  const rows = dataPoints.map(d => [
    d.timestamp, d.position, d.velocity, d.potentialEnergy,
    d.kineticEnergy, d.frictionLoss, d.airDragLoss, d.totalEnergy,
    d.isSupplemented ? '是' : '否'
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

export function exportToJSON(simulation: Simulation, filename: string): void {
  const json = JSON.stringify(simulation, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
