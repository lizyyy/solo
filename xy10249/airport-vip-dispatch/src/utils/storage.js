const fs = require('fs');
const path = require('path');
const {
  DATA_DIR, FLIGHTS_FILE, VEHICLES_FILE, DRIVERS_FILE, 
  DISPATCH_HISTORY_FILE, REPORTS_DIR
} = require('../config');
const Flight = require('../models/flight');
const Vehicle = require('../models/vehicle');
const Driver = require('../models/driver');
const Dispatch = require('../models/dispatch');

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function readJsonFile(filePath, defaultData = []) {
  if (!fs.existsSync(filePath)) {
    return defaultData;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return defaultData;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

const storage = {
  initialize() {
    ensureDirectoryExists();
  },

  getFlights() {
    ensureDirectoryExists();
    const data = readJsonFile(FLIGHTS_FILE, []);
    return data.map(f => Flight.fromJSON(f));
  },

  saveFlights(flights) {
    ensureDirectoryExists();
    const data = flights.map(f => f.toJSON());
    writeJsonFile(FLIGHTS_FILE, data);
  },

  getFlightById(id) {
    const flights = this.getFlights();
    return flights.find(f => f.id === id);
  },

  saveFlight(flight) {
    const flights = this.getFlights();
    const index = flights.findIndex(f => f.id === flight.id);
    if (index === -1) {
      flights.push(flight);
    } else {
      flights[index] = flight;
    }
    this.saveFlights(flights);
  },

  getVehicles() {
    ensureDirectoryExists();
    const data = readJsonFile(VEHICLES_FILE, []);
    return data.map(v => Vehicle.fromJSON(v));
  },

  saveVehicles(vehicles) {
    ensureDirectoryExists();
    const data = vehicles.map(v => v.toJSON());
    writeJsonFile(VEHICLES_FILE, data);
  },

  getVehicleById(id) {
    const vehicles = this.getVehicles();
    return vehicles.find(v => v.id === id);
  },

  saveVehicle(vehicle) {
    const vehicles = this.getVehicles();
    const index = vehicles.findIndex(v => v.id === vehicle.id);
    if (index === -1) {
      vehicles.push(vehicle);
    } else {
      vehicles[index] = vehicle;
    }
    this.saveVehicles(vehicles);
  },

  getDrivers() {
    ensureDirectoryExists();
    const data = readJsonFile(DRIVERS_FILE, []);
    return data.map(d => Driver.fromJSON(d));
  },

  saveDrivers(drivers) {
    ensureDirectoryExists();
    const data = drivers.map(d => d.toJSON());
    writeJsonFile(DRIVERS_FILE, data);
  },

  getDriverById(id) {
    const drivers = this.getDrivers();
    return drivers.find(d => d.id === id);
  },

  saveDriver(driver) {
    const drivers = this.getDrivers();
    const index = drivers.findIndex(d => d.id === driver.id);
    if (index === -1) {
      drivers.push(driver);
    } else {
      drivers[index] = driver;
    }
    this.saveDrivers(drivers);
  },

  getDispatches() {
    ensureDirectoryExists();
    const data = readJsonFile(DISPATCH_HISTORY_FILE, []);
    return data.map(d => Dispatch.fromJSON(d));
  },

  saveDispatches(dispatches) {
    ensureDirectoryExists();
    const data = dispatches.map(d => d.toJSON());
    writeJsonFile(DISPATCH_HISTORY_FILE, data);
  },

  getDispatchById(id) {
    const dispatches = this.getDispatches();
    return dispatches.find(d => d.id === id);
  },

  saveDispatch(dispatch) {
    const dispatches = this.getDispatches();
    const index = dispatches.findIndex(d => d.id === dispatch.id);
    if (index === -1) {
      dispatches.push(dispatch);
    } else {
      dispatches[index] = dispatch;
    }
    this.saveDispatches(dispatches);
  },

  getDispatchesByFlightId(flightId) {
    return this.getDispatches().filter(d => d.flightId === flightId);
  },

  getDispatchesByVehicleId(vehicleId) {
    return this.getDispatches().filter(d => d.vehicleId === vehicleId);
  },

  getDispatchesByDriverId(driverId) {
    return this.getDispatches().filter(d => d.driverId === driverId);
  },

  clearAll() {
    if (fs.existsSync(FLIGHTS_FILE)) fs.unlinkSync(FLIGHTS_FILE);
    if (fs.existsSync(VEHICLES_FILE)) fs.unlinkSync(VEHICLES_FILE);
    if (fs.existsSync(DRIVERS_FILE)) fs.unlinkSync(DRIVERS_FILE);
    if (fs.existsSync(DISPATCH_HISTORY_FILE)) fs.unlinkSync(DISPATCH_HISTORY_FILE);
  }
};

module.exports = storage;
