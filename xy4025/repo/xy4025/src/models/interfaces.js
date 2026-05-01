export class Point {
  constructor(x, y, floor = 1) {
    this.x = x;
    this.y = y;
    this.floor = floor;
  }

  distanceTo(other) {
    if (this.floor !== other.floor) return Infinity;
    return Math.sqrt(Math.pow(other.x - this.x, 2) + Math.pow(other.y - this.y, 2));
  }

  clone() {
    return new Point(this.x, this.y, this.floor);
  }

  equals(other) {
    return this.x === other.x && this.y === other.y && this.floor === other.floor;
  }
}

export class Floor {
  constructor(id, name, level, height = 4) {
    this.id = id;
    this.name = name;
    this.level = level;
    this.height = height;
    this.nodes = new Map();
    this.edges = [];
    this.exits = [];
    this.obstacles = [];
  }

  addNode(node) {
    this.nodes.set(node.id, node);
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  addEdge(edge) {
    this.edges.push(edge);
  }

  addExit(exit) {
    this.exits.push(exit);
  }

  addObstacle(obstacle) {
    this.obstacles.push(obstacle);
  }
}

export class Node {
  constructor(id, x, y, floor, type = 'corner') {
    this.id = id;
    this.position = new Point(x, y, floor);
    this.type = type;
    this.connections = [];
  }
}

export class Edge {
  constructor(id, fromNode, toNode, type = 'corridor', width = 2) {
    this.id = id;
    this.from = fromNode;
    this.to = toNode;
    this.type = type;
    this.width = width;
    this.isBlocked = false;
    this.blockReason = null;
    this.blockTimeStart = null;
    this.blockTimeEnd = null;
    this.usageCount = 0;
  }

  get length() {
    return this.from.position.distanceTo(this.to.position);
  }

  isBlockedAt(time) {
    if (!this.isBlocked) return false;
    if (this.blockTimeStart === null && this.blockTimeEnd === null) return true;
    const afterStart = this.blockTimeStart === null || time >= this.blockTimeStart;
    const beforeEnd = this.blockTimeEnd === null || time <= this.blockTimeEnd;
    return afterStart && beforeEnd;
  }
}

export class Exit {
  constructor(id, node, type, isSafe = true) {
    this.id = id;
    this.node = node;
    this.type = type;
    this.isSafe = isSafe;
    this.connections = [];
  }

  get position() {
    return this.node.position;
  }
}

export class Person {
  constructor(id, name, group, startPosition) {
    this.id = id;
    this.name = name;
    this.group = group;
    this.startPosition = startPosition;
    this.trajectory = [];
    this.observations = [];
    this.analysis = null;
  }

  addTrajectoryPoint(time, position, speed = 0) {
    this.trajectory.push({
      time,
      position: position.clone(),
      speed
    });
    this.trajectory.sort((a, b) => a.time - b.time);
  }

  addObservation(time, observer, note) {
    this.observations.push({
      time,
      observer,
      note
    });
    this.observations.sort((a, b) => a.time - b.time);
  }

  getPositionAt(time) {
    if (this.trajectory.length === 0) return null;
    
    const firstPoint = this.trajectory[0];
    if (time <= firstPoint.time) return firstPoint.position;
    
    const lastPoint = this.trajectory[this.trajectory.length - 1];
    if (time >= lastPoint.time) return lastPoint.position;
    
    for (let i = 0; i < this.trajectory.length - 1; i++) {
      const curr = this.trajectory[i];
      const next = this.trajectory[i + 1];
      
      if (time >= curr.time && time <= next.time) {
        const t = (time - curr.time) / (next.time - curr.time);
        return new Point(
          curr.position.x + (next.position.x - curr.position.x) * t,
          curr.position.y + (next.position.y - curr.position.y) * t,
          curr.position.floor
        );
      }
    }
    
    return lastPoint.position;
  }

  getTotalDistance() {
    if (this.trajectory.length < 2) return 0;
    let distance = 0;
    for (let i = 0; i < this.trajectory.length - 1; i++) {
      distance += this.trajectory[i].position.distanceTo(this.trajectory[i + 1].position);
    }
    return distance;
  }

  getTotalTime() {
    if (this.trajectory.length < 2) return 0;
    return this.trajectory[this.trajectory.length - 1].time - this.trajectory[0].time;
  }
}

export class AnalysisResult {
  constructor(personId) {
    this.personId = personId;
    this.actualTime = 0;
    this.actualDistance = 0;
    this.optimalDistance = 0;
    this.detourDistance = 0;
    this.detourRatio = 0;
    this.usedBlockedPaths = [];
    this.reachedExit = null;
    this.reachedNearestExit = false;
    this.anomalies = [];
    this.stayPoints = [];
  }

  addAnomaly(type, time, position, description) {
    this.anomalies.push({
      type,
      time,
      position: position.clone(),
      description
    });
  }

  addStayPoint(timeStart, timeEnd, position, duration) {
    this.stayPoints.push({
      timeStart,
      timeEnd,
      position: position.clone(),
      duration
    });
  }
}

export class SimulationData {
  constructor() {
    this.floors = new Map();
    this.exits = [];
    this.connections = [];
    this.persons = new Map();
    this.blockedEdges = [];
    this.metadata = {
      startTime: 0,
      endTime: 300,
      totalPersons: 0,
      totalExits: 0
    };
  }

  addFloor(floor) {
    this.floors.set(floor.id, floor);
  }

  getFloor(id) {
    return this.floors.get(id);
  }

  addExit(exit) {
    this.exits.push(exit);
  }

  addConnection(connection) {
    this.connections.push(connection);
  }

  addPerson(person) {
    this.persons.set(person.id, person);
    this.metadata.totalPersons = this.persons.size;
  }

  getPerson(id) {
    return this.persons.get(id);
  }

  addBlockedEdge(edgeInfo) {
    this.blockedEdges.push(edgeInfo);
  }

  getAllNodes() {
    const nodes = [];
    for (const floor of this.floors.values()) {
      nodes.push(...floor.nodes.values());
    }
    return nodes;
  }

  getAllEdges() {
    const edges = [];
    for (const floor of this.floors.values()) {
      edges.push(...floor.edges);
    }
    edges.push(...this.connections);
    return edges;
  }
}
