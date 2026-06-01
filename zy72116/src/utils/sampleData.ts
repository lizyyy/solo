import { DataPoint, AnomalyConfig, Metadata } from '../types';

export const sampleDataCSV = `时间,离心力(N),方向,单位,备注
2024-01-15 08:00:00,1250,正,N,正常运行
2024-01-15 08:00:05,1280,正,N,正常运行
2024-01-15 08:00:10,1310,正,N,正常运行
2024-01-15 08:00:15,2850,正,N,⚠️ 极端值
2024-01-15 08:00:20,1270,正,N,恢复正常
2024-01-15 08:00:25,1240,正,N,正常运行
2024-01-15 08:00:30,1290,正,N,正常运行
2024-01-15 08:00:35,1300,正,N,正常运行
2024-01-15 08:00:40,1260,正,N,正常运行
2024-01-15 08:00:45,3100,正,N,⚠️ 极端值
2024-01-15 08:00:50,1280,正,N,恢复正常
2024-01-15 08:00:55,1250,正,N,正常运行`;

export const dirtyDataCSV = `时间,离心力(N),方向,单位,备注
2024-01-15 08:00:00,1250,,N,缺失方向
2024-01-15 08:00:05,abc,正,N,无效数值
2024-01-15 08:00:10,1310,正,PSI,异常单位
2024-01-15 08:00:20,1270,正,N,跳过一行
2024-01-15 08:00:55,1250,正,N,最后一行`;

export function generateSampleData(): DataPoint[] {
  return [
    { id: 's1', timestamp: new Date('2024-01-15 08:00:00').getTime(), timeLabel: '08:00:00', centrifugalForce: 1250, direction: 'positive', unit: 'N', remark: '正常运行' },
    { id: 's2', timestamp: new Date('2024-01-15 08:00:05').getTime(), timeLabel: '08:00:05', centrifugalForce: 1280, direction: 'positive', unit: 'N', remark: '正常运行' },
    { id: 's3', timestamp: new Date('2024-01-15 08:00:10').getTime(), timeLabel: '08:00:10', centrifugalForce: 1310, direction: 'positive', unit: 'N', remark: '正常运行' },
    { id: 's4', timestamp: new Date('2024-01-15 08:00:15').getTime(), timeLabel: '08:00:15', centrifugalForce: 2850, direction: 'positive', unit: 'N', remark: '⚠️ 极端值' },
    { id: 's5', timestamp: new Date('2024-01-15 08:00:20').getTime(), timeLabel: '08:00:20', centrifugalForce: 1270, direction: 'positive', unit: 'N', remark: '恢复正常' },
    { id: 's6', timestamp: new Date('2024-01-15 08:00:25').getTime(), timeLabel: '08:00:25', centrifugalForce: 1240, direction: 'positive', unit: 'N', remark: '正常运行' },
    { id: 's7', timestamp: new Date('2024-01-15 08:00:30').getTime(), timeLabel: '08:00:30', centrifugalForce: 1290, direction: 'positive', unit: 'N', remark: '正常运行' },
    { id: 's8', timestamp: new Date('2024-01-15 08:00:35').getTime(), timeLabel: '08:00:35', centrifugalForce: 1300, direction: 'positive', unit: 'N', remark: '正常运行' },
    { id: 's9', timestamp: new Date('2024-01-15 08:00:40').getTime(), timeLabel: '08:00:40', centrifugalForce: 1260, direction: 'positive', unit: 'N', remark: '正常运行' },
    { id: 's10', timestamp: new Date('2024-01-15 08:00:45').getTime(), timeLabel: '08:00:45', centrifugalForce: 3100, direction: 'positive', unit: 'N', remark: '⚠️ 极端值' },
    { id: 's11', timestamp: new Date('2024-01-15 08:00:50').getTime(), timeLabel: '08:00:50', centrifugalForce: 1280, direction: 'positive', unit: 'N', remark: '恢复正常' },
    { id: 's12', timestamp: new Date('2024-01-15 08:00:55').getTime(), timeLabel: '08:00:55', centrifugalForce: 1250, direction: 'positive', unit: 'N', remark: '正常运行' },
  ];
}

export const defaultAnomalyConfig: AnomalyConfig = {
  method: 'iqr',
  iqrMultiplier: 1.5,
  zscoreThreshold: 3.0,
  manualThreshold: { min: 0, max: 5000 }
};

export const defaultMetadata: Metadata = {
  source: '样例数据 - 游乐设施离心力测试',
  processedAt: Date.now(),
  processor: '项目助理小宋',
  remarks: '这是用于演示的样例数据，包含2个极端值异常点'
};
