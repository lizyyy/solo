const { v4: uuidv4 } = require('uuid');

const BOUNDARY_RULES = {
  MAX_TEMPERATURE_DIFF: 15,
  MIN_ZONE_HEIGHT: 0.5,
  MAX_ZONE_HEIGHT: 10,
  OVERLAP_THRESHOLD: 0.05,
  WAREHOUSE_BOUNDS: {
    minX: 0, maxX: 100,
    minY: 0, maxY: 100,
    minZ: 0, maxZ: 20
  }
};

class TemperatureZone3D {
  constructor(data) {
    this.id = uuidv4();
    this.name = data.name || '';
    this.layerId = data.layerId || null;
    this.routeId = data.routeId || null;
    this.createdAt = new Date().toISOString();
    this.createdBy = data.createdBy || '';
    this.bounds = {
      minX: data.bounds?.minX ?? 0,
      maxX: data.bounds?.maxX ?? 0,
      minY: data.bounds?.minY ?? 0,
      maxY: data.bounds?.maxY ?? 0,
      minZ: data.bounds?.minZ ?? 0,
      maxZ: data.bounds?.maxZ ?? 0
    };
    this.temperatureRange = {
      min: data.temperatureRange?.min ?? 0,
      max: data.temperatureRange?.max ?? 0
    };
    this.color = data.color || '#ffffff';
    this.sensors = data.sensors || [];
    this.remark = data.remark || '';
    this.status = 'draft';
    this.validationErrors = [];
  }

  validateBounds() {
    const errors = [];
    const { WAREHOUSE_BOUNDS, MAX_TEMPERATURE_DIFF, MIN_ZONE_HEIGHT, MAX_ZONE_HEIGHT } = BOUNDARY_RULES;

    if (this.bounds.minX < WAREHOUSE_BOUNDS.minX || this.bounds.maxX > WAREHOUSE_BOUNDS.maxX) {
      errors.push(`温区X坐标超出冷链库范围(${WAREHOUSE_BOUNDS.minX}-${WAREHOUSE_BOUNDS.maxX})`);
    }
    if (this.bounds.minY < WAREHOUSE_BOUNDS.minY || this.bounds.maxY > WAREHOUSE_BOUNDS.maxY) {
      errors.push(`温区Y坐标超出冷链库范围(${WAREHOUSE_BOUNDS.minY}-${WAREHOUSE_BOUNDS.maxY})`);
    }
    if (this.bounds.minZ < WAREHOUSE_BOUNDS.minZ || this.bounds.maxZ > WAREHOUSE_BOUNDS.maxZ) {
      errors.push(`温区Z坐标超出冷链库范围(${WAREHOUSE_BOUNDS.minZ}-${WAREHOUSE_BOUNDS.maxZ})`);
    }

    const height = this.bounds.maxZ - this.bounds.minZ;
    if (height < MIN_ZONE_HEIGHT) {
      errors.push(`温区高度(${height}m)小于最小要求(${MIN_ZONE_HEIGHT}m)`);
    }
    if (height > MAX_ZONE_HEIGHT) {
      errors.push(`温区高度(${height}m)超过最大限制(${MAX_ZONE_HEIGHT}m)`);
    }

    const tempDiff = this.temperatureRange.max - this.temperatureRange.min;
    if (tempDiff > MAX_TEMPERATURE_DIFF) {
      errors.push(`温区温差(${tempDiff}°C)超过最大允许值(${MAX_TEMPERATURE_DIFF}°C)`);
    }

    this.validationErrors = errors;
    return errors.length === 0;
  }

  checkOverlap(otherZone) {
    const { OVERLAP_THRESHOLD } = BOUNDARY_RULES;
    const overlap = {
      x: Math.max(0, Math.min(this.bounds.maxX, otherZone.bounds.maxX) - Math.max(this.bounds.minX, otherZone.bounds.minX)),
      y: Math.max(0, Math.min(this.bounds.maxY, otherZone.bounds.maxY) - Math.max(this.bounds.minY, otherZone.bounds.minY)),
      z: Math.max(0, Math.min(this.bounds.maxZ, otherZone.bounds.maxZ) - Math.max(this.bounds.minZ, otherZone.bounds.minZ))
    };
    const overlapVolume = overlap.x * overlap.y * overlap.z;
    const thisVolume = (this.bounds.maxX - this.bounds.minX) * (this.bounds.maxY - this.bounds.minY) * (this.bounds.maxZ - this.bounds.minZ);
    const otherVolume = (otherZone.bounds.maxX - otherZone.bounds.minX) * (otherZone.bounds.maxY - otherZone.bounds.minY) * (otherZone.bounds.maxZ - otherZone.bounds.minZ);
    const maxVolume = Math.max(thisVolume, otherVolume);
    return overlapVolume > maxVolume * OVERLAP_THRESHOLD;
  }

  static getBoundaryRules() {
    return { ...BOUNDARY_RULES };
  }
}

module.exports = { TemperatureZone3D, BOUNDARY_RULES };
