const xml2js = require('xml2js');
const dayjs = require('dayjs');
const _ = require('lodash');

const { toDateString, toDateTimeString, getHourOfDay } = require('../utils/date');
const { normalizeUnit, getTypeUnitInfo } = require('../utils/units');

const TARGET_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKQuantityTypeIdentifierSleepAnalysis',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierDistanceCycling',
  'HKQuantityTypeIdentifierWalkingHeartRateAverage',
];

const SLEEP_CATEGORIES = {
  'HKCategoryValueSleepAnalysisAsleepDeep': 'deep',
  'HKCategoryValueSleepAnalysisAsleepCore': 'light',
  'HKCategoryValueSleepAnalysisAsleepREM': 'rem',
  'HKCategoryValueSleepAnalysisAsleep': 'light',
  'HKCategoryValueSleepAnalysisAwake': 'awake',
  'HKCategoryValueSleepAnalysisInBed': 'in_bed',
};

async function parseAppleHealthXML(xmlContent) {
  const parser = new xml2js.Parser({
    explicitArray: false,
    ignoreAttrs: false,
    mergeAttrs: true,
  });

  const result = await parser.parseStringPromise(xmlContent);
  const healthData = result.HealthData || result;
  
  const records = [];
  const workouts = [];
  const seenRecords = new Set();

  if (healthData.Record) {
    const rawRecords = Array.isArray(healthData.Record) 
      ? healthData.Record 
      : [healthData.Record];

    for (const record of rawRecords) {
      const parsed = parseRecord(record, seenRecords);
      if (parsed) {
        records.push(parsed);
      }
    }
  }

  if (healthData.Workout) {
    const rawWorkouts = Array.isArray(healthData.Workout)
      ? healthData.Workout
      : [healthData.Workout];

    for (const workout of rawWorkouts) {
      const parsed = parseWorkout(workout);
      if (parsed) {
        workouts.push(parsed);
      }
    }
  }

  return {
    records,
    workouts,
    recordTypes: _.countBy(records, 'type'),
    totalRecords: records.length,
    totalWorkouts: workouts.length,
  };
}

function parseRecord(record, seenRecords) {
  if (!record.type) return null;

  if (!TARGET_TYPES.includes(record.type)) {
    return null;
  }

  const startDate = record.startDate || record.creationDate;
  const endDate = record.endDate || startDate;
  
  if (!startDate) return null;

  const startParsed = dayjs(startDate);
  const endParsed = dayjs(endDate);

  if (!startParsed.isValid() || !endParsed.isValid()) {
    return null;
  }

  const date = toDateString(startParsed);
  const hour = getHourOfDay(startParsed);

  let value = parseFloat(record.value);
  if (isNaN(value)) {
    if (record.type.includes('SleepAnalysis') && record.value) {
      const duration = endParsed.diff(startParsed, 'minute', true);
      value = duration;
    } else {
      value = null;
    }
  }

  let unit = record.unit;
  let normalizedValue = value;

  if (record.type === 'HKQuantityTypeIdentifierSleepAnalysis' || 
      record.type === 'HKCategoryTypeIdentifierSleepAnalysis') {
    const duration = endParsed.diff(startParsed, 'minute', true);
    normalizedValue = duration;
    unit = 'min';
    
    if (record.value && SLEEP_CATEGORIES[record.value]) {
      record.sleepStage = SLEEP_CATEGORIES[record.value];
    }
  }

  if (value !== null && unit) {
    const unitInfo = getTypeUnitInfo(record.type);
    if (unitInfo.category && unitInfo.category !== 'count') {
      const normalized = normalizeUnit(value, unit, unitInfo.category);
      normalizedValue = normalized.value;
    }
  }

  const id = generateRecordId(record, date, hour);
  
  if (seenRecords.has(id)) {
    return null;
  }
  seenRecords.add(id);

  const device = parseDevice(record.device);
  const sourceName = record.sourceName || device?.name;
  const sourceVersion = record.sourceVersion;

  let metadata = {};
  if (record.MetadataEntry) {
    const entries = Array.isArray(record.MetadataEntry) 
      ? record.MetadataEntry 
      : [record.MetadataEntry];
    for (const entry of entries) {
      if (entry.key && entry.value) {
        metadata[entry.key] = entry.value;
      }
    }
  }

  if (record.sleepStage) {
    metadata.sleepStage = record.sleepStage;
  }

  return {
    id,
    type: record.type,
    sourceName,
    sourceVersion,
    device: device ? JSON.stringify(device) : null,
    unit: record.unit || unit,
    value: normalizedValue,
    rawValue: value,
    startDate: toDateTimeString(startParsed),
    endDate: toDateTimeString(endParsed),
    creationDate: record.creationDate ? toDateTimeString(dayjs(record.creationDate)) : null,
    metadata: Object.keys(metadata).length ? JSON.stringify(metadata) : null,
    date,
    hour,
  };
}

function parseWorkout(workout) {
  if (!workout.workoutActivityType) return null;

  const startDate = workout.startDate;
  const endDate = workout.endDate;
  
  if (!startDate || !endDate) return null;

  const startParsed = dayjs(startDate);
  const endParsed = dayjs(endDate);

  if (!startParsed.isValid() || !endParsed.isValid()) {
    return null;
  }

  const date = toDateString(startParsed);
  const duration = parseFloat(workout.duration) || endParsed.diff(startParsed, 'minute', true);
  const durationUnit = workout.durationUnit || 'min';

  let totalDistance = parseFloat(workout.totalDistance) || 0;
  const totalDistanceUnit = workout.totalDistanceUnit || 'km';
  
  if (totalDistanceUnit === 'm' || totalDistanceUnit === 'meter') {
    totalDistance = totalDistance / 1000;
  } else if (totalDistanceUnit === 'mi') {
    totalDistance = totalDistance * 1.60934;
  }

  let totalEnergyBurned = parseFloat(workout.totalEnergyBurned) || 0;
  const totalEnergyBurnedUnit = workout.totalEnergyBurnedUnit || 'kcal';
  
  if (totalEnergyBurnedUnit === 'kJ') {
    totalEnergyBurned = totalEnergyBurned / 4.184;
  }

  const device = parseDevice(workout.device);
  const sourceName = workout.sourceName || device?.name;

  let metadata = {};
  if (workout.MetadataEntry) {
    const entries = Array.isArray(workout.MetadataEntry)
      ? workout.MetadataEntry
      : [workout.MetadataEntry];
    for (const entry of entries) {
      if (entry.key && entry.value) {
        metadata[entry.key] = entry.value;
      }
    }
  }

  let workoutEvents = [];
  if (workout.WorkoutEvent) {
    const events = Array.isArray(workout.WorkoutEvent)
      ? workout.WorkoutEvent
      : [workout.WorkoutEvent];
    for (const event of events) {
      if (event.type) {
        workoutEvents.push({
          type: event.type,
          date: event.date,
          duration: parseFloat(event.duration) || 0,
          durationUnit: event.durationUnit,
        });
      }
    }
  }

  if (workoutEvents.length) {
    metadata.workoutEvents = workoutEvents;
  }

  const id = `workout_${date}_${workout.workoutActivityType}_${startParsed.unix()}`;

  return {
    id,
    workoutActivityType: workout.workoutActivityType,
    duration,
    durationUnit,
    totalDistance,
    totalDistanceUnit: 'km',
    totalEnergyBurned,
    totalEnergyBurnedUnit: 'kcal',
    startDate: toDateTimeString(startParsed),
    endDate: toDateTimeString(endParsed),
    creationDate: workout.creationDate ? toDateTimeString(dayjs(workout.creationDate)) : null,
    sourceName,
    device: device ? JSON.stringify(device) : null,
    metadata: Object.keys(metadata).length ? JSON.stringify(metadata) : null,
    date,
    gpxFile: null,
    hasGpx: 0,
  };
}

function parseDevice(deviceString) {
  if (!deviceString) return null;

  const match = deviceString.match(/<<(.*?)>>/);
  if (!match) return { raw: deviceString };

  const content = match[1];
  const parts = content.split(',');
  
  const device = {};
  for (const part of parts) {
    const [key, value] = part.split(':').map(s => s.trim());
    if (key && value) {
      device[key] = value;
    }
  }

  return device;
}

function generateRecordId(record, date, hour) {
  const type = record.type;
  const source = record.sourceName || 'unknown';
  const startDate = record.startDate || '';
  
  const base = `${date}_${type}_${source}_${startDate}`;
  return `record_${Buffer.from(base).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`;
}

module.exports = {
  parseAppleHealthXML,
  TARGET_TYPES,
};
