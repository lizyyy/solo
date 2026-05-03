import Papa from 'papaparse';
import YAML from 'yaml';
import dayjs from 'dayjs';

export class DataParser {
  constructor() {
    this.garageStructure = null;
    this.reservations = [];
    this.scheduleCommands = [];
    this.deviceRules = null;
  }

  async parseGarageStructure(jsonText) {
    try {
      const data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
      this.garageStructure = this.normalizeGarageStructure(data);
      return this.garageStructure;
    } catch (error) {
      throw new Error(`解析车库结构失败: ${error.message}`);
    }
  }

  normalizeGarageStructure(data) {
    const structure = {
      id: data.id || 'garage-001',
      name: data.name || '立体停车库',
      floors: [],
      elevators: [],
      totalSlots: 0
    };

    if (data.floors && Array.isArray(data.floors)) {
      structure.floors = data.floors.map((floor, index) => {
        const floorObj = {
          id: floor.id || `floor-${index}`,
          level: floor.level !== undefined ? floor.level : index,
          name: floor.name || `第${index + 1}层`,
          height: floor.height || 3.5,
          slots: [],
          aisles: []
        };

        if (floor.slots && Array.isArray(floor.slots)) {
          floorObj.slots = floor.slots.map((slot, slotIndex) => {
            const slotObj = {
              id: slot.id || `${floorObj.id}-slot-${slotIndex}`,
              position: slot.position || { x: slotIndex * 3, z: 0 },
              size: slot.size || { width: 2.5, depth: 5.0 },
              type: slot.type || 'standard',
              status: 'empty',
              maxWeight: slot.maxWeight || 2500,
              rotation: slot.rotation || 0
            };
            structure.totalSlots++;
            return slotObj;
          });
        }

        if (floor.aisles && Array.isArray(floor.aisles)) {
          floorObj.aisles = floor.aisles.map((aisle, aisleIndex) => ({
            id: aisle.id || `${floorObj.id}-aisle-${aisleIndex}`,
            path: aisle.path || [],
            width: aisle.width || 3.0
          }));
        }

        return floorObj;
      });
    }

    if (data.elevators && Array.isArray(data.elevators)) {
      structure.elevators = data.elevators.map((elevator, index) => ({
        id: elevator.id || `elevator-${index}`,
        name: elevator.name || `升降机${index + 1}`,
        position: elevator.position || { x: -5, z: 0 },
        floors: elevator.floors || structure.floors.map(f => f.level),
        maxCapacity: elevator.maxCapacity || 2500,
        speed: elevator.speed || 2.0,
        currentFloor: elevator.currentFloor || 0,
        status: 'idle'
      }));
    }

    return structure;
  }

  async parseReservations(csvText) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            this.reservations = results.data
              .filter(row => row.id || row.reservation_id)
              .map(row => this.normalizeReservation(row));
            this.reservations.sort((a, b) => 
              dayjs(a.requestTime).valueOf() - dayjs(b.requestTime).valueOf()
            );
            resolve(this.reservations);
          } catch (error) {
            reject(new Error(`处理预约数据失败: ${error.message}`));
          }
        },
        error: (error) => reject(new Error(`解析 CSV 失败: ${error.message}`))
      });
    });
  }

  normalizeReservation(row) {
    const getField = (names) => {
      for (const name of names) {
        if (row[name] !== undefined) return row[name];
      }
      return undefined;
    };

    const id = getField(['id', 'reservation_id', 'request_id', '预约ID', 'ID']) || `res-${Date.now()}-${Math.random()}`;
    const type = getField(['type', 'operation_type', '类型', '操作类型']) || 'park';
    const vehicleId = getField(['vehicle_id', 'car_id', '车牌', '车牌号', 'vehicle_plate']) || `CAR-${id}`;
    const requestTime = getField(['request_time', 'time', '申请时间', '预约时间', 'create_time']);
    const targetFloor = getField(['target_floor', 'floor', '目标楼层', '楼层']);
    const targetSlot = getField(['target_slot', 'slot', '目标车位', '车位']);
    const weight = getField(['weight', '车辆重量', 'weight_kg']);
    const deadline = getField(['deadline', 'expect_time', '预计完成时间', '期望时间']);

    return {
      id: String(id).trim(),
      type: type.toLowerCase().includes('取') || type.toLowerCase() === 'pickup' ? 'pickup' : 'park',
      vehicleId: String(vehicleId).trim(),
      requestTime: requestTime ? this.parseTime(requestTime) : dayjs().toISOString(),
      targetFloor: targetFloor !== undefined ? parseInt(targetFloor) : undefined,
      targetSlot: targetSlot ? String(targetSlot).trim() : undefined,
      weight: weight ? parseFloat(weight) : 1500,
      deadline: deadline ? this.parseTime(deadline) : undefined,
      status: 'pending',
      originalRow: row
    };
  }

  async parseScheduleCommands(jsonlText) {
    const lines = jsonlText.trim().split('\n').filter(line => line.trim());
    this.scheduleCommands = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        if (line.startsWith('//') || line.startsWith('#')) continue;
        
        const data = JSON.parse(line);
        const command = this.normalizeScheduleCommand(data, i);
        this.scheduleCommands.push(command);
      } catch (error) {
        console.warn(`解析第 ${i + 1} 行调度指令失败: ${error.message}`);
      }
    }

    this.scheduleCommands.sort((a, b) => 
      dayjs(a.time).valueOf() - dayjs(b.time).valueOf()
    );

    return this.scheduleCommands;
  }

  normalizeScheduleCommand(data, index) {
    const getField = (names) => {
      for (const name of names) {
        if (data[name] !== undefined) return data[name];
      }
      return undefined;
    };

    const id = getField(['id', 'command_id', '指令ID']) || `cmd-${index}`;
    const time = getField(['time', 'timestamp', '时间', '时间戳']);
    const type = getField(['type', 'action', '类型', '操作']) || 'move';
    const vehicleId = getField(['vehicle_id', 'car_id', '车牌', '车牌号']);
    const elevatorId = getField(['elevator_id', 'lift_id', '升降机', '升降机ID']);
    const fromFloor = getField(['from_floor', 'from', '起始楼层', 'from_level']);
    const toFloor = getField(['to_floor', 'to', '目标楼层', 'to_level']);
    const fromSlot = getField(['from_slot', 'from_position', '起始车位']);
    const toSlot = getField(['to_slot', 'to_position', '目标车位']);
    const path = getField(['path', '轨迹', '路径']);
    const duration = getField(['duration', '预计时间', 'duration_seconds']);

    return {
      id: String(id).trim(),
      time: time ? this.parseTime(time) : dayjs().toISOString(),
      lineNumber: index + 1,
      type: this.normalizeCommandType(type),
      vehicleId: vehicleId ? String(vehicleId).trim() : undefined,
      elevatorId: elevatorId ? String(elevatorId).trim() : undefined,
      fromFloor: fromFloor !== undefined ? parseInt(fromFloor) : undefined,
      toFloor: toFloor !== undefined ? parseInt(toFloor) : undefined,
      fromSlot: fromSlot ? String(fromSlot).trim() : undefined,
      toSlot: toSlot ? String(toSlot).trim() : undefined,
      path: path || [],
      duration: duration ? parseFloat(duration) : undefined,
      originalData: data
    };
  }

  normalizeCommandType(type) {
    const t = String(type).toLowerCase();
    if (t.includes('入库') || t === 'park' || t === 'enter' || t === '停车') return 'park';
    if (t.includes('取车') || t === 'pickup' || t === 'exit' || t === '出车') return 'pickup';
    if (t.includes('移动') || t === 'move' || t === 'transfer' || t === '移库') return 'move';
    if (t.includes('升降') || t === 'lift' || t === 'elevator') return 'elevator';
    if (t.includes('等待') || t === 'wait' || t === 'idle') return 'wait';
    return 'move';
  }

  async parseDeviceRules(yamlText) {
    try {
      const data = YAML.parse(yamlText);
      this.deviceRules = this.normalizeDeviceRules(data);
      return this.deviceRules;
    } catch (error) {
      throw new Error(`解析设备规则失败: ${error.message}`);
    }
  }

  normalizeDeviceRules(data) {
    const rules = {
      elevators: [],
      shuttles: [],
      safety: {},
      timing: {}
    };

    if (data.elevators && Array.isArray(data.elevators)) {
      rules.elevators = data.elevators.map((e, i) => ({
        id: e.id || `elevator-rule-${i}`,
        maxCapacity: e.max_capacity || e.maxCapacity || 2500,
        speed: e.speed || 2.0,
        acceleration: e.acceleration || 0.5,
        maxFloors: e.max_floors || e.maxFloors || 10,
        doorOpenTime: e.door_open_time || e.doorOpenTime || 3,
        doorCloseTime: e.door_close_time || e.doorCloseTime || 3
      }));
    }

    if (data.shuttles && Array.isArray(data.shuttles)) {
      rules.shuttles = data.shuttles.map((s, i) => ({
        id: s.id || `shuttle-rule-${i}`,
        maxCapacity: s.max_capacity || s.maxCapacity || 2500,
        speed: s.speed || 3.0,
        acceleration: s.acceleration || 1.0
      }));
    }

    if (data.safety) {
      rules.safety = {
        minDistanceBetweenCars: data.safety.min_distance_between_cars || data.safety.minDistance || 1.0,
        maxOccupancyPerZone: data.safety.max_occupancy_per_zone || data.safety.maxOccupancy || 10,
        emergencyStopDelay: data.safety.emergency_stop_delay || data.safety.emergencyDelay || 0.5
      };
    }

    if (data.timing) {
      rules.timing = {
        parkTimeLimit: data.timing.park_time_limit || data.timing.parkLimit || 120,
        pickupTimeLimit: data.timing.pickup_time_limit || data.timing.pickupLimit || 180,
        transferTimeLimit: data.timing.transfer_time_limit || data.timing.transferLimit || 60
      };
    }

    return rules;
  }

  parseTime(timeStr) {
    if (!timeStr) return dayjs().toISOString();
    
    let parsed = dayjs(timeStr);
    if (parsed.isValid()) return parsed.toISOString();
    
    const formats = [
      'YYYY-MM-DD HH:mm:ss',
      'YYYY-MM-DD HH:mm',
      'MM/DD/YYYY HH:mm:ss',
      'DD/MM/YYYY HH:mm:ss',
      'HH:mm:ss',
      'HH:mm'
    ];
    
    for (const fmt of formats) {
      parsed = dayjs(timeStr, fmt);
      if (parsed.isValid()) {
        if (fmt.includes('HH:mm') && !fmt.includes('YYYY')) {
          const today = dayjs().startOf('day');
          const time = dayjs(timeStr, fmt);
          return today
            .hour(time.hour())
            .minute(time.minute())
            .second(time.second())
            .toISOString();
        }
        return parsed.toISOString();
      }
    }
    
    console.warn(`无法解析时间格式: ${timeStr}，使用当前时间`);
    return dayjs().toISOString();
  }

  getTimeRange() {
    const allTimes = [
      ...this.reservations.map(r => r.requestTime),
      ...this.scheduleCommands.map(c => c.time)
    ];
    
    if (allTimes.length === 0) {
      return {
        start: dayjs().startOf('day').toISOString(),
        end: dayjs().endOf('day').toISOString()
      };
    }
    
    const sorted = allTimes.sort((a, b) => dayjs(a).valueOf() - dayjs(b).valueOf());
    return {
      start: sorted[0],
      end: sorted[sorted.length - 1]
    };
  }

  getAllData() {
    return {
      garageStructure: this.garageStructure,
      reservations: this.reservations,
      scheduleCommands: this.scheduleCommands,
      deviceRules: this.deviceRules,
      timeRange: this.getTimeRange()
    };
  }
}

export const dataParser = new DataParser();
