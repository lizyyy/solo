const SAVE_KEY = 'deicing_dispatch_save';
const SETTINGS_KEY = 'deicing_dispatch_settings';
const PROGRESS_KEY = 'deicing_dispatch_progress';

class StorageManager {
  constructor() {
    this.saveKey = SAVE_KEY;
    this.settingsKey = SETTINGS_KEY;
    this.progressKey = PROGRESS_KEY;
  }

  saveGame(gameState) {
    try {
      const saveData = {
        version: '1.0.0',
        timestamp: Date.now(),
        gameState: this.serializeGameState(gameState)
      };

      localStorage.setItem(this.saveKey, JSON.stringify(saveData));
      return { success: true };
    } catch (error) {
      console.error('Failed to save game:', error);
      return { success: false, error: error.message };
    }
  }

  loadGame() {
    try {
      const saved = localStorage.getItem(this.saveKey);
      if (!saved) {
        return { success: false, error: 'No save data found' };
      }

      const saveData = JSON.parse(saved);
      return {
        success: true,
        data: this.deserializeGameState(saveData.gameState)
      };
    } catch (error) {
      console.error('Failed to load game:', error);
      return { success: false, error: error.message };
    }
  }

  hasSaveData() {
    return localStorage.getItem(this.saveKey) !== null;
  }

  deleteSave() {
    try {
      localStorage.removeItem(this.saveKey);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  serializeGameState(state) {
    return {
      levelId: state.levelId,
      currentTime: state.currentTime,
      dayOfOperation: state.dayOfOperation,
      timeRemaining: state.timeRemaining,
      score: state.score,
      status: state.status,
      flights: state.flights.map(f => ({ ...f })),
      vehicles: state.vehicles.map(v => ({ ...v })),
      pads: state.pads.map(p => ({ ...p })),
      fluidInventory: JSON.parse(JSON.stringify(state.fluidInventory)),
      assignments: state.assignments.map(a => ({ ...a })),
      eventLog: state.eventLog.map(e => ({ ...e })),
      level: { ...state.level }
    };
  }

  deserializeGameState(data) {
    return {
      ...data,
      flights: data.flights.map(f => ({ ...f })),
      vehicles: data.vehicles.map(v => ({ ...v })),
      pads: data.pads.map(p => ({ ...p })),
      fluidInventory: JSON.parse(JSON.stringify(data.fluidInventory)),
      assignments: data.assignments.map(a => ({ ...a })),
      eventLog: data.eventLog.map(e => ({ ...e })),
      level: { ...data.level }
    };
  }

  saveSettings(settings) {
    try {
      localStorage.setItem(this.settingsKey, JSON.stringify(settings));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(this.settingsKey);
      if (!saved) {
        return { success: true, data: this.getDefaultSettings() };
      }
      return {
        success: true,
        data: { ...this.getDefaultSettings(), ...JSON.parse(saved) }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getDefaultSettings() {
    return {
      soundEnabled: true,
      musicEnabled: true,
      effectsVolume: 80,
      musicVolume: 50,
      timeScale: 1,
      showTutorial: true,
      autoSave: true,
      autoSaveInterval: 60
    };
  }

  saveProgress(progress) {
    try {
      const existing = this.loadProgress();
      const updated = {
        ...existing,
        ...progress,
        lastPlayed: Date.now()
      };
      localStorage.setItem(this.progressKey, JSON.stringify(updated));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem(this.progressKey);
      if (!saved) {
        return this.getDefaultProgress();
      }
      return { ...this.getDefaultProgress(), ...JSON.parse(saved) };
    } catch (error) {
      return this.getDefaultProgress();
    }
  }

  getDefaultProgress() {
    return {
      unlockedLevels: ['level-01'],
      completedLevels: [],
      highScores: {},
      totalScore: 0,
      gamesPlayed: 0
    };
  }

  unlockLevel(levelId) {
    const progress = this.loadProgress();
    if (!progress.unlockedLevels.includes(levelId)) {
      progress.unlockedLevels.push(levelId);
      this.saveProgress(progress);
    }
  }

  completeLevel(levelId, score) {
    const progress = this.loadProgress();

    if (!progress.completedLevels.includes(levelId)) {
      progress.completedLevels.push(levelId);
    }

    const currentHighScore = progress.highScores[levelId] || 0;
    if (score > currentHighScore) {
      progress.highScores[levelId] = score;
    }

    progress.totalScore += score;
    progress.gamesPlayed++;

    this.saveProgress(progress);
  }

  isLevelUnlocked(levelId) {
    const progress = this.loadProgress();
    return progress.unlockedLevels.includes(levelId);
  }

  getHighScore(levelId) {
    const progress = this.loadProgress();
    return progress.highScores[levelId] || 0;
  }

  generateReportId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RPT-${year}${month}${day}-${random}`;
  }

  generateSettlementReport(gameState) {
    const flights = gameState.flights;
    const successfulFlights = flights.filter(f => f.status === 'takeoff');
    const delayedFlights = flights.filter(f => f.status === 'delayed');
    const divertedFlights = flights.filter(f => f.status === 'diverted');

    const totalFluidUsed = {};
    gameState.assignments.forEach(a => {
      const flight = flights.find(f => f.id === a.flightId);
      if (flight) {
        const type = flight.fluidType;
        totalFluidUsed[type] = (totalFluidUsed[type] || 0) + a.fluidUsed;
      }
    });

    const vehicleActiveTime = {};
    const vehicleIdleTime = {};
    const vehicleIds = gameState.vehicles.map(v => v.id);

    vehicleIds.forEach(id => {
      vehicleActiveTime[id] = 0;
      vehicleIdleTime[id] = 0;
    });

    gameState.assignments.forEach(assignment => {
      if (assignment.vehicleId) {
        vehicleActiveTime[assignment.vehicleId] += assignment.endTime - assignment.assignmentTime;
      }
    });

    const totalGameTime = gameState.level.timeLimit;
    vehicleIds.forEach(id => {
      vehicleIdleTime[id] = Math.max(0, totalGameTime - vehicleActiveTime[id]);
    });

    const fluidInventory = gameState.fluidInventory;
    const fluidUsage = {};
    Object.keys(fluidInventory).forEach(type => {
      const initial = fluidInventory[type].total;
      const remaining = fluidInventory[type].available;
      const used = initial - remaining;
      const percentage = initial > 0 ? ((used / initial) * 100).toFixed(1) + '%' : '0%';
      fluidUsage[type] = { used, percentage };
    });

    const vehicleUtilization = {};
    vehicleIds.forEach(id => {
      vehicleUtilization[id] = {
        activeTime: Math.round(vehicleActiveTime[id]),
        idleTime: Math.round(vehicleIdleTime[id])
      };
    });

    const issues = [];
    delayedFlights.forEach(flight => {
      issues.push({
        flight: flight.id,
        issue: `航班延误: ${flight.delayReason || '未知原因'}`,
        resolution: '等待调度处理'
      });
    });

    gameState.vehicles.forEach(vehicle => {
      if (vehicle.status === 'maintenance') {
        issues.push({
          flight: vehicle.id,
          issue: '车辆故障',
          resolution: '维修中'
        });
      }
    });

    const scoreBreakdown = this.calculateScoreBreakdown(gameState);

    const report = {
      reportId: this.generateReportId(),
      levelId: gameState.levelId,
      gameDate: new Date().toISOString().split('T')[0],
      summary: {
        totalFlights: flights.length,
        successfulDeicing: successfulFlights.length,
        delayedFlights: delayedFlights.length,
        divertedFlights: divertedFlights.length,
        onTimeRate: flights.length > 0 ?
          ((successfulFlights.length / flights.length) * 100).toFixed(1) + '%' : '0%',
        totalScore: scoreBreakdown.total
      },
      timeline: this.generateTimeline(gameState),
      fluidUsage,
      vehicleUtilization,
      issues,
      scoreBreakdown
    };

    return report;
  }

  calculateScoreBreakdown(gameState) {
    let baseScore = 0;
    const bonuses = [];
    const penalties = [];

    gameState.flights.forEach(flight => {
      if (flight.status === 'takeoff') {
        baseScore += 100;

        const delay = (flight.actualDeparture || 0) - flight.departureTime;
        if (delay > 0) {
          penalties.push({ type: 'delay', amount: delay * 10 });
        }

        if (flight.specialEvent === 'midnight_flight') {
          bonuses.push({ type: 'midnight_flight', amount: 100 });
        }

        if (flight.specialEvent === 'return_flight') {
          bonuses.push({ type: 'return_flight_handled', amount: 150 });
        }
      }
    });

    const successfulFlights = gameState.flights.filter(f => f.status === 'takeoff').length;
    if (successfulFlights === gameState.flights.length && gameState.flights.length > 0) {
      bonuses.push({ type: 'all_completed', amount: 200 });
    }

    const totalBonuses = bonuses.reduce((sum, b) => sum + b.amount, 0);
    const totalPenalties = penalties.reduce((sum, p) => sum + p.amount, 0);

    return {
      baseScore,
      bonuses,
      penalties,
      totalBonuses,
      totalPenalties,
      total: Math.max(0, baseScore + totalBonuses - totalPenalties)
    };
  }

  generateTimeline(gameState) {
    const timeline = [];

    gameState.flights.forEach(flight => {
      if (flight.deicingStartTime !== undefined) {
        timeline.push({
          time: this.formatTime(flight.deicingStartTime),
          event: `${flight.id} 开始除冰`,
          type: 'deicing_start'
        });
      }

      if (flight.deicingCompleteTime !== undefined) {
        timeline.push({
          time: this.formatTime(flight.deicingCompleteTime),
          event: `${flight.id} 除冰完成`,
          type: 'deicing_complete'
        });
      }

      if (flight.actualDeparture !== undefined) {
        timeline.push({
          time: this.formatTime(flight.actualDeparture),
          event: `${flight.id} 起飞`,
          type: 'takeoff'
        });
      }
    });

    gameState.eventLog.forEach(event => {
      timeline.push({
        time: this.formatTime(event.time),
        event: event.message,
        type: event.type || 'info'
      });
    });

    return timeline.sort((a, b) => {
      const timeA = this.parseTime(a.time);
      const timeB = this.parseTime(b.time);
      return timeA - timeB;
    });
  }

  formatTime(minutes) {
    if (minutes >= 1440) minutes -= 1440;
    if (minutes < 0) minutes += 1440;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  parseTime(timeStr) {
    const [hours, mins] = timeStr.split(':').map(Number);
    return hours * 60 + mins;
  }

  exportReportToJson(report) {
    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `deicing_report_${report.reportId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportReportToCsv(report) {
    let csv = '时间,事件,类型\n';

    report.timeline.forEach(entry => {
      csv += `${entry.time},"${entry.event}",${entry.type}\n`;
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `deicing_report_${report.reportId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  clearAllData() {
    try {
      localStorage.removeItem(this.saveKey);
      localStorage.removeItem(this.settingsKey);
      localStorage.removeItem(this.progressKey);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageManager };
}