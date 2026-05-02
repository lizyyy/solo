import { SimulationData, Floor, Node, Edge, Exit, Person, Point } from '../models/interfaces.js';
import { ExitType, ConnectionType } from '../models/types.js';

export class SampleDataGenerator {
  constructor() {
    this.floorHeight = 4;
  }

  generate() {
    const simulationData = new SimulationData();
    
    const floor1 = new Floor('floor_1', '一层', 1, this.floorHeight);
    const floor2 = new Floor('floor_2', '二层', 2, this.floorHeight);
    
    simulationData.addFloor(floor1);
    simulationData.addFloor(floor2);
    
    this.createFloor1Nodes(floor1);
    this.createFloor2Nodes(floor2);
    this.createEdges(floor1, floor2);
    this.createExits(floor1, floor2, simulationData);
    this.createBlockedEdges(floor1);
    this.createPersons(simulationData, floor1, floor2);
    
    simulationData.metadata.startTime = 0;
    simulationData.metadata.endTime = 300;
    
    return simulationData;
  }

  createFloor1Nodes(floor) {
    const nodePositions = [
      { id: 'f1_nw', x: -40, y: -30 },
      { id: 'f1_n', x: 0, y: -30 },
      { id: 'f1_ne', x: 40, y: -30 },
      { id: 'f1_w', x: -40, y: 0 },
      { id: 'f1_center', x: 0, y: 0 },
      { id: 'f1_e', x: 40, y: 0 },
      { id: 'f1_sw', x: -40, y: 30 },
      { id: 'f1_s', x: 0, y: 30 },
      { id: 'f1_se', x: 40, y: 30 },
      { id: 'f1_stair_nw', x: -35, y: -25 },
      { id: 'f1_stair_se', x: 35, y: 25 },
      { id: 'f1_shop_1', x: -20, y: -15 },
      { id: 'f1_shop_2', x: 20, y: -15 },
      { id: 'f1_shop_3', x: -20, y: 15 },
      { id: 'f1_shop_4', x: 20, y: 15 }
    ];
    
    for (const pos of nodePositions) {
      const node = new Node(pos.id, pos.x, pos.y, floor.level, pos.type || 'corner');
      floor.addNode(node);
    }
  }

  createFloor2Nodes(floor) {
    const nodePositions = [
      { id: 'f2_nw', x: -40, y: -30 },
      { id: 'f2_n', x: 0, y: -30 },
      { id: 'f2_ne', x: 40, y: -30 },
      { id: 'f2_w', x: -40, y: 0 },
      { id: 'f2_center', x: 0, y: 0 },
      { id: 'f2_e', x: 40, y: 0 },
      { id: 'f2_sw', x: -40, y: 30 },
      { id: 'f2_s', x: 0, y: 30 },
      { id: 'f2_se', x: 40, y: 30 },
      { id: 'f2_stair_nw', x: -35, y: -25 },
      { id: 'f2_stair_se', x: 35, y: 25 },
      { id: 'f2_restaurant', x: -20, y: -15 },
      { id: 'f2_cinema', x: 20, y: -15 },
      { id: 'f2_office', x: 0, y: 15 }
    ];
    
    for (const pos of nodePositions) {
      const node = new Node(pos.id, pos.x, pos.y, floor.level, pos.type || 'corner');
      floor.addNode(node);
    }
  }

  createEdges(floor1, floor2) {
    const floor1Edges = [
      ['f1_nw', 'f1_n', ConnectionType.CORRIDOR],
      ['f1_n', 'f1_ne', ConnectionType.CORRIDOR],
      ['f1_w', 'f1_center', ConnectionType.CORRIDOR],
      ['f1_center', 'f1_e', ConnectionType.CORRIDOR],
      ['f1_sw', 'f1_s', ConnectionType.CORRIDOR],
      ['f1_s', 'f1_se', ConnectionType.CORRIDOR],
      ['f1_nw', 'f1_w', ConnectionType.CORRIDOR],
      ['f1_ne', 'f1_e', ConnectionType.CORRIDOR],
      ['f1_sw', 'f1_w', ConnectionType.CORRIDOR],
      ['f1_se', 'f1_e', ConnectionType.CORRIDOR],
      ['f1_n', 'f1_center', ConnectionType.CORRIDOR],
      ['f1_center', 'f1_s', ConnectionType.CORRIDOR],
      ['f1_center', 'f1_shop_1', ConnectionType.CORRIDOR],
      ['f1_center', 'f1_shop_2', ConnectionType.CORRIDOR],
      ['f1_center', 'f1_shop_3', ConnectionType.CORRIDOR],
      ['f1_center', 'f1_shop_4', ConnectionType.CORRIDOR],
      ['f1_w', 'f1_stair_nw', ConnectionType.STAIRCASE],
      ['f1_e', 'f1_stair_se', ConnectionType.STAIRCASE]
    ];
    
    for (const [fromId, toId, type] of floor1Edges) {
      const from = floor1.getNode(fromId);
      const to = floor1.getNode(toId);
      if (from && to) {
        const edge = new Edge(`edge_${fromId}_${toId}`, from, to, type, type === ConnectionType.CORRIDOR ? 3 : 2);
        floor1.addEdge(edge);
      }
    }
    
    const blockedEdge = floor1.edges.find(e => 
      (e.from.id === 'f1_center' && e.to.id === 'f1_s') ||
      (e.from.id === 'f1_s' && e.to.id === 'f1_center')
    );
    if (blockedEdge) {
      blockedEdge.isBlocked = true;
      blockedEdge.blockReason = '演练中临时封闭 - 模拟火灾区域';
    }
    
    const floor2Edges = [
      ['f2_nw', 'f2_n', ConnectionType.CORRIDOR],
      ['f2_n', 'f2_ne', ConnectionType.CORRIDOR],
      ['f2_w', 'f2_center', ConnectionType.CORRIDOR],
      ['f2_center', 'f2_e', ConnectionType.CORRIDOR],
      ['f2_sw', 'f2_s', ConnectionType.CORRIDOR],
      ['f2_s', 'f2_se', ConnectionType.CORRIDOR],
      ['f2_nw', 'f2_w', ConnectionType.CORRIDOR],
      ['f2_ne', 'f2_e', ConnectionType.CORRIDOR],
      ['f2_sw', 'f2_w', ConnectionType.CORRIDOR],
      ['f2_se', 'f2_e', ConnectionType.CORRIDOR],
      ['f2_n', 'f2_center', ConnectionType.CORRIDOR],
      ['f2_center', 'f2_s', ConnectionType.CORRIDOR],
      ['f2_center', 'f2_restaurant', ConnectionType.CORRIDOR],
      ['f2_center', 'f2_cinema', ConnectionType.CORRIDOR],
      ['f2_center', 'f2_office', ConnectionType.CORRIDOR],
      ['f2_w', 'f2_stair_nw', ConnectionType.STAIRCASE],
      ['f2_e', 'f2_stair_se', ConnectionType.STAIRCASE]
    ];
    
    for (const [fromId, toId, type] of floor2Edges) {
      const from = floor2.getNode(fromId);
      const to = floor2.getNode(toId);
      if (from && to) {
        const edge = new Edge(`edge_${fromId}_${toId}`, from, to, type, type === ConnectionType.CORRIDOR ? 3 : 2);
        floor2.addEdge(edge);
      }
    }
  }

  createExits(floor1, floor2, simulationData) {
    const exitConfigs = [
      { id: 'exit_nw', nodeId: 'f1_nw', type: ExitType.EMERGENCY, floor: floor1 },
      { id: 'exit_ne', nodeId: 'f1_ne', type: ExitType.EMERGENCY, floor: floor1 },
      { id: 'exit_sw', nodeId: 'f1_sw', type: ExitType.MAIN, floor: floor1 },
      { id: 'exit_se', nodeId: 'f1_se', type: ExitType.MAIN, floor: floor1 },
      { id: 'exit_stair_nw', nodeId: 'f1_stair_nw', type: ExitType.STAIRCASE, floor: floor1 },
      { id: 'exit_stair_se', nodeId: 'f1_stair_se', type: ExitType.STAIRCASE, floor: floor1 }
    ];
    
    for (const config of exitConfigs) {
      const node = config.floor.getNode(config.nodeId);
      if (node) {
        const exit = new Exit(config.id, node, config.type, true);
        config.floor.addExit(exit);
        simulationData.addExit(exit);
      }
    }
  }

  createBlockedEdges(floor1) {
    const blockedEdge = floor1.edges.find(e => 
      (e.from.id === 'f1_center' && e.to.id === 'f1_s') ||
      (e.from.id === 'f1_s' && e.to.id === 'f1_center')
    );
    if (blockedEdge) {
      blockedEdge.isBlocked = true;
      blockedEdge.blockReason = '演练中临时封闭 - 模拟火灾区域';
    }
  }

  createPersons(simulationData, floor1, floor2) {
    const personConfigs = [
      {
        id: 'p1',
        name: '张三',
        group: '商铺人员',
        startPos: { x: -20, y: -15, floor: 1 },
        trajectory: this.createTrajectory(
          { x: -20, y: -15, floor: 1 },
          [
            { time: 0, x: -20, y: -15 },
            { time: 30, x: 0, y: 0 },
            { time: 60, x: 0, y: -30 },
            { time: 90, x: -40, y: -30 }
          ]
        ),
        observations: [{ time: 45, observer: '观察员A', note: '在中心区域犹豫不决' }],
        hasAnomaly: true
      },
      {
        id: 'p2',
        name: '李四',
        group: '顾客',
        startPos: { x: 20, y: -15, floor: 1 },
        trajectory: this.createTrajectory(
          { x: 20, y: -15, floor: 1 },
          [
            { time: 0, x: 20, y: -15 },
            { time: 20, x: 0, y: 0 },
            { time: 40, x: 0, y: 30 },
            { time: 60, x: 40, y: 30 }
          ]
        ),
        observations: [],
        hasAnomaly: true,
        usesBlocked: true
      },
      {
        id: 'p3',
        name: '王五',
        group: '员工',
        startPos: { x: -20, y: 15, floor: 1 },
        trajectory: this.createTrajectory(
          { x: -20, y: 15, floor: 1 },
          [
            { time: 0, x: -20, y: 15 },
            { time: 15, x: 0, y: 0 },
            { time: 35, x: -40, y: 0 },
            { time: 55, x: -40, y: -25 },
            { time: 75, x: -40, y: -30 }
          ]
        ),
        observations: [{ time: 50, observer: '观察员B', note: '引导其他人员' }],
        hasAnomaly: false
      },
      {
        id: 'p4',
        name: '赵六',
        group: '顾客',
        startPos: { x: 20, y: 15, floor: 1 },
        trajectory: this.createTrajectory(
          { x: 20, y: 15, floor: 1 },
          [
            { time: 0, x: 20, y: 15 },
            { time: 0, x: 20, y: 15 },
            { time: 45, x: 20, y: 15 },
            { time: 60, x: 0, y: 0 },
            { time: 80, x: 40, y: 0 },
            { time: 100, x: 40, y: 30 }
          ]
        ),
        observations: [{ time: 20, observer: '观察员A', note: '在店铺门口停留，似乎在等待' }],
        hasAnomaly: true,
        staysTooLong: true
      },
      {
        id: 'p5',
        name: '孙七',
        group: '商铺人员',
        startPos: { x: 0, y: 0, floor: 1 },
        trajectory: this.createTrajectory(
          { x: 0, y: 0, floor: 1 },
          [
            { time: 0, x: 0, y: 0 },
            { time: 10, x: 40, y: 0 },
            { time: 25, x: 40, y: 25 },
            { time: 40, x: 40, y: 30 }
          ]
        ),
        observations: [],
        hasAnomaly: false
      },
      {
        id: 'p6',
        name: '周八',
        group: '顾客',
        startPos: { x: -40, y: -30, floor: 1 },
        trajectory: this.createTrajectory(
          { x: -40, y: -30, floor: 1 },
          [
            { time: 0, x: -40, y: -30 },
            { time: 5, x: -40, y: -30 }
          ]
        ),
        observations: [{ time: 0, observer: '观察员A', note: '已在出口附近' }],
        hasAnomaly: false
      },
      {
        id: 'p7',
        name: '吴九',
        group: '顾客',
        startPos: { x: -20, y: -15, floor: 2 },
        trajectory: this.createTrajectory(
          { x: -20, y: -15, floor: 2 },
          [
            { time: 0, x: -20, y: -15, floor: 2 },
            { time: 20, x: 0, y: 0, floor: 2 },
            { time: 40, x: -40, y: 0, floor: 2 },
            { time: 60, x: -35, y: -25, floor: 2 },
            { time: 90, x: -35, y: -25, floor: 1 },
            { time: 110, x: -40, y: -30, floor: 1 }
          ]
        ),
        observations: [{ time: 80, observer: '观察员C', note: '从楼梯下到一层' }],
        hasAnomaly: false
      },
      {
        id: 'p8',
        name: '郑十',
        group: '员工',
        startPos: { x: 20, y: -15, floor: 2 },
        trajectory: this.createTrajectory(
          { x: 20, y: -15, floor: 2 },
          [
            { time: 0, x: 20, y: -15, floor: 2 },
            { time: 15, x: 0, y: 0, floor: 2 },
            { time: 30, x: 0, y: 0, floor: 2 },
            { time: 75, x: 0, y: 0, floor: 2 },
            { time: 90, x: 40, y: 0, floor: 2 },
            { time: 110, x: 35, y: 25, floor: 2 },
            { time: 140, x: 35, y: 25, floor: 1 },
            { time: 160, x: 40, y: 30, floor: 1 }
          ]
        ),
        observations: [
          { time: 40, observer: '观察员C', note: '在二层中心区域组织疏散' },
          { time: 130, observer: '观察员B', note: '从另一楼梯下到一层' }
        ],
        hasAnomaly: true,
        staysTooLong: true
      }
    ];
    
    for (const config of personConfigs) {
      const person = new Person(
        config.id,
        config.name,
        config.group,
        new Point(config.startPos.x, config.startPos.y, config.startPos.floor)
      );
      
      for (const point of config.trajectory) {
        const floor = point.floor || config.startPos.floor;
        person.addTrajectoryPoint(
          point.time,
          new Point(point.x, point.y, floor)
        );
      }
      
      for (const obs of config.observations) {
        person.addObservation(obs.time, obs.observer, obs.note);
      }
      
      simulationData.addPerson(person);
    }
  }

  createTrajectory(startPos, points) {
    return points.map(p => ({
      time: p.time,
      x: p.x,
      y: p.y,
      floor: p.floor || startPos.floor
    }));
  }

  exportCSVFiles() {
    const floorsCSV = `id,name,level,height
floor_1,一层,1,4
floor_2,二层,2,4`;

    const nodesCSV = `id,floor,x,y,type
f1_nw,floor_1,-40,-30,corner
f1_n,floor_1,0,-30,corner
f1_ne,floor_1,40,-30,corner
f1_w,floor_1,-40,0,corner
f1_center,floor_1,0,0,corner
f1_e,floor_1,40,0,corner
f1_sw,floor_1,-40,30,corner
f1_s,floor_1,0,30,corner
f1_se,floor_1,40,30,corner
f1_stair_nw,floor_1,-35,-25,stair
f1_stair_se,floor_1,35,25,stair
f1_shop_1,floor_1,-20,-15,shop
f1_shop_2,floor_1,20,-15,shop
f1_shop_3,floor_1,-20,15,shop
f1_shop_4,floor_1,20,15,shop
f2_nw,floor_2,-40,-30,corner
f2_n,floor_2,0,-30,corner
f2_ne,floor_2,40,-30,corner
f2_w,floor_2,-40,0,corner
f2_center,floor_2,0,0,corner
f2_e,floor_2,40,0,corner
f2_sw,floor_2,-40,30,corner
f2_s,floor_2,0,30,corner
f2_se,floor_2,40,30,corner
f2_stair_nw,floor_2,-35,-25,stair
f2_stair_se,floor_2,35,25,stair
f2_restaurant,floor_2,-20,-15,restaurant
f2_cinema,floor_2,20,-15,cinema
f2_office,floor_2,0,15,office`;

    const edgesCSV = `id,floor,from,to,type,width,blocked,blockReason
edge_f1_nw_f1_n,floor_1,f1_nw,f1_n,corridor,3,false,
edge_f1_n_f1_ne,floor_1,f1_n,f1_ne,corridor,3,false,
edge_f1_w_f1_center,floor_1,f1_w,f1_center,corridor,3,false,
edge_f1_center_f1_e,floor_1,f1_center,f1_e,corridor,3,false,
edge_f1_sw_f1_s,floor_1,f1_sw,f1_s,corridor,3,false,
edge_f1_s_f1_se,floor_1,f1_s,f1_se,corridor,3,false,
edge_f1_nw_f1_w,floor_1,f1_nw,f1_w,corridor,3,false,
edge_f1_ne_f1_e,floor_1,f1_ne,f1_e,corridor,3,false,
edge_f1_sw_f1_w,floor_1,f1_sw,f1_w,corridor,3,false,
edge_f1_se_f1_e,floor_1,f1_se,f1_e,corridor,3,false,
edge_f1_n_f1_center,floor_1,f1_n,f1_center,corridor,3,false,
edge_f1_center_f1_s,floor_1,f1_center,f1_s,corridor,3,true,演练中临时封闭 - 模拟火灾区域
edge_f1_w_f1_stair_nw,floor_1,f1_w,f1_stair_nw,staircase,2,false,
edge_f1_e_f1_stair_se,floor_1,f1_e,f1_stair_se,staircase,2,false,
edge_f2_nw_f2_n,floor_2,f2_nw,f2_n,corridor,3,false,
edge_f2_n_f2_ne,floor_2,f2_n,f2_ne,corridor,3,false,
edge_f2_w_f2_center,floor_2,f2_w,f2_center,corridor,3,false,
edge_f2_center_f2_e,floor_2,f2_center,f2_e,corridor,3,false,
edge_f2_sw_f2_s,floor_2,f2_sw,f2_s,corridor,3,false,
edge_f2_s_f2_se,floor_2,f2_s,f2_se,corridor,3,false,
edge_f2_nw_f2_w,floor_2,f2_nw,f2_w,corridor,3,false,
edge_f2_ne_f2_e,floor_2,f2_ne,f2_e,corridor,3,false,
edge_f2_sw_f2_w,floor_2,f2_sw,f2_w,corridor,3,false,
edge_f2_se_f2_e,floor_2,f2_se,f2_e,corridor,3,false,
edge_f2_n_f2_center,floor_2,f2_n,f2_center,corridor,3,false,
edge_f2_center_f2_s,floor_2,f2_center,f2_s,corridor,3,false,
edge_f2_w_f2_stair_nw,floor_2,f2_w,f2_stair_nw,staircase,2,false,
edge_f2_e_f2_stair_se,floor_2,f2_e,f2_stair_se,staircase,2,false,`;

    const exitsCSV = `id,floor,node,type,isSafe
exit_nw,floor_1,f1_nw,emergency,true
exit_ne,floor_1,f1_ne,emergency,true
exit_sw,floor_1,f1_sw,main,true
exit_se,floor_1,f1_se,main,true
exit_stair_nw,floor_1,f1_stair_nw,staircase,true
exit_stair_se,floor_1,f1_stair_se,staircase,true`;

    const personsCSV = `id,name,group,startX,startY,startFloor
p1,张三,商铺人员,-20,-15,1
p2,李四,顾客,20,-15,1
p3,王五,员工,-20,15,1
p4,赵六,顾客,20,15,1
p5,孙七,商铺人员,0,0,1
p6,周八,顾客,-40,-30,1
p7,吴九,顾客,-20,-15,2
p8,郑十,员工,20,-15,2`;

    const trajectoriesCSV = `personId,time,x,y,floor,speed
p1,0,-20,-15,1,0
p1,30,0,0,1,1.2
p1,60,0,-30,1,1.5
p1,90,-40,-30,1,1.8
p2,0,20,-15,1,0
p2,20,0,0,1,1.4
p2,40,0,30,1,1.5
p2,60,40,30,1,1.6
p3,0,-20,15,1,0
p3,15,0,0,1,1.8
p3,35,-40,0,1,2.0
p3,55,-40,-25,1,1.2
p3,75,-40,-30,1,1.0
p4,0,20,15,1,0
p4,15,20,15,1,0
p4,30,20,15,1,0
p4,45,20,15,1,0
p4,60,0,0,1,1.5
p4,80,40,0,1,2.0
p4,100,40,30,1,1.5
p5,0,0,0,1,0
p5,10,40,0,1,4.0
p5,25,40,25,1,1.7
p5,40,40,30,1,1.0
p6,0,-40,-30,1,0
p6,5,-40,-30,1,0
p7,0,-20,-15,2,0
p7,20,0,0,2,1.4
p7,40,-40,0,2,2.0
p7,60,-35,-25,2,1.0
p7,90,-35,-25,1,1.5
p7,110,-40,-30,1,1.0
p8,0,20,-15,2,0
p8,15,0,0,2,1.9
p8,30,0,0,2,0
p8,45,0,0,2,0
p8,60,0,0,2,0
p8,75,0,0,2,0
p8,90,40,0,2,2.2
p8,110,35,25,2,1.5
p8,140,35,25,1,1.5
p8,160,40,30,1,1.0`;

    const observationsCSV = `personId,time,observer,note
p1,45,观察员A,在中心区域犹豫不决
p3,50,观察员B,引导其他人员
p4,20,观察员A,在店铺门口停留，似乎在等待
p6,0,观察员A,已在出口附近
p7,80,观察员C,从楼梯下到一层
p8,40,观察员C,在二层中心区域组织疏散
p8,130,观察员B,从另一楼梯下到一层`;

    const blockedPathsCSV = `edgeId,reason,timeStart,timeEnd
edge_f1_center_f1_s,演练中临时封闭 - 模拟火灾区域,0,300`;

    return {
      'floors.csv': floorsCSV,
      'nodes.csv': nodesCSV,
      'edges.csv': edgesCSV,
      'exits.csv': exitsCSV,
      'persons.csv': personsCSV,
      'trajectories.csv': trajectoriesCSV,
      'observations.csv': observationsCSV,
      'blockedPaths.csv': blockedPathsCSV
    };
  }
}

export default SampleDataGenerator;
