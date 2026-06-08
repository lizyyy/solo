import type { SensorRecord, CalculationParams, LocationResult } from '@/types';

const EARTH_RADIUS = 6371.0;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const DEG_TO_KM_LAT = 111.32;
const degToKmLon = (lat: number): number => 111.32 * Math.cos(toRadians(lat));

export const calculateDistance = (
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

const toLocalXyz = (
  lat: number,
  lon: number,
  depth: number,
  refLat: number,
  refLon: number
): [number, number, number] => {
  const x = (lon - refLon) * degToKmLon(refLat);
  const y = (lat - refLat) * DEG_TO_KM_LAT;
  const z = depth;
  return [x, y, z];
};

const fromLocalXyz = (
  x: number,
  y: number,
  refLat: number,
  refLon: number
): [number, number] => {
  const lat = refLat + y / DEG_TO_KM_LAT;
  const lon = refLon + x / degToKmLon(refLat);
  return [lat, lon];
};

const solveLeastSquares = (
  A: number[][],
  b: number[],
  damping: number = 0
): number[] => {
  const m = A.length;
  const n = A[0].length;

  const AtA: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const Atb: number[] = new Array(n).fill(0);

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        AtA[j][k] += A[i][j] * A[i][k];
      }
      Atb[j] += A[i][j] * b[i];
    }
  }

  for (let i = 0; i < n; i++) {
    AtA[i][i] += damping;
  }

  const augmented = AtA.map((row, i) => [...row, Atb[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = j;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    if (Math.abs(augmented[i][i]) < 1e-15) continue;

    for (let j = i + 1; j < n; j++) {
      const factor = augmented[j][i] / augmented[i][i];
      for (let k = i; k <= n; k++) {
        augmented[j][k] -= factor * augmented[i][k];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(augmented[i][i]) < 1e-15) continue;
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += augmented[i][j] * x[j];
    }
    x[i] = (augmented[i][n] - sum) / augmented[i][i];
  }

  return x;
};

const MAX_STEP_KM = 50.0;

const clampStep = (delta: number[], maxStep: number): number[] => {
  const spatialMag = Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1] + delta[2] * delta[2]);
  if (spatialMag > maxStep && spatialMag > 0) {
    const scale = maxStep / spatialMag;
    return [delta[0] * scale, delta[1] * scale, delta[2] * scale, delta[3] * scale];
  }
  return delta;
};

export const locateEarthquake = (
  records: SensorRecord[],
  params: CalculationParams
): LocationResult => {
  const validRecords = records.filter(
    (r) => r.pWaveArrival !== null && r.sWaveArrival !== null
  );

  if (validRecords.length < 4) {
    throw new Error('至少需要4个有效台站记录进行定位');
  }

  let lat = 0;
  let lon = 0;
  validRecords.forEach((r) => {
    lat += r.latitude;
    lon += r.longitude;
  });
  lat /= validRecords.length;
  lon /= validRecords.length;

  let depth = 15.0;
  const vp = params.pWaveVelocity;
  const refLat = lat;
  const refLon = lon;

  let originTime = 0;
  let travelTimeSum = 0;
  validRecords.forEach((record) => {
    const [stx, sty] = toLocalXyz(record.latitude, record.longitude, 0, refLat, refLon);
    const Ri = Math.sqrt(stx * stx + sty * sty + depth * depth);
    travelTimeSum += Ri / vp;
  });
  const avgTravelTime = travelTimeSum / validRecords.length;
  const avgObserved = validRecords.reduce((s, r) => s + r.pWaveArrival!, 0) / validRecords.length;
  originTime = avgObserved - avgTravelTime;

  let damping = 1.0;
  let prevAvgResidual = Infinity;

  for (let iter = 0; iter < params.maxIterations; iter++) {
    const [sx, sy, sz] = toLocalXyz(lat, lon, depth, refLat, refLon);

    const A: number[][] = [];
    const b: number[] = [];

    validRecords.forEach((record) => {
      const [stx, sty, stz] = toLocalXyz(
        record.latitude,
        record.longitude,
        0,
        refLat,
        refLon
      );
      const dx = stx - sx;
      const dy = sty - sy;
      const dz = stz - sz;
      const Ri = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (Ri < 1e-10) return;

      const theoreticalTime = originTime + Ri / vp;
      const dTdX = -dx / (vp * Ri);
      const dTdY = -dy / (vp * Ri);
      const dTdZ = -dz / (vp * Ri);

      A.push([dTdX, dTdY, dTdZ, 1]);
      b.push(record.pWaveArrival! - theoreticalTime);
    });

    if (A.length < 4) break;

    let delta = solveLeastSquares(A, b, damping);
    delta = clampStep(delta, MAX_STEP_KM);

    const [curX, curY, curZ] = toLocalXyz(lat, lon, depth, refLat, refLon);
    const updatedX = curX + delta[0];
    const updatedY = curY + delta[1];
    const updatedZ = curZ + delta[2];

    const testDepth = updatedZ < 0 ? 1.0 : updatedZ;
    const [testLat, testLon] = fromLocalXyz(updatedX, updatedY, refLat, refLon);

    let testAvgRes = Infinity;
    const testSx = updatedX;
    const testSy = updatedY;
    const testSz = testDepth;
    const testOt = originTime + delta[3];
    let testResSum = 0;
    let testResCount = 0;
    validRecords.forEach((record) => {
      const [stx, sty, stz] = toLocalXyz(record.latitude, record.longitude, 0, refLat, refLon);
      const dx2 = stx - testSx;
      const dy2 = sty - testSy;
      const dz2 = stz - testSz;
      const Ri = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
      if (Ri > 1e-10) {
        testResSum += Math.abs(record.pWaveArrival! - (testOt + Ri / vp));
        testResCount++;
      }
    });
    if (testResCount > 0) testAvgRes = testResSum / testResCount;

    if (testAvgRes < prevAvgResidual) {
      depth = testDepth;
      lat = testLat;
      lon = testLon;
      originTime = testOt;
      damping = Math.max(damping * 0.5, 1e-6);
      prevAvgResidual = testAvgRes;
    } else {
      damping = damping * 2.0;
    }

    const deltaMag = Math.sqrt(
      delta[0] * delta[0] + delta[1] * delta[1] + delta[2] * delta[2]
    );

    if (deltaMag < params.convergenceThreshold && damping < 0.01) {
      break;
    }
  }

  const residuals = validRecords.map((record) => {
    const [stx, sty, stz] = toLocalXyz(
      record.latitude,
      record.longitude,
      0,
      refLat,
      refLon
    );
    const [sx2, sy2, sz2] = toLocalXyz(lat, lon, depth, refLat, refLon);
    const dx = stx - sx2;
    const dy = sty - sy2;
    const dz = stz - sz2;
    const Ri = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const theoreticalTime = originTime + Ri / vp;
    return {
      sensorId: record.sensorId,
      residual: record.pWaveArrival! - theoreticalTime,
    };
  });

  const absResiduals = residuals.map((r) => Math.abs(r.residual));
  const avgResidual =
    absResiduals.reduce((sum, r) => sum + r, 0) / absResiduals.length;

  let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
  if (avgResidual < 0.1) quality = 'excellent';
  else if (avgResidual < 0.5) quality = 'good';
  else if (avgResidual < 1.0) quality = 'fair';
  else quality = 'poor';

  const validMagnitudes = validRecords
    .map((r) => r.amplitude)
    .filter((m): m is number => m !== null);

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
      horizontal: avgResidual * vp,
      vertical: avgResidual * vp * 0.5,
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
  if (amplitude <= 0 || distance <= 0) return 0;
  return Math.log10(amplitude) + 1.7 * Math.log10(distance) - 0.1;
};
