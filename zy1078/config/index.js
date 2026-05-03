import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  dataDir: path.resolve(__dirname, '../data'),
  defaultDataFiles: {
    runs: 'runs.csv',
    shoes: 'shoes.json',
    soreness: 'soreness.csv'
  },
  validation: {
    minDistance: 0.1,
    maxDistance: 100,
    minPace: 2,
    maxPace: 8,
    minElevation: -100,
    maxElevation: 2000
  },
  risks: {
    acwrWarnThreshold: 1.5,
    acwrDangerThreshold: 2.0,
    weeklyIncreaseThreshold: 0.2,
    weeklyAbsoluteIncreaseThreshold: 5,
    maxConsecutiveHighDays: 3,
    highIntensityPaceThreshold: 4.5,
    longRunDistanceThreshold: 16,
    longRunRatioThreshold: 0.4,
    acuteDays: 7,
    chronicDays: 28
  },
  shoes: {
    maxMileage: 800,
    warningMileage: 600,
    maxDaysSinceWorn: 14,
    maxDaysSinceWornWarning: 7
  },
  soreness: {
    correlationWindowDays: 3,
    minCorrelationSamples: 3
  },
  server: {
    port: 3000,
    host: 'localhost'
  }
};
