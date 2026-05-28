export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
export const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

export function calculateDeclination(dayOfYear: number): number {
  return 23.45 * Math.sin(toRadians((360 / 365) * (dayOfYear - 81)));
}

export function calculateSolarAltitude(
  latitude: number,
  declination: number,
  hourAngle: number
): number {
  const latRad = toRadians(latitude);
  const decRad = toRadians(declination);
  const haRad = toRadians(hourAngle);

  const sinAlt =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);

  return toDegrees(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
}

export function calculateSolarAzimuth(
  latitude: number,
  declination: number,
  hourAngle: number
): number {
  const latRad = toRadians(latitude);
  const decRad = toRadians(declination);
  const haRad = toRadians(hourAngle);

  const sinAlt =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const cosAlt = Math.sqrt(1 - sinAlt * sinAlt);

  if (cosAlt < 0.001) {
    return hourAngle > 0 ? 180 : 0;
  }

  let cosAz =
    (Math.sin(decRad) * Math.cos(latRad) -
      Math.cos(decRad) * Math.sin(latRad) * Math.cos(haRad)) /
    cosAlt;
  cosAz = Math.max(-1, Math.min(1, cosAz));

  const azimuth = toDegrees(Math.acos(cosAz));
  return hourAngle > 0 ? 360 - azimuth : azimuth;
}

export function calculateHourAngle(solarTime: number): number {
  return 15 * (solarTime - 12);
}

export function getDayOfYear(month: number, day: number): number {
  const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return daysBeforeMonth[month - 1] + day;
}

export function getHourlyGenerationWeights(latitude: number): number[] {
  const weights: number[] = new Array(24).fill(0);
  const totalDaylight = 12 + 2 * Math.sin(toRadians(latitude)) * 2;
  const sunriseHour = 12 - totalDaylight / 2;
  const sunsetHour = 12 + totalDaylight / 2;

  let totalWeight = 0;
  for (let hour = 0; hour < 24; hour++) {
    if (hour >= sunriseHour && hour <= sunsetHour) {
      const midHour = hour + 0.5;
      const hourAngle = calculateHourAngle(midHour);
      const declination = calculateDeclination(172);
      const altitude = calculateSolarAltitude(latitude, declination, hourAngle);
      weights[hour] = Math.max(0, Math.sin(toRadians(altitude)));
      totalWeight += weights[hour];
    }
  }

  if (totalWeight > 0) {
    for (let hour = 0; hour < 24; hour++) {
      weights[hour] = weights[hour] / totalWeight;
    }
  }

  return weights;
}

export function getMonthlyGenerationFactors(latitude: number): number[] {
  const monthlyFactors: number[] = [];
  const midMonthDays = [15, 46, 75, 105, 136, 166, 197, 228, 258, 289, 319, 350];

  for (const dayOfYear of midMonthDays) {
    const declination = calculateDeclination(dayOfYear);
    let dailyEnergy = 0;

    for (let hour = 6; hour <= 18; hour++) {
      const hourAngle = calculateHourAngle(hour);
      const altitude = calculateSolarAltitude(latitude, declination, hourAngle);
      if (altitude > 0) {
        dailyEnergy += Math.sin(toRadians(altitude));
      }
    }

    monthlyFactors.push(dailyEnergy);
  }

  const maxFactor = Math.max(...monthlyFactors);
  return monthlyFactors.map((f) => f / maxFactor);
}
