import { RoutePoint, PickerRoute, RouteAnalysis, OptimizationSuggestion } from './models.js';

export class RoutePlanner {
  constructor(warehouse, skus, orders) {
    this.warehouse = warehouse;
    this.skus = skus;
    this.orders = orders;
    this.skuMap = new Map();
    this.skuToShelf = new Map();
    
    skus.forEach(sku => {
      this.skuMap.set(sku.skuCode, sku);
      if (sku.shelfId) {
        if (!this.skuToShelf.has(sku.skuCode)) {
          this.skuToShelf.set(sku.skuCode, sku.shelfId);
        }
      }
    });
  }

  getShelfBySKU(skuCode) {
    const shelfId = this.skuToShelf.get(skuCode);
    if (!shelfId) return null;
    return this.warehouse.getShelfById(shelfId);
  }

  getSKUByCode(skuCode) {
    return this.skuMap.get(skuCode);
  }

  calculateDistance(point1, point2) {
    return Math.sqrt(
      Math.pow(point1.x - point2.x, 2) +
      Math.pow(point1.y - point2.y, 2)
    );
  }

  findNearestPoint(fromPoint, availablePoints) {
    let nearest = null;
    let minDist = Infinity;
    
    availablePoints.forEach(point => {
      const dist = this.calculateDistance(fromPoint, point);
      if (dist < minDist) {
        minDist = dist;
        nearest = point;
      }
    });
    
    return { point: nearest, distance: minDist };
  }

  planRouteForOrder(order, startPoint, packingStation) {
    const route = new PickerRoute(0);
    route.assignedOrders = [order.orderId];
    
    route.addPoint(new RoutePoint({
      x: startPoint.x,
      y: startPoint.y,
      type: 'start',
      label: '拣货起点'
    }));

    const pickPoints = [];
    const missingSKUs = [];
    const lowStockSKUs = [];

    order.items.forEach(item => {
      const shelf = this.getShelfBySKU(item.skuCode);
      const sku = this.getSKUByCode(item.skuCode);
      
      if (!shelf) {
        missingSKUs.push({
          skuCode: item.skuCode,
          quantity: item.quantity
        });
        return;
      }

      if (sku && sku.quantity < item.quantity) {
        lowStockSKUs.push({
          skuCode: item.skuCode,
          skuName: sku.skuName,
          available: sku.quantity,
          required: item.quantity
        });
      }

      const center = shelf.getCenter();
      pickPoints.push(new RoutePoint({
        x: center.x,
        y: center.y,
        type: 'pick',
        label: `${shelf.name} - ${item.skuCode}`,
        shelfId: shelf.id,
        skuCodes: [item.skuCode],
        orderIds: [order.orderId]
      }));
    });

    const remainingPoints = [...pickPoints];
    let currentPoint = startPoint;

    while (remainingPoints.length > 0) {
      const { point: nearest, distance } = this.findNearestPoint(currentPoint, remainingPoints);
      if (nearest) {
        route.addPoint(nearest);
        currentPoint = { x: nearest.x, y: nearest.y };
        const index = remainingPoints.indexOf(nearest);
        if (index > -1) {
          remainingPoints.splice(index, 1);
        }
      } else {
        break;
      }
    }

    if (packingStation) {
      const packCenter = packingStation.getCenter();
      route.addPoint(new RoutePoint({
        x: packCenter.x,
        y: packCenter.y,
        type: 'packing',
        label: packingStation.name
      }));
    }

    return {
      route,
      missingSKUs,
      lowStockSKUs
    };
  }

  planMultiPickerRoutes(selectedOrders, pickerCount, algorithm = 'nearest') {
    const startPoint = this.warehouse.pickStart;
    const packingStation = this.warehouse.getPrimaryPackingStation();
    
    const allPickPoints = this.collectPickPoints(selectedOrders);
    const shelvesWithOrders = this.groupByShelf(allPickPoints);
    
    let pickerRoutes = [];
    
    if (algorithm === 'cluster' || algorithm === 'zone') {
      pickerRoutes = this.planByZone(shelvesWithOrders, selectedOrders, pickerCount, startPoint, packingStation);
    } else {
      pickerRoutes = this.planByNearest(shelvesWithOrders, selectedOrders, pickerCount, startPoint, packingStation);
    }

    const analysis = this.analyzeRoutes(pickerRoutes, selectedOrders);
    
    return {
      routes: pickerRoutes,
      analysis,
      hotspots: this.identifyHotspots(pickerRoutes),
      suggestions: this.generateOptimizationSuggestions(pickerRoutes, selectedOrders)
    };
  }

  collectPickPoints(orders) {
    const points = [];
    
    orders.forEach(order => {
      order.items.forEach(item => {
        const shelf = this.getShelfBySKU(item.skuCode);
        const sku = this.getSKUByCode(item.skuCode);
        
        if (shelf) {
          const center = shelf.getCenter();
          points.push({
            x: center.x,
            y: center.y,
            shelfId: shelf.id,
            shelf: shelf,
            skuCode: item.skuCode,
            sku: sku,
            orderId: order.orderId,
            quantity: item.quantity
          });
        }
      });
    });
    
    return points;
  }

  groupByShelf(pickPoints) {
    const shelfMap = new Map();
    
    pickPoints.forEach(point => {
      if (!shelfMap.has(point.shelfId)) {
        shelfMap.set(point.shelfId, {
          shelf: point.shelf,
          x: point.x,
          y: point.y,
          shelfId: point.shelfId,
          skuCodes: new Set(),
          orderIds: new Set(),
          items: []
        });
      }
      
      const group = shelfMap.get(point.shelfId);
      group.skuCodes.add(point.skuCode);
      group.orderIds.add(point.orderId);
      group.items.push(point);
    });
    
    return Array.from(shelfMap.values());
  }

  planByNearest(shelfGroups, orders, pickerCount, startPoint, packingStation) {
    const routes = [];
    
    for (let i = 0; i < pickerCount; i++) {
      routes.push(new PickerRoute(i + 1));
    }

    const orderBatches = this.batchOrders(orders, pickerCount);
    
    orderBatches.forEach((batch, index) => {
      if (batch.length === 0) return;
      
      const route = routes[index];
      route.assignedOrders = batch.map(o => o.orderId);
      
      const batchPickPoints = this.collectPickPoints(batch);
      const batchShelfGroups = this.groupByShelf(batchPickPoints);
      
      route.addPoint(new RoutePoint({
        x: startPoint.x,
        y: startPoint.y,
        type: 'start',
        label: '拣货起点'
      }));

      const remainingGroups = [...batchShelfGroups];
      let currentPoint = startPoint;

      while (remainingGroups.length > 0) {
        const { point: nearest, distance } = this.findNearestPoint(
          currentPoint,
          remainingGroups.map(g => ({ x: g.x, y: g.y, group: g }))
        );
        
        if (nearest) {
          const group = nearest.group;
          route.addPoint(new RoutePoint({
            x: group.x,
            y: group.y,
            type: 'pick',
            label: group.shelf.name,
            shelfId: group.shelfId,
            skuCodes: Array.from(group.skuCodes),
            orderIds: Array.from(group.orderIds)
          }));
          
          currentPoint = { x: group.x, y: group.y };
          const idx = remainingGroups.indexOf(group);
          if (idx > -1) remainingGroups.splice(idx, 1);
        } else {
          break;
        }
      }

      if (packingStation) {
        const packCenter = packingStation.getCenter();
        route.addPoint(new RoutePoint({
          x: packCenter.x,
          y: packCenter.y,
          type: 'packing',
          label: packingStation.name
        }));
      }
    });

    return routes.filter(r => r.points.length > 1);
  }

  planByZone(shelfGroups, orders, pickerCount, startPoint, packingStation) {
    const zones = this.groupByZone(shelfGroups);
    const zoneKeys = Array.from(zones.keys());
    const routes = [];
    
    for (let i = 0; i < pickerCount; i++) {
      routes.push(new PickerRoute(i + 1));
    }

    const orderBatches = this.batchOrders(orders, pickerCount);
    
    orderBatches.forEach((batch, index) => {
      if (batch.length === 0) return;
      
      const route = routes[index];
      route.assignedOrders = batch.map(o => o.orderId);
      
      const batchPickPoints = this.collectPickPoints(batch);
      const batchShelfGroups = this.groupByShelf(batchPickPoints);
      const batchZones = this.groupByZone(batchShelfGroups);
      
      route.addPoint(new RoutePoint({
        x: startPoint.x,
        y: startPoint.y,
        type: 'start',
        label: '拣货起点'
      }));

      const sortedZones = Array.from(batchZones.keys()).sort();
      
      sortedZones.forEach(zone => {
        const zoneGroups = batchZones.get(zone);
        zoneGroups.sort((a, b) => a.y - b.y);
        
        zoneGroups.forEach(group => {
          route.addPoint(new RoutePoint({
            x: group.x,
            y: group.y,
            type: 'pick',
            label: group.shelf.name,
            shelfId: group.shelfId,
            skuCodes: Array.from(group.skuCodes),
            orderIds: Array.from(group.orderIds)
          }));
        });
      });

      if (packingStation) {
        const packCenter = packingStation.getCenter();
        route.addPoint(new RoutePoint({
          x: packCenter.x,
          y: packCenter.y,
          type: 'packing',
          label: packingStation.name
        }));
      }
    });

    return routes.filter(r => r.points.length > 1);
  }

  groupByZone(shelfGroups) {
    const zones = new Map();
    
    shelfGroups.forEach(group => {
      const zone = group.shelf.zone || 'A';
      if (!zones.has(zone)) {
        zones.set(zone, []);
      }
      zones.get(zone).push(group);
    });
    
    return zones;
  }

  batchOrders(orders, batchCount) {
    const batches = [];
    for (let i = 0; i < batchCount; i++) {
      batches.push([]);
    }
    
    orders.forEach((order, index) => {
      batches[index % batchCount].push(order);
    });
    
    return batches;
  }

  analyzeRoutes(routes, orders) {
    const analysis = new RouteAnalysis();
    analysis.pickerRoutes = routes;
    
    let totalDistance = 0;
    let totalTurns = 0;
    const allVisitedShelves = new Set();
    
    routes.forEach(route => {
      totalDistance += route.totalDistance;
      totalTurns += this.countTurns(route.points);
      route.visitedShelves.forEach(s => allVisitedShelves.add(s));
    });
    
    analysis.totalDistance = parseFloat(totalDistance.toFixed(2));
    analysis.avgDistancePerPicker = routes.length > 0 
      ? parseFloat((totalDistance / routes.length).toFixed(2)) 
      : 0;
    analysis.turnCount = totalTurns;
    analysis.uniqueShelvesVisited = allVisitedShelves.size;
    
    analysis.backtrackDistance = this.calculateBacktrack(routes);
    analysis.backtrackRatio = totalDistance > 0 
      ? parseFloat((analysis.backtrackDistance / totalDistance).toFixed(2)) 
      : 0;
    
    return analysis;
  }

  countTurns(points) {
    if (points.length < 3) return 0;
    
    let turns = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const prev = { x: points[i].x - points[i-1].x, y: points[i].y - points[i-1].y };
      const next = { x: points[i+1].x - points[i].x, y: points[i+1].y - points[i].y };
      
      const cross = prev.x * next.y - prev.y * next.x;
      if (Math.abs(cross) > 0.01) {
        turns++;
      }
    }
    
    return turns;
  }

  calculateBacktrack(routes) {
    const pathSegments = new Map();
    
    routes.forEach(route => {
      for (let i = 0; i < route.points.length - 1; i++) {
        const from = route.points[i];
        const to = route.points[i + 1];
        
        const key = this.getSegmentKey(from, to);
        const count = pathSegments.get(key) || 0;
        pathSegments.set(key, count + 1);
      }
    });
    
    let backtrackDist = 0;
    pathSegments.forEach((count, key) => {
      if (count > 1) {
        const [fromX, fromY, toX, toY] = key.split('_').map(Number);
        const dist = Math.sqrt(
          Math.pow(toX - fromX, 2) +
          Math.pow(toY - fromY, 2)
        );
        backtrackDist += dist * (count - 1);
      }
    });
    
    return parseFloat(backtrackDist.toFixed(2));
  }

  getSegmentKey(from, to) {
    const x1 = Math.min(from.x, to.x);
    const y1 = Math.min(from.y, to.y);
    const x2 = Math.max(from.x, to.x);
    const y2 = Math.max(from.y, to.y);
    return `${x1}_${y1}_${x2}_${y2}`;
  }

  identifyHotspots(routes) {
    const hotspots = [];
    const aisleTraffic = new Map();
    const pointCounts = new Map();

    routes.forEach(route => {
      for (let i = 0; i < route.points.length - 1; i++) {
        const from = route.points[i];
        const to = route.points[i + 1];
        
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        
        const nearestAisle = this.findNearestAisle(midX, midY);
        if (nearestAisle) {
          const count = aisleTraffic.get(nearestAisle.id) || 0;
          aisleTraffic.set(nearestAisle.id, count + 1);
        }
      }

      route.points.forEach(point => {
        if (point.shelfId) {
          const key = `${point.x}_${point.y}`;
          const count = pointCounts.get(key) || 0;
          pointCounts.set(key, count + 1);
        }
      });
    });

    const pickerCount = routes.length;
    if (pickerCount > 1) {
      aisleTraffic.forEach((count, aisleId) => {
        if (count >= pickerCount * 2) {
          const aisle = this.warehouse.aisles.find(a => a.id === aisleId);
          if (aisle) {
            hotspots.push({
              type: 'aisle',
              id: aisleId,
              name: aisle.name,
              x: aisle.getCenter().x,
              y: aisle.getCenter().y,
              trafficCount: count,
              severity: count >= pickerCount * 3 ? 'high' : 'medium',
              description: `通道 ${aisle.name} 被经过 ${count} 次，可能发生拥堵`
            });
          }
        }
      });
    }

    pointCounts.forEach((count, key) => {
      if (count >= 2) {
        const [x, y] = key.split('_').map(Number);
        hotspots.push({
          type: 'pick',
          x,
          y,
          pickCount: count,
          severity: count >= 4 ? 'high' : 'medium',
          description: `该拣货点被 ${count} 个拣货员访问`
        });
      }
    });

    return hotspots.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  findNearestAisle(x, y) {
    let nearest = null;
    let minDist = Infinity;
    
    this.warehouse.aisles.forEach(aisle => {
      const center = aisle.getCenter();
      const dist = Math.sqrt(
        Math.pow(center.x - x, 2) +
        Math.pow(center.y - y, 2)
      );
      
      if (dist < minDist) {
        minDist = dist;
        nearest = aisle;
      }
    });
    
    return minDist < 2 ? nearest : null;
  }

  generateOptimizationSuggestions(routes, orders) {
    const suggestions = [];
    
    const hotSKUs = this.identifyHotSKUs(orders);
    
    const packingStation = this.warehouse.getPrimaryPackingStation();
    if (!packingStation) return suggestions;
    
    const packCenter = packingStation.getCenter();
    
    hotSKUs.forEach(hot => {
      const sku = this.getSKUByCode(hot.skuCode);
      if (!sku) return;
      
      const shelf = this.getShelfBySKU(hot.skuCode);
      if (!shelf) return;
      
      const shelfCenter = shelf.getCenter();
      const distanceToPack = this.calculateDistance(shelfCenter, packCenter);
      
      if (distanceToPack > 4) {
        suggestions.push(new OptimizationSuggestion({
          type: 'relocation',
          skuCode: hot.skuCode,
          skuName: sku.skuName,
          currentLocation: `${shelf.name} (${shelf.zone}区)`,
          suggestedLocation: '靠近打包台的货架',
          reason: `该 SKU 是热销商品（订单出现 ${hot.count} 次），但距离打包台较远（${distanceToPack.toFixed(1)} 米）`,
          estimatedSaving: Math.round(distanceToPack * hot.count * 2)
        }));
      }
    });

    const lowStockSKUs = this.skus.filter(sku => sku.isLowStock());
    lowStockSKUs.forEach(sku => {
      suggestions.push(new OptimizationSuggestion({
        type: 'reorder',
        skuCode: sku.skuCode,
        skuName: sku.skuName,
        currentLocation: sku.location,
        reason: `库存（${sku.quantity}）低于补货阈值（${sku.reorderThreshold}）`,
        estimatedSaving: 0
      }));
    });

    return suggestions.sort((a, b) => {
      if (a.type === 'reorder' && b.type !== 'reorder') return -1;
      if (a.type !== 'reorder' && b.type === 'reorder') return 1;
      return b.estimatedSaving - a.estimatedSaving;
    });
  }

  identifyHotSKUs(orders) {
    const skuCounts = new Map();
    
    orders.forEach(order => {
      order.items.forEach(item => {
        const count = skuCounts.get(item.skuCode) || 0;
        skuCounts.set(item.skuCode, count + 1);
      });
    });
    
    const hotSKUs = [];
    skuCounts.forEach((count, skuCode) => {
      if (count >= 2) {
        hotSKUs.push({ skuCode, count });
      }
    });
    
    return hotSKUs.sort((a, b) => b.count - a.count);
  }

  checkInventory(orders) {
    const missing = [];
    const lowStock = [];
    
    orders.forEach(order => {
      order.items.forEach(item => {
        const sku = this.getSKUByCode(item.skuCode);
        
        if (!sku) {
          missing.push({
            orderId: order.orderId,
            skuCode: item.skuCode,
            quantity: item.quantity,
            reason: 'SKU 未在货位表中找到'
          });
          return;
        }
        
        if (!this.getShelfBySKU(item.skuCode)) {
          missing.push({
            orderId: order.orderId,
            skuCode: item.skuCode,
            skuName: sku.skuName,
            quantity: item.quantity,
            reason: 'SKU 没有分配货架'
          });
          return;
        }
        
        if (sku.quantity < item.quantity) {
          lowStock.push({
            orderId: order.orderId,
            skuCode: item.skuCode,
            skuName: sku.skuName,
            available: sku.quantity,
            required: item.quantity,
            deficit: item.quantity - sku.quantity
          });
        }
      });
    });
    
    return { missing, lowStock };
  }
}
