const PathManager = require('./PathManager');
const RescueTeam = require('./RescueTeam');

class RescueSystem {
  constructor() {
    this.pathManager = new PathManager();
    this.teams = new Map();
    this.alarms = new Map();
    this.riskFactors = {
      elevationGainWeight: 0.002,
      elevationLossWeight: 0.001,
      distanceWeight: 0.0001,
      riskMultiplier: 1.5,
      speedVariation: 0.3
    };
  }

  initialize(sampleData) {
    this.pathManager.addNodes(sampleData.nodes);
    this.pathManager.addConnections(sampleData.connections);
    if (sampleData.teams) {
      sampleData.teams.forEach(team => 
        this.addTeam(RescueTeam.fromJSON(team))
      );
    }
    if (sampleData.alarms) {
      sampleData.alarms.forEach(alarm => 
        this.addAlarm(alarm)
      );
    }
    return this;
  }

  addTeam(team) {
    this.teams.set(team.id, team);
    return this;
  }

  addAlarm(alarm) {
    this.alarms.set(alarm.id, {
      id: alarm.id,
      nodeId: alarm.nodeId,
      severity: alarm.severity || 'medium',
      description: alarm.description || '',
      timestamp: alarm.timestamp || Date.now(),
      status: alarm.status || 'pending',
      assignedTeamId: null
    });
    return this;
  }

  calculateETA(teamId, targetNodeId, route = null) {
    const team = this.teams.get(teamId);
    if (!team) return null;

    const startNodeId = team.currentNodeId;
    let path = route;

    if (!path) {
      path = this.pathManager.findShortestPath(startNodeId, targetNodeId, true);
    }

    if (!path || path.length < 2) return null;

    const distance = this.pathManager.calculateTotalDistance(path);
    const elevationGain = this.pathManager.calculateTotalElevationGain(path);
    const elevationLoss = this.pathManager.calculateTotalElevationLoss(path);

    const distanceTime = distance / team.speed;
    const elevationPenalty = (elevationGain * this.riskFactors.elevationGainWeight) + 
                             (elevationLoss * this.riskFactors.elevationLossWeight);

    const riskPenalty = this.calculateRiskPenalty(path);
    const totalTime = distanceTime + elevationPenalty + riskPenalty;

    return {
      path: path,
      distance: distance,
      elevationGain: elevationGain,
      elevationLoss: elevationLoss,
      baseTime: distanceTime,
      elevationPenalty: elevationPenalty,
      riskPenalty: riskPenalty,
      totalTime: totalTime,
      formattedETA: this.formatTime(totalTime)
    };
  }

  calculateRiskPenalty(path) {
    let penalty = 0;
    path.forEach(nodeId => {
      const node = this.pathManager.getNode(nodeId);
      if (node && node.riskLevel > 0) {
        penalty += node.riskLevel * this.riskFactors.riskMultiplier;
      }
    });
    return penalty;
  }

  calculateRouteRisk(path) {
    if (!path || path.length < 2) return 0;

    let totalRisk = 0;
    let maxRisk = 0;
    let count = 0;

    path.forEach(nodeId => {
      const node = this.pathManager.getNode(nodeId);
      if (node) {
        totalRisk += node.riskLevel;
        maxRisk = Math.max(maxRisk, node.riskLevel);
        count++;
      }
    });

    const elevationGain = this.pathManager.calculateTotalElevationGain(path);
    const distance = this.pathManager.calculateTotalDistance(path);
    const avgRisk = count > 0 ? totalRisk / count : 0;

    return {
      averageRisk: avgRisk,
      maxRisk: maxRisk,
      elevationRisk: elevationGain * this.riskFactors.elevationGainWeight * 10,
      distanceRisk: distance * this.riskFactors.distanceWeight,
      overallRisk: Math.max(maxRisk, avgRisk + elevationGain * 0.001)
    };
  }

  assignBestTeam(alarmId) {
    const alarm = this.alarms.get(alarmId);
    if (!alarm || alarm.status !== 'pending') return null;

    let bestTeam = null;
    let bestETA = null;

    this.teams.forEach(team => {
      if (team.status === 'standby') {
        const eta = this.calculateETA(team.id, alarm.nodeId);
        if (eta && (!bestETA || eta.totalTime < bestETA.totalTime)) {
          bestTeam = team;
          bestETA = eta;
        }
      }
    });

    if (bestTeam) {
      alarm.status = 'assigned';
      alarm.assignedTeamId = bestTeam.id;
      bestTeam.assignTask(alarmId, bestETA.path);
      return { team: bestTeam, eta: bestETA, alarm: alarm };
    }

    return null;
  }

  generateRouteReport(alarmId) {
    const alarm = this.alarms.get(alarmId);
    if (!alarm || !alarm.assignedTeamId) return null;

    const team = this.teams.get(alarm.assignedTeamId);
    if (!team || !team.route) return null;

    const eta = this.calculateETA(team.id, alarm.nodeId, team.route);
    const risk = this.calculateRouteRisk(team.route);
    const profile = this.pathManager.getElevationProfile(team.route);

    return {
      alarmId: alarm.id,
      alarmNodeId: alarm.nodeId,
      teamId: team.id,
      teamName: team.name,
      route: team.route,
      elevationProfile: profile,
      eta: eta,
      risk: risk,
      timestamp: Date.now(),
      recommendations: this.generateRecommendations(eta, risk)
    };
  }

  generateRecommendations(eta, risk) {
    const recommendations = [];
    if (eta.elevationGain > 300) {
      recommendations.push({
        level: 'warning',
        message: '爬升高度超过300米，建议携带额外供氧设备'
      });
    }
    if (eta.elevationLoss > 200) {
      recommendations.push({
        level: 'info',
        message: '下降高度较大，注意防滑和膝关节保护'
      });
    }
    if (risk.maxRisk >= 3) {
      recommendations.push({
        level: 'danger',
        message: '路径存在高风险区域，建议谨慎前进'
      });
    }
    if (risk.averageRisk >= 2) {
      recommendations.push({
        level: 'warning',
        message: '整体风险等级较高，考虑是否需要增援'
      });
    }
    return recommendations;
  }

  markNodeRisk(nodeId, riskLevel) {
    const node = this.pathManager.getNode(nodeId);
    if (node) {
      node.riskLevel = Math.max(0, Math.min(5, riskLevel));
    }
    return this;
  }

  moveTeamTo(teamId, nodeId) {
    const team = this.teams.get(teamId);
    if (team) {
      team.currentNodeId = nodeId;
      if (team.route && team.route[team.route.length - 1] === nodeId) {
        team.completeMission();
      }
    }
    return this;
  }

  updateTeamSpeed(teamId, newSpeed) {
    const team = this.teams.get(teamId);
    if (team && newSpeed > 0) {
      team.speed = newSpeed;
    }
    return this;
  }

  formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}小时${mins}分钟`;
    }
    return `${mins}分钟`;
  }

  getSystemStatus() {
    const standbyTeams = Array.from(this.teams.values()).filter(t => t.status === 'standby');
    const movingTeams = Array.from(this.teams.values()).filter(t => t.status === 'moving');
    const pendingAlarms = Array.from(this.alarms.values()).filter(a => a.status === 'pending');
    const assignedAlarms = Array.from(this.alarms.values()).filter(a => a.status === 'assigned');

    return {
      totalNodes: this.pathManager.getAllNodes().length,
      totalTeams: this.teams.size,
      standbyTeams: standbyTeams.length,
      movingTeams: movingTeams.length,
      pendingAlarms: pendingAlarms.length,
      assignedAlarms: assignedAlarms.length,
      teams: Array.from(this.teams.values()).map(t => t.toJSON()),
      alarms: Array.from(this.alarms.values())
    };
  }
}

module.exports = RescueSystem;
