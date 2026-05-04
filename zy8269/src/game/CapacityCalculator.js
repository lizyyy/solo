class CapacityCalculator {
  constructor(game) {
    this.game = game;
  }
  
  calculateAreaCapacity(areaName) {
    const area = this.game.areas[areaName];
    if (!area) return { current: 0, capacity: 0, utilization: 0 };
    
    const current = this.game.passengers.filter(p => p.area === areaName).length;
    const capacity = area.capacity;
    const utilization = capacity > 0 ? current / capacity : 0;
    
    return {
      current,
      capacity,
      utilization,
      status: this.getCapacityStatus(utilization)
    };
  }
  
  getCapacityStatus(utilization) {
    if (utilization > 0.95) return 'critical';
    if (utilization > 0.85) return 'danger';
    if (utilization > 0.7) return 'warning';
    if (utilization > 0.5) return 'moderate';
    return 'safe';
  }
  
  calculateAllAreas() {
    const results = {};
    for (const name in this.game.areas) {
      results[name] = this.calculateAreaCapacity(name);
    }
    return results;
  }
  
  getOvercrowdedAreas() {
    const overcrowded = [];
    for (const [name, area] of Object.entries(this.game.areas)) {
      const capacity = this.calculateAreaCapacity(name);
      if (capacity.utilization > 0.85) {
        overcrowded.push({
          name,
          ...capacity,
          area
        });
      }
    }
    return overcrowded;
  }
  
  getBottlenecks() {
    const bottlenecks = [];
    
    const gates = this.game.objects.filter(o => o.type === 'gate');
    gates.forEach(gate => {
      const nearbyPassengers = this.getPassengersNearObject(gate, 50);
      const throughput = gate.state === 'open' ? 
        (gate.accessibility ? 2 : 1) : 0;
      
      if (nearbyPassengers.length > throughput * 10 && gate.state === 'open') {
        bottlenecks.push({
          type: 'gate',
          object: gate,
          waiting: nearbyPassengers.length,
          throughput
        });
      }
      
      if (nearbyPassengers.length > 20 && gate.state === 'closed') {
        bottlenecks.push({
          type: 'closed_gate',
          object: gate,
          waiting: nearbyPassengers.length,
          message: '建议打开此闸机缓解人流'
        });
      }
    });
    
    const escalators = this.game.objects.filter(o => o.type === 'escalator');
    escalators.forEach(escalator => {
      const nearbyPassengers = this.getPassengersNearObject(escalator, 80);
      
      if (nearbyPassengers.length > 30) {
        bottlenecks.push({
          type: 'escalator',
          object: escalator,
          waiting: nearbyPassengers.length
        });
      }
    });
    
    return bottlenecks;
  }
  
  getPassengersNearObject(obj, radius) {
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    
    return this.game.passengers.filter(p => {
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      return Math.sqrt(dx * dx + dy * dy) < radius;
    });
  }
  
  getPassengerDensity(x, y, radius) {
    const passengers = this.game.passengers.filter(p => {
      const dx = p.x - x;
      const dy = p.y - y;
      return Math.sqrt(dx * dx + dy * dy) < radius;
    });
    
    const area = Math.PI * radius * radius;
    return passengers.length / (area / 100);
  }
  
  checkStationCapacity() {
    let totalCurrent = 0;
    let totalCapacity = 0;
    
    for (const area of Object.values(this.game.areas)) {
      totalCurrent += this.game.passengers.filter(p => p.area === area.name).length;
      totalCapacity += area.capacity;
    }
    
    return {
      totalCurrent,
      totalCapacity,
      totalUtilization: totalCapacity > 0 ? totalCurrent / totalCapacity : 0
    };
  }
  
  calculateWaitTime(areaName) {
    const area = this.game.areas[areaName];
    if (!area) return 0;
    
    const passengers = this.game.passengers.filter(p => p.area === areaName);
    const throughput = this.calculateThroughput(areaName);
    
    if (throughput === 0) return Infinity;
    
    return passengers.length / throughput * 10;
  }
  
  calculateThroughput(areaName) {
    if (areaName.includes('entrance') || areaName.includes('concourse')) {
      const openGates = this.game.objects.filter(o => 
        o.type === 'gate' && o.state === 'open'
      );
      return openGates.reduce((sum, gate) => {
        return sum + (gate.accessibility ? 0.5 : 1);
      }, 0);
    }
    
    if (areaName.includes('platform')) {
      const escalators = this.game.objects.filter(o => 
        o.type === 'escalator' && o.direction === 'down'
      );
      return escalators.length * 2;
    }
    
    return 1;
  }
}

export default CapacityCalculator;
