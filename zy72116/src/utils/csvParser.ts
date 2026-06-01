import { DataPoint, Direction } from '../types';

export function parseCSV(content: string): DataPoint[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const dataPoints: DataPoint[] = [];

  const timeIndex = headers.findIndex(h => h.includes('时间') || h.includes('time'));
  const forceIndex = headers.findIndex(h => h.includes('离心力') || h.includes('force') || h.includes('Force'));
  const directionIndex = headers.findIndex(h => h.includes('方向') || h.includes('direction'));
  const unitIndex = headers.findIndex(h => h.includes('单位') || h.includes('unit'));
  const remarkIndex = headers.findIndex(h => h.includes('备注') || h.includes('remark'));

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    
    const timeStr = values[timeIndex] || '';
    const forceStr = values[forceIndex] || '0';
    const directionStr = values[directionIndex] || '';
    const unit = values[unitIndex] || 'N';
    const remark = values[remarkIndex] || '';

    let timestamp = Date.now();
    let timeLabel = timeStr;
    
    if (timeStr) {
      const parsedDate = new Date(timeStr);
      if (!isNaN(parsedDate.getTime())) {
        timestamp = parsedDate.getTime();
        timeLabel = timeStr;
      }
    }

    let direction: Direction = 'unknown';
    if (directionStr.includes('正') || directionStr.toLowerCase() === 'positive' || directionStr === '+') {
      direction = 'positive';
    } else if (directionStr.includes('负') || directionStr.toLowerCase() === 'negative' || directionStr === '-') {
      direction = 'negative';
    }

    const centrifugalForce = parseFloat(forceStr) || 0;

    dataPoints.push({
      id: `point-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      timeLabel,
      centrifugalForce,
      direction,
      unit,
      remark
    });
  }

  return dataPoints.sort((a, b) => a.timestamp - b.timestamp);
}

export function generateCSV(dataPoints: DataPoint[]): string {
  const headers = ['时间', '离心力(N)', '方向', '单位', '是否异常', '异常原因', '备注'];
  const rows = dataPoints.map(point => {
    const direction = point.direction === 'positive' ? '正' : point.direction === 'negative' ? '负' : '未知';
    return [
      point.timeLabel,
      point.centrifugalForce.toString(),
      direction,
      point.unit,
      point.isAnomaly ? '是' : '否',
      point.anomalyReason || '',
      point.remark || ''
    ].join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
