/**
 * 拣货路线优化器
 * 使用最近邻算法、遗传算法等优化拣货路线
 */

class RouteOptimizer {
    constructor(warehouse) {
        this.warehouse = warehouse;
    }
    
    optimize(pickingOrder, options = {}) {
        const validItems = pickingOrder.getValidItems();
        
        if (validItems.length === 0) {
            return {
                points: [],
                totalDistance: 0,
                error: '没有有效的拣货项'
            };
        }
        
        const startPoint = this.getStartPoint();
        const endPoint = this.getEndPoint();
        
        const pickPoints = this.collectPickPoints(validItems);
        
        const algorithm = options.algorithm || 'nearest_neighbor';
        let route;
        
        switch (algorithm) {
            case 'genetic':
                route = this.geneticAlgorithm(startPoint, endPoint, pickPoints, options);
                break;
            case 'two_opt':
                route = this.twoOpt(startPoint, endPoint, pickPoints, options);
                break;
            case 'nearest_neighbor':
            default:
                route = this.nearestNeighbor(startPoint, endPoint, pickPoints, options);
                break;
        }
        
        const totalDistance = this.calculateRouteDistance(route);
        
        return {
            points: route,
            totalDistance: totalDistance,
            algorithm: algorithm,
            itemCount: validItems.length,
            segments: this.createSegments(route)
        };
    }
    
    getStartPoint() {
        const entrance = this.warehouse.getDefaultEntrance();
        if (entrance) {
            return {
                type: 'start',
                x: entrance.x,
                z: entrance.z,
                objectId: entrance.id,
                objectName: entrance.name,
                label: '起点 - ' + entrance.name
            };
        }
        return {
            type: 'start',
            x: 0,
            z: -this.warehouse.width / 2,
            objectId: null,
            objectName: '默认入口',
            label: '起点'
        };
    }
    
    getEndPoint() {
        const exit = this.warehouse.getDefaultExit();
        if (exit) {
            return {
                type: 'end',
                x: exit.x,
                z: exit.z,
                objectId: exit.id,
                objectName: exit.name,
                label: '终点 - ' + exit.name
            };
        }
        return {
            type: 'end',
            x: 0,
            z: this.warehouse.width / 2,
            objectId: null,
            objectName: '默认出口',
            label: '终点'
        };
    }
    
    collectPickPoints(validItems) {
        const skuMap = this.warehouse.getSkuMap();
        const points = [];
        
        const shelfGroups = new Map();
        
        validItems.forEach(item => {
            const skuInfo = skuMap[item.sku];
            let point;
            
            if (skuInfo) {
                const shelf = this.warehouse.getObjectById(skuInfo.shelfId);
                point = {
                    type: 'pick',
                    x: skuInfo.position?.x ?? (shelf ? shelf.x : 0),
                    z: skuInfo.position?.z ?? (shelf ? shelf.z : 0),
                    objectId: skuInfo.shelfId,
                    objectName: skuInfo.shelfName,
                    slot: skuInfo.slot,
                    sku: item.sku,
                    quantity: item.quantity,
                    orderNo: item.orderNo,
                    itemId: item.id,
                    label: `${skuInfo.shelfName} - ${skuInfo.slot}`
                };
            } else {
                const shelf = this.warehouse.findShelfBySlot(item.shelfSlot);
                if (shelf) {
                    point = {
                        type: 'pick',
                        x: shelf.x,
                        z: shelf.z,
                        objectId: shelf.id,
                        objectName: shelf.name,
                        slot: item.shelfSlot,
                        sku: item.sku,
                        quantity: item.quantity,
                        orderNo: item.orderNo,
                        itemId: item.id,
                        label: `${shelf.name} - ${item.shelfSlot}`
                    };
                } else {
                    return null;
                }
            }
            
            const key = `${point.x.toFixed(2)},${point.z.toFixed(2)}`;
            if (!shelfGroups.has(key)) {
                shelfGroups.set(key, {
                    ...point,
                    items: []
                });
            }
            shelfGroups.get(key).items.push({
                sku: item.sku,
                quantity: item.quantity,
                orderNo: item.orderNo,
                slot: point.slot
            });
        });
        
        return Array.from(shelfGroups.values());
    }
    
    nearestNeighbor(start, end, points, options = {}) {
        if (points.length === 0) {
            return [start, end];
        }
        
        const route = [start];
        const unvisited = [...points];
        let current = start;
        
        while (unvisited.length > 0) {
            let nearestIndex = 0;
            let nearestDist = Infinity;
            
            for (let i = 0; i < unvisited.length; i++) {
                const dist = Utils.manhattanDistance(
                    current.x, current.z,
                    unvisited[i].x, unvisited[i].z
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestIndex = i;
                }
            }
            
            const next = unvisited.splice(nearestIndex, 1)[0];
            route.push(next);
            current = next;
        }
        
        route.push(end);
        return route;
    }
    
    twoOpt(start, end, points, options = {}) {
        if (points.length < 3) {
            return this.nearestNeighbor(start, end, points, options);
        }
        
        let route = this.nearestNeighbor(start, end, points, options);
        let improved = true;
        
        while (improved) {
            improved = false;
            let bestDistance = this.calculateRouteDistance(route);
            
            for (let i = 1; i < route.length - 2; i++) {
                for (let k = i + 1; k < route.length - 1; k++) {
                    const newRoute = this.twoOptSwap(route, i, k);
                    const newDistance = this.calculateRouteDistance(newRoute);
                    
                    if (newDistance < bestDistance) {
                        route = newRoute;
                        bestDistance = newDistance;
                        improved = true;
                    }
                }
            }
        }
        
        return route;
    }
    
    twoOptSwap(route, i, k) {
        const newRoute = [];
        for (let j = 0; j < i; j++) {
            newRoute.push(route[j]);
        }
        for (let j = k; j >= i; j--) {
            newRoute.push(route[j]);
        }
        for (let j = k + 1; j < route.length; j++) {
            newRoute.push(route[j]);
        }
        return newRoute;
    }
    
    geneticAlgorithm(start, end, points, options = {}) {
        if (points.length < 4) {
            return this.twoOpt(start, end, points, options);
        }
        
        const populationSize = options.populationSize || 50;
        const generations = options.generations || 100;
        const mutationRate = options.mutationRate || 0.1;
        
        let population = this.initializePopulation(start, end, points, populationSize);
        
        for (let gen = 0; gen < generations; gen++) {
            population = this.evaluatePopulation(population);
            population = this.selectPopulation(population);
            population = this.crossoverPopulation(population, start, end);
            population = this.mutatePopulation(population, mutationRate, start, end);
        }
        
        population = this.evaluatePopulation(population);
        population.sort((a, b) => a.fitness - b.fitness);
        
        return population[0].route;
    }
    
    initializePopulation(start, end, points, size) {
        const population = [];
        
        for (let i = 0; i < size; i++) {
            const shuffled = [...points].sort(() => Math.random() - 0.5);
            population.push({
                route: [start, ...shuffled, end]
            });
        }
        
        population[0] = {
            route: this.nearestNeighbor(start, end, points)
        };
        
        return population;
    }
    
    evaluatePopulation(population) {
        return population.map(individual => ({
            ...individual,
            fitness: this.calculateRouteDistance(individual.route)
        }));
    }
    
    selectPopulation(population) {
        population.sort((a, b) => a.fitness - b.fitness);
        
        const eliteCount = Math.floor(population.length * 0.2);
        const selected = population.slice(0, eliteCount);
        
        while (selected.length < population.length) {
            const parent1 = this.tournamentSelect(population);
            const parent2 = this.tournamentSelect(population);
            selected.push(parent1.fitness < parent2.fitness ? parent1 : parent2);
        }
        
        return selected;
    }
    
    tournamentSelect(population) {
        const tournamentSize = 3;
        let best = null;
        
        for (let i = 0; i < tournamentSize; i++) {
            const individual = population[Math.floor(Math.random() * population.length)];
            if (!best || individual.fitness < best.fitness) {
                best = individual;
            }
        }
        
        return best;
    }
    
    crossoverPopulation(population, start, end) {
        const newPopulation = [];
        
        for (let i = 0; i < population.length; i += 2) {
            if (i + 1 < population.length) {
                const parent1 = population[i];
                const parent2 = population[i + 1];
                
                const child1 = this.crossover(parent1, parent2, start, end);
                const child2 = this.crossover(parent2, parent1, start, end);
                
                newPopulation.push(child1, child2);
            } else {
                newPopulation.push(population[i]);
            }
        }
        
        return newPopulation;
    }
    
    crossover(parent1, parent2, start, end) {
        const points1 = parent1.route.slice(1, -1);
        const points2 = parent2.route.slice(1, -1);
        
        if (points1.length < 2) {
            return parent1;
        }
        
        const startIndex = Math.floor(Math.random() * points1.length);
        const endIndex = Math.floor(Math.random() * points1.length);
        const min = Math.min(startIndex, endIndex);
        const max = Math.max(startIndex, endIndex);
        
        const childPoints = [];
        const usedKeys = new Set();
        
        for (let i = min; i <= max; i++) {
            childPoints.push(points1[i]);
            usedKeys.add(`${points1[i].x.toFixed(2)},${points1[i].z.toFixed(2)}`);
        }
        
        for (const point of points2) {
            const key = `${point.x.toFixed(2)},${point.z.toFixed(2)}`;
            if (!usedKeys.has(key)) {
                childPoints.push(point);
                usedKeys.add(key);
            }
        }
        
        return {
            route: [start, ...childPoints, end]
        };
    }
    
    mutatePopulation(population, mutationRate, start, end) {
        return population.map(individual => {
            if (Math.random() < mutationRate) {
                return this.mutate(individual, start, end);
            }
            return individual;
        });
    }
    
    mutate(individual, start, end) {
        const points = individual.route.slice(1, -1);
        
        if (points.length < 2) {
            return individual;
        }
        
        const i = Math.floor(Math.random() * points.length);
        const j = Math.floor(Math.random() * points.length);
        
        const temp = points[i];
        points[i] = points[j];
        points[j] = temp;
        
        return {
            route: [start, ...points, end]
        };
    }
    
    calculateRouteDistance(route) {
        if (route.length < 2) return 0;
        
        let total = 0;
        for (let i = 0; i < route.length - 1; i++) {
            total += Utils.manhattanDistance(
                route[i].x, route[i].z,
                route[i + 1].x, route[i + 1].z
            );
        }
        return total;
    }
    
    createSegments(route) {
        const segments = [];
        
        for (let i = 0; i < route.length - 1; i++) {
            const from = route[i];
            const to = route[i + 1];
            segments.push({
                from: from,
                to: to,
                distance: Utils.manhattanDistance(from.x, from.z, to.x, to.z),
                index: i
            });
        }
        
        return segments;
    }
    
    calculateWithOrder(pickingOrder, orderIndices) {
        const validItems = pickingOrder.getValidItems();
        
        if (validItems.length === 0) {
            return {
                points: [],
                totalDistance: 0,
                distance: 0,
                error: '没有有效的拣货项'
            };
        }
        
        const startPoint = this.getStartPoint();
        const endPoint = this.getEndPoint();
        
        const pickPoints = this.collectPickPoints(validItems);
        
        const orderedPoints = [startPoint];
        
        orderIndices.forEach(idx => {
            if (idx >= 0 && idx < pickPoints.length) {
                orderedPoints.push(pickPoints[idx]);
            }
        });
        
        orderedPoints.push(endPoint);
        
        const totalDistance = this.calculateRouteDistance(orderedPoints);
        
        return {
            points: orderedPoints,
            totalDistance: totalDistance,
            distance: totalDistance,
            algorithm: 'manual',
            itemCount: validItems.length,
            segments: this.createSegments(orderedPoints)
        };
    }
    
    static optimizeRoute(warehouse, pickingOrder, options) {
        const optimizer = new RouteOptimizer(warehouse);
        return optimizer.optimize(pickingOrder, options);
    }
    
    static optimize(warehouse, pickingOrder, options) {
        return RouteOptimizer.optimizeRoute(warehouse, pickingOrder, options);
    }
    
    static calculateRouteWithOrder(warehouse, pickingOrder, orderIndices) {
        const optimizer = new RouteOptimizer(warehouse);
        return optimizer.calculateWithOrder(pickingOrder, orderIndices);
    }
}
