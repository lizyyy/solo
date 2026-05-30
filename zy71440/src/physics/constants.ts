export const PHYSICAL_CONSTANTS = {
  G: 6.67430e-11,
  c: 299792458,
  solarMass: 1.989e30,
  Mpc: 3.086e22,
} as const;

export const SIMULATION_SCALE = {
  unitToMeters: 1e10,
  schwarzschildScaling: 1.0,
} as const;

export const DEFAULT_PARAMETERS = {
  blackHoleMass: 10.0,
  rayCount: 20,
  observerDistance: 30.0,
  starDensity: 0.8,
  showEventHorizon: true,
  showPhotonSphere: true,
  lensStrength: 1.0,
} as const;

export const calculateSchwarzschildRadius = (massSolar: number): number => {
  const massKg = massSolar * PHYSICAL_CONSTANTS.solarMass;
  const rs = (2 * PHYSICAL_CONSTANTS.G * massKg) / (PHYSICAL_CONSTANTS.c * PHYSICAL_CONSTANTS.c);
  return rs / SIMULATION_SCALE.unitToMeters;
};

export const calculatePhotonSphereRadius = (schwarzschildRadius: number): number => {
  return 1.5 * schwarzschildRadius;
};

export const calculateInnermostStableOrbit = (schwarzschildRadius: number): number => {
  return 3 * schwarzschildRadius;
};

export const getStarColor = (temperature: number): string => {
  if (temperature < 3500) return '#ff6b6b';
  if (temperature < 5000) return '#ffa94d';
  if (temperature < 6000) return '#ffd43b';
  if (temperature < 7500) return '#ffffff';
  if (temperature < 10000) return '#a5d8ff';
  return '#74c0fc';
};
