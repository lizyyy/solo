import { Anomaly, ChipPackage, ColorScale } from '../types';

export const detectAnomalies = (
  chipPackage: ChipPackage,
  colorScale: ColorScale
): Anomaly[] => {
  const anomalies: Anomaly[] = [];
  
  const allTemps = [
    ...chipPackage.powerPoints.map(p => p.temperature),
    ...chipPackage.tempSensors.filter(s => !s.isMissing).map(s => s.temperature)
  ];
  
  const actualMinTemp = Math.min(...allTemps);
  const actualMaxTemp = Math.max(...allTemps);
  const actualRange = actualMaxTemp - actualMinTemp;
  const colorScaleRange = colorScale.max - colorScale.min;
  const ratio = actualRange / colorScaleRange;
  
  if (ratio > 2 || ratio < 0.2) {
    anomalies.push({
      id: 'anomaly-color-scale',
      type: 'color_scale',
      severity: ratio > 2 ? 'high' : 'medium',
      message: `当前色阶范围 ${colorScale.min}°C-${colorScale.max}°C 与实际温度跨度 ${actualMinTemp}°C-${actualMaxTemp}°C 不匹配，建议调整色阶范围以获得更准确的热岛显示`,
      relatedItemId: 'color-scale'
    });
  }
  
  chipPackage.tempSensors.forEach(sensor => {
    if (sensor.isMissing) {
      anomalies.push({
        id: `anomaly-sensor-${sensor.id}`,
        type: 'missing_sensor',
        severity: 'high',
        message: `位置「${sensor.expectedLocation}」的温度采样点 ${sensor.name} 缺失，该区域热数据可能不准确`,
        location: sensor.position,
        relatedItemId: sensor.id
      });
    }
  });
  
  chipPackage.airChannels.forEach(channel => {
    if (channel.isReversed || channel.outletTemp < channel.inletTemp) {
      anomalies.push({
        id: `anomaly-wind-${channel.id}`,
        type: 'wind_reversed',
        severity: 'high',
        message: `风道「${channel.name}」风向可能反转，请检查：出风口温度(${channel.outletTemp.toFixed(1)}°C)低于进风口温度(${channel.inletTemp.toFixed(1)}°C)，这与正常散热逻辑不符`,
        relatedItemId: channel.id
      });
    }
  });
  
  return anomalies;
};

export const getSeverityColor = (severity: Anomaly['severity']): string => {
  switch (severity) {
    case 'low': return '#eab308';
    case 'medium': return '#f97316';
    case 'high': return '#ef4444';
    default: return '#6b7280';
  }
};

export const getSeverityBgColor = (severity: Anomaly['severity']): string => {
  switch (severity) {
    case 'low': return 'bg-yellow-500/20';
    case 'medium': return 'bg-orange-500/20';
    case 'high': return 'bg-red-500/20';
    default: return 'bg-gray-500/20';
  }
};
