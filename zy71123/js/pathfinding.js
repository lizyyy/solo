class Pathfinding {
    constructor(gridSize = 1) {
        this.gridSize = gridSize;
        this.grid = new Map();
    }

    buildGrid(floorData, obstacles) {
        this.floorData = floorData;
        this.halfWidth = floorData.width / 2;
        this.halfDepth = floorData.depth / 2;
        this.obstacles = obstacles;
        
        this.grid.clear();
        
        for (let x = -this.halfWidth; x <= this.halfWidth; x += this.gridSize) {
            for (let z = -this.halfDepth; z <= this.halfDepth; z += this.gridSize) {
                const key = `${x},${z}`;
                const isBlocked = this.checkCollision(x, z, obstacles);
                this.grid.set(key, {
                    x, z,
                    walkable: !isBlocked,
                    g: 0,
                    h: 0,
                    f: 0,
                    parent: null
                });
            }
        }
    }

    checkCollision(x, z, obstacles, padding = 0.8) {
        for (const obs of obstacles) {
            const halfWidth = (obs.width / 2) + padding;
            const halfDepth = (obs.depth / 2) + padding;
            
            if (x >= (obs.x - halfWidth) && x <= (obs.x + halfWidth) &&
                z >= (obs.z - halfDepth) && z <= (obs.z + halfDepth)) {
                return true;
            }
        }
        return false;
    }

    checkLineCollision(x1, z1, x2, z2, obstacles, padding = 0.8) {
        const steps = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1)) / this.gridSize);
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const z = z1 + (z2 - z1) * t;
            
            if (this.checkCollision(x, z, obstacles, padding)) {
                return true;
            }
        }
        return false;
    }

    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
    }

    getNeighbors(node) {
        const neighbors = [];
        const directions = [
            { x: this.gridSize, z: 0 },
            { x: -this.gridSize, z: 0 },
            { x: 0, z: this.gridSize },
            { x: 0, z: -this.gridSize },
            { x: this.gridSize, z: this.gridSize },
            { x: -this.gridSize, z: this.gridSize },
            { x: this.gridSize, z: -this.gridSize },
            { x: -this.gridSize, z: -this.gridSize }
        ];

        for (const dir of directions) {
            const key = `${node.x + dir.x},${node.z + dir.z}`;
            if (this.grid.has(key)) {
                neighbors.push(this.grid.get(key));
            }
        }

        return neighbors;
    }

    findPath(startX, startZ, endX, endZ) {
        const startKey = `${Math.round(startX / this.gridSize) * this.gridSize},${Math.round(startZ / this.gridSize) * this.gridSize}`;
        const endKey = `${Math.round(endX / this.gridSize) * this.gridSize},${Math.round(endZ / this.gridSize) * this.gridSize}`;

        if (!this.grid.has(startKey) || !this.grid.has(endKey)) {
            return null;
        }

        const startNode = this.grid.get(startKey);
        const endNode = this.grid.get(endKey);

        if (!startNode.walkable || !endNode.walkable) {
            return null;
        }

        this.grid.forEach(node => {
            node.g = 0;
            node.h = 0;
            node.f = 0;
            node.parent = null;
        });

        const openSet = [startNode];
        const closedSet = new Set();

        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();

            if (current === endNode) {
                return this.reconstructPath(current);
            }

            closedSet.add(current);

            for (const neighbor of this.getNeighbors(current)) {
                if (closedSet.has(neighbor) || !neighbor.walkable) {
                    continue;
                }

                const moveCost = (neighbor.x !== current.x && neighbor.z !== current.z) ? 1.4 : 1;
                const tentativeG = current.g + moveCost;

                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                } else if (tentativeG >= neighbor.g) {
                    continue;
                }

                neighbor.parent = current;
                neighbor.g = tentativeG;
                neighbor.h = this.heuristic(neighbor, endNode);
                neighbor.f = neighbor.g + neighbor.h;
            }
        }

        return null;
    }

    reconstructPath(endNode) {
        const path = [];
        let current = endNode;

        while (current) {
            path.unshift({ x: current.x, z: current.z });
            current = current.parent;
        }

        return this.smoothPath(path);
    }

    smoothPath(path) {
        if (path.length < 3) return path;

        const smoothed = [path[0]];
        let i = 0;

        while (i < path.length - 1) {
            let j = path.length - 1;
            
            while (j > i + 1) {
                if (!this.checkLineCollision(
                    path[i].x, path[i].z,
                    path[j].x, path[j].z,
                    this.obstacles || []
                )) {
                    break;
                }
                j--;
            }

            smoothed.push(path[j]);
            i = j;
        }

        return smoothed;
    }

    optimizeRoute(startPoint, inspectionPoints, chargerPoint) {
        const route = [];
        const remaining = [...inspectionPoints];
        let current = startPoint;

        while (remaining.length > 0) {
            remaining.sort((a, b) => {
                const distA = this.heuristic(
                    { x: current.x, z: current.z },
                    { x: a.x, z: a.z }
                );
                const distB = this.heuristic(
                    { x: current.x, z: current.z },
                    { x: b.x, z: b.z }
                );
                return distA - distB;
            });

            const next = remaining.shift();
            route.push(next);
            current = next;
        }

        return route;
    }

    calculatePathDistance(path) {
        if (!path || path.length < 2) return 0;
        
        let distance = 0;
        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i - 1].x;
            const dz = path[i].z - path[i - 1].z;
            distance += Math.sqrt(dx * dx + dz * dz);
        }
        return distance;
    }

    calculateFullRoute(startPoint, inspectionPoints, chargerPoint) {
        const segments = [];
        let totalDistance = 0;
        let current = startPoint;
        let hasCollision = false;
        const collisions = [];

        const route = this.optimizeRoute(startPoint, inspectionPoints, chargerPoint);

        for (const point of route) {
            const path = this.findPath(current.x, current.z, point.x, point.z);
            
            if (path) {
                const dist = this.calculatePathDistance(path);
                segments.push({
                    from: { ...current },
                    to: { ...point },
                    path: path,
                    distance: dist,
                    targetPoint: point
                });
                totalDistance += dist;
                current = point;
            } else {
                hasCollision = true;
                collisions.push({ from: current, to: point });
            }
        }

        if (chargerPoint) {
            const returnPath = this.findPath(current.x, current.z, chargerPoint.x, chargerPoint.z);
            if (returnPath) {
                const dist = this.calculatePathDistance(returnPath);
                segments.push({
                    from: { ...current },
                    to: { ...chargerPoint },
                    path: returnPath,
                    distance: dist,
                    isReturn: true
                });
                totalDistance += dist;
            } else {
                hasCollision = true;
                collisions.push({ from: current, to: chargerPoint });
            }
        }

        return {
            segments,
            totalDistance,
            hasCollision,
            collisions,
            route
        };
    }

    getFullPath(segments) {
        const fullPath = [];
        for (const segment of segments) {
            fullPath.push(...segment.path);
        }
        return fullPath;
    }

    estimateBatteryConsumption(distance, inspectDuration = 0) {
        const movementConsumption = distance * 0.5;
        const inspectConsumption = inspectDuration * 0.2;
        return movementConsumption + inspectConsumption;
    }

    checkLowBatteryReturn(currentBattery, currentDistance, returnDistance, threshold = 20) {
        const requiredBattery = this.estimateBatteryConsumption(returnDistance);
        return currentBattery - requiredBattery <= threshold;
    }

    getReachablePoints(startX, startZ, maxDistance) {
        const reachable = [];
        
        for (const [key, node] of this.grid) {
            if (!node.walkable) continue;
            
            const path = this.findPath(startX, startZ, node.x, node.z);
            if (path) {
                const dist = this.calculatePathDistance(path);
                if (dist <= maxDistance) {
                    reachable.push({
                        x: node.x,
                        z: node.z,
                        distance: dist
                    });
                }
            }
        }
        
        return reachable;
    }
}