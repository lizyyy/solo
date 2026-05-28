import type { AcousticDataset, AbsorptionData, AcousticReading, Seat } from '../models/acoustic';
import {
  createShoeBoxHall,
  createSeatGrid,
  createSoundSources,
  generateRayPaths,
} from '../../utils/geometryBuilder';

export function generateAnomalyDataset(): AcousticDataset {
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

  const { hall, faces } = createShoeBoxHall(HALL_WIDTH, HALL_HEIGHT, HALL_DEPTH, '问题数据音乐厅');
  
  let seats = createSeatGrid(SEAT_START_X, SEAT_START_Z, SEAT_ROWS, SEATS_PER_ROW, ROW_SPACING, SEAT_SPACING);
  
  seats = seats.map((seat, index) => {
    if (index === 25 || index === 47 || index === 89) {
      return {
        ...seat,
        position: {
          x: seat.position.x + 30,
          y: seat.position.y,
          z: seat.position.z,
        },
      };
    }
    return seat;
  });

  const soundSources = createSoundSources(STAGE_Z, HALL_WIDTH);
  const rayPaths = generateRayPaths(soundSources, hall, seats, 5200, 6);

  const badRayIndex = 5000;
  for (let i = badRayIndex; i < badRayIndex + 50; i++) {
    if (rayPaths[i]) {
      rayPaths[i].energy = 1.2 + Math.random() * 0.5;
      rayPaths[i].order = 5;
    }
  }

  const completeFaces = faces.filter(
    (f) => f.id !== 'face_ceiling' && f.id !== 'face_wall_left' && f.id !== 'face_wall_right'
  );
  const absorptionData: AbsorptionData[] = completeFaces.map((face) => ({
    faceId: face.id,
    frequency_125Hz: 0.15 + Math.random() * 0.2,
    frequency_250Hz: 0.1 + Math.random() * 0.2,
    frequency_500Hz: 0.08 + Math.random() * 0.15,
    frequency_1kHz: 0.07 + Math.random() * 0.1,
    frequency_2kHz: 0.06 + Math.random() * 0.08,
    frequency_4kHz: 0.05 + Math.random() * 0.06,
  }));

  const seatsWithReadings = seats.filter((_, i) => i % 5 !== 0);
  const acousticReadings: AcousticReading[] = seatsWithReadings.map((seat) => {
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
      projectName: '问题数据音乐厅声学方案（待修正）',
      date: new Date().toISOString().split('T')[0],
      avgRT60: Math.round(avgRT60 * 100) / 100,
      avgSPL: Math.round(avgSPL * 10) / 10,
      avgClarity: Math.round(avgClarity * 10) / 10,
      recommendations: [
        '⚠️ 数据存在多处异常，请先查看异常检测面板',
        '建议补充缺失的墙面吸声率数据后重新计算',
        '座位坐标可能存在测量误差，建议复核',
        '射线密度过高，建议筛选后查看',
      ],
    },
  };
}
