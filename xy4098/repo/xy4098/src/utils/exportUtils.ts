import Papa from 'papaparse';
import type { Alert, InspectionSuggestion, Sensor, WorkOrder, Thresholds } from '../types';
import { formatTimestamp } from './dataParser';

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

export function exportInspectionSuggestionsToMarkdown(
  suggestions: InspectionSuggestion[],
  alerts: Alert[],
  workOrders: WorkOrder[],
  sensors: Sensor[],
  thresholds: Thresholds
): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  let markdown = `# 室内热区巡检建议报告\n\n`;
  markdown += `**生成时间**: ${formatTimestamp(now.getTime())}\n\n`;
  markdown += `---\n\n`;

  const highPriority = suggestions.filter((s) => s.priority === 'high');
  const mediumPriority = suggestions.filter((s) => s.priority === 'medium');
  const lowPriority = suggestions.filter((s) => s.priority === 'low');

  markdown += `## 摘要\n\n`;
  markdown += `- **高优先级问题**: ${highPriority.length} 个\n`;
  markdown += `- **中优先级问题**: ${mediumPriority.length} 个\n`;
  markdown += `- **低优先级问题**: ${lowPriority.length} 个\n`;
  markdown += `- **活动告警**: ${alerts.length} 个\n`;
  markdown += `- **待处理工单**: ${workOrders.filter((o) => o.status === 'pending' || o.status === 'in_progress').length} 个\n\n`;
  markdown += `---\n\n`;

  markdown += `## 阈值配置\n\n`;
  markdown += `| 参数 | 下限 | 上限 |\n`;
  markdown += `|------|------|------|\n`;
  markdown += `| 温度 | ${thresholds.temperatureMin}°C | ${thresholds.temperatureMax}°C |\n`;
  markdown += `| 湿度 | ${thresholds.humidityMin}% | ${thresholds.humidityMax}% |\n\n`;
  markdown += `---\n\n`;

  if (highPriority.length > 0) {
    markdown += `## ⚠️ 高优先级巡检建议\n\n`;
    highPriority.forEach((suggestion, index) => {
      markdown += `### ${index + 1}. ${suggestion.issueType}\n\n`;
      markdown += `**位置**: ${suggestion.floorId} / ${suggestion.zoneId}`;
      if (suggestion.sensorId) {
        const sensor = sensors.find((s) => s.id === suggestion.sensorId);
        markdown += ` / ${sensor?.name || suggestion.sensorId}`;
      }
      markdown += `\n\n`;
      markdown += `**建议**: ${suggestion.suggestion}\n\n`;
      markdown += `---\n\n`;
    });
  }

  if (mediumPriority.length > 0) {
    markdown += `## ⚡ 中优先级巡检建议\n\n`;
    mediumPriority.forEach((suggestion, index) => {
      markdown += `### ${index + 1}. ${suggestion.issueType}\n\n`;
      markdown += `**位置**: ${suggestion.floorId} / ${suggestion.zoneId}`;
      if (suggestion.sensorId) {
        const sensor = sensors.find((s) => s.id === suggestion.sensorId);
        markdown += ` / ${sensor?.name || suggestion.sensorId}`;
      }
      markdown += `\n\n`;
      markdown += `**建议**: ${suggestion.suggestion}\n\n`;
      markdown += `---\n\n`;
    });
  }

  if (lowPriority.length > 0) {
    markdown += `## 📋 低优先级巡检建议\n\n`;
    lowPriority.forEach((suggestion, index) => {
      markdown += `### ${index + 1}. ${suggestion.issueType}\n\n`;
      markdown += `**位置**: ${suggestion.floorId} / ${suggestion.zoneId}`;
      if (suggestion.sensorId) {
        const sensor = sensors.find((s) => s.id === suggestion.sensorId);
        markdown += ` / ${sensor?.name || suggestion.sensorId}`;
      }
      markdown += `\n\n`;
      markdown += `**建议**: ${suggestion.suggestion}\n\n`;
      markdown += `---\n\n`;
    });
  }

  const activeWorkOrders = workOrders.filter((o) => o.status === 'pending' || o.status === 'in_progress');
  if (activeWorkOrders.length > 0) {
    markdown += `## 📋 活跃工单\n\n`;
    markdown += `| 工单ID | 标题 | 状态 | 优先级 | 指派给 | 创建时间 |\n`;
    markdown += `|--------|------|------|--------|--------|----------|\n`;
    activeWorkOrders.forEach((order) => {
      const statusMap: Record<string, string> = {
        pending: '待处理',
        in_progress: '处理中',
        completed: '已完成',
        cancelled: '已取消',
      };
      const priorityMap: Record<string, string> = {
        low: '低',
        medium: '中',
        high: '高',
        critical: '紧急',
      };
      markdown += `| ${order.id} | ${order.title} | ${statusMap[order.status] || order.status} | ${priorityMap[order.priority] || order.priority} | ${order.assignedTo} | ${formatTimestamp(order.createdAt)} |\n`;
    });
    markdown += `\n`;
    markdown += `---\n\n`;
  }

  markdown += `## 附录\n\n`;
  markdown += `### 传感器状态概览\n\n`;
  markdown += `| 传感器ID | 名称 | 楼层 | 区域 | 状态 |\n`;
  markdown += `|----------|------|------|------|------|\n`;
  sensors.forEach((sensor) => {
    const hasAlert = alerts.some((a) => a.sensorId === sensor.id);
    const lastReading = sensor.readings[sensor.readings.length - 1];
    const isOnline = lastReading?.isOnline ?? true;
    let status = '正常';
    if (hasAlert) status = '有告警';
    else if (!isOnline) status = '离线';
    
    markdown += `| ${sensor.id} | ${sensor.name} | ${sensor.floorId} | ${sensor.zoneId} | ${status} |\n`;
  });
  markdown += `\n`;

  markdown += `---\n\n`;
  markdown += `*此报告由室内热区巡检沙盘系统自动生成*\n`;

  return markdown;
}

export function exportInspectionSuggestionsToCSV(
  suggestions: InspectionSuggestion[],
  alerts: Alert[],
  workOrders: WorkOrder[],
  sensors: Sensor[]
): string {
  const csvData = suggestions.map((suggestion) => {
    const sensor = sensors.find((s) => s.id === suggestion.sensorId);
    const relatedAlerts = alerts.filter((a) => 
      a.sensorId === suggestion.sensorId || 
      (a.zoneId === suggestion.zoneId && a.floorId === suggestion.floorId)
    );
    const relatedWorkOrders = workOrders.filter((o) => 
      o.sensorId === suggestion.sensorId ||
      (o.zoneId === suggestion.zoneId && o.floorId === suggestion.floorId)
    );

    return {
      '优先级': suggestion.priority === 'high' ? '高' : suggestion.priority === 'medium' ? '中' : '低',
      '问题类型': suggestion.issueType,
      '楼层': suggestion.floorId,
      '区域': suggestion.zoneId,
      '传感器ID': suggestion.sensorId || '',
      '传感器名称': sensor?.name || '',
      '巡检建议': suggestion.suggestion,
      '关联告警数': relatedAlerts.length,
      '关联工单数': relatedWorkOrders.length,
    };
  });

  return Papa.unparse(csvData);
}

export function exportAlertsToCSV(alerts: Alert[]): string {
  const csvData = alerts.map((alert) => {
    const typeMap: Record<string, string> = {
      continuous_threshold: '连续超阈',
      sensor_offline: '传感器离线',
      repeated_dispatch: '重复派单',
    };
    const severityMap: Record<string, string> = {
      warning: '警告',
      error: '错误',
      critical: '严重',
    };

    return {
      '告警ID': alert.id,
      '类型': typeMap[alert.type] || alert.type,
      '严重程度': severityMap[alert.severity] || alert.severity,
      '标题': alert.title,
      '描述': alert.description,
      '楼层': alert.floorId,
      '区域': alert.zoneId || '',
      '传感器ID': alert.sensorId || '',
      '关联工单ID': alert.relatedWorkOrders?.join(', ') || '',
      '关联传感器ID': alert.relatedSensorIds?.join(', ') || '',
      '时间': formatTimestamp(alert.timestamp),
      '持续时长(分钟)': alert.data.continuousDuration ? Math.round(alert.data.continuousDuration / 60000) : '',
      '离线时长(分钟)': alert.data.offlineDuration ? Math.round(alert.data.offlineDuration / 60000) : '',
      '派单次数': alert.data.dispatchCount || '',
    };
  });

  return Papa.unparse(csvData);
}

export function exportSensorReadingsToCSV(sensors: Sensor[]): string {
  const allReadings: Array<{
    '传感器ID': string;
    '传感器名称': string;
    '楼层': string;
    '区域': string;
    '时间': string;
    '温度(°C)': number;
    '湿度(%)': number;
    '在线状态': string;
  }> = [];

  sensors.forEach((sensor) => {
    sensor.readings.forEach((reading) => {
      allReadings.push({
        '传感器ID': sensor.id,
        '传感器名称': sensor.name,
        '楼层': sensor.floorId,
        '区域': sensor.zoneId,
        '时间': formatTimestamp(reading.timestamp),
        '温度(°C)': parseFloat(reading.temperature.toFixed(2)),
        '湿度(%)': parseFloat(reading.humidity.toFixed(2)),
        '在线状态': reading.isOnline ? '在线' : '离线',
      });
    });
  });

  return Papa.unparse(allReadings);
}

export function downloadMarkdown(
  suggestions: InspectionSuggestion[],
  alerts: Alert[],
  workOrders: WorkOrder[],
  sensors: Sensor[],
  thresholds: Thresholds
): void {
  const markdown = exportInspectionSuggestionsToMarkdown(
    suggestions,
    alerts,
    workOrders,
    sensors,
    thresholds
  );
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(markdown, `巡检建议报告_${dateStr}.md`, 'text/markdown');
}

export function downloadInspectionCSV(
  suggestions: InspectionSuggestion[],
  alerts: Alert[],
  workOrders: WorkOrder[],
  sensors: Sensor[]
): void {
  const csv = exportInspectionSuggestionsToCSV(suggestions, alerts, workOrders, sensors);
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(csv, `巡检建议_${dateStr}.csv`, 'text/csv;charset=utf-8');
}

export function downloadAlertsCSV(alerts: Alert[]): void {
  const csv = exportAlertsToCSV(alerts);
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(csv, `告警列表_${dateStr}.csv`, 'text/csv;charset=utf-8');
}

export function downloadSensorReadingsCSV(sensors: Sensor[]): void {
  const csv = exportSensorReadingsToCSV(sensors);
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(csv, `传感器读数_${dateStr}.csv`, 'text/csv;charset=utf-8');
}
