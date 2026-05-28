import type { AcousticDataset, AbsorptionData, AcousticReading } from '../models/acoustic';
import {
  createShoeBoxHall,
  createSeatGrid,
  createSoundSources,
  generateRayPaths,
} from '../../utils/geometryBuilder';

export function generateNormalDataset(): AcousticDataset {
  const HALL_WIDTH = 22;
  const HALL_HEIGHT = 10;
  const HALL_DEPTH = 30;
  const STAGE_Z = -HALL_DEPTH / 2 + 3;
  const SEAT_START_Z = -HALL_DEPTH / 2 + 6;
  const SEAT_START_X = -9;
  const SEAT_ROWS = 12;
  const SEATS_PER_ROW = 16;
  const ROW_SPACING = 1.2;
  const SEAT_SPACING = 1.2;

  const { hall, faces } = createShoeBoxHall(HALL_WIDTH, HALL_HEIGHT, HALL_DEPTH, '标准音乐厅');
  const seats = createSeatGrid(SEAT_START_X, SEAT_START_Z, SEAT_ROWS, SEATS_PER_ROW, ROW_SPACING, SEAT_SPACING);
  const soundSources = createSoundSources(STAGE_Z, HALL_WIDTH);
  const rayPaths = generateRayPaths(soundSources, hall, seats, 800, 5);

  const absorptionData: AbsorptionData[] = faces.map((face) => ({
    faceId: face.id,
    frequency_125Hz: 0.15 + Math.random() * 0.2,
    frequency_250Hz: 0.1 + Math.random() * 0.2,
    frequency_500Hz: 0.08 + Math.random() * 0.15,
    frequency_1kHz: 0.07 + Math.random() * 0.1,
    frequency_2kHz: 0.06 + Math.random() * 0.08,
    frequency_4kHz: 0.05 + Math.random() * 0.06,
  }));

  const acousticReadings: AcousticReading[] = seats.map((seat) => {
    const distanceToSource = Math.sqrt(
      Math.pow(seat.position.x, 2) +
      Math.pow(seat.position.z - STAGE_Z, 2)
    );
    const distanceFactor = Math.min(distanceToSource / 25, 1);

    return {
      seatId: seat.id,
      reverberationTime: 1.6 + Math.random() * 0.4 + distanceFactor * 0.3,
      soundPressureLevel: 92 - distanceFactor * 18 + (Math.random() - 0.5) * 3,
      clarity: 6 - distanceFactor * 5 + (Math.random() - 0.5) * 1,
      definition: 75 - distanceFactor * 25 + (Math.random() - 0.5) * 5,
    };
  });

  const avgRT60 = acousticReadings.reduce((s, r) => s + r.reverberationTime, 0) / acousticReadings.length;
  const avgSPL = acousticReadings.reduce((s, r) => s + r.soundPressureLevel, 0) / acousticReadings.length;
  const avgClarity = acousticReadings.reduce((s, r) => s + r.clarity, 0) / acousticReadings.length;

  return {
    hall,
    materialFaces: faces,
    absorptionData,
    soundSources,
    seats,
    acousticReadings,
    rayPaths,
    reportSummary: {
      projectName: '标准音乐厅声学设计方案',
      date: new Date().toISOString().split('T')[0],
      avgRT60: Math.round(avgRT60 * 100) / 100,
      avgSPL: Math.round(avgSPL * 10) / 10,
      avgClarity: Math.round(avgClarity * 10) / 10,
      recommendations: [
        '整体混响时间控制在1.6-2.0秒范围内，符合交响乐演出要求',
        '声压级分布均匀，前后排差异小于10dB',
        'VIP区域清晰度表现优异，建议保留当前设计',
        '后墙吸声材料可适当调整以优化低频混响',
      ],
    },
  };
}
