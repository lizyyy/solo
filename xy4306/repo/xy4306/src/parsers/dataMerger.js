const dayjs = require('dayjs');
const { CONFIG } = require('../config/constants');

class DataMerger {
  constructor() {
    this.mergedTimeline = [];
    this.vehicleBatches = {};
  }

  merge({ temperatureRecords = [], doorEvents = [], notes = [] }) {
    const allEvents = [];

    for (const record of temperatureRecords) {
      allEvents.push({
        ...record,
        eventType: 'temperature'
      });
    }

    for (const event of doorEvents) {
      if (event.openTime) {
        allEvents.push({
          timestamp: event.openTime,
          time: event.openTimeStr,
          eventType: 'door_open',
          doorEvent: event,
          vehicle: event.vehicle,
          source: 'door'
        });
      }
      if (event.closeTime) {
        allEvents.push({
          timestamp: event.closeTime,
          time: event.closeTimeStr,
          eventType: 'door_close',
          doorEvent: event,
          vehicle: event.vehicle,
          source: 'door'
        });
      }
    }

    for (const note of notes) {
      if (note.timestamp) {
        allEvents.push({
          ...note,
          eventType: 'note'
        });
      }
    }

    this.mergedTimeline = allEvents.sort((a, b) => 
      dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf()
    );

    this.organizeByVehicleBatch(temperatureRecords, doorEvents, notes);

    return {
      timeline: this.mergedTimeline,
      vehicleBatches: this.vehicleBatches
    };
  }

  organizeByVehicleBatch(temperatureRecords, doorEvents, notes) {
    this.vehicleBatches = {};

    const vehicleSet = new Set();
    temperatureRecords.forEach(r => vehicleSet.add(r.vehicle));
    doorEvents.forEach(e => vehicleSet.add(e.vehicle));
    notes.forEach(n => {
      if (n.vehicle && n.vehicle !== 'unknown') {
        vehicleSet.add(n.vehicle);
      }
    });

    for (const vehicle of vehicleSet) {
      const vehicleTemperatures = temperatureRecords.filter(r => r.vehicle === vehicle);
      const vehicleDoorEvents = doorEvents.filter(e => e.vehicle === vehicle);
      const vehicleNotes = notes.filter(n => n.vehicle === vehicle || n.vehicle === 'unknown');

      const batchSet = new Set(vehicleTemperatures.map(r => r.batch).filter(b => b && b !== 'unknown'));
      
      this.vehicleBatches[vehicle] = {
        vehicle,
        temperatures: vehicleTemperatures,
        doorEvents: vehicleDoorEvents,
        notes: vehicleNotes,
        batches: {},
        timeRange: this.calculateTimeRange(vehicleTemperatures, vehicleDoorEvents, vehicleNotes)
      };

      for (const batch of batchSet) {
        const batchTemperatures = vehicleTemperatures.filter(r => r.batch === batch);
        const batchTimeRange = this.calculateTimeRange(batchTemperatures, [], []);
        
        const batchDoorEvents = this.filterEventsByTimeRange(vehicleDoorEvents, batchTimeRange);
        const batchNotes = this.filterNotesByTimeRange(vehicleNotes, batchTimeRange);

        this.vehicleBatches[vehicle].batches[batch] = {
          batch,
          vehicle,
          temperatures: batchTemperatures,
          doorEvents: batchDoorEvents,
          notes: batchNotes,
          timeRange: batchTimeRange,
          mergedTimeline: this.createBatchTimeline(batchTemperatures, batchDoorEvents, batchNotes)
        };
      }
    }

    return this.vehicleBatches;
  }

  createBatchTimeline(temperatures, doorEvents, notes) {
    const events = [];

    for (const record of temperatures) {
      events.push({
        ...record,
        eventType: 'temperature'
      });
    }

    for (const event of doorEvents) {
      if (event.openTime) {
        events.push({
          timestamp: event.openTime,
          time: event.openTimeStr,
          eventType: 'door_open',
          doorEvent: event,
          vehicle: event.vehicle,
          source: 'door'
        });
      }
      if (event.closeTime) {
        events.push({
          timestamp: event.closeTime,
          time: event.closeTimeStr,
          eventType: 'door_close',
          doorEvent: event,
          vehicle: event.vehicle,
          source: 'door'
        });
      }
    }

    for (const note of notes) {
      if (note.timestamp) {
        events.push({
          ...note,
          eventType: 'note'
        });
      }
    }

    return events.sort((a, b) => 
      dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf()
    );
  }

  calculateTimeRange(temperatures, doorEvents, notes) {
    const times = [];

    temperatures.forEach(r => times.push(dayjs(r.timestamp).valueOf()));
    
    doorEvents.forEach(e => {
      if (e.openTime) times.push(dayjs(e.openTime).valueOf());
      if (e.closeTime) times.push(dayjs(e.closeTime).valueOf());
    });

    notes.forEach(n => {
      if (n.timestamp) times.push(dayjs(n.timestamp).valueOf());
    });

    if (times.length === 0) {
      return null;
    }

    return {
      start: dayjs(Math.min(...times)).toISOString(),
      end: dayjs(Math.max(...times)).toISOString()
    };
  }

  filterEventsByTimeRange(events, timeRange) {
    if (!timeRange) return events;

    const start = dayjs(timeRange.start);
    const end = dayjs(timeRange.end);

    return events.filter(event => {
      const eventStart = dayjs(event.openTime);
      const eventEnd = event.closeTime ? dayjs(event.closeTime) : end;
      
      return eventStart.isBefore(end) && eventEnd.isAfter(start);
    });
  }

  filterNotesByTimeRange(notes, timeRange) {
    if (!timeRange) return notes;

    const start = dayjs(timeRange.start);
    const end = dayjs(timeRange.end);

    return notes.filter(note => {
      if (!note.timestamp) return true;
      const noteTime = dayjs(note.timestamp);
      return noteTime.isAfter(start.subtract(1, 'hour')) && noteTime.isBefore(end.add(1, 'hour'));
    });
  }

  getVehicleBatches() {
    return this.vehicleBatches;
  }

  getVehicles() {
    return Object.keys(this.vehicleBatches);
  }

  getBatchesForVehicle(vehicle) {
    if (!this.vehicleBatches[vehicle]) return [];
    return Object.keys(this.vehicleBatches[vehicle].batches);
  }

  getBatchData(vehicle, batch) {
    if (!this.vehicleBatches[vehicle] || !this.vehicleBatches[vehicle].batches[batch]) {
      return null;
    }
    return this.vehicleBatches[vehicle].batches[batch];
  }

  getSummary() {
    const vehicles = this.getVehicles();
    const totalBatches = vehicles.reduce(
      (sum, v) => sum + Object.keys(this.vehicleBatches[v].batches).length, 0
    );
    const totalRecords = vehicles.reduce(
      (sum, v) => sum + this.vehicleBatches[v].temperatures.length, 0
    );
    const totalDoorEvents = vehicles.reduce(
      (sum, v) => sum + this.vehicleBatches[v].doorEvents.length, 0
    );
    const totalNotes = vehicles.reduce(
      (sum, v) => sum + this.vehicleBatches[v].notes.length, 0
    );

    return {
      vehicleCount: vehicles.length,
      totalBatches,
      totalTemperatureRecords: totalRecords,
      totalDoorEvents,
      totalNotes,
      vehicles: vehicles.map(v => ({
        vehicle: v,
        batchCount: Object.keys(this.vehicleBatches[v].batches).length,
        recordCount: this.vehicleBatches[v].temperatures.length
      }))
    };
  }
}

module.exports = DataMerger;
