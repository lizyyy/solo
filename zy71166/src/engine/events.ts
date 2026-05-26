import type { Rack, ACUnit, GameEvent, LevelConfig } from './types';
import { PHYSICS_CONFIG } from './config';

const { MIGRATE_SUCCESS_RATE } = PHYSICS_CONFIG;

export function generateRandomEvent(
  turn: number,
  hour: number,
  racks: Rack[],
  acUnits: ACUnit[],
  probability: number,
): GameEvent | null {
  if (Math.random() > probability) return null;

  const eventTypes: Array<{ type: GameEvent['type']; weight: number }> = [
    { type: 'hotspot', weight: 3 },
    { type: 'load_spike', weight: 3 },
    { type: 'ac_overload', weight: 2 },
    { type: 'migrate_fail', weight: 2 },
  ];

  const totalWeight = eventTypes.reduce((s, e) => s + e.weight, 0);
  let rand = Math.random() * totalWeight;
  let selectedType = eventTypes[0].type;

  for (const et of eventTypes) {
    rand -= et.weight;
    if (rand <= 0) {
      selectedType = et.type;
      break;
    }
  }

  const normalRacks = racks.filter((r) => r.status === 'normal');
  const runningACs = acUnits.filter((a) => a.isOn && a.status !== 'fault');

  switch (selectedType) {
    case 'hotspot': {
      if (normalRacks.length === 0) return null;
      const rack = normalRacks[Math.floor(Math.random() * normalRacks.length)];
      return {
        id: `evt-${Date.now()}-hotspot`,
        turn,
        hour,
        type: 'hotspot',
        message: `机柜 ${rack.name} 附近出现热点，温度上升加快！`,
        severity: 'warning',
        timestamp: Date.now(),
      };
    }
    case 'load_spike': {
      if (normalRacks.length === 0) return null;
      const rack = normalRacks[Math.floor(Math.random() * normalRacks.length)];
      const spikeAmount = Math.round(rack.maxLoad * 0.15 * 10) / 10;
      return {
        id: `evt-${Date.now()}-spike`,
        turn,
        hour,
        type: 'load_spike',
        message: `业务高峰：机柜 ${rack.name} 负载突增 ${spikeAmount} kW！`,
        severity: 'info',
        timestamp: Date.now(),
      };
    }
    case 'ac_overload': {
      if (runningACs.length === 0) return null;
      const ac = runningACs[Math.floor(Math.random() * runningACs.length)];
      return {
        id: `evt-${Date.now()}-ac`,
        turn,
        hour,
        type: 'ac_overload',
        message: `空调 ${ac.name} 压缩机负载过高，效率下降！`,
        severity: 'warning',
        timestamp: Date.now(),
      };
    }
    case 'migrate_fail': {
      return {
        id: `evt-${Date.now()}-mig`,
        turn,
        hour,
        type: 'migrate_fail',
        message: '网络波动：下一次负载迁移可能失败！',
        severity: 'warning',
        timestamp: Date.now(),
      };
    }
    default:
      return null;
  }
}

export function applyEventEffects(
  event: GameEvent,
  racks: Rack[],
  acUnits: ACUnit[],
): { racks: Rack[]; acUnits: ACUnit[] } {
  const newRacks = racks.map((r) => ({ ...r }));
  const newACUnits = acUnits.map((a) => ({ ...a }));

  switch (event.type) {
    case 'hotspot': {
      const rackName = event.message.match(/机柜 (\S+)/)?.[1];
      const rack = newRacks.find((r) => r.name === rackName);
      if (rack) {
        rack.temperature = Math.round((rack.temperature + 2) * 10) / 10;
      }
      break;
    }
    case 'load_spike': {
      const rackName = event.message.match(/机柜 (\S+)/)?.[1];
      const rack = newRacks.find((r) => r.name === rackName);
      if (rack) {
        const spike = Math.round(rack.maxLoad * 0.15 * 10) / 10;
        rack.load = Math.min(rack.maxLoad, Math.round((rack.load + spike) * 10) / 10);
      }
      break;
    }
    case 'ac_overload': {
      const acName = event.message.match(/空调 (\S+)/)?.[1];
      const ac = newACUnits.find((a) => a.name === acName);
      if (ac) {
        ac.efficiency = Math.max(0.5, Math.round((ac.efficiency - 0.15) * 100) / 100);
      }
      break;
    }
  }

  return { racks: newRacks, acUnits: newACUnits };
}

export function tryMigrateLoad(
  racks: Rack[],
  fromRackId: string,
  toRackId: string,
  amount: number,
  level: LevelConfig,
): {
  success: boolean;
  racks: Rack[];
  message: string;
} {
  const fromRack = racks.find((r) => r.id === fromRackId);
  const toRack = racks.find((r) => r.id === toRackId);

  if (!fromRack || !toRack) {
    return { success: false, racks, message: '指定的机柜不存在' };
  }

  if (fromRack.status === 'fault' || toRack.status === 'fault') {
    return { success: false, racks, message: '故障机柜无法进行负载迁移' };
  }

  if (amount > fromRack.load) {
    return { success: false, racks, message: '源机柜负载不足' };
  }

  if (toRack.load + amount > toRack.maxLoad) {
    return { success: false, racks, message: '目标机柜容量不足' };
  }

  const success = Math.random() < MIGRATE_SUCCESS_RATE;

  if (!success) {
    return {
      success: false,
      racks,
      message: `负载迁移失败！网络连接中断，请稍后重试。`,
    };
  }

  const newRacks = racks.map((r) => {
    if (r.id === fromRackId) {
      return { ...r, load: Math.round((r.load - amount) * 10) / 10 };
    }
    if (r.id === toRackId) {
      return { ...r, load: Math.round((r.load + amount) * 10) / 10 };
    }
    return { ...r };
  });

  return {
    success: true,
    racks: newRacks,
    message: `成功迁移 ${amount} kW 负载：${fromRack.name} → ${toRack.name}`,
  };
}
