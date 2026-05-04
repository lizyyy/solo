import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const MISSIONS_FILE = path.join(DATA_DIR, 'missions.json');

let missionsCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 5000;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadMissions() {
  ensureDataDir();
  
  const now = Date.now();
  if (missionsCache && (now - lastCacheTime) < CACHE_TTL) {
    return [...missionsCache];
  }
  
  if (!fs.existsSync(MISSIONS_FILE)) {
    missionsCache = [];
    lastCacheTime = now;
    return [];
  }
  
  try {
    const content = fs.readFileSync(MISSIONS_FILE, 'utf-8');
    missionsCache = JSON.parse(content);
    lastCacheTime = now;
    return [...missionsCache];
  } catch (error) {
    console.error('加载任务数据失败:', error);
    missionsCache = [];
    lastCacheTime = now;
    return [];
  }
}

function saveMissions(missions) {
  ensureDataDir();
  
  try {
    fs.writeFileSync(MISSIONS_FILE, JSON.stringify(missions, null, 2), 'utf-8');
    missionsCache = [...missions];
    lastCacheTime = Date.now();
    return true;
  } catch (error) {
    console.error('保存任务数据失败:', error);
    return false;
  }
}

export function getAllMissions() {
  return loadMissions();
}

export function getMissionById(id) {
  const missions = loadMissions();
  return missions.find(m => m.id === id) || null;
}

export function createMission(missionData) {
  const missions = loadMissions();
  
  const now = new Date().toISOString();
  const newMission = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    name: missionData.name || `任务 ${missions.length + 1}`,
    description: missionData.description || '',
    
    flightPath: missionData.flightPath || [],
    flightPathRaw: missionData.flightPathRaw || null,
    
    restrictedZones: missionData.restrictedZones || { type: 'FeatureCollection', features: [] },
    restrictedZonesRaw: missionData.restrictedZonesRaw || null,
    
    batteryData: missionData.batteryData || { batteries: [], rawData: [] },
    batteryDataRaw: missionData.batteryDataRaw || null,
    
    weatherWindow: missionData.weatherWindow || {
      date: null,
      startTime: null,
      endTime: null,
      windSpeed: null,
      windDirection: null,
      visibility: null,
      temperature: null,
      notes: ''
    },
    
    pilotInfo: missionData.pilotInfo || {
      name: '',
      licenseNumber: '',
      contact: ''
    },
    
    aircraftInfo: missionData.aircraftInfo || {
      model: '',
      serialNumber: '',
      maxFlightTime: 30
    },
    
    risks: missionData.risks || [],
    summary: missionData.summary || {
      canFly: true,
      criticalCount: 0,
      warningCount: 0,
      overriddenCount: 0,
      totalRisks: 0,
      status: 'ok',
      message: '待检查'
    },
    analysisConfig: missionData.analysisConfig || null,
    
    status: 'draft',
    checkResult: null,
    
    files: {
      kml: missionData.files?.kml || null,
      geojson: missionData.files?.geojson || null,
      csv: missionData.files?.csv || null
    },
    
    tags: missionData.tags || [],
    notes: missionData.notes || ''
  };
  
  missions.unshift(newMission);
  saveMissions(missions);
  
  return newMission;
}

export function updateMission(id, updates) {
  const missions = loadMissions();
  const index = missions.findIndex(m => m.id === id);
  
  if (index === -1) {
    return null;
  }
  
  const updatedMission = {
    ...missions[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  missions[index] = updatedMission;
  saveMissions(missions);
  
  return updatedMission;
}

export function deleteMission(id) {
  const missions = loadMissions();
  const index = missions.findIndex(m => m.id === id);
  
  if (index === -1) {
    return false;
  }
  
  missions.splice(index, 1);
  saveMissions(missions);
  
  return true;
}

export function duplicateMission(id) {
  const mission = getMissionById(id);
  
  if (!mission) {
    return null;
  }
  
  const duplicated = createMission({
    ...mission,
    name: `${mission.name} (副本)`,
    status: 'draft',
    createdAt: undefined,
    updatedAt: undefined,
    id: undefined
  });
  
  return duplicated;
}

export function searchMissions(query) {
  const missions = loadMissions();
  const lowerQuery = query.toLowerCase();
  
  return missions.filter(mission => {
    if (mission.name.toLowerCase().includes(lowerQuery)) return true;
    if (mission.description.toLowerCase().includes(lowerQuery)) return true;
    if (mission.status.toLowerCase().includes(lowerQuery)) return true;
    if (mission.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;
    return false;
  });
}

export function getMissionStats() {
  const missions = loadMissions();
  
  const stats = {
    total: missions.length,
    byStatus: {
      draft: 0,
      ready: 0,
      completed: 0,
      cancelled: 0
    },
    byResult: {
      ok: 0,
      warning: 0,
      critical: 0
    },
    recentMissions: []
  };
  
  missions.forEach(mission => {
    stats.byStatus[mission.status] = (stats.byStatus[mission.status] || 0) + 1;
    
    if (mission.summary?.status) {
      stats.byResult[mission.summary.status] = (stats.byResult[mission.summary.status] || 0) + 1;
    }
  });
  
  stats.recentMissions = missions
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10)
    .map(m => ({
      id: m.id,
      name: m.name,
      status: m.status,
      summary: m.summary,
      createdAt: m.createdAt
    }));
  
  return stats;
}
