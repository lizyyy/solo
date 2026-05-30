import type {
  ArrayConfig,
  PVModule,
  PowerResult,
  ShadingResult,
  ConnectionType,
} from '../types';

export function calculateModulePower(
  module: PVModule,
  shadingRate: number,
  irradiance: number = 1000
): {
  actualPower: number;
  theoreticalPower: number;
  lossRate: number;
  bypassDiodeActive: boolean;
  lossReason: 'shading' | 'mismatch' | 'diode' | 'other';
} {
  const theoreticalPower = module.ratedPower * (irradiance / 1000);

  let actualPower: number;
  let bypassDiodeActive = false;
  let lossReason: 'shading' | 'mismatch' | 'diode' | 'other' = 'other';

  if (shadingRate <= 0) {
    actualPower = theoreticalPower;
    lossReason = 'other';
  } else if (module.bypassDiode && shadingRate > 0.3) {
    bypassDiodeActive = true;
    actualPower = theoreticalPower * (1 - shadingRate * 0.5);
    lossReason = 'diode';
  } else {
    actualPower = theoreticalPower * (1 - shadingRate * 0.9);
    lossReason = shadingRate > 0.5 ? 'shading' : 'mismatch';
  }

  const lossRate = ((theoreticalPower - actualPower) / theoreticalPower) * 100;

  return {
    actualPower,
    theoreticalPower,
    lossRate,
    bypassDiodeActive,
    lossReason,
  };
}

export function calculateArrayPower(
  arrayConfig: ArrayConfig,
  shadingResults: ShadingResult[],
  irradiance: number = 1000
): { powerResults: PowerResult[]; totalPower: number; totalLoss: number } {
  const timestamp = Date.now();
  const powerResults: PowerResult[] = arrayConfig.modules.map((module) => {
    const shading = shadingResults.find((s) => s.moduleId === module.id);
    const shadingRate = shading?.shadingRate || 0;

    const power = calculateModulePower(module, shadingRate, irradiance);

    return {
      timestamp,
      moduleId: module.id,
      ...power,
    };
  });

  let totalPower = 0;
  let totalTheoretical = 0;

  if (arrayConfig.connectionType === 'series') {
    const minCurrent = Math.min(...powerResults.map((p) => p.actualPower));
    totalPower = minCurrent * arrayConfig.modules.length;
    totalTheoretical = powerResults.reduce((sum, p) => sum + p.theoreticalPower, 0);
  } else if (arrayConfig.connectionType === 'parallel') {
    totalPower = powerResults.reduce((sum, p) => sum + p.actualPower, 0);
    totalTheoretical = powerResults.reduce((sum, p) => sum + p.theoreticalPower, 0);
  } else {
    const perString = arrayConfig.seriesPerString;
    const strings = arrayConfig.parallelStrings;

    for (let s = 0; s < strings; s++) {
      const stringResults = powerResults.slice(s * perString, (s + 1) * perString);
      const minCurrent = Math.min(...stringResults.map((p) => p.actualPower));
      totalPower += minCurrent * perString;
    }
    totalTheoretical = powerResults.reduce((sum, p) => sum + p.theoreticalPower, 0);
  }

  const totalLoss = totalTheoretical - totalPower;

  return {
    powerResults,
    totalPower,
    totalLoss,
  };
}

export function calculateIVCurve(
  modules: PVModule[],
  shadingRates: Map<string, number>,
  connectionType: ConnectionType
): { voltage: number[]; current: number[] } {
  const steps = 50;
  const voltage: number[] = [];
  const current: number[] = [];

  const maxVoltage = modules.length * 30;
  const maxCurrent = 10;

  if (connectionType === 'series') {
    for (let i = 0; i <= steps; i++) {
      const v = (i / steps) * maxVoltage;
      const perModuleV = v / modules.length;
      let minI = Infinity;

      modules.forEach((m) => {
        const shadingRate = shadingRates.get(m.id) || 0;
        const i = calculateModuleCurrent(perModuleV, shadingRate);
        minI = Math.min(minI, i);
      });

      voltage.push(v);
      current.push(minI);
    }
  } else {
    for (let i = 0; i <= steps; i++) {
      const v = (i / steps) * (maxVoltage / modules.length);
      let totalI = 0;

      modules.forEach((m) => {
        const shadingRate = shadingRates.get(m.id) || 0;
        totalI += calculateModuleCurrent(v, shadingRate);
      });

      voltage.push(v);
      current.push(totalI);
    }
  }

  return { voltage, current };
}

function calculateModuleCurrent(voltage: number, shadingRate: number): number {
  const Isc = 10 * (1 - shadingRate * 0.8);
  const Voc = 30;
  const FF = 0.75;

  if (voltage <= 0) return Isc;
  if (voltage >= Voc) return 0;

  const normalizedV = voltage / Voc;
  return Isc * (1 - Math.exp(normalizedV * 5 - 5)) * FF;
}

export function getConnectionTypeName(type: ConnectionType): string {
  const names: Record<ConnectionType, string> = {
    series: '串联',
    parallel: '并联',
    hybrid: '混联',
  };
  return names[type];
}
