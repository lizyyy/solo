import { differenceInMinutes, parseISO } from 'date-fns';

export function parseDateTime(dateString: string): Date {
  return parseISO(dateString);
}

export function formatDateTime(date: Date): string {
  return date.toISOString();
}

export function getMinutesDifference(date1: Date, date2: Date): number {
  return Math.abs(differenceInMinutes(date1, date2));
}

export function calculateTemperatureSlope(
  temperatures: { timestamp: string; temperature: number | null }[]
): number | undefined {
  const validTemps = temperatures.filter(
    (t) => t.temperature !== null && !isNaN(t.temperature as number)
  ) as { timestamp: string; temperature: number }[];

  if (validTemps.length < 2) {
    return undefined;
  }

  validTemps.sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const firstTemp = validTemps[0];
  const lastTemp = validTemps[validTemps.length - 1];

  const timeDiffMinutes = getMinutesDifference(
    new Date(lastTemp.timestamp),
    new Date(firstTemp.timestamp)
  );

  if (timeDiffMinutes === 0) {
    return undefined;
  }

  const tempDiff = lastTemp.temperature - firstTemp.temperature;
  return tempDiff / timeDiffMinutes;
}

export function getTemperatureStats(
  temperatures: { temperature: number | null }[]
): { max: number | undefined; min: number | undefined; avg: number | undefined } {
  const validTemps = temperatures
    .map((t) => t.temperature)
    .filter((t): t is number => t !== null && !isNaN(t));

  if (validTemps.length === 0) {
    return { max: undefined, min: undefined, avg: undefined };
  }

  const max = Math.max(...validTemps);
  const min = Math.min(...validTemps);
  const avg = validTemps.reduce((sum, t) => sum + t, 0) / validTemps.length;

  return { max, min, avg };
}

export function detectSensorGaps(
  temperatures: { timestamp: string; temperature: number | null }[],
  maxGapMinutes: number
): { hasGap: boolean; totalGapMinutes: number } {
  if (temperatures.length < 2) {
    return { hasGap: false, totalGapMinutes: 0 };
  }

  const sortedTemps = [...temperatures].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  let hasGap = false;
  let totalGapMinutes = 0;

  for (let i = 1; i < sortedTemps.length; i++) {
    const prevTime = new Date(sortedTemps[i - 1].timestamp);
    const currTime = new Date(sortedTemps[i].timestamp);
    const gapMinutes = getMinutesDifference(currTime, prevTime);

    if (gapMinutes > maxGapMinutes) {
      hasGap = true;
      totalGapMinutes += gapMinutes - maxGapMinutes;
    }

    if (sortedTemps[i].temperature === null) {
      hasGap = true;
    }
  }

  return { hasGap, totalGapMinutes };
}

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}
