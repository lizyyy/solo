import type { Rack, ACUnit } from './types';
import { PHYSICS_CONFIG } from './config';

const {
  HEAT_RATE,
  COP_BASE,
  INFILTRATION_RATE,
  DIFFUSION_RATE,
  HEAT_CAPACITY,
  WARNING_TEMP,
  DANGER_TEMP,
  FAULT_TEMP,
} = PHYSICS_CONFIG;

function getDistance(p1: { x: number; z: number }, p2: { x: number; z: number }): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.z - p2.z, 2));
}

function findNeighbors(rack: Rack, allRacks: Rack[], maxDistance: number = 3): Rack[] {
  return allRacks.filter((r) => {
    if (r.id === rack.id) return false;
    return getDistance(rack.position, r.position) <= maxDistance;
  });
}

export function calculateRackHeatGeneration(rack: Rack): number {
  return rack.load * HEAT_RATE;
}

export function calculateACCooling(ac: ACUnit, roomAvgTemp: number): { cooling: number; powerDraw: number } {
  if (!ac.isOn || ac.status === 'fault') {
    return { cooling: 0, powerDraw: 0 };
  }

  const tempDiff = roomAvgTemp - ac.setPoint;
  const efficiencyFactor = Math.max(0.5, Math.min(1.5, 1 + tempDiff * 0.03));
  const actualCOP = COP_BASE * efficiencyFactor;
  const cooling = ac.capacity * ac.efficiency * efficiencyFactor;
  const powerDraw = cooling / actualCOP;

  return { cooling, powerDraw };
}

export function calculateTemperatureChange(
  racks: Rack[],
  acUnits: ACUnit[],
  outdoorTemp: number,
): { newRacks: Rack[]; newACUnits: ACUnit[]; totalElectricityUsed: number } {
  const newRacks = racks.map((r) => ({ ...r }));
  const newACUnits = acUnits.map((a) => ({ ...a }));

  const avgTemp = newRacks.reduce((sum, r) => sum + r.temperature, 0) / newRacks.length;

  let totalCooling = 0;
  let totalElectricityUsed = 0;

  for (const ac of newACUnits) {
    if (ac.isOn && ac.status !== 'fault') {
      const { cooling, powerDraw } = calculateACCooling(ac, avgTemp);
      totalCooling += cooling;
      totalElectricityUsed += powerDraw;
      ac.powerDraw = powerDraw;
      ac.status = powerDraw > ac.capacity / COP_BASE * PHYSICS_CONFIG.OVERLOAD_THRESHOLD ? 'overload' : 'running';
    } else {
      ac.powerDraw = 0;
      ac.status = 'off';
    }
  }

  const totalHeatGeneration = newRacks.reduce((sum, r) => sum + calculateRackHeatGeneration(r), 0);
  const infiltrationHeat = Math.max(0, (outdoorTemp - 25) * INFILTRATION_RATE);
  const netHeat = totalHeatGeneration - totalCooling + infiltrationHeat;
  const baseTempChange = netHeat / HEAT_CAPACITY / newRacks.length;

  for (let i = 0; i < newRacks.length; i++) {
    const rack = newRacks[i];
    const rackHeat = calculateRackHeatGeneration(rack) / HEAT_CAPACITY;

    const neighbors = findNeighbors(rack, newRacks);
    let diffusionChange = 0;
    for (const neighbor of neighbors) {
      const tempDiff = neighbor.temperature - rack.temperature;
      diffusionChange += tempDiff * DIFFUSION_RATE / neighbors.length;
    }

    const distanceToACs = newACUnits
      .filter((a) => a.isOn && a.status !== 'fault')
      .map((a) => getDistance(rack.position, a.position));

    const acInfluence = distanceToACs.length > 0
      ? Math.min(...distanceToACs)
      : 10;

    const coolingEffect = totalCooling > 0
      ? -(totalCooling / newRacks.length / HEAT_CAPACITY) * (1 / (1 + acInfluence * 0.1))
      : 0;

    let newTemp = rack.temperature + baseTempChange + rackHeat + diffusionChange + coolingEffect;
    newTemp = Math.max(18, Math.min(50, newTemp));

    rack.temperature = Math.round(newTemp * 10) / 10;

    if (rack.temperature >= FAULT_TEMP) {
      rack.status = 'fault';
    } else if (rack.temperature >= DANGER_TEMP) {
      rack.status = 'danger';
    } else if (rack.temperature >= WARNING_TEMP) {
      rack.status = 'warning';
    } else {
      rack.status = 'normal';
    }
  }

  totalElectricityUsed += newRacks.reduce((sum, r) => sum + r.load, 0);

  return {
    newRacks,
    newACUnits,
    totalElectricityUsed: Math.round(totalElectricityUsed * 100) / 100,
  };
}

export function updateRackStatuses(racks: Rack[]): Rack[] {
  return racks.map((rack) => {
    const r = { ...rack };
    if (r.temperature >= FAULT_TEMP) {
      r.status = 'fault';
    } else if (r.temperature >= DANGER_TEMP) {
      r.status = 'danger';
    } else if (r.temperature >= WARNING_TEMP) {
      r.status = 'warning';
    } else {
      r.status = 'normal';
    }
    return r;
  });
}
