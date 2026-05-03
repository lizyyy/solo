import moment from 'moment';
import { parseDate } from './date.js';

const ROAD_SURFACES = ['公路', 'road', 'asphalt', 'pavement', '马路', '柏油路', '水泥路'];
const TRAIL_SURFACES = ['越野', 'trail', '土路', '泥土', '山间', '山路', '越野跑'];
const TRACK_SURFACES = ['田径场', 'track', '跑道', '塑胶跑道', '田径'];
const TREADMILL_SURFACES = ['跑步机', 'treadmill', '室内跑', '室内'];

const ROAD_TRAINING = ['路跑', '公路跑', 'easy run', 'easy', '轻松跑', '有氧跑', '有氧'];
const INTERVAL_TRAINING = ['间歇', 'interval', '间歇跑', '速度训练', 'speed', '间歇训练'];
const TEMPO_TRAINING = [' tempo', '节奏跑', '乳酸阈', '阈值跑', 'lactate', 't-pace'];
const LONG_RUN_TRAINING = ['长距离', 'long run', 'long', 'lsd', '长距离慢跑'];
const RACE_TRAINING = ['比赛', 'race', '赛事', '马拉松', '半马', '全马'];
const RECOVERY_TRAINING = ['恢复跑', 'recovery', '轻松', '慢跑'];

const SHOE_BRANDS = ['nike', '耐克', 'adidas', '阿迪达斯', 'brooks', '布鲁克斯', 'saucony', '索康尼', 'asics', '亚瑟士', 'new balance', 'nb', '新百伦', 'hoka', '霍卡', 'on', '昂跑', 'altra', '索康尼', 'salomon', '萨洛蒙'];

export function normalizeSurface(surface) {
  if (!surface) return 'unknown';
  
  const lower = String(surface).toLowerCase().trim();
  
  if (ROAD_SURFACES.some(s => lower.includes(s.toLowerCase()))) return 'road';
  if (TRAIL_SURFACES.some(s => lower.includes(s.toLowerCase()))) return 'trail';
  if (TRACK_SURFACES.some(s => lower.includes(s.toLowerCase()))) return 'track';
  if (TREADMILL_SURFACES.some(s => lower.includes(s.toLowerCase()))) return 'treadmill';
  
  return lower;
}

export function normalizeTrainingType(type) {
  if (!type) return 'unknown';
  
  const lower = String(type).toLowerCase().trim();
  
  if (INTERVAL_TRAINING.some(t => lower.includes(t.toLowerCase()))) return 'interval';
  if (TEMPO_TRAINING.some(t => lower.includes(t.toLowerCase()))) return 'tempo';
  if (LONG_RUN_TRAINING.some(t => lower.includes(t.toLowerCase()))) return 'long_run';
  if (RACE_TRAINING.some(t => lower.includes(t.toLowerCase()))) return 'race';
  if (RECOVERY_TRAINING.some(t => lower.includes(t.toLowerCase()))) return 'recovery';
  if (ROAD_TRAINING.some(t => lower.includes(t.toLowerCase()))) return 'easy';
  
  return lower;
}

export function normalizeShoeName(name) {
  if (!name) return 'unknown';
  
  return String(name).trim();
}

export function normalizePace(paceValue, durationMinutes, distanceKm) {
  if (paceValue !== null && paceValue !== undefined) {
    const pace = parseFloat(paceValue);
    if (!isNaN(pace) && pace > 0) {
      return pace;
    }
  }
  
  if (durationMinutes && distanceKm && distanceKm > 0) {
    return durationMinutes / distanceKm;
  }
  
  return null;
}

export function parseDurationToMinutes(durationStr) {
  if (!durationStr) return null;
  
  if (typeof durationStr === 'number') {
    return durationStr;
  }
  
  const str = String(durationStr).trim();
  
  const colonMatch = str.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (colonMatch) {
    const hours = colonMatch[3] ? parseInt(colonMatch[1]) : 0;
    const minutes = colonMatch[3] ? parseInt(colonMatch[2]) : parseInt(colonMatch[1]);
    const seconds = colonMatch[3] ? parseInt(colonMatch[3]) : parseInt(colonMatch[2]);
    return hours * 60 + minutes + seconds / 60;
  }
  
  const hMatch = str.match(/(\d+)\s*h(ours?)?/i);
  const mMatch = str.match(/(\d+)\s*m(in(utes?)?)?/i);
  const sMatch = str.match(/(\d+)\s*s(ec(onds?)?)?/i);
  
  const hours = hMatch ? parseInt(hMatch[1]) : 0;
  const minutes = mMatch ? parseInt(mMatch[1]) : 0;
  const seconds = sMatch ? parseInt(sMatch[1]) : 0;
  
  if (hours > 0 || minutes > 0 || seconds > 0) {
    return hours * 60 + minutes + seconds / 60;
  }
  
  const numMatch = str.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    return parseFloat(numMatch[1]);
  }
  
  return null;
}

export function parseElevation(elevationStr) {
  if (elevationStr === null || elevationStr === undefined || elevationStr === '') return 0;
  
  if (typeof elevationStr === 'number') {
    return elevationStr;
  }
  
  const str = String(elevationStr).trim();
  const numMatch = str.match(/(-?\d+(?:\.\d+)?)/);
  if (numMatch) {
    return parseFloat(numMatch[1]);
  }
  
  return 0;
}

export function getSurfaceName(surface) {
  const names = {
    road: '公路',
    trail: '越野',
    track: '田径场',
    treadmill: '跑步机',
    unknown: '未知'
  };
  return names[surface] || surface;
}

export function getTrainingTypeName(type) {
  const names = {
    easy: '轻松跑',
    interval: '间歇跑',
    tempo: '节奏跑',
    long_run: '长距离',
    race: '比赛',
    recovery: '恢复跑',
    unknown: '未知'
  };
  return names[type] || type;
}
