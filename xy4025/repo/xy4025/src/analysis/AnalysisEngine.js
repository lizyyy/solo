import { PathFinder } from './PathFinder.js';
import { AnomalyDetector } from './AnomalyDetector.js';

export class AnalysisEngine {
  constructor(simulationData, config = {}) {
    this.simulationData = simulationData;
    this.pathFinder = new PathFinder(
      simulationData.getAllNodes(),
      simulationData.getAllEdges()
    );
    this.anomalyDetector = new AnomalyDetector(config);
    this.results = {
      personAnalyses: new Map(),
      congestionEvents: [],
      summary: null
    };
  }

  runFullAnalysis() {
    const persons = Array.from(this.simulationData.persons.values());
    const allEdges = this.simulationData.getAllEdges();
    
    for (const person of persons) {
      const analysis = this.anomalyDetector.analyzePerson(
        person,
        this.pathFinder,
        this.simulationData.exits,
        allEdges
      );
      person.analysis = analysis;
      this.results.personAnalyses.set(person.id, analysis);
    }
    
    this.results.congestionEvents = this.anomalyDetector.detectCongestion(
      persons,
      allEdges
    );
    
    this.results.summary = this.generateSummary();
    
    return this.results;
  }

  generateSummary() {
    const personAnalyses = Array.from(this.results.personAnalyses.values());
    
    const totalPersons = personAnalyses.length;
    let personsWithAnomalies = 0;
    let totalAnomalies = 0;
    let totalDetourDistance = 0;
    let reachedExitCount = 0;
    let reachedNearestExitCount = 0;
    let usedBlockedPathCount = 0;
    
    const anomalyTypeCounts = new Map();
    
    for (const analysis of personAnalyses) {
      if (analysis.anomalies.length > 0) {
        personsWithAnomalies++;
        totalAnomalies += analysis.anomalies.length;
      }
      
      for (const anomaly of analysis.anomalies) {
        const count = anomalyTypeCounts.get(anomaly.type) || 0;
        anomalyTypeCounts.set(anomaly.type, count + 1);
      }
      
      totalDetourDistance += analysis.detourDistance;
      
      if (analysis.reachedExit) {
        reachedExitCount++;
        if (analysis.reachedNearestExit) {
          reachedNearestExitCount++;
        }
      }
      
      if (analysis.usedBlockedPaths.length > 0) {
        usedBlockedPathCount++;
      }
    }
    
    return {
      totalPersons,
      personsWithAnomalies,
      anomalyRatio: totalPersons > 0 ? personsWithAnomalies / totalPersons : 0,
      totalAnomalies,
      anomalyTypeCounts: Object.fromEntries(anomalyTypeCounts),
      avgDetourDistance: totalPersons > 0 ? totalDetourDistance / totalPersons : 0,
      reachedExitCount,
      reachedExitRatio: totalPersons > 0 ? reachedExitCount / totalPersons : 0,
      reachedNearestExitCount,
      reachedNearestExitRatio: reachedExitCount > 0 ? reachedNearestExitCount / reachedExitCount : 0,
      usedBlockedPathCount,
      usedBlockedPathRatio: totalPersons > 0 ? usedBlockedPathCount / totalPersons : 0,
      congestionEvents: this.results.congestionEvents.length
    };
  }

  getPersonsWithAnomalies() {
    const result = [];
    for (const [personId, analysis] of this.results.personAnalyses) {
      if (analysis.anomalies.length > 0) {
        const person = this.simulationData.getPerson(personId);
        result.push({ person, analysis });
      }
    }
    return result;
  }

  getPersonsByAnomalyType(anomalyType) {
    const result = [];
    for (const [personId, analysis] of this.results.personAnalyses) {
      const hasType = analysis.anomalies.some(a => a.type === anomalyType);
      if (hasType) {
        const person = this.simulationData.getPerson(personId);
        result.push({ person, analysis });
      }
    }
    return result;
  }

  getCongestionEvents() {
    return this.results.congestionEvents;
  }

  getSummary() {
    return this.results.summary;
  }

  getPersonAnalysis(personId) {
    return this.results.personAnalyses.get(personId);
  }

  getPersonsByFloor(floorLevel) {
    const result = [];
    for (const [personId, analysis] of this.results.personAnalyses) {
      const person = this.simulationData.getPerson(personId);
      if (person.trajectory.length > 0) {
        const startFloor = person.trajectory[0].position.floor;
        if (startFloor === floorLevel) {
          result.push({ person, analysis });
        }
      }
    }
    return result;
  }

  getPersonsByGroup(group) {
    const result = [];
    for (const [personId, analysis] of this.results.personAnalyses) {
      const person = this.simulationData.getPerson(personId);
      if (person.group === group) {
        result.push({ person, analysis });
      }
    }
    return result;
  }

  getAllGroups() {
    const groups = new Set();
    for (const person of this.simulationData.persons.values()) {
      groups.add(person.group);
    }
    return Array.from(groups);
  }

  getAllFloors() {
    return Array.from(this.simulationData.floors.values()).map(f => f.level);
  }
}

export default AnalysisEngine;
