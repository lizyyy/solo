import { describe, it, expect, beforeEach } from 'vitest';
import { Simulation } from '../modules/Simulation.js';
import { SampleData } from '../data/SampleData.js';

describe('Simulation', () => {
  let simulation;
  let dronesData;
  let noFlyZones;
  let batteriesData;

  beforeEach(() => {
    dronesData = SampleData.getDronesData();
    noFlyZones = SampleData.getNoFlyZones();
    batteriesData = SampleData.getBatteriesData();
    simulation = new Simulation(dronesData, noFlyZones, batteriesData);
  });

  describe('初始化', () => {
    it('应该正确初始化无人机数量', () => {
      expect(simulation.drones.length).toBe(8);
    });

    it('应该正确计算总时长', () => {
      expect(simulation.totalTime).toBeGreaterThan(0);
    });

    it('应该正确初始化禁飞区', () => {
      expect(simulation.noFlyZones.length).toBe(3);
    });
  });

  describe('时间控制', () => {
    it('初始时间应该为0', () => {
      expect(simulation.currentTime).toBe(0);
    });

    it('seekTo应该能跳转到指定时间', () => {
      const targetTime = 30;
      simulation.seekTo(targetTime);
      expect(simulation.currentTime).toBe(targetTime);
    });

    it('seekTo应该限制在有效范围内', () => {
      simulation.seekTo(-10);
      expect(simulation.currentTime).toBe(0);

      simulation.seekTo(simulation.totalTime + 100);
      expect(simulation.currentTime).toBe(simulation.totalTime);
    });

    it('reset应该重置到初始状态', () => {
      simulation.seekTo(50);
      simulation.reset();
      expect(simulation.currentTime).toBe(0);
      expect(simulation.isPlaying).toBe(false);
    });
  });

  describe('无人机状态', () => {
    it('应该能获取无人机状态', () => {
      simulation.seekTo(10);
      const states = simulation.getDroneStates();
      expect(states.length).toBe(8);
    });

    it('活跃无人机应该有位置信息', () => {
      simulation.seekTo(10);
      const states = simulation.getDroneStates();
      const activeStates = states.filter(s => s.isActive);
      
      activeStates.forEach(state => {
        expect(state.position).not.toBeNull();
        expect(state.position.x).toBeDefined();
        expect(state.position.y).toBeDefined();
        expect(state.position.z).toBeDefined();
      });
    });

    it('初始时间的无人机应该不活跃', () => {
      const states = simulation.getDroneStates();
      states.forEach(state => {
        expect(state.isActive).toBe(false);
      });
    });
  });

  describe('碰撞检测', () => {
    it('应该正确计算3D距离', () => {
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 3, y: 0, z: 0 };
      const dist = simulation.distance3D(p1, p2);
      expect(dist).toBe(3);
    });

    it('应该检测到近距离无人机', () => {
      const closeDrones = [
        {
          id: 'close_1',
          name: '近距离无人机1',
          batteryId: 'battery_0',
          waypoints: [
            { time: 0, x: 0, y: 0, z: 10 },
            { time: 10, x: 1, y: 0, z: 10 }
          ],
          color: '#ff0000'
        },
        {
          id: 'close_2',
          name: '近距离无人机2',
          batteryId: 'battery_1',
          waypoints: [
            { time: 0, x: 0, y: 2, z: 10 },
            { time: 10, x: 1, y: 2, z: 10 }
          ],
          color: '#00ff00'
        }
      ];

      const closeSimulation = new Simulation(closeDrones, []);
      closeSimulation.seekTo(5);

      const stats = closeSimulation.getStats();
      expect(stats.minDistance).toBeLessThan(3);
    });
  });

  describe('禁飞区检测', () => {
    it('应该检测圆形禁飞区', () => {
      const position = { x: 0, y: 0, z: 20 };
      const circleZone = {
        shape: 'circle',
        center: { x: 0, y: 0 },
        radius: 20,
        minAltitude: 0,
        maxAltitude: 100
      };

      const result = simulation.isInNoFlyZone(position, circleZone);
      expect(result).toBe(true);
    });

    it('应该检测圆形禁飞区外的点', () => {
      const position = { x: 30, y: 0, z: 20 };
      const circleZone = {
        shape: 'circle',
        center: { x: 0, y: 0 },
        radius: 20,
        minAltitude: 0,
        maxAltitude: 100
      };

      const result = simulation.isInNoFlyZone(position, circleZone);
      expect(result).toBe(false);
    });

    it('应该检测多边形禁飞区', () => {
      const position = { x: 80, y: 0, z: 20 };
      const polygonZone = {
        shape: 'polygon',
        coordinates: [
          { x: 60, y: 60 },
          { x: 120, y: 60 },
          { x: 120, y: -60 },
          { x: 60, y: -60 }
        ],
        minAltitude: 0,
        maxAltitude: 200
      };

      const result = simulation.isInNoFlyZone(position, polygonZone);
      expect(result).toBe(true);
    });
  });

  describe('电池计算', () => {
    it('应该正确计算电池电量', () => {
      const drone = {
        id: 'test_drone',
        startTime: 0,
        batteryId: 'battery_0'
      };

      const battery = {
        id: 'battery_0',
        capacity: 100,
        drainRate: 1
      };

      const testSim = new Simulation(
        [{ ...drone, waypoints: [], name: 'test', color: '#fff' }],
        [],
        [battery]
      );

      testSim.seekTo(50);
      const batteryLevel = testSim.calculateBatteryLevel(
        { startTime: 0, batteryId: 'battery_0' },
        50
      );

      expect(batteryLevel).toBe(50);
    });

    it('电池电量不能为负数', () => {
      const drone = {
        id: 'test_drone',
        startTime: 0,
        batteryId: 'battery_0'
      };

      const battery = {
        id: 'battery_0',
        capacity: 100,
        drainRate: 1
      };

      const testSim = new Simulation(
        [{ ...drone, waypoints: [], name: 'test', color: '#fff' }],
        [],
        [battery]
      );

      const batteryLevel = testSim.calculateBatteryLevel(
        { startTime: 0, batteryId: 'battery_0' },
        200
      );

      expect(batteryLevel).toBe(0);
    });
  });

  describe('统计信息', () => {
    it('应该返回正确的统计信息', () => {
      simulation.seekTo(30);
      const stats = simulation.getStats();

      expect(stats.currentTime).toBe(30);
      expect(stats.droneCount).toBe(8);
      expect(stats.noFlyCount).toBe(3);
    });
  });

  describe('事件系统', () => {
    it('应该能注册和触发事件监听器', () => {
      let eventTriggered = false;
      let eventData = null;

      simulation.on('testEvent', (data) => {
        eventTriggered = true;
        eventData = data;
      });

      const testData = { value: 'test' };
      simulation.emit('testEvent', testData);

      expect(eventTriggered).toBe(true);
      expect(eventData).toEqual(testData);
    });
  });

  describe('完整分析', () => {
    it('应该能运行完整分析', () => {
      const results = simulation.runFullAnalysis();

      expect(results.collisions).toBeDefined();
      expect(results.noFlyViolations).toBeDefined();
      expect(results.batteryWarnings).toBeDefined();
      expect(results.minDistances).toBeDefined();
    });

    it('完整分析后时间应该保持不变', () => {
      const originalTime = 30;
      simulation.seekTo(originalTime);
      simulation.runFullAnalysis();

      expect(simulation.currentTime).toBe(originalTime);
    });
  });
});
