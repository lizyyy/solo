import path from 'path';
import os from 'os';
import fs from 'fs';

const DEFAULT_APPEAL_DIR = path.join(os.homedir(), '.rider-appeal');

export function getAppealDir(): string {
  const customDir = process.env.APPEAL_DIR;
  const appealDir = customDir || DEFAULT_APPEAL_DIR;
  
  if (!fs.existsSync(appealDir)) {
    fs.mkdirSync(appealDir, { recursive: true });
  }
  
  return appealDir;
}

export function getDataDir(): string {
  const dataDir = path.join(getAppealDir(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

export function getReportsDir(): string {
  const reportsDir = path.join(getAppealDir(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

export const CONFIG = {
  MERCHANT_PREPARE_TIMEOUT_THRESHOLD: 15 * 60 * 1000,
  WEATHER_AFFECTED_WINDOW_BEFORE: 30 * 60 * 1000,
  WEATHER_AFFECTED_WINDOW_AFTER: 30 * 60 * 1000,
  TRAJECTORY_GAP_THRESHOLD: 5 * 60 * 1000,
  MAX_ALLOWED_DELAY_RATIO: 1.5,
  MIN_TRAJECTORY_POINTS: 5,
  APPEAL_TYPES: ['timeout', 'bad_review', 'cancellation'] as const,
  WEATHER_TYPES: ['sunny', 'rain', 'heavy_rain', 'storm', 'fog', 'snow'] as const,
  BAD_WEATHER_TYPES: ['heavy_rain', 'storm', 'heavy_snow'] as const,
};
