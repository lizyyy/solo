import Dexie, { Table } from 'dexie';
import type { Experiment, FittingParams, EnvironmentParams } from '@/types';

class ExperimentDatabase extends Dexie {
  experiments!: Table<Experiment, string>;

  constructor() {
    super('DroneThrustDB');
    this.version(1).stores({
      experiments: 'id, name, createdAt, updatedAt',
    });
  }
}

const db = new ExperimentDatabase();

export async function saveExperiment(experiment: Experiment): Promise<string> {
  experiment.updatedAt = Date.now();
  if (!experiment.createdAt) {
    experiment.createdAt = Date.now();
  }
  await db.experiments.put(experiment);
  return experiment.id;
}

export async function getExperiment(id: string): Promise<Experiment | undefined> {
  return db.experiments.get(id);
}

export async function getAllExperiments(): Promise<Experiment[]> {
  return db.experiments.orderBy('updatedAt').reverse().toArray();
}

export async function deleteExperiment(id: string): Promise<void> {
  await db.experiments.delete(id);
}

export async function saveParamsToLocal(params: FittingParams, environment: EnvironmentParams): Promise<void> {
  localStorage.setItem('thrust_fitting_params', JSON.stringify(params));
  localStorage.setItem('thrust_environment_params', JSON.stringify(environment));
}

export function loadParamsFromLocal(): { fittingParams: FittingParams | null; environmentParams: EnvironmentParams | null } {
  try {
    const fittingParamsStr = localStorage.getItem('thrust_fitting_params');
    const environmentStr = localStorage.getItem('thrust_environment_params');

    return {
      fittingParams: fittingParamsStr ? JSON.parse(fittingParamsStr) : null,
      environmentParams: environmentStr ? JSON.parse(environmentStr) : null,
    };
  } catch {
    return { fittingParams: null, environmentParams: null };
  }
}

export const defaultFittingParams: FittingParams = {
  fitType: 'polynomial',
  polynomialDegree: 2,
  independentVariable: 'rpm',
  controlVariables: {},
  thrustUnit: 'N',
  rpmSamplingInterval: 500,
  voltageSagThreshold: 5,
  outlierThreshold: 3,
};

export const defaultEnvironmentParams: EnvironmentParams = {
  airDensity: 1.225,
  temperature: 25,
  humidity: 50,
  pressure: 101.325,
};
