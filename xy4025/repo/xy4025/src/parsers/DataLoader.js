import { SimulationData } from '../models/interfaces.js';
import { CSVParser } from './CSVParser.js';

export class DataLoader {
  constructor() {
    this.csvParser = new CSVParser();
    this.simulationData = new SimulationData();
  }

  async loadFromJSON(jsonData) {
    this.simulationData = new SimulationData();

    if (jsonData.floors) {
      for (const floorData of jsonData.floors) {
        this.simulationData.addFloor(floorData);
      }
    }

    if (jsonData.exits) {
      for (const exitData of jsonData.exits) {
        this.simulationData.addExit(exitData);
      }
    }

    if (jsonData.persons) {
      for (const personData of jsonData.persons) {
        this.simulationData.addPerson(personData);
      }
    }

    if (jsonData.blockedEdges) {
      for (const blocked of jsonData.blockedEdges) {
        this.simulationData.addBlockedEdge(blocked);
      }
    }

    if (jsonData.metadata) {
      this.simulationData.metadata = { ...this.simulationData.metadata, ...jsonData.metadata };
    }

    return this.simulationData;
  }

  async loadFromFiles(files) {
    const fileMap = this.classifyFiles(files);
    return this.loadFromClassifiedFiles(fileMap);
  }

  classifyFiles(files) {
    const fileMap = {
      floors: null,
      nodes: null,
      edges: null,
      exits: null,
      persons: null,
      trajectories: null,
      observations: null,
      blockedPaths: null
    };

    for (const file of files) {
      const name = file.name.toLowerCase();
      
      if (name.includes('floor') || name.includes('楼层')) {
        fileMap.floors = file;
      } else if (name.includes('node') || name.includes('节点')) {
        fileMap.nodes = file;
      } else if (name.includes('edge') || name.includes('边') || name.includes('连接')) {
        fileMap.edges = file;
      } else if (name.includes('exit') || name.includes('出口')) {
        fileMap.exits = file;
      } else if (name.includes('person') || name.includes('人员')) {
        fileMap.persons = file;
      } else if (name.includes('trajector') || name.includes('轨迹') || name.includes('移动')) {
        fileMap.trajectories = file;
      } else if (name.includes('observation') || name.includes('观察') || name.includes('备注')) {
        fileMap.observations = file;
      } else if (name.includes('block') || name.includes('封闭') || name.includes('障碍物')) {
        fileMap.blockedPaths = file;
      }
    }

    return fileMap;
  }

  async loadFromClassifiedFiles(fileMap) {
    this.simulationData = new SimulationData();
    const floorsMap = new Map();
    const nodesMap = new Map();
    const edgesMap = new Map();
    const personsMap = new Map();

    if (fileMap.floors) {
      const data = await this.csvParser.parseCSVFile(fileMap.floors);
      const floors = this.csvParser.parseFloors(data);
      for (const floor of floors) {
        this.simulationData.addFloor(floor);
        floorsMap.set(floor.id, floor);
      }
    }

    if (fileMap.nodes) {
      const data = await this.csvParser.parseCSVFile(fileMap.nodes);
      const nodes = this.csvParser.parseNodes(data, floorsMap);
      for (const node of nodes) {
        nodesMap.set(node.id, node);
      }
    }

    if (fileMap.edges) {
      const data = await this.csvParser.parseCSVFile(fileMap.edges);
      const edges = this.csvParser.parseEdges(data, nodesMap, floorsMap);
      for (const edge of edges) {
        edgesMap.set(edge.id, edge);
      }
    }

    if (fileMap.exits) {
      const data = await this.csvParser.parseCSVFile(fileMap.exits);
      const exits = this.csvParser.parseExits(data, nodesMap, floorsMap);
      for (const exit of exits) {
        this.simulationData.addExit(exit);
      }
      this.simulationData.metadata.totalExits = exits.length;
    }

    if (fileMap.persons) {
      const data = await this.csvParser.parseCSVFile(fileMap.persons);
      const persons = this.csvParser.parsePersons(data);
      for (const person of persons) {
        this.simulationData.addPerson(person);
        personsMap.set(person.id, person);
      }
    }

    if (fileMap.trajectories) {
      const data = await this.csvParser.parseCSVFile(fileMap.trajectories);
      this.csvParser.parseTrajectories(data, personsMap);
      this.updateTimeRange(personsMap);
    }

    if (fileMap.observations) {
      const data = await this.csvParser.parseCSVFile(fileMap.observations);
      this.csvParser.parseObservations(data, personsMap);
    }

    if (fileMap.blockedPaths) {
      const data = await this.csvParser.parseCSVFile(fileMap.blockedPaths);
      const blockedPaths = this.csvParser.parseBlockedPaths(data, edgesMap);
      for (const blocked of blockedPaths) {
        this.simulationData.addBlockedEdge(blocked);
      }
    }

    return this.simulationData;
  }

  updateTimeRange(personsMap) {
    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const person of personsMap.values()) {
      if (person.trajectory.length > 0) {
        const firstTime = person.trajectory[0].time;
        const lastTime = person.trajectory[person.trajectory.length - 1].time;
        minTime = Math.min(minTime, firstTime);
        maxTime = Math.max(maxTime, lastTime);
      }
    }

    if (minTime !== Infinity) {
      this.simulationData.metadata.startTime = minTime;
      this.simulationData.metadata.endTime = maxTime;
    }
  }

  getSimulationData() {
    return this.simulationData;
  }
}

export default DataLoader;
