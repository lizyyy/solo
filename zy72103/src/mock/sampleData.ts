import type { BatteryRecord } from '@/types';

export function generateSampleRecords(): BatteryRecord[] {
  const baseTime = new Date('2026-06-01T14:00:00');

  const rawData: Array<{
    timeOffset: number;
    temperature: number | null;
    voltage: number | null;
    current: number | null;
    internalResistance: number | null;
  }> = [
    { timeOffset: 0, temperature: 28.5, voltage: 3.72, current: 12.5, internalResistance: 2.1 },
    { timeOffset: 1, temperature: 29.1, voltage: 3.71, current: 12.6, internalResistance: 2.1 },
    { timeOffset: 2, temperature: 30.2, voltage: 3.70, current: 12.8, internalResistance: 2.2 },
    { timeOffset: 3, temperature: 31.5, voltage: 3.69, current: 13.0, internalResistance: 2.2 },
    { timeOffset: 4, temperature: 32.8, voltage: 3.68, current: 13.2, internalResistance: 2.3 },
    { timeOffset: 5, temperature: 34.2, voltage: 3.67, current: 13.5, internalResistance: 2.3 },
    { timeOffset: 6, temperature: null, voltage: 3.66, current: 13.7, internalResistance: 2.4 },
    { timeOffset: 7, temperature: 37.5, voltage: 3.65, current: 14.0, internalResistance: 2.4 },
    { timeOffset: 8, temperature: 39.1, voltage: 3.64, current: 14.2, internalResistance: 2.5 },
    { timeOffset: 9, temperature: 41.3, voltage: 3.63, current: 14.5, internalResistance: 2.5 },
    { timeOffset: 10, temperature: 43.8, voltage: 3.62, current: 14.8, internalResistance: 2.6 },
    { timeOffset: 11, temperature: 46.2, voltage: null, current: 15.0, internalResistance: 2.6 },
    { timeOffset: 12, temperature: 48.7, voltage: 3.60, current: 15.3, internalResistance: 2.7 },
    { timeOffset: 13, temperature: 52.4, voltage: 3.58, current: 15.6, internalResistance: 2.8 },
    { timeOffset: 14, temperature: 55.1, voltage: 3.56, current: 15.9, internalResistance: 2.9 },
    { timeOffset: 15, temperature: 55.1, voltage: 3.56, current: 15.9, internalResistance: 2.9 },
    { timeOffset: 16, temperature: 57.8, voltage: 3.54, current: 16.2, internalResistance: 3.0 },
    { timeOffset: 17, temperature: 60.0, voltage: 3.52, current: 16.5, internalResistance: 3.1 },
    { timeOffset: 18, temperature: 63.5, voltage: 3.50, current: 16.8, internalResistance: 3.2 },
    { timeOffset: 19, temperature: 67.2, voltage: 3.48, current: 17.1, internalResistance: 3.3 },
    { timeOffset: 20, temperature: 85.0, voltage: 3.40, current: 18.5, internalResistance: 4.1 },
    { timeOffset: 21, temperature: 92.0, voltage: 3.35, current: 19.2, internalResistance: 4.8 },
    { timeOffset: 22, temperature: null, voltage: 3.30, current: null, internalResistance: 5.2 },
  ];

  return rawData.map((d, index) => {
    const timestamp = new Date(baseTime.getTime() + d.timeOffset * 60000);
    return {
      id: `REC-${String(index + 1).padStart(3, '0')}`,
      timestamp,
      temperature: d.temperature,
      voltage: d.voltage,
      current: d.current,
      internalResistance: d.internalResistance,
      dataQuality: {
        isNull: false,
        isDuplicate: false,
        isBoundary: false,
        isExtreme: false,
      },
      detectionSteps: [],
    };
  });
}

export const sampleCsvContent = `时间,温度(°C),电压(V),电流(A),内阻(mΩ)
2026-06-01 14:00,28.5,3.72,12.5,2.1
2026-06-01 14:01,29.1,3.71,12.6,2.1
2026-06-01 14:02,30.2,3.70,12.8,2.2
2026-06-01 14:03,31.5,3.69,13.0,2.2
2026-06-01 14:04,32.8,3.68,13.2,2.3
2026-06-01 14:05,34.2,3.67,13.5,2.3
2026-06-01 14:06,,3.66,13.7,2.4
2026-06-01 14:07,37.5,3.65,14.0,2.4
2026-06-01 14:08,39.1,3.64,14.2,2.5
2026-06-01 14:09,41.3,3.63,14.5,2.5
2026-06-01 14:10,43.8,3.62,14.8,2.6
2026-06-01 14:11,46.2,,15.0,2.6
2026-06-01 14:12,48.7,3.60,15.3,2.7
2026-06-01 14:13,52.4,3.58,15.6,2.8
2026-06-01 14:14,55.1,3.56,15.9,2.9
2026-06-01 14:15,55.1,3.56,15.9,2.9
2026-06-01 14:16,57.8,3.54,16.2,3.0
2026-06-01 14:17,60.0,3.52,16.5,3.1
2026-06-01 14:18,63.5,3.50,16.8,3.2
2026-06-01 14:19,67.2,3.48,17.1,3.3
2026-06-01 14:20,85.0,3.40,18.5,4.1
2026-06-01 14:21,92.0,3.35,19.2,4.8
2026-06-01 14:22,,3.30,,5.2
`;
