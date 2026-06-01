import type { SensorRecord, CalculationParams, LocationResult } from '@/types';

const EARTH_RADIUS = 6371.0;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
};

const calculateTravelTime = (
  distance: number,
  velocity: number
): number => {
  return distance / velocity;
};

const solveLinearSystem = (
  A: number[][],
  b: number[]
): number[] => {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = j;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    for (let j = i + 1; j < n; j++) {
      const factor = augmented[j][i] / augmented[i][i];
      for (let k = i; k <= n; k++) {
        augmented[j][k] -= factor * augmented[i][k];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += augmented[i][j] * x[j];
    }
    x[i] = (augmented[i][n] - sum) / augmented[i][i];
  }

  return x;
};

export const locateEarthquake = (
  records: SensorRecord[],
  params: CalculationParams
): LocationResult => {
  const validRecords = records.filter(
    (r) => r.pWaveArrival !== null && r.sWaveArrival !== null
  );

  if (validRecords.length < 3) {
    throw new Error('至少需要3个有效台站记录');
  }

  let lat = 0;
  let lon = 0;
  let depth = 10;
  let originTime = 0;

  validRecords.forEach((r) => {
    lat += r.latitude;
    lon += r.longitude;
  });
  lat /= validRecords.length;
  lon /= validRecords.length;

  const pWaveArrivals = validRecords.map((r) => r.pWaveArrival!);
  originTime = Math.min(...pWaveArrivals) - 5;

  for (let iter = 0; iter < params.maxIterations; iter++) {
    const A: number[][] = [];
    const b: number[] = [];

    validRecords.forEach((record) => {
      const distance = calculateDistance(
        lat,
        lon,
        record.latitude,
        record.longitude
      );
      const totalDistance = Math.sqrt(
        distance * distance + depth * depth
      );

      const theoreticalTime =
        originTime +
        calculateTravelTime(totalDistance, params.pWaveVelocity);

      const dTdLat =
        ((record.latitude - lat) *
        (depth / totalDistance) *
        (1 / params.pWaveVelocity));
      const dTdLon =
        ((record.longitude - lon) *
          (depth / totalDistance) *
          (1 / params.pWaveVelocity));
      const dTdDepth =
        (depth / totalDistance) * (1 / params.pWaveVelocity);

      A.push([dTdLat, dTdLon, dTdDepth, 1]);
      b.push(record.pWaveArrival! - theoreticalTime);
    });

    const delta = solveLinearSystem(A, b);

    lat += delta[0];
    lon += delta[1];
    depth += delta[2];
    originTime += delta[3];

    const deltaMagnitude = Math.sqrt(
      delta[0] * delta[0] +
        delta[1] * delta[1] +
        delta[2] * delta[2]
    );

    if (deltaMagnitude < params.convergenceThreshold) {
      break;
    }
  }

  const residuals = validRecords.map((record) => {
    const distance = calculateDistance(
      lat,
      lon,
      record.latitude,
      record.longitude
    );
    const totalDistance = Math.sqrt(
      distance * distance + depth * depth
    );
    const theoreticalTime =
      originTime +
      calculateTravelTime(totalDistance, params.pWaveVelocity);
    return {
      sensorId: record.sensorId,
      residual: record.pWaveArrival! - theoreticalTime,
    };
  });

  const avgResidual =
    residuals.reduce((sum, r) => sum + Math.abs(r.residual), 0) /
    residuals.length;

  let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
  if (avgResidual < 0.1) quality = 'excellent';
  else if (avgResidual < 0.5) quality = 'good';
  else if (avgResidual < 1.0) quality = 'fair';
  else quality = 'poor';

  const magnitudes = validRecords.map((r) => r.amplitude);
  const validMagnitudes = magnitudes.filter(
    (m): m is number => m !== null
  );
  const magnitude =
    validMagnitudes.length > 0
      ? validMagnitudes.reduce((a, b) => a + b, 0) / validMagnitudes.length
      : 0;

  return {
    id: crypto.randomUUID(),
    earthquakeId: `EQ-${Date.now()}`,
    latitude: lat,
    longitude: lon,
    depth: depth,
    originTime: originTime,
    magnitude: magnitude,
    uncertainty: {
      horizontal: avgResidual * params.pWaveVelocity,
      vertical: avgResidual * params.pWaveVelocity * 0.5,
    },
    residuals: residuals,
    quality: quality,
    extremeValues: [],
    needsReview: [],
  };
};

export const calculateMagnitude = (
  amplitude: number,
  distance: number
): number => {
  return Math.log10(amplitude) + 1.7 * Math.log10(distance) - 0.1;
};
