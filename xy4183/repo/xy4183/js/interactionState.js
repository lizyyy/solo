export class InteractionState {
  constructor() {
    this.mode = 'view';
    this.hazards = [];
    this.routeWaypoints = [];
    this.selectedHazard = null;
    this.selectedWaypoint = null;
    this.onHazardAdded = null;
    this.onHazardUpdated = null;
    this.onHazardDeleted = null;
    this.onRouteUpdated = null;
    this.onModeChanged = null;
  }

  setMode(mode) {
    const validModes = ['view', 'mark_hazard', 'plan_route'];
    if (!validModes.includes(mode)) {
      throw new Error(`无效模式: ${mode}，有效模式: ${validModes.join(', ')}`);
    }
    
    this.mode = mode;
    this.selectedHazard = null;
    this.selectedWaypoint = null;
    
    if (this.onModeChanged) {
      this.onModeChanged(mode);
    }
    
    return this.mode;
  }

  getMode() {
    return this.mode;
  }

  addHazard(hazard) {
    const newHazard = {
      id: hazard.id || `hazard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: hazard.type || 'unknown',
      location: hazard.location || { x: 0, y: 0, z: 0 },
      severity: hazard.severity || 'medium',
      description: hazard.description || '',
      radius: hazard.radius || 5,
      photos: hazard.photos || [],
      notes: hazard.notes || '',
      timestamp: hazard.timestamp || new Date().toISOString(),
      status: hazard.status || 'pending'
    };

    this.hazards.push(newHazard);
    this.selectedHazard = newHazard;

    if (this.onHazardAdded) {
      this.onHazardAdded(newHazard);
    }

    return newHazard;
  }

  updateHazard(hazardId, updates) {
    const index = this.hazards.findIndex(h => h.id === hazardId);
    if (index === -1) {
      throw new Error(`未找到隐患: ${hazardId}`);
    }

    this.hazards[index] = {
      ...this.hazards[index],
      ...updates,
      id: hazardId
    };

    if (this.onHazardUpdated) {
      this.onHazardUpdated(this.hazards[index]);
    }

    return this.hazards[index];
  }

  deleteHazard(hazardId) {
    const index = this.hazards.findIndex(h => h.id === hazardId);
    if (index === -1) {
      throw new Error(`未找到隐患: ${hazardId}`);
    }

    const deletedHazard = this.hazards.splice(index, 1)[0];

    if (this.selectedHazard?.id === hazardId) {
      this.selectedHazard = null;
    }

    if (this.onHazardDeleted) {
      this.onHazardDeleted(deletedHazard);
    }

    return deletedHazard;
  }

  getHazards(filters = {}) {
    let filtered = [...this.hazards];

    if (filters.type) {
      filtered = filtered.filter(h => h.type === filters.type);
    }

    if (filters.severity) {
      filtered = filtered.filter(h => h.severity === filters.severity);
    }

    if (filters.status) {
      filtered = filtered.filter(h => h.status === filters.status);
    }

    return filtered;
  }

  selectHazard(hazardId) {
    this.selectedHazard = this.hazards.find(h => h.id === hazardId) || null;
    return this.selectedHazard;
  }

  addRouteWaypoint(location) {
    const waypoint = {
      id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      location: { x: location.x, y: location.y, z: location.z },
      name: location.name || `点位 ${this.routeWaypoints.length + 1}`,
      notes: location.notes || '',
      estimatedTime: location.estimatedTime || null
    };

    this.routeWaypoints.push(waypoint);
    this.selectedWaypoint = waypoint;

    if (this.onRouteUpdated) {
      this.onRouteUpdated(this.routeWaypoints);
    }

    return waypoint;
  }

  insertRouteWaypoint(index, location) {
    if (index < 0 || index > this.routeWaypoints.length) {
      throw new Error(`插入位置无效: ${index}`);
    }

    const waypoint = {
      id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      location: { x: location.x, y: location.y, z: location.z },
      name: location.name || `点位 ${index + 1}`,
      notes: location.notes || '',
      estimatedTime: location.estimatedTime || null
    };

    this.routeWaypoints.splice(index, 0, waypoint);
    this.selectedWaypoint = waypoint;

    for (let i = index + 1; i < this.routeWaypoints.length; i++) {
      this.routeWaypoints[i].name = `点位 ${i + 1}`;
    }

    if (this.onRouteUpdated) {
      this.onRouteUpdated(this.routeWaypoints);
    }

    return waypoint;
  }

  updateRouteWaypoint(waypointId, updates) {
    const index = this.routeWaypoints.findIndex(w => w.id === waypointId);
    if (index === -1) {
      throw new Error(`未找到航点: ${waypointId}`);
    }

    this.routeWaypoints[index] = {
      ...this.routeWaypoints[index],
      ...updates,
      id: waypointId
    };

    if (this.onRouteUpdated) {
      this.onRouteUpdated(this.routeWaypoints);
    }

    return this.routeWaypoints[index];
  }

  deleteRouteWaypoint(waypointId) {
    const index = this.routeWaypoints.findIndex(w => w.id === waypointId);
    if (index === -1) {
      throw new Error(`未找到航点: ${waypointId}`);
    }

    const deletedWaypoint = this.routeWaypoints.splice(index, 1)[0];

    if (this.selectedWaypoint?.id === waypointId) {
      this.selectedWaypoint = null;
    }

    for (let i = index; i < this.routeWaypoints.length; i++) {
      this.routeWaypoints[i].name = `点位 ${i + 1}`;
    }

    if (this.onRouteUpdated) {
      this.onRouteUpdated(this.routeWaypoints);
    }

    return deletedWaypoint;
  }

  moveRouteWaypoint(waypointId, newIndex) {
    const currentIndex = this.routeWaypoints.findIndex(w => w.id === waypointId);
    if (currentIndex === -1) {
      throw new Error(`未找到航点: ${waypointId}`);
    }

    if (newIndex < 0 || newIndex >= this.routeWaypoints.length) {
      throw new Error(`目标位置无效: ${newIndex}`);
    }

    const [waypoint] = this.routeWaypoints.splice(currentIndex, 1);
    this.routeWaypoints.splice(newIndex, 0, waypoint);

    for (let i = 0; i < this.routeWaypoints.length; i++) {
      this.routeWaypoints[i].name = `点位 ${i + 1}`;
    }

    if (this.onRouteUpdated) {
      this.onRouteUpdated(this.routeWaypoints);
    }

    return this.routeWaypoints;
  }

  clearRoute() {
    const oldRoute = [...this.routeWaypoints];
    this.routeWaypoints = [];
    this.selectedWaypoint = null;

    if (this.onRouteUpdated) {
      this.onRouteUpdated(this.routeWaypoints);
    }

    return oldRoute;
  }

  getRouteWaypoints() {
    return [...this.routeWaypoints];
  }

  calculateRouteDistance() {
    if (this.routeWaypoints.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < this.routeWaypoints.length; i++) {
      const prev = this.routeWaypoints[i - 1].location;
      const curr = this.routeWaypoints[i].location;
      
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dz = curr.z - prev.z;
      
      totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    return totalDistance;
  }

  estimateRouteTime(avgSpeedKmh = 10) {
    const distanceKm = this.calculateRouteDistance() / 1000;
    const hazardCount = this.hazards.filter(h => h.status !== 'resolved').length;
    const hazardDelayMinutes = hazardCount * 5;

    const travelTimeHours = distanceKm / avgSpeedKmh;
    const travelTimeMinutes = travelTimeHours * 60;
    const totalMinutes = travelTimeMinutes + hazardDelayMinutes;

    return {
      distance: distanceKm,
      travelTimeMinutes: Math.round(travelTimeMinutes),
      hazardDelayMinutes,
      totalMinutes: Math.round(totalMinutes),
      hazardCount
    };
  }

  getState() {
    return {
      mode: this.mode,
      hazards: [...this.hazards],
      routeWaypoints: [...this.routeWaypoints],
      selectedHazard: this.selectedHazard,
      selectedWaypoint: this.selectedWaypoint
    };
  }

  loadState(state) {
    if (state.mode) {
      this.mode = state.mode;
    }
    if (state.hazards) {
      this.hazards = [...state.hazards];
    }
    if (state.routeWaypoints) {
      this.routeWaypoints = [...state.routeWaypoints];
    }
    this.selectedHazard = state.selectedHazard || null;
    this.selectedWaypoint = state.selectedWaypoint || null;

    if (this.onHazardAdded) {
      this.hazards.forEach(h => this.onHazardAdded(h));
    }
    if (this.onRouteUpdated) {
      this.onRouteUpdated(this.routeWaypoints);
    }
  }

  reset() {
    this.mode = 'view';
    this.hazards = [];
    this.routeWaypoints = [];
    this.selectedHazard = null;
    this.selectedWaypoint = null;
  }

  getStatistics() {
    const hazardStats = {
      total: this.hazards.length,
      byType: {},
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      byStatus: { pending: 0, in_progress: 0, resolved: 0 }
    };

    for (const hazard of this.hazards) {
      hazardStats.byType[hazard.type] = (hazardStats.byType[hazard.type] || 0) + 1;
      hazardStats.bySeverity[hazard.severity] = (hazardStats.bySeverity[hazard.severity] || 0) + 1;
      hazardStats.byStatus[hazard.status] = (hazardStats.byStatus[hazard.status] || 0) + 1;
    }

    const routeStats = {
      waypointCount: this.routeWaypoints.length,
      distance: this.calculateRouteDistance(),
      estimatedTime: this.estimateRouteTime()
    };

    return {
      hazards: hazardStats,
      route: routeStats
    };
  }
}
