import moment from 'moment';
import { getWeekNumber, getMonthNumber, getWeekRange, getMonthRange, isDateInRange, daysBetween } from '../utils/date.js';
import { getSurfaceName, getTrainingTypeName } from '../utils/normalization.js';
import config from '../config/index.js';

export class DataAggregator {
  constructor(runs = [], shoes = [], soreness = []) {
    this.runs = runs;
    this.shoes = shoes;
    this.soreness = soreness;
  }

  filterRuns(options = {}) {
    let filtered = [...this.runs];

    if (options.startDate) {
      const start = moment(options.startDate);
      filtered = filtered.filter(r => r.date.isSameOrAfter(start));
    }

    if (options.endDate) {
      const end = moment(options.endDate);
      filtered = filtered.filter(r => r.date.isSameOrBefore(end));
    }

    if (options.shoes && options.shoes.length > 0) {
      filtered = filtered.filter(r => options.shoes.includes(r.shoe));
    }

    if (options.surfaces && options.surfaces.length > 0) {
      filtered = filtered.filter(r => options.surfaces.includes(r.surface));
    }

    if (options.trainingTypes && options.trainingTypes.length > 0) {
      filtered = filtered.filter(r => options.trainingTypes.includes(r.trainingType));
    }

    if (options.minDistance !== undefined) {
      filtered = filtered.filter(r => r.distance >= options.minDistance);
    }

    if (options.maxDistance !== undefined) {
      filtered = filtered.filter(r => r.distance <= options.maxDistance);
    }

    return filtered;
  }

  getByWeek(year, week) {
    const { start, end } = getWeekRange(year, week);
    return this.filterRuns({ startDate: start, endDate: end });
  }

  getByMonth(year, month) {
    const { start, end } = getMonthRange(year, month);
    return this.filterRuns({ startDate: start, endDate: end });
  }

  aggregateByWeek(options = {}) {
    const filtered = this.filterRuns(options);
    const weeks = new Map();

    for (const run of filtered) {
      const { year, week } = getWeekNumber(run.date);
      const key = `${year}-W${week.toString().padStart(2, '0')}`;

      if (!weeks.has(key)) {
        weeks.set(key, {
          year,
          week,
          key,
          startDate: getWeekRange(year, week).start,
          runs: [],
          totalDistance: 0,
          totalDuration: 0,
          totalElevation: 0,
          runCount: 0,
          avgPace: null,
          paces: [],
          surfaces: {},
          trainingTypes: {},
          shoes: {}
        });
      }

      const weekData = weeks.get(key);
      weekData.runs.push(run);
      weekData.totalDistance += run.distance;
      weekData.totalDuration += (run.duration || 0);
      weekData.totalElevation += run.elevation;
      weekData.runCount += 1;

      if (run.pace) {
        weekData.paces.push(run.pace);
      }

      weekData.surfaces[run.surface] = (weekData.surfaces[run.surface] || 0) + run.distance;
      weekData.trainingTypes[run.trainingType] = (weekData.trainingTypes[run.trainingType] || 0) + run.distance;
      weekData.shoes[run.shoe] = (weekData.shoes[run.shoe] || 0) + run.distance;
    }

    const result = Array.from(weeks.values()).map(w => ({
      ...w,
      avgPace: w.paces.length > 0 ? w.paces.reduce((a, b) => a + b, 0) / w.paces.length : null
    }));

    return result.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.week - b.week;
    });
  }

  aggregateByMonth(options = {}) {
    const filtered = this.filterRuns(options);
    const months = new Map();

    for (const run of filtered) {
      const { year, month } = getMonthNumber(run.date);
      const key = `${year}-${month.toString().padStart(2, '0')}`;

      if (!months.has(key)) {
        months.set(key, {
          year,
          month,
          key,
          startDate: getMonthRange(year, month).start,
          runs: [],
          totalDistance: 0,
          totalDuration: 0,
          totalElevation: 0,
          runCount: 0,
          avgPace: null,
          paces: [],
          surfaces: {},
          trainingTypes: {},
          shoes: {}
        });
      }

      const monthData = months.get(key);
      monthData.runs.push(run);
      monthData.totalDistance += run.distance;
      monthData.totalDuration += (run.duration || 0);
      monthData.totalElevation += run.elevation;
      monthData.runCount += 1;

      if (run.pace) {
        monthData.paces.push(run.pace);
      }

      monthData.surfaces[run.surface] = (monthData.surfaces[run.surface] || 0) + run.distance;
      monthData.trainingTypes[run.trainingType] = (monthData.trainingTypes[run.trainingType] || 0) + run.distance;
      monthData.shoes[run.shoe] = (monthData.shoes[run.shoe] || 0) + run.distance;
    }

    const result = Array.from(months.values()).map(m => ({
      ...m,
      avgPace: m.paces.length > 0 ? m.paces.reduce((a, b) => a + b, 0) / m.paces.length : null
    }));

    return result.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }

  aggregateByShoe(options = {}) {
    const filtered = this.filterRuns(options);
    const shoes = new Map();

    for (const run of filtered) {
      const shoeName = run.shoe || 'unknown';
      if (!shoes.has(shoeName)) {
        shoes.set(shoeName, {
          name: shoeName,
          runs: [],
          totalDistance: 0,
          totalDuration: 0,
          totalElevation: 0,
          runCount: 0,
          firstRun: null,
          lastRun: null,
          avgPace: null,
          paces: [],
          surfaces: {},
          trainingTypes: {}
        });
      }

      const shoeData = shoes.get(shoeName);
      shoeData.runs.push(run);
      shoeData.totalDistance += run.distance;
      shoeData.totalDuration += (run.duration || 0);
      shoeData.totalElevation += run.elevation;
      shoeData.runCount += 1;

      if (!shoeData.firstRun || run.date.isBefore(shoeData.firstRun)) {
        shoeData.firstRun = run.date;
      }
      if (!shoeData.lastRun || run.date.isAfter(shoeData.lastRun)) {
        shoeData.lastRun = run.date;
      }

      if (run.pace) {
        shoeData.paces.push(run.pace);
      }

      shoeData.surfaces[run.surface] = (shoeData.surfaces[run.surface] || 0) + run.distance;
      shoeData.trainingTypes[run.trainingType] = (shoeData.trainingTypes[run.trainingType] || 0) + run.distance;
    }

    return Array.from(shoes.values()).map(s => ({
      ...s,
      avgPace: s.paces.length > 0 ? s.paces.reduce((a, b) => a + b, 0) / s.paces.length : null,
      daysSinceLastRun: s.lastRun ? daysBetween(moment(), s.lastRun) : null
    }));
  }

  aggregateBySurface(options = {}) {
    const filtered = this.filterRuns(options);
    const surfaces = new Map();

    for (const run of filtered) {
      const surface = run.surface || 'unknown';
      if (!surfaces.has(surface)) {
        surfaces.set(surface, {
          surface,
          surfaceName: getSurfaceName(surface),
          runs: [],
          totalDistance: 0,
          totalDuration: 0,
          totalElevation: 0,
          runCount: 0,
          avgPace: null,
          paces: []
        });
      }

      const surfaceData = surfaces.get(surface);
      surfaceData.runs.push(run);
      surfaceData.totalDistance += run.distance;
      surfaceData.totalDuration += (run.duration || 0);
      surfaceData.totalElevation += run.elevation;
      surfaceData.runCount += 1;

      if (run.pace) {
        surfaceData.paces.push(run.pace);
      }
    }

    return Array.from(surfaces.values()).map(s => ({
      ...s,
      avgPace: s.paces.length > 0 ? s.paces.reduce((a, b) => a + b, 0) / s.paces.length : null
    }));
  }

  aggregateByTrainingType(options = {}) {
    const filtered = this.filterRuns(options);
    const types = new Map();

    for (const run of filtered) {
      const type = run.trainingType || 'unknown';
      if (!types.has(type)) {
        types.set(type, {
          type,
          typeName: getTrainingTypeName(type),
          runs: [],
          totalDistance: 0,
          totalDuration: 0,
          totalElevation: 0,
          runCount: 0,
          avgPace: null,
          paces: []
        });
      }

      const typeData = types.get(type);
      typeData.runs.push(run);
      typeData.totalDistance += run.distance;
      typeData.totalDuration += (run.duration || 0);
      typeData.totalElevation += run.elevation;
      typeData.runCount += 1;

      if (run.pace) {
        typeData.paces.push(run.pace);
      }
    }

    return Array.from(types.values()).map(t => ({
      ...t,
      avgPace: t.paces.length > 0 ? t.paces.reduce((a, b) => a + b, 0) / t.paces.length : null
    }));
  }

  getUniqueShoes() {
    return [...new Set(this.runs.filter(r => r.shoe && r.shoe !== 'unknown').map(r => r.shoe))];
  }

  getUniqueSurfaces() {
    return [...new Set(this.runs.map(r => r.surface))];
  }

  getUniqueTrainingTypes() {
    return [...new Set(this.runs.map(r => r.trainingType))];
  }

  getDateRange() {
    if (this.runs.length === 0) {
      return { start: null, end: null };
    }

    const dates = this.runs.map(r => r.date);
    return {
      start: moment.min(dates),
      end: moment.max(dates)
    };
  }
}

export function createAggregator(validationResult) {
  return new DataAggregator(
    validationResult.runs?.data || [],
    validationResult.shoes?.data || [],
    validationResult.soreness?.data || []
  );
}
