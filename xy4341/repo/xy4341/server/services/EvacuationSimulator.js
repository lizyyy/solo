const Floor = require('../models/Floor');
const Exit = require('../models/Exit');
const Person = require('../models/Person');
const DrillSession = require('../models/DrillSession');
const FirePoint = require('../models/FirePoint');
const DrillEvent = require('../models/DrillEvent');
const SimulationSnapshot = require('../models/SimulationSnapshot');

const SIMULATION_CONFIG = {
  PERSON_SPEED: 1.5,
  PERSON_DENSITY_THRESHOLD: 0.3,
  CONGESTION_DISTANCE: 2.0,
  FIRE_SPREAD_RATE: 0.5,
  FIRE_DANGER_RADIUS_MULTIPLIER: 1.5,
  EXIT_CAPACITY_PER_STEP: 2,
  MIN_DISTANCE_TO_FIRE: 3.0
};

class EvacuationSimulator {
  constructor(drillSessionId) {
    this.drillSessionId = drillSessionId;
    this.drillSession = null;
    this.floors = [];
    this.exits = new Map();
    this.persons = new Map();
    this.firePoints = [];
    this.congestionPoints = [];
    this.timeStep = 0;
  }

  async initialize() {
    this.drillSession = DrillSession.findById(this.drillSessionId);
    if (!this.drillSession) {
      throw new Error('Drill session not found');
    }

    this.floors = Floor.findAll();
    this.timeStep = this.drillSession.current_time_step;

    for (const floor of this.floors) {
      const floorExits = Exit.findByFloorId(floor.id);
      this.exits.set(floor.id, floorExits);

      const floorPersons = Person.findByFloorId(floor.id);
      for (const person of floorPersons) {
        this.persons.set(person.id, person);
      }
    }

    this.firePoints = FirePoint.findByDrillSessionId(this.drillSessionId);

    if (this.timeStep === 0) {
      this.assignNearestExits();
    }

    console.log(`Simulator initialized for session ${this.drillSessionId}`);
  }

  assignNearestExits() {
    for (const [personId, person] of this.persons) {
      const floorExits = this.exits.get(person.floor_id) || [];
      const availableExits = floorExits.filter(e => e.status === 'available');
      
      if (availableExits.length > 0) {
        let nearestExit = availableExits[0];
        let minDistance = this.calculateDistance(person, nearestExit);
        
        for (const exit of availableExits.slice(1)) {
          const distance = this.calculateDistance(person, exit);
          if (distance < minDistance) {
            minDistance = distance;
            nearestExit = exit;
          }
        }
        
        person.nearest_exit_id = nearestExit.id;
        this.persons.set(personId, person);
      }
    }
  }

  calculateDistance(point1, point2) {
    return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
  }

  isPointInFireDangerZone(x, y, floorId) {
    const floorFirePoints = this.firePoints.filter(fp => fp.floor_id === floorId);
    for (const firePoint of floorFirePoints) {
      const dangerRadius = firePoint.radius * SIMULATION_CONFIG.FIRE_DANGER_RADIUS_MULTIPLIER;
      const distance = this.calculateDistance({ x, y }, firePoint);
      if (distance <= dangerRadius) {
        return { inDanger: true, firePoint };
      }
    }
    return { inDanger: false };
  }

  findAlternativeExit(person, currentExitId) {
    const floorExits = this.exits.get(person.floor_id) || [];
    const availableExits = floorExits.filter(e => 
      e.status === 'available' && e.id !== currentExitId
    );
    
    if (availableExits.length === 0) return null;
    
    let bestExit = null;
    let bestScore = -Infinity;
    
    for (const exit of availableExits) {
      const distance = this.calculateDistance(person, exit);
      const fireDanger = this.isPointInFireDangerZone(exit.x, exit.y, person.floor_id);
      
      let score = 1000 - distance;
      if (fireDanger.inDanger) {
        score -= 500;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestExit = exit;
      }
    }
    
    return bestExit;
  }

  detectCongestion(floorId) {
    const floorPersons = Array.from(this.persons.values()).filter(p => 
      p.floor_id === floorId && p.status === 'evacuating'
    );
    
    const congestionPoints = [];
    const visited = new Set();
    
    for (const person of floorPersons) {
      if (visited.has(person.id)) continue;
      
      const cluster = [person];
      visited.add(person.id);
      
      for (const otherPerson of floorPersons) {
        if (visited.has(otherPerson.id)) continue;
        
        const distance = this.calculateDistance(person, otherPerson);
        if (distance < SIMULATION_CONFIG.CONGESTION_DISTANCE) {
          cluster.push(otherPerson);
          visited.add(otherPerson.id);
        }
      }
      
      if (cluster.length >= 5) {
        const centerX = cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length;
        const centerY = cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length;
        
        congestionPoints.push({
          x: centerX,
          y: centerY,
          personCount: cluster.length,
          intensity: Math.min(1.0, cluster.length / 15)
        });
      }
    }
    
    return congestionPoints;
  }

  step() {
    this.timeStep++;
    const events = [];

    for (const floor of this.floors) {
      const floorCongestion = this.detectCongestion(floor.id);
      if (floorCongestion.length > 0) {
        events.push({
          event_type: 'congestion_detected',
          description: `楼层 ${floor.name} 检测到 ${floorCongestion.length} 个拥堵点`,
          data: { floorId: floor.id, congestionPoints: floorCongestion }
        });
      }
    }

    const exitQueue = new Map();
    for (const [floorId, floorExits] of this.exits) {
      for (const exit of floorExits) {
        exitQueue.set(exit.id, []);
      }
    }

    for (const [personId, person] of this.persons) {
      if (person.status === 'evacuated' || person.status === 'injured') continue;

      if (person.status === 'idle') {
        person.status = 'evacuating';
      }

      const fireDanger = this.isPointInFireDangerZone(person.x, person.y, person.floor_id);
      if (fireDanger.inDanger) {
        person.status = 'trapped';
        events.push({
          event_type: 'person_trapped',
          description: `人员 ${personId} 被困在危险区域`,
          data: { personId, floorId: person.floor_id, x: person.x, y: person.y }
        });
        continue;
      }

      let targetExit = null;
      if (person.nearest_exit_id) {
        const floorExits = this.exits.get(person.floor_id) || [];
        targetExit = floorExits.find(e => e.id === person.nearest_exit_id);
        
        if (targetExit && targetExit.status !== 'available') {
          const alternativeExit = this.findAlternativeExit(person, person.nearest_exit_id);
          if (alternativeExit) {
            person.nearest_exit_id = alternativeExit.id;
            targetExit = alternativeExit;
            events.push({
              event_type: 'exit_changed',
              description: `人员 ${personId} 切换出口`,
              data: { personId, oldExitId: targetExit.id, newExitId: alternativeExit.id }
            });
          } else {
            person.status = 'trapped';
            continue;
          }
        }
      }

      if (!targetExit) {
        person.status = 'trapped';
        continue;
      }

      const distanceToExit = this.calculateDistance(person, targetExit);
      
      if (distanceToExit < 1.0) {
        exitQueue.get(targetExit.id).push(person);
      } else {
        const directionX = targetExit.x - person.x;
        const directionY = targetExit.y - person.y;
        const directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        
        const moveDistance = SIMULATION_CONFIG.PERSON_SPEED * person.speed;
        
        person.x += (directionX / directionLength) * moveDistance;
        person.y += (directionY / directionLength) * moveDistance;
        
        const newDistance = this.calculateDistance(person, targetExit);
        if (newDistance < 1.0) {
          exitQueue.get(targetExit.id).push(person);
        }
      }

      this.persons.set(personId, person);
    }

    for (const [exitId, personsAtExit] of exitQueue) {
      const exit = Array.from(this.exits.values())
        .flat()
        .find(e => e.id === exitId);
      
      if (!exit) continue;
      
      const capacity = exit.capacity * SIMULATION_CONFIG.EXIT_CAPACITY_PER_STEP;
      const personsToEvacuate = personsAtExit.slice(0, capacity);
      
      for (const person of personsToEvacuate) {
        person.status = 'evacuated';
        person.evacuation_time = this.timeStep;
        this.persons.set(person.id, person);
      }
      
      if (personsToEvacuate.length > 0) {
        events.push({
          event_type: 'persons_evacuated',
          description: `${personsToEvacuate.length} 人通过出口 ${exit.name} 疏散`,
          data: { exitId, count: personsToEvacuate.length }
        });
      }
    }

    this.updatePersonsInDatabase();
    this.updateDrillSessionTimeStep();
    this.createSnapshot();

    for (const event of events) {
      DrillEvent.create({
        drill_session_id: this.drillSessionId,
        time_step: this.timeStep,
        event_type: event.event_type,
        description: event.description,
        data: event.data
      });
    }

    const statusSummary = Person.getStatusSummary();
    const allEvacuated = statusSummary.idle === 0 && 
                         statusSummary.evacuating === 0 && 
                         statusSummary.trapped === 0;
    
    if (allEvacuated) {
      DrillSession.update(this.drillSessionId, { status: 'completed' });
      DrillEvent.create({
        drill_session_id: this.drillSessionId,
        time_step: this.timeStep,
        event_type: 'drill_completed',
        description: '演练已完成，所有人员已疏散',
        data: { totalEvacuated: statusSummary.evacuated }
      });
    }

    return {
      timeStep: this.timeStep,
      events,
      statusSummary,
      isComplete: allEvacuated
    };
  }

  updatePersonsInDatabase() {
    for (const [personId, person] of this.persons) {
      Person.update(personId, {
        x: person.x,
        y: person.y,
        status: person.status,
        nearest_exit_id: person.nearest_exit_id,
        evacuation_time: person.evacuation_time
      });
    }
  }

  updateDrillSessionTimeStep() {
    DrillSession.update(this.drillSessionId, {
      current_time_step: this.timeStep
    });
  }

  createSnapshot() {
    const snapshotData = {
      persons: Array.from(this.persons.values()).map(p => ({
        id: p.id,
        floor_id: p.floor_id,
        x: p.x,
        y: p.y,
        status: p.status,
        nearest_exit_id: p.nearest_exit_id
      })),
      firePoints: this.firePoints.map(fp => fp.toJSON()),
      exits: Array.from(this.exits.entries()).map(([floorId, floorExits]) => ({
        floorId,
        exits: floorExits.map(e => e.toJSON())
      }))
    };

    SimulationSnapshot.create({
      drill_session_id: this.drillSessionId,
      time_step: this.timeStep,
      snapshot_data: snapshotData
    });
  }

  addFirePoint(floorId, x, y, intensity = 1.0, radius = 5.0) {
    const firePoint = FirePoint.create({
      drill_session_id: this.drillSessionId,
      floor_id: floorId,
      x,
      y,
      intensity,
      radius,
      time_step: this.timeStep
    });
    
    this.firePoints.push(firePoint);
    
    this.updateExitsAvailability();
    
    return firePoint;
  }

  updateExitsAvailability() {
    for (const [floorId, floorExits] of this.exits) {
      for (const exit of floorExits) {
        const fireDanger = this.isPointInFireDangerZone(exit.x, exit.y, floorId);
        
        if (fireDanger.inDanger && exit.status === 'available') {
          Exit.update(exit.id, { status: 'blocked' });
          exit.status = 'blocked';
          
          DrillEvent.create({
            drill_session_id: this.drillSessionId,
            time_step: this.timeStep,
            event_type: 'exit_blocked',
            description: `出口 ${exit.name} 被火势阻断`,
            data: { exitId: exit.id, floorId }
          });
        }
      }
    }
  }

  getState() {
    return {
      timeStep: this.timeStep,
      drillSession: this.drillSession,
      persons: Array.from(this.persons.values()).map(p => p.toJSON()),
      firePoints: this.firePoints.map(fp => fp.toJSON()),
      exits: Array.from(this.exits.entries()).map(([floorId, floorExits]) => ({
        floorId,
        exits: floorExits.map(e => e.toJSON())
      })),
      statusSummary: Person.getStatusSummary()
    };
  }
}

module.exports = EvacuationSimulator;
