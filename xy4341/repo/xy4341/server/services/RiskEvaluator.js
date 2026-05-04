const Floor = require('../models/Floor');
const Exit = require('../models/Exit');
const Person = require('../models/Person');
const FirePoint = require('../models/FirePoint');
const RiskAssessment = require('../models/RiskAssessment');
const EvacuationSimulator = require('./EvacuationSimulator');

const RISK_WEIGHTS = {
  congestion: 0.35,
  fireSpread: 0.30,
  exitAvailability: 0.20,
  evacuationProgress: 0.15
};

class RiskEvaluator {
  constructor(drillSessionId) {
    this.drillSessionId = drillSessionId;
    this.simulator = null;
  }

  async initialize() {
    this.simulator = new EvacuationSimulator(this.drillSessionId);
    await this.simulator.initialize();
  }

  calculateCongestionScore(floorId) {
    const floorPersons = Person.findByFloorId(floorId).filter(p => 
      p.status === 'evacuating' || p.status === 'trapped'
    );
    
    if (floorPersons.length === 0) {
      return { score: 0, details: { personCount: 0, clusters: [] } };
    }

    const clusters = [];
    const visited = new Set();
    
    for (const person of floorPersons) {
      if (visited.has(person.id)) continue;
      
      const cluster = [person];
      visited.add(person.id);
      
      for (const otherPerson of floorPersons) {
        if (visited.has(otherPerson.id)) continue;
        
        const distance = Math.sqrt(
          Math.pow(person.x - otherPerson.x, 2) + 
          Math.pow(person.y - otherPerson.y, 2)
        );
        
        if (distance < 2.5) {
          cluster.push(otherPerson);
          visited.add(otherPerson.id);
        }
      }
      
      if (cluster.length >= 3) {
        clusters.push({
          count: cluster.length,
          centerX: cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length,
          centerY: cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length
        });
      }
    }

    let congestionScore = 0;
    for (const cluster of clusters) {
      const clusterScore = Math.min(100, cluster.count * 8);
      congestionScore = Math.max(congestionScore, clusterScore);
    }

    const density = floorPersons.length / 50;
    const densityScore = Math.min(100, density * 20);
    congestionScore = Math.max(congestionScore, densityScore);

    return {
      score: congestionScore,
      details: {
        personCount: floorPersons.length,
        clusters: clusters
      }
    };
  }

  calculateFireSpreadScore(floorId) {
    const firePoints = FirePoint.findByDrillAndFloor(this.drillSessionId, floorId);
    
    if (firePoints.length === 0) {
      return { score: 0, details: { fireCount: 0, totalIntensity: 0 } };
    }

    let totalIntensity = 0;
    let maxRadius = 0;
    
    for (const firePoint of firePoints) {
      totalIntensity += firePoint.intensity;
      maxRadius = Math.max(maxRadius, firePoint.radius);
    }

    const floorPersons = Person.findByFloorId(floorId);
    let personsInDanger = 0;
    
    for (const person of floorPersons) {
      for (const firePoint of firePoints) {
        const dangerRadius = firePoint.radius * 1.5;
        const distance = Math.sqrt(
          Math.pow(person.x - firePoint.x, 2) + 
          Math.pow(person.y - firePoint.y, 2)
        );
        
        if (distance <= dangerRadius) {
          personsInDanger++;
          break;
        }
      }
    }

    const intensityScore = Math.min(100, totalIntensity * 30);
    const dangerScore = Math.min(100, (personsInDanger / Math.max(1, floorPersons.length)) * 100);
    
    const fireScore = Math.max(intensityScore, dangerScore);

    return {
      score: fireScore,
      details: {
        fireCount: firePoints.length,
        totalIntensity,
        maxRadius,
        personsInDanger
      }
    };
  }

  calculateExitAvailabilityScore(floorId) {
    const floorExits = Exit.findByFloorId(floorId);
    
    if (floorExits.length === 0) {
      return { score: 100, details: { availableExits: 0, totalExits: 0, blockReason: 'no_exits' } };
    }

    const availableExits = floorExits.filter(e => e.status === 'available');
    const availableRatio = availableExits.length / floorExits.length;
    
    const availabilityScore = (1 - availableRatio) * 100;

    let totalCapacity = 0;
    let availableCapacity = 0;
    
    for (const exit of floorExits) {
      totalCapacity += exit.capacity;
      if (exit.status === 'available') {
        availableCapacity += exit.capacity;
      }
    }

    const capacityRatio = availableCapacity / Math.max(1, totalCapacity);
    const capacityScore = (1 - capacityRatio) * 100;

    const finalScore = Math.max(availabilityScore, capacityScore);

    return {
      score: finalScore,
      details: {
        totalExits: floorExits.length,
        availableExits: availableExits.length,
        blockedExits: floorExits.length - availableExits.length,
        totalCapacity,
        availableCapacity
      }
    };
  }

  calculateEvacuationProgressScore(floorId) {
    const floorPersons = Person.findByFloorId(floorId);
    const totalPersons = floorPersons.length;
    
    if (totalPersons === 0) {
      return { score: 0, details: { totalPersons: 0, progress: 100 } };
    }

    const evacuatedPersons = floorPersons.filter(p => p.status === 'evacuated');
    const trappedPersons = floorPersons.filter(p => p.status === 'trapped');
    const injuredPersons = floorPersons.filter(p => p.status === 'injured');
    
    const evacuatedCount = evacuatedPersons.length;
    const trappedCount = trappedPersons.length;
    const injuredCount = injuredPersons.length;
    
    const progress = (evacuatedCount / totalPersons) * 100;
    
    const trappedRisk = (trappedCount / totalPersons) * 100;
    const injuredRisk = (injuredCount / totalPersons) * 100;
    
    const progressScore = (100 - progress) * 0.5 + trappedRisk + injuredRisk * 2;

    return {
      score: Math.min(100, progressScore),
      details: {
        totalPersons,
        evacuatedCount,
        trappedCount,
        injuredCount,
        progress
      }
    };
  }

  evaluateFloor(floorId, timeStep) {
    const congestionResult = this.calculateCongestionScore(floorId);
    const fireResult = this.calculateFireSpreadScore(floorId);
    const exitResult = this.calculateExitAvailabilityScore(floorId);
    const progressResult = this.calculateEvacuationProgressScore(floorId);

    const overallScore = 
      congestionResult.score * RISK_WEIGHTS.congestion +
      fireResult.score * RISK_WEIGHTS.fireSpread +
      exitResult.score * RISK_WEIGHTS.exitAvailability +
      progressResult.score * RISK_WEIGHTS.evacuationProgress;

    return {
      floorId,
      overallScore: Math.round(overallScore * 10) / 10,
      congestionScore: congestionResult.score,
      fireSpreadScore: fireResult.score,
      exitAvailabilityScore: exitResult.score,
      evacuationProgressScore: progressResult.score,
      details: {
        congestion: congestionResult.details,
        fireSpread: fireResult.details,
        exitAvailability: exitResult.details,
        evacuationProgress: progressResult.details
      }
    };
  }

  evaluateOverall(timeStep) {
    const floors = Floor.findAll();
    const floorEvaluations = [];
    
    for (const floor of floors) {
      const floorEval = this.evaluateFloor(floor.id, timeStep);
      floorEvaluations.push(floorEval);
    }

    const totalPersons = Person.findAll().length;
    let weightedSum = 0;
    let totalWeight = 0;

    for (const floorEval of floorEvaluations) {
      const floorPersons = Person.findByFloorId(floorEval.floorId).length;
      const weight = totalPersons > 0 ? floorPersons / totalPersons : 1 / floors.length;
      
      weightedSum += floorEval.overallScore * weight;
      totalWeight += weight;
    }

    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      timeStep,
      overallScore: Math.round(overallScore * 10) / 10,
      floorEvaluations,
      summary: this.getRiskLevel(overallScore)
    };
  }

  getRiskLevel(score) {
    if (score >= 80) return { level: 'critical', color: '#ff0000', description: '极度危险' };
    if (score >= 60) return { level: 'high', color: '#ff6600', description: '高风险' };
    if (score >= 40) return { level: 'medium', color: '#ffcc00', description: '中等风险' };
    if (score >= 20) return { level: 'low', color: '#99cc00', description: '低风险' };
    return { level: 'safe', color: '#00cc00', description: '安全' };
  }

  saveEvaluation(evaluation) {
    const assessment = RiskAssessment.create({
      drill_session_id: this.drillSessionId,
      time_step: evaluation.timeStep,
      overall_score: evaluation.overallScore,
      congestion_score: evaluation.floorEvaluations[0]?.congestionScore || 0,
      fire_spread_score: evaluation.floorEvaluations[0]?.fireSpreadScore || 0,
      exit_availability_score: evaluation.floorEvaluations[0]?.exitAvailabilityScore || 0,
      evacuation_progress_score: evaluation.floorEvaluations[0]?.evacuationProgressScore || 0,
      details: evaluation
    });

    return assessment;
  }

  evaluateAndSave(timeStep) {
    const evaluation = this.evaluateOverall(timeStep);
    this.saveEvaluation(evaluation);
    return evaluation;
  }
}

module.exports = RiskEvaluator;
