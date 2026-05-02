const FlightStatus = {
  SCHEDULED: 'scheduled',
  BOARDING: 'boarding',
  DEICING: 'deicing',
  DEICED: 'deiced',
  CLEARED: 'cleared',
  TAKEOFF: 'takeoff',
  DELAYED: 'delayed',
  DIVERTED: 'diverted',
  CANCELLED: 'cancelled'
};

const VehicleStatus = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  MAINTENANCE: 'maintenance',
  OFF_DUTY: 'off_duty',
  DISPATCHING: 'dispatching'
};

const PadStatus = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline'
};

const EventType = {
  VEHICLE_BREAKDOWN: 'vehicle_breakdown',
  SHIFT_CHANGE: 'shift_change',
  FLUID_SHORTAGE: 'fluid_shortage',
  RETURN_FLIGHT: 'return_flight',
  WEATHER_CHANGE: 'weather_change',
  FLIGHT_DELAY: 'flight_delay'
};

class Scheduler {
  constructor(gameState) {
    this.state = gameState;
    this.listeners = [];
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  notify(event, data) {
    this.listeners.forEach(cb => cb(event, data));
  }

  assignFlightToPad(flightId, padId, vehicleId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    const pad = this.state.pads.find(p => p.id === padId);
    const vehicle = this.state.vehicles.find(v => v.id === vehicleId);

    if (!flight || !pad || !vehicle) {
      return { success: false, error: 'Invalid flight, pad or vehicle' };
    }

    if (pad.status !== PadStatus.AVAILABLE) {
      return { success: false, error: 'Pad is not available' };
    }

    if (vehicle.status !== VehicleStatus.AVAILABLE) {
      return { success: false, error: 'Vehicle is not available' };
    }

    if (this.state.fluidInventory[flight.fluidType].available < flight.fluidRequired) {
      return { success: false, error: 'Insufficient fluid' };
    }

    pad.status = PadStatus.BUSY;
    pad.currentFlight = flightId;
    pad.currentVehicle = vehicleId;
    pad.processStartTime = this.state.currentTime;
    pad.processEndTime = this.state.currentTime + pad.processTime;

    vehicle.status = VehicleStatus.BUSY;
    vehicle.currentPad = padId;
    vehicle.currentFlight = flightId;

    flight.status = FlightStatus.DEICING;
    flight.assignedPad = padId;
    flight.assignedVehicle = vehicleId;
    flight.deicingStartTime = this.state.currentTime;
    flight.deicingEndTime = pad.processEndTime;

    this.state.fluidInventory[flight.fluidType].available -= flight.fluidRequired;
    this.state.assignments.push({
      flightId,
      padId,
      vehicleId,
      assignmentTime: this.state.currentTime,
      fluidUsed: flight.fluidRequired
    });

    this.notify('assignment', { flight, pad, vehicle });
    return { success: true };
  }

  completeDeicing(flightId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    if (!flight || flight.status !== FlightStatus.DEICING) {
      return { success: false, error: 'Flight is not in deicing state' };
    }

    const pad = this.state.pads.find(p => p.id === flight.assignedPad);
    const vehicle = this.state.vehicles.find(v => v.id === flight.assignedVehicle);

    if (pad) {
      pad.status = PadStatus.AVAILABLE;
      pad.currentFlight = null;
      pad.currentVehicle = null;
    }

    if (vehicle) {
      vehicle.status = VehicleStatus.AVAILABLE;
      vehicle.currentPad = null;
      vehicle.currentFlight = null;
    }

    flight.status = FlightStatus.DEICED;
    flight.deicingCompleteTime = this.state.currentTime;

    this.notify('deicing_complete', { flight });
    return { success: true };
  }

  clearFlightForTakeoff(flightId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    if (!flight || flight.status !== FlightStatus.DEICED) {
      return { success: false, error: 'Flight is not ready for takeoff' };
    }

    flight.status = FlightStatus.CLEARED;
    flight.clearedTime = this.state.currentTime;

    this.notify('flight_cleared', { flight });
    return { success: true };
  }

  takeoffFlight(flightId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    if (!flight) {
      return { success: false, error: 'Flight not found' };
    }

    if (flight.status === FlightStatus.CLEARED) {
      flight.status = FlightStatus.TAKEOFF;
      flight.actualDeparture = this.state.currentTime;
      flight.takeoffTime = this.state.currentTime;

      const delay = this.state.currentTime - flight.departureTime;
      if (delay > 0) {
        this.state.score -= delay * 10;
      }

      this.notify('takeoff', { flight, delay });
      return { success: true, delay };
    }

    if (flight.status === FlightStatus.DEICED) {
      this.clearFlightForTakeoff(flightId);
      return this.takeoffFlight(flightId);
    }

    return { success: false, error: 'Flight cannot take off' };
  }

  handleVehicleBreakdown(vehicleId, repairTime = 15) {
    const vehicle = this.state.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    vehicle.status = VehicleStatus.MAINTENANCE;
    vehicle.breakdownTime = this.state.currentTime;
    vehicle.repairEndTime = this.state.currentTime + repairTime;

    if (vehicle.currentFlight) {
      const flight = this.state.flights.find(f => f.id === vehicle.currentFlight);
      if (flight && flight.status === FlightStatus.DEICING) {
        flight.status = FlightStatus.DELAYED;
        flight.delayReason = 'vehicle_breakdown';

        const pad = this.state.pads.find(p => p.id === flight.assignedPad);
        if (pad) {
          pad.status = PadStatus.AVAILABLE;
          pad.currentFlight = null;
          pad.currentVehicle = null;
        }
      }
      vehicle.currentFlight = null;
      vehicle.currentPad = null;
    }

    this.notify('vehicle_breakdown', { vehicle, repairTime });
    return { success: true };
  }

  repairVehicle(vehicleId) {
    const vehicle = this.state.vehicles.find(v => v.id === vehicleId);
    if (!vehicle || vehicle.status !== VehicleStatus.MAINTENANCE) {
      return { success: false, error: 'Vehicle is not under repair' };
    }

    vehicle.status = VehicleStatus.AVAILABLE;
    vehicle.breakdownTime = null;
    vehicle.repairEndTime = null;

    this.notify('vehicle_repaired', { vehicle });
    return { success: true };
  }

  handleShiftChange(vehicleId, changeTime = 5) {
    const vehicle = this.state.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      return { success: false, error: 'Vehicle not found' };
    }

    const wasAvailable = vehicle.status === VehicleStatus.AVAILABLE;

    if (vehicle.currentFlight) {
      const flight = this.state.flights.find(f => f.id === vehicle.currentFlight);
      if (flight && flight.status === FlightStatus.DEICING) {
        flight.status = FlightStatus.DELAYED;
        flight.delayReason = 'shift_change';

        const pad = this.state.pads.find(p => p.id === flight.assignedPad);
        if (pad) {
          pad.status = PadStatus.AVAILABLE;
        }
        vehicle.currentFlight = null;
        vehicle.currentPad = null;
      }
    }

    vehicle.status = VehicleStatus.OFF_DUTY;
    vehicle.shiftChangeStart = this.state.currentTime;
    vehicle.shiftChangeEnd = this.state.currentTime + changeTime;

    setTimeout(() => {
      vehicle.status = VehicleStatus.AVAILABLE;
      vehicle.shiftChangeStart = null;
      vehicle.shiftChangeEnd = null;
      this.notify('shift_change_complete', { vehicle });
    }, changeTime * 60 * 1000 / this.state.timeScale);

    this.notify('shift_change_start', { vehicle, changeTime });
    return { success: true };
  }

  handleReturnFlight(flightId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    if (!flight) {
      return { success: false, error: 'Flight not found' };
    }

    flight.status = FlightStatus.BOARDING;
    flight.priority = 1;
    flight.specialEvent = 'return_flight';
    flight.returnTime = this.state.currentTime;

    this.notify('return_flight', { flight });
    return { success: true };
  }

  addFluidSupply(fluidType, amount) {
    if (!this.state.fluidInventory[fluidType]) {
      return { success: false, error: 'Invalid fluid type' };
    }

    this.state.fluidInventory[fluidType].available += amount;
    this.state.fluidInventory[fluidType].total += amount;

    this.notify('fluid_supply', { fluidType, amount });
    return { success: true };
  }

  getAvailablePads() {
    return this.state.pads.filter(p => p.status === PadStatus.AVAILABLE);
  }

  getAvailableVehicles() {
    return this.state.vehicles.filter(v =>
      v.status === VehicleStatus.AVAILABLE ||
      (v.status === VehicleStatus.OFF_DUTY &&
       this.state.currentTime >= v.shiftChangeEnd)
    );
  }

  getFlightsNeedingDeicing() {
    return this.state.flights.filter(f =>
      f.status === FlightStatus.SCHEDULED ||
      f.status === FlightStatus.BOARDING ||
      f.status === FlightStatus.DELAYED
    ).sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.departureTime - b.departureTime;
    });
  }

  getActiveDeicingOperations() {
    return this.state.flights.filter(f => f.status === FlightStatus.DEICING);
  }

  advanceTime(deltaMinutes) {
    this.state.currentTime += deltaMinutes;

    while (this.state.currentTime >= 1440) {
      this.state.currentTime -= 1440;
      this.state.dayOfOperation++;
    }

    this.state.pads.forEach(pad => {
      if (pad.status === PadStatus.BUSY && this.state.currentTime >= pad.processEndTime) {
        this.completeDeicing(pad.currentFlight);
      }
    });

    this.state.vehicles.forEach(vehicle => {
      if (vehicle.status === VehicleStatus.MAINTENANCE &&
          this.state.currentTime >= vehicle.repairEndTime) {
        this.repairVehicle(vehicle.id);
      }

      if (vehicle.status === VehicleStatus.OFF_DUTY &&
          this.state.currentTime >= vehicle.shiftChangeEnd) {
        vehicle.status = VehicleStatus.AVAILABLE;
        vehicle.shiftChangeStart = null;
        vehicle.shiftChangeEnd = null;
      }
    });

    this.state.flights.forEach(flight => {
      if (flight.status === FlightStatus.CLEARED &&
          this.state.currentTime >= flight.departureTime) {
        this.takeoffFlight(flight.id);
      }

      if (flight.status !== FlightStatus.TAKEOFF &&
          flight.status !== FlightStatus.DIVERTED &&
          this.state.currentTime >= flight.departureTime + 60) {
        flight.status = FlightStatus.DELAYED;
        flight.delayReason = 'missed_window';
      }
    });

    this.notify('time_advance', { currentTime: this.state.currentTime, deltaMinutes });
    return this.state.currentTime;
  }

  checkWinCondition() {
    const allFlightsHandled = this.state.flights.every(f =>
      f.status === FlightStatus.TAKEOFF ||
      f.status === FlightStatus.DIVERTED ||
      f.status === FlightStatus.CANCELLED
    );

    const successfulDeicing = this.state.flights.filter(f =>
      f.status === FlightStatus.TAKEOFF
    ).length;

    const requiredDeicing = this.state.level.objectives?.requiredDeicing || this.state.flights.length;

    return {
      allFlightsHandled,
      successfulDeicing,
      requiredDeicing,
      isWin: successfulDeicing >= requiredDeicing,
      isComplete: allFlightsHandled
    };
  }

  getState() {
    return {
      ...this.state,
      availablePads: this.getAvailablePads(),
      availableVehicles: this.getAvailableVehicles(),
      flightsNeedingDeicing: this.getFlightsNeedingDeicing(),
      activeOperations: this.getActiveDeicingOperations(),
      winCondition: this.checkWinCondition()
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FlightStatus,
    VehicleStatus,
    PadStatus,
    EventType,
    Scheduler
  };
}