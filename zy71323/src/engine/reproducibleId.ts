import type { EstimationParams } from '@/types';
import { roundToPrecision } from './validator';

const normalizeParams = (params: EstimationParams): EstimationParams => {
  return {
    ...params,
    tidalRange: roundToPrecision(params.tidalRange, 4),
    flowVelocity: roundToPrecision(params.flowVelocity, 4),
    impellerArea: roundToPrecision(params.impellerArea, 4),
    efficiency: roundToPrecision(params.efficiency, 6),
    tideCycles: params.tideCycles
      .sort((a, b) => a.startTime - b.startTime)
      .map(cycle => ({
        ...cycle,
        tideHeight: roundToPrecision(cycle.tideHeight, 4),
        flowVelocity: roundToPrecision(cycle.flowVelocity, 4),
      })),
    deviceConstraints: {
      ...params.deviceConstraints,
      ratedPower: roundToPrecision(params.deviceConstraints.ratedPower, 4),
      maxFlowVelocity: roundToPrecision(params.deviceConstraints.maxFlowVelocity, 4),
      minFlowVelocity: roundToPrecision(params.deviceConstraints.minFlowVelocity, 4),
      maxEfficiency: roundToPrecision(params.deviceConstraints.maxEfficiency, 6),
      impellerDiameter: roundToPrecision(params.deviceConstraints.impellerDiameter, 4),
    },
  };
};

const deterministicStringify = (obj: unknown): string => {
  const sortedObj = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(sortedObj);
    } else if (value !== null && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce((acc, key) => {
          acc[key] = sortedObj((value as Record<string, unknown>)[key]);
          return acc;
        }, {} as Record<string, unknown>);
    }
    return value;
  };
  
  return JSON.stringify(sortedObj(obj));
};

const sha256 = async (message: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const generateReproducibleId = async (params: EstimationParams): Promise<string> => {
  const normalized = normalizeParams(params);
  const serialized = deterministicStringify(normalized);
  return sha256(serialized);
};

export const generateShortId = (fullId: string, length: number = 8): string => {
  return fullId.substring(0, length);
};
