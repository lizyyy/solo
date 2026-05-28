export interface OrbitParams {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  raan: number;
}

export function calculateOrbitalPeriod(semiMajorAxis: number): number {
  const mu = 398600.4418;
  return 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu);
}

export function calculateElevation(
  probePosition: { x: number; y: number; z: number },
  stationPosition: { lat: number; lng: number }
): number {
  const earthRadius = 6371;
  
  const stationX = earthRadius * Math.cos(stationPosition.lat) * Math.cos(stationPosition.lng);
  const stationY = earthRadius * Math.cos(stationPosition.lat) * Math.sin(stationPosition.lng);
  const stationZ = earthRadius * Math.sin(stationPosition.lat);
  
  const dx = probePosition.x - stationX;
  const dy = probePosition.y - stationY;
  const dz = probePosition.z - stationZ;
  
  const range = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  const stationUp = {
    x: Math.cos(stationPosition.lat) * Math.cos(stationPosition.lng),
    y: Math.cos(stationPosition.lat) * Math.sin(stationPosition.lng),
    z: Math.sin(stationPosition.lat),
  };
  
  const dot = dx * stationUp.x + dy * stationUp.y + dz * stationUp.z;
  const elevation = Math.asin(dot / range) * (180 / Math.PI);
  
  return elevation;
}

export function isVisible(
  probePosition: { x: number; y: number; z: number },
  stationPosition: { lat: number; lng: number },
  minElevation: number = 5
): boolean {
  const elevation = calculateElevation(probePosition, stationPosition);
  return elevation >= minElevation;
}

export function getProbePositionAtTime(
  orbitParams: OrbitParams,
  time: number,
  startTime: number
): { x: number; y: number; z: number } {
  const period = calculateOrbitalPeriod(orbitParams.semiMajorAxis);
  const elapsed = (time - startTime) / 1000;
  const meanAnomaly = (2 * Math.PI * elapsed) / period;
  
  let eccentricAnomaly = meanAnomaly;
  for (let i = 0; i < 10; i++) {
    eccentricAnomaly = meanAnomaly + orbitParams.eccentricity * Math.sin(eccentricAnomaly);
  }
  
  const trueAnomaly = 2 * Math.atan2(
    Math.sqrt(1 + orbitParams.eccentricity) * Math.sin(eccentricAnomaly / 2),
    Math.sqrt(1 - orbitParams.eccentricity) * Math.cos(eccentricAnomaly / 2)
  );
  
  const r = orbitParams.semiMajorAxis * (1 - orbitParams.eccentricity * Math.cos(eccentricAnomaly));
  
  const orbitX = r * Math.cos(trueAnomaly);
  const orbitY = r * Math.sin(trueAnomaly);
  
  const inc = orbitParams.inclination * (Math.PI / 180);
  const raan = orbitParams.raan * (Math.PI / 180);
  
  const x = orbitX * Math.cos(raan) - orbitY * Math.cos(inc) * Math.sin(raan);
  const y = orbitX * Math.sin(raan) + orbitY * Math.cos(inc) * Math.cos(raan);
  const z = orbitY * Math.sin(inc);
  
  return { x, y, z };
}

export function generateVisibilityWindows(
  orbitParams: OrbitParams,
  station: { lat: number; lng: number },
  startTime: number,
  duration: number,
  minElevation: number = 5
): Array<{ startTime: number; endTime: number; maxElevation: number }> {
  const windows: Array<{ startTime: number; endTime: number; maxElevation: number }> = [];
  const step = 10000;
  let currentTime = startTime;
  const endTime = startTime + duration;
  
  while (currentTime < endTime) {
    const pos = getProbePositionAtTime(orbitParams, currentTime, startTime);
    const visible = isVisible(pos, station, minElevation);
    
    if (visible) {
      let windowStart = currentTime;
      let windowMaxElevation = calculateElevation(pos, station);
      
      while (currentTime < endTime) {
        currentTime += step;
        const pos2 = getProbePositionAtTime(orbitParams, currentTime, startTime);
        const elev = calculateElevation(pos2, station);
        windowMaxElevation = Math.max(windowMaxElevation, elev);
        
        if (!isVisible(pos2, station, minElevation)) {
          break;
        }
      }
      
      windows.push({
        startTime: windowStart,
        endTime: currentTime,
        maxElevation: windowMaxElevation,
      });
    }
    
    currentTime += step;
  }
  
  return windows;
}
