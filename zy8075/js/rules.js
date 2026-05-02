const AircraftConfig = {
  A220: { fluidRange: [80, 100], processTime: 10, category: 'narrow' },
  'B737-700': { fluidRange: [80, 120], processTime: 10, category: 'narrow' },
  'B737-800': { fluidRange: [120, 180], processTime: 15, category: 'narrow' },
  A320: { fluidRange: [120, 180], processTime: 15, category: 'narrow' },
  A321: { fluidRange: [150, 200], processTime: 18, category: 'narrow' },
  A330: { fluidRange: [180, 250], processTime: 20, category: 'wide' },
  B767: { fluidRange: [180, 250], processTime: 20, category: 'wide' },
  B777: { fluidRange: [250, 350], processTime: 25, category: 'wide' },
  A350: { fluidRange: [280, 380], processTime: 28, category: 'wide' },
  A380: { fluidRange: [300, 450], processTime: 30, category: 'super' },
  B747: { fluidRange: [300, 450], processTime: 30, category: 'super' },
  E190: { fluidRange: [60, 90], processTime: 8, category: 'regional' },
  E195: { fluidRange: [70, 100], processTime: 8, category: 'regional' }
};

const DEICING_WINDOW = {
  international: { before: 45, after: 15 },
  domestic: { before: 30, after: 10 }
};

const FLUID_CONSUMPTION_RATES = {
  TypeI: { perMinute: 0.5, perDegree: 0.02 },
  TypeII: { perMinute: 0.4, perDegree: 0.015 },
  TypeIII: { perMinute: 0.3, perDegree: 0.01 },
  TypeIV: { perMinute: 0.35, perDegree: 0.012 }
};

class RulesEngine {
  constructor(gameState) {
    this.state = gameState;
  }

  validateAssignment(flightId, padId, vehicleId) {
    const errors = [];
    const warnings = [];

    const flight = this.state.flights.find(f => f.id === flightId);
    const pad = this.state.pads.find(p => p.id === padId);
    const vehicle = this.state.vehicles.find(v => v.id === vehicleId);

    if (!flight) {
      errors.push('Flight not found');
      return { valid: false, errors, warnings };
    }

    if (!pad) {
      errors.push('Deicing pad not found');
      return { valid: false, errors, warnings };
    }

    if (!vehicle) {
      errors.push('Vehicle not found');
      return { valid: false, errors, warnings };
    }

    if (flight.status !== 'scheduled' &&
        flight.status !== 'boarding' &&
        flight.status !== 'delayed') {
      errors.push(`Flight is in ${flight.status} state, cannot assign to deicing`);
    }

    if (pad.status !== 'available') {
      errors.push(`Pad ${padId} is currently ${pad.status}`);
    }

    if (vehicle.status !== 'available') {
      errors.push(`Vehicle ${vehicleId} is currently ${vehicle.status}`);
    }

    const fluidInfo = this.state.fluidInventory[flight.fluidType];
    if (!fluidInfo || fluidInfo.available < flight.fluidRequired) {
      errors.push(`Insufficient ${flight.fluidType} fluid. Required: ${flight.fluidRequired}L, Available: ${fluidInfo?.available || 0}L`);
    }

    const timeToDeparture = this.getTimeToDeparture(flight);
    const windowConfig = this.isInternationalFlight(flight) ?
      DEICING_WINDOW.international : DEICING_WINDOW.domestic;

    if (timeToDeparture < windowConfig.after) {
      errors.push(`Flight departs in ${timeToDeparture} minutes - too late for deicing (window closes ${windowConfig.after}min before)`);
    }

    if (timeToDeparture > windowConfig.before + 30) {
      warnings.push(`Flight departs in ${timeToDeparture} minutes - deicing window opens in ${timeToDeparture - windowConfig.before} minutes`);
    }

    const aircraftConfig = AircraftConfig[flight.aircraftType];
    if (aircraftConfig) {
      if (flight.fluidRequired < aircraftConfig.fluidRange[0]) {
        warnings.push(`Fluid amount (${flight.fluidRequired}L) is below typical minimum for ${flight.aircraftType} (${aircraftConfig.fluidRange[0]}L)`);
      }
      if (flight.fluidRequired > aircraftConfig.fluidRange[1] * 1.2) {
        warnings.push(`Fluid amount (${flight.fluidRequired}L) exceeds typical maximum for ${flight.aircraftType} (${aircraftConfig.fluidRange[1]}L)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        flight,
        pad,
        vehicle,
        timeToDeparture,
        windowConfig,
        aircraftConfig
      }
    };
  }

  validateVehicleAssignment(vehicleId, padId, flightId) {
    const vehicle = this.state.vehicles.find(v => v.id === vehicleId);
    const pad = this.state.pads.find(p => p.id === padId);
    const flight = this.state.flights.find(f => f.id === flightId);

    const errors = [];
    const warnings = [];

    if (!vehicle) {
      errors.push('Vehicle not found');
      return { valid: false, errors, warnings };
    }

    if (!pad) {
      errors.push('Pad not found');
      return { valid: false, errors, warnings };
    }

    if (vehicle.status !== 'available') {
      errors.push(`Vehicle is ${vehicle.status}`);
    }

    if (pad.status !== 'available') {
      errors.push(`Pad is ${pad.status}`);
    }

    if (flight) {
      if (vehicle.currentFluid < flight.fluidRequired) {
        warnings.push(`Vehicle has insufficient fluid for this flight`);
      }
    }

    if (vehicle.currentFluid < 200) {
      warnings.push(`Vehicle fluid critically low (${vehicle.currentFluid}L)`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      vehicle,
      pad
    };
  }

  canStartDeicing(flightId, padId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    const pad = this.state.pads.find(p => p.id === padId);

    if (!flight || !pad) return false;

    if (pad.status !== 'available') return false;

    const timeToDeparture = this.getTimeToDeparture(flight);
    const windowConfig = this.isInternationalFlight(flight) ?
      DEICING_WINDOW.international : DEICING_WINDOW.domestic;

    return timeToDeparture >= windowConfig.after;
  }

  getTimeToDeparture(flight) {
    let departureTime = flight.departureTime;
    const currentTime = this.state.currentTime;
    const currentDay = this.state.dayOfOperation;

    if (departureTime < currentTime && currentDay === 1) {
      if (flight.specialEvent === 'midnight_flight') {
        departureTime += 1440;
      }
    }

    if (departureTime < currentTime) {
      const daysPassed = Math.floor((currentTime - departureTime) / 1440) + 1;
      departureTime += daysPassed * 1440;
    }

    return departureTime - currentTime;
  }

  isInternationalFlight(flight) {
    const intlDestinations = ['PEK', 'PVG', 'HKG', 'NRT', 'ICN', 'SIN', 'BKK', 'DXB', 'LHR', 'CDG', 'FRA', 'JFK', 'LAX'];
    return intlDestinations.some(dest => flight.destination.includes(dest));
  }

  checkDeicingWindow(flight) {
    const timeToDeparture = this.getTimeToDeparture(flight);
    const windowConfig = this.isInternationalFlight(flight) ?
      DEICING_WINDOW.international : DEICING_WINDOW.domestic;

    const windowStart = windowConfig.before;
    const windowEnd = windowConfig.after;

    if (timeToDeparture > windowStart) {
      return { status: 'too_early', timeToWindow: timeToDeparture - windowStart };
    }

    if (timeToDeparture <= windowStart && timeToDeparture > windowEnd) {
      return { status: 'in_window', timeRemaining: timeToDeparture - windowEnd };
    }

    if (timeToDeparture <= windowEnd) {
      return { status: 'window_closed', delay: windowEnd - timeToDeparture };
    }

    return { status: 'unknown' };
  }

  calculateDelayPenalty(flight) {
    if (flight.status === 'takeoff') {
      const actualDeparture = flight.actualDeparture || this.state.currentTime;
      const delay = actualDeparture - flight.departureTime;
      if (delay > 0) {
        return delay * 10;
      }
    }
    return 0;
  }

  checkPriorityConflicts(flightId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    if (!flight) return [];

    const conflicts = [];

    this.state.flights.forEach(otherFlight => {
      if (otherFlight.id === flightId) return;

      if (otherFlight.priority < flight.priority) {
        const timeDiff = Math.abs(this.getTimeToDeparture(flight) - this.getTimeToDeparture(otherFlight));
        if (timeDiff < 15) {
          conflicts.push({
            flight: otherFlight,
            reason: 'higher_priority_within_15min',
            urgency: flight.priority === 1 ? 'critical' : 'normal'
          });
        }
      }
    });

    return conflicts;
  }

  calculateScore() {
    let score = 0;
    const bonuses = [];
    const penalties = [];

    this.state.flights.forEach(flight => {
      if (flight.status === 'takeoff') {
        score += 100;

        const delay = (flight.actualDeparture || this.state.currentTime) - flight.departureTime;
        if (delay > 0) {
          penalties.push({ flight: flight.id, type: 'delay', amount: delay * 10 });
          score -= delay * 10;
        } else {
          const optimalWindow = this.checkDeicingWindow(flight);
          if (optimalWindow.status === 'in_window') {
            bonuses.push({ flight: flight.id, type: 'optimal_timing', amount: 50 });
            score += 50;
          }
        }

        if (flight.specialEvent === 'midnight_flight') {
          bonuses.push({ flight: flight.id, type: 'midnight_flight', amount: 100 });
          score += 100;
        }

        if (flight.specialEvent === 'return_flight') {
          bonuses.push({ flight: flight.id, type: 'return_handled', amount: 150 });
          score += 150;
        }
      } else if (flight.status === 'delayed' || flight.status === 'diverted') {
        penalties.push({ flight: flight.id, type: 'flight_failed', amount: 50 });
        score -= 50;
      }
    });

    const totalFlights = this.state.flights.length;
    const successfulFlights = this.state.flights.filter(f => f.status === 'takeoff').length;

    if (successfulFlights === totalFlights && totalFlights > 0) {
      bonuses.push({ type: 'all_flights_completed', amount: 200 });
      score += 200;
    }

    const remainingTime = this.state.timeRemaining || 0;
    if (remainingTime > this.state.level.objectives?.bonusTime) {
      const timeBonus = Math.floor(remainingTime / 10) * 10;
      bonuses.push({ type: 'time_remaining', amount: timeBonus });
      score += timeBonus;
    }

    return {
      total: Math.max(0, score),
      bonuses,
      penalties,
      breakdown: {
        successfulFlights,
        totalFlights,
        successRate: `${((successfulFlights / totalFlights) * 100).toFixed(1)}%`
      }
    };
  }

  validateGameEnd() {
    const flights = this.state.flights;
    const activeFlights = flights.filter(f =>
      f.status !== 'takeoff' &&
      f.status !== 'diverted' &&
      f.status !== 'cancelled'
    );

    if (activeFlights.length === 0) {
      return { canEnd: true, reason: 'all_flights_processed' };
    }

    const allDelayed = activeFlights.every(f =>
      f.status === 'delayed' &&
      this.getTimeToDeparture(f) < -30
    );

    if (allDelayed && activeFlights.length > 0) {
      return { canEnd: true, reason: 'all_flights_delayed' };
    }

    if (this.state.currentTime >= this.state.level.timeLimit) {
      return { canEnd: true, reason: 'time_expired' };
    }

    return { canEnd: false };
  }

  getAircraftConfig(aircraftType) {
    return AircraftConfig[aircraftType] || {
      fluidRange: [100, 200],
      processTime: 15,
      category: 'unknown'
    };
  }

  calculateFluidConsumption(flight, duration, temperature = -10) {
    const config = FLUID_CONSUMPTION_RATES[flight.fluidType] || FLUID_CONSUMPTION_RATES.TypeI;
    const baseConsumption = flight.fluidRequired;
    const timeConsumption = config.perMinute * duration;
    const tempConsumption = config.perDegree * Math.abs(temperature) * (duration / 60);

    return Math.ceil(baseConsumption + timeConsumption + tempConsumption);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AircraftConfig,
    DEICING_WINDOW,
    FLUID_CONSUMPTION_RATES,
    RulesEngine
  };
}