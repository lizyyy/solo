import Papa from 'papaparse';
import { Point, Floor, Node, Edge, Exit, Person, SimulationData } from '../models/interfaces.js';
import { ExitType, ConnectionType } from '../models/types.js';

export class CSVParser {
  constructor() {
    this.errors = [];
  }

  async parseCSVFile(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  async parseCSVString(csvString) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  parseFloors(data) {
    const floors = [];
    for (const row of data) {
      const floor = new Floor(
        row.id || `floor_${floors.length}`,
        row.name || `楼层 ${row.level}`,
        parseInt(row.level) || 1,
        parseFloat(row.height) || 4
      );
      floors.push(floor);
    }
    return floors;
  }

  parseNodes(data, floorsMap) {
    const nodes = [];
    for (const row of data) {
      const floorId = row.floorId || row.floor;
      const floor = floorsMap.get(floorId);
      if (!floor) {
        this.errors.push(`未找到楼层: ${floorId}`);
        continue;
      }
      
      const node = new Node(
        row.id || `node_${nodes.length}`,
        parseFloat(row.x) || 0,
        parseFloat(row.y) || 0,
        floor.level,
        row.type || 'corner'
      );
      floor.addNode(node);
      nodes.push(node);
    }
    return nodes;
  }

  parseEdges(data, nodesMap, floorsMap) {
    const edges = [];
    for (const row of data) {
      const fromNode = nodesMap.get(row.from || row.fromId);
      const toNode = nodesMap.get(row.to || row.toId);
      
      if (!fromNode || !toNode) {
        this.errors.push(`边的节点不存在: ${row.from} -> ${row.to}`);
        continue;
      }

      const edge = new Edge(
        row.id || `edge_${edges.length}`,
        fromNode,
        toNode,
        row.type || ConnectionType.CORRIDOR,
        parseFloat(row.width) || 2
      );

      if (row.blocked === 'true' || row.blocked === true || row.isBlocked === 'true' || row.isBlocked === true) {
        edge.isBlocked = true;
        edge.blockReason = row.blockReason || null;
        edge.blockTimeStart = row.blockTimeStart ? parseFloat(row.blockTimeStart) : null;
        edge.blockTimeEnd = row.blockTimeEnd ? parseFloat(row.blockTimeEnd) : null;
      }

      const floor = floorsMap.get(row.floorId || row.floor);
      if (floor) {
        floor.addEdge(edge);
      }
      
      edges.push(edge);
    }
    return edges;
  }

  parseExits(data, nodesMap, floorsMap) {
    const exits = [];
    for (const row of data) {
      const node = nodesMap.get(row.nodeId || row.node);
      if (!node) {
        this.errors.push(`出口节点不存在: ${row.nodeId}`);
        continue;
      }

      const exit = new Exit(
        row.id || `exit_${exits.length}`,
        node,
        row.type || ExitType.EMERGENCY,
        (row.isSafe !== 'false' && row.isSafe !== false)
      );

      const floor = floorsMap.get(row.floorId || row.floor);
      if (floor) {
        floor.addExit(exit);
      }
      
      exits.push(exit);
    }
    return exits;
  }

  parsePersons(data) {
    const persons = [];
    for (const row of data) {
      const startPos = new Point(
        parseFloat(row.startX) || 0,
        parseFloat(row.startY) || 0,
        parseInt(row.startFloor) || 1
      );
      
      const person = new Person(
        row.id || `person_${persons.length}`,
        row.name || `人员 ${persons.length}`,
        row.group || 'default',
        startPos
      );
      
      persons.push(person);
    }
    return persons;
  }

  parseTrajectories(data, personsMap) {
    for (const row of data) {
      const person = personsMap.get(row.personId || row.person_id);
      if (!person) {
        continue;
      }

      const position = new Point(
        parseFloat(row.x) || 0,
        parseFloat(row.y) || 0,
        parseInt(row.floor) || 1
      );

      person.addTrajectoryPoint(
        parseFloat(row.time) || 0,
        position,
        parseFloat(row.speed) || 0
      );
    }
  }

  parseObservations(data, personsMap) {
    for (const row of data) {
      const person = personsMap.get(row.personId || row.person_id);
      if (!person) {
        continue;
      }

      person.addObservation(
        parseFloat(row.time) || 0,
        row.observer || '未知观察员',
        row.note || row.remark || ''
      );
    }
  }

  parseBlockedPaths(data, edgesMap) {
    const blockedPaths = [];
    for (const row of data) {
      const edge = edgesMap.get(row.edgeId || row.edge_id);
      if (!edge) {
        this.errors.push(`封闭边不存在: ${row.edgeId}`);
        continue;
      }

      edge.isBlocked = true;
      edge.blockReason = row.reason || row.blockReason || null;
      edge.blockTimeStart = row.timeStart ? parseFloat(row.timeStart) : null;
      edge.blockTimeEnd = row.timeEnd ? parseFloat(row.timeEnd) : null;

      blockedPaths.push({
        edge,
        reason: edge.blockReason,
        timeStart: edge.blockTimeStart,
        timeEnd: edge.blockTimeEnd
      });
    }
    return blockedPaths;
  }
}

export default CSVParser;
