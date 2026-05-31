const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { createError } = require('./utils/errors');

class MissionStore {
  constructor() {
    this.dataDir = config.dataDir;
    this.missionsFile = path.join(this.dataDir, 'missions.json');
    this._ensureDataDir();
    this._loadMissions();
  }

  _ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.missionsFile)) {
      fs.writeFileSync(this.missionsFile, JSON.stringify({ missions: [], versions: {} }, null, 2));
    }
  }

  _loadMissions() {
    try {
      const data = JSON.parse(fs.readFileSync(this.missionsFile, 'utf8'));
      this.missions = data.missions || [];
      this.versions = data.versions || {};
    } catch (e) {
      this.missions = [];
      this.versions = {};
    }
  }

  _saveMissions() {
    fs.writeFileSync(
      this.missionsFile,
      JSON.stringify({ missions: this.missions, versions: this.versions }, null, 2)
    );
  }

  _generateMissionId(missionData) {
    const { date, routeName, pilot } = missionData;
    const base = `${date}-${routeName}-${pilot || 'unknown'}`;
    return base.replace(/\s+/g, '-').toLowerCase();
  }

  _generateDataHash(data) {
    const str = JSON.stringify(data);
    return crypto.createHash('md5').update(str).digest('hex');
  }

  findMission(missionId) {
    return this.missions.find(m => m.id === missionId);
  }

  checkDuplicate(missionData) {
    const missionId = this._generateMissionId(missionData);
    const existing = this.findMission(missionId);
    
    if (!existing) {
      return { isDuplicate: false, missionId };
    }
    
    const routeHash = missionData.routeHash || this._generateDataHash(missionData.waypoints || []);
    const batteryHash = missionData.batteryHash || this._generateDataHash(missionData.batteryRecords || []);
    
    const sameRoute = existing.routeHash === routeHash;
    const sameBattery = existing.batteryHash === batteryHash;
    
    return {
      isDuplicate: sameRoute && sameBattery,
      missionId,
      existingMission: existing,
      differences: {
        route: !sameRoute,
        battery: !sameBattery
      }
    };
  }

  saveMission(missionData, analysisResult) {
    const missionId = this._generateMissionId(missionData);
    const duplicateCheck = this.checkDuplicate(missionData);
    
    if (duplicateCheck.isDuplicate) {
      throw createError('MISSION_ALREADY_EXISTS', missionId);
    }
    
    const routeHash = missionData.routeHash || this._generateDataHash(missionData.waypoints || []);
    const batteryHash = missionData.batteryHash || this._generateDataHash(missionData.batteryRecords || []);
    
    const mission = {
      id: missionId,
      date: missionData.date,
      routeName: missionData.routeName,
      pilot: missionData.pilot,
      routeHash,
      batteryHash,
      kmlFile: missionData.kmlFile,
      batteryFile: missionData.batteryFile,
      analysis: analysisResult,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
    
    const existingIndex = this.missions.findIndex(m => m.id === missionId);
    if (existingIndex >= 0) {
      const oldMission = this.missions[existingIndex];
      mission.version = oldMission.version + 1;
      mission.createdAt = oldMission.createdAt;
      
      if (!this.versions[missionId]) {
        this.versions[missionId] = [];
      }
      this.versions[missionId].push({
        version: oldMission.version,
        savedAt: oldMission.updatedAt,
        mission: oldMission
      });
    }
    
    if (existingIndex >= 0) {
      this.missions[existingIndex] = mission;
    } else {
      this.missions.push(mission);
    }
    
    this._saveMissions();
    return mission;
  }

  getVersionHistory(missionId) {
    return this.versions[missionId] || [];
  }

  compareVersions(missionId, versionA, versionB) {
    const history = this.versions[missionId] || [];
    const v1 = history.find(h => h.version === versionA);
    const v2 = history.find(h => h.version === versionB);
    const current = this.findMission(missionId);
    
    if (!v1 || !v2) return null;
    
    const changes = [];
    
    if (v1.mission.routeHash !== v2.mission.routeHash) {
      changes.push({ field: 'route', message: '航线数据有变化' });
    }
    
    if (v1.mission.batteryHash !== v2.mission.batteryHash) {
      changes.push({ field: 'battery', message: '电池记录有变化' });
    }
    
    const oldResult = v1.mission.analysis;
    const newResult = v2.mission.analysis;
    
    if (oldResult.safe !== newResult.safe) {
      changes.push({
        field: 'safety',
        oldValue: oldResult.safe ? '安全' : '不安全',
        newValue: newResult.safe ? '安全' : '不安全',
        message: `安全判定从 "${oldResult.safe ? '安全' : '不安全'}" 变成 "${newResult.safe ? '安全' : '不安全'}"`
      });
    }
    
    return {
      hasChanges: changes.length > 0,
      changes,
      summary: changes.length === 0 ? '两个版本完全一致' : `发现 ${changes.length} 处差异`
    };
  }

  listMissions(options = {}) {
    let result = [...this.missions];
    
    if (options.date) {
      result = result.filter(m => m.date === options.date);
    }
    
    if (options.pilot) {
      result = result.filter(m => m.pilot === options.pilot);
    }
    
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return result;
  }

  getMissionChanges(oldMission, newMission) {
    const changes = [];
    
    if (oldMission.routeHash !== newMission.routeHash) {
      changes.push({
        type: 'route',
        message: '航线数据不同'
      });
    }
    
    if (oldMission.batteryHash !== newMission.batteryHash) {
      changes.push({
        type: 'battery',
        message: '电池记录不同'
      });
    }
    
    return changes;
  }
}

module.exports = MissionStore;
