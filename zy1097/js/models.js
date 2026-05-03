export class Warehouse {
  constructor(data) {
    this.name = data.name || '未命名仓库';
    this.dimensions = data.dimensions || { width: 10, height: 10, unit: '米' };
    this.shelves = (data.shelves || []).map(s => new Shelf(s));
    this.aisles = (data.aisles || []).map(a => new Aisle(a));
    this.packingStations = (data.packingStations || []).map(p => new PackingStation(p));
    this.pickStart = data.pickStart || { x: 0, y: 0, description: '拣货起点' };
  }

  getPrimaryPackingStation() {
    return this.packingStations.find(p => p.isPrimary) || this.packingStations[0] || null;
  }

  getShelfById(id) {
    return this.shelves.find(s => s.id === id);
  }

  toJSON() {
    return {
      name: this.name,
      dimensions: this.dimensions,
      shelves: this.shelves.map(s => s.toJSON()),
      aisles: this.aisles.map(a => a.toJSON()),
      packingStations: this.packingStations.map(p => p.toJSON()),
      pickStart: this.pickStart
    };
  }
}

export class Shelf {
  constructor(data) {
    this.id = data.id || `shelf-${Date.now()}`;
    this.name = data.name || '货架';
    this.x = data.x ?? 0;
    this.y = data.y ?? 0;
    this.width = data.width ?? 2;
    this.depth = data.depth ?? 0.8;
    this.levels = data.levels ?? 4;
    this.orientation = data.orientation || 'horizontal';
    this.zone = data.zone || 'A';
  }

  getCenter() {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.depth / 2
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      width: this.width,
      depth: this.depth,
      levels: this.levels,
      orientation: this.orientation,
      zone: this.zone
    };
  }
}

export class Aisle {
  constructor(data) {
    this.id = data.id || `aisle-${Date.now()}`;
    this.name = data.name || '通道';
    this.x = data.x ?? 0;
    this.y = data.y ?? 0;
    this.width = data.width ?? 1;
    this.depth = data.depth ?? 1;
    this.type = data.type || 'shelf';
  }

  getCenter() {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.depth / 2
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      width: this.width,
      depth: this.depth,
      type: this.type
    };
  }
}

export class PackingStation {
  constructor(data) {
    this.id = data.id || `packing-${Date.now()}`;
    this.name = data.name || '打包台';
    this.x = data.x ?? 0;
    this.y = data.y ?? 0;
    this.width = data.width ?? 1.5;
    this.depth = data.depth ?? 1;
    this.isPrimary = data.isPrimary ?? false;
  }

  getCenter() {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.depth / 2
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      width: this.width,
      depth: this.depth,
      isPrimary: this.isPrimary
    };
  }
}

export class SKULocation {
  constructor(data) {
    this.skuCode = data.sku_code || data.skuCode || '';
    this.skuName = data.sku_name || data.skuName || '';
    this.shelfId = data.shelf_id || data.shelfId || '';
    this.location = data.location || '';
    this.quantity = parseInt(data.quantity) || 0;
    this.reorderThreshold = parseInt(data.reorder_threshold) || parseInt(data.reorderThreshold) || 5;
    this.hotRank = parseInt(data.hot_rank) || parseInt(data.hotRank) || 999;
  }

  isLowStock() {
    return this.quantity <= this.reorderThreshold;
  }

  toJSON() {
    return {
      skuCode: this.skuCode,
      skuName: this.skuName,
      shelfId: this.shelfId,
      location: this.location,
      quantity: this.quantity,
      reorderThreshold: this.reorderThreshold,
      hotRank: this.hotRank
    };
  }
}

export class Order {
  constructor(data) {
    this.orderId = data.order_id || data.orderId || '';
    this.customerName = data.customer_name || data.customerName || '';
    this.orderDate = data.order_date || data.orderDate || '';
    this.items = [];
    this.notes = data.notes || '';
    this.selected = false;
  }

  addItem(item) {
    this.items.push({
      skuCode: item.sku_code || item.skuCode,
      quantity: parseInt(item.quantity) || 1
    });
  }

  getTotalSKUs() {
    return this.items.length;
  }

  getTotalQuantity() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  toJSON() {
    return {
      orderId: this.orderId,
      customerName: this.customerName,
      orderDate: this.orderDate,
      items: this.items,
      notes: this.notes
    };
  }
}

export class RoutePoint {
  constructor(data) {
    this.x = data.x ?? 0;
    this.y = data.y ?? 0;
    this.type = data.type || 'waypoint';
    this.label = data.label || '';
    this.shelfId = data.shelfId || null;
    this.skuCodes = data.skuCodes || [];
    this.orderIds = data.orderIds || [];
  }
}

export class PickerRoute {
  constructor(pickerId) {
    this.pickerId = pickerId;
    this.points = [];
    this.totalDistance = 0;
    this.backtrackDistance = 0;
    this.turnCount = 0;
    this.visitedShelves = new Set();
    this.aisleCounts = new Map();
    this.assignedOrders = [];
  }

  addPoint(point) {
    if (this.points.length > 0) {
      const lastPoint = this.points[this.points.length - 1];
      const dist = Math.sqrt(
        Math.pow(point.x - lastPoint.x, 2) +
        Math.pow(point.y - lastPoint.y, 2)
      );
      this.totalDistance += dist;
    }
    
    if (point.shelfId) {
      this.visitedShelves.add(point.shelfId);
    }
    
    this.points.push(point);
  }

  toJSON() {
    return {
      pickerId: this.pickerId,
      points: this.points,
      totalDistance: this.totalDistance,
      backtrackDistance: this.backtrackDistance,
      turnCount: this.turnCount,
      visitedShelves: Array.from(this.visitedShelves),
      aisleCounts: Object.fromEntries(this.aisleCounts),
      assignedOrders: this.assignedOrders
    };
  }
}

export class RouteAnalysis {
  constructor() {
    this.totalDistance = 0;
    this.avgDistancePerPicker = 0;
    this.backtrackDistance = 0;
    this.backtrackRatio = 0;
    this.hotspots = [];
    this.turnCount = 0;
    this.uniqueShelvesVisited = 0;
    this.pickerRoutes = [];
  }
}

export class OptimizationSuggestion {
  constructor(data) {
    this.type = data.type || 'relocation';
    this.skuCode = data.skuCode || '';
    this.skuName = data.skuName || '';
    this.currentLocation = data.currentLocation || '';
    this.suggestedLocation = data.suggestedLocation || '';
    this.reason = data.reason || '';
    this.estimatedSaving = data.estimatedSaving || 0;
  }
}
