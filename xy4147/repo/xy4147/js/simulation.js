/**
 * 模拟模块
 * 负责人群路径模拟和烟雾扩散模拟
 */

import { TileType, Direction } from './levels.js';

export class PathFinder {
    constructor(level, placedItems) {
        this.level = level;
        this.placedItems = placedItems;
        this.blockedDoors = this.getBlockedDoors();
    }

    getBlockedDoors() {
        return this.placedItems
            .filter(item => item.type === 'block')
            .map(item => `${item.x},${item.y}`);
    }

    findPath(startX, startY, targets, avoidSmoke = true, smokeState = null) {
        const openSet = [{ x: startX, y: startY, g: 0, h: 0, f: 0, parent: null }];
        const closedSet = new Set();
        
        const startKey = `${startX},${startY}`;
        const cameFrom = {};
        const gScore = {};
        
        gScore[startKey] = 0;
        
        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = `${current.x},${current.y}`;
            
            const reachedTarget = targets.some(target => 
                current.x === target.x && current.y === target.y
            );
            if (reachedTarget) {
                return this.reconstructPath(current);
            }
            
            closedSet.add(currentKey);
            
            const neighbors = this.getNeighbors(current.x, current.y);
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                
                if (closedSet.has(neighborKey)) continue;
                
                if (!this.isPassable(neighbor.x, neighbor.y, smokeState, avoidSmoke)) continue;
                
                const tentativeG = current.g + 1;
                
                if (gScore[neighborKey] === undefined || tentativeG < gScore[neighborKey]) {
                    const h = this.heuristic(neighbor.x, neighbor.y, targets);
                    const f = tentativeG + h;
                    
                    cameFrom[neighborKey] = current;
                    gScore[neighborKey] = tentativeG;
                    
                    const existing = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
                    if (existing) {
                        existing.g = tentativeG;
                        existing.f = f;
                    } else {
                        openSet.push({ x: neighbor.x, y: neighbor.y, g: tentativeG, h, f, parent: current });
                    }
                }
            }
        }
        
        return null;
    }

    heuristic(x, y, targets) {
        let minDistance = Infinity;
        for (const target of targets) {
            const distance = Math.abs(x - target.x) + Math.abs(y - target.y);
            minDistance = Math.min(minDistance, distance);
        }
        return minDistance;
    }

    reconstructPath(node) {
        const path = [];
        let current = node;
        while (current) {
            path.unshift({ x: current.x, y: current.y });
            current = current.parent;
        }
        return path;
    }

    getNeighbors(x, y) {
        const neighbors = [];
        const directions = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }
        ];
        
        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            
            if (nx >= 0 && nx < this.level.width && ny >= 0 && ny < this.level.height) {
                neighbors.push({ x: nx, y: ny });
            }
        }
        
        return neighbors;
    }

    isPassable(x, y, smokeState, avoidSmoke) {
        const tile = this.level.grid[y]?.[x];
        if (tile === undefined) return false;
        
        if (tile === TileType.WALL) return false;
        
        if (tile === TileType.DOOR) {
            const key = `${x},${y}`;
            if (this.blockedDoors.includes(key)) return false;
        }
        
        if (avoidSmoke && smokeState) {
            const key = `${x},${y}`;
            if (smokeState[key] && smokeState[key] > 0.3) {
                return false;
            }
        }
        
        return true;
    }

    findPathUsingArrows(startX, startY, arrows, exits) {
        const visited = new Set();
        const path = [{ x: startX, y: startY }];
        let currentX = startX;
        let currentY = startY;
        
        const maxSteps = 200;
        let steps = 0;
        
        while (steps < maxSteps) {
            steps++;
            const key = `${currentX},${currentY}`;
            
            if (visited.has(key)) break;
            visited.add(key);
            
            const atExit = exits.some(exit => 
                exit.x === currentX && exit.y === currentY
            );
            if (atExit) return path;
            
            const arrow = arrows.find(a => a.x === currentX && a.y === currentY);
            
            if (arrow) {
                const direction = this.getDirectionVector(arrow.direction);
                const nextX = currentX + direction.dx;
                const nextY = currentY + direction.dy;
                
                if (this.isPassable(nextX, nextY, null, false)) {
                    currentX = nextX;
                    currentY = nextY;
                    path.push({ x: currentX, y: currentY });
                    continue;
                }
            }
            
            const neighbors = this.getNeighbors(currentX, currentY);
            let foundNext = false;
            
            for (const neighbor of neighbors) {
                if (visited.has(`${neighbor.x},${neighbor.y}`)) continue;
                if (!this.isPassable(neighbor.x, neighbor.y, null, false)) continue;
                
                const neighborArrow = arrows.find(a => a.x === neighbor.x && a.y === neighbor.y);
                if (neighborArrow) {
                    const arrowDir = this.getDirectionVector(neighborArrow.direction);
                    const wouldGoBack = 
                        (currentX === neighbor.x + arrowDir.dx && 
                         currentY === neighbor.y + arrowDir.dy);
                    
                    if (!wouldGoBack) {
                        currentX = neighbor.x;
                        currentY = neighbor.y;
                        path.push({ x: currentX, y: currentY });
                        foundNext = true;
                        break;
                    }
                }
            }
            
            if (foundNext) continue;
            
            for (const neighbor of neighbors) {
                if (visited.has(`${neighbor.x},${neighbor.y}`)) continue;
                if (!this.isPassable(neighbor.x, neighbor.y, null, false)) continue;
                
                currentX = neighbor.x;
                currentY = neighbor.y;
                path.push({ x: currentX, y: currentY });
                foundNext = true;
                break;
            }
            
            if (!foundNext) break;
        }
        
        const finalKey = `${currentX},${currentY}`;
        const atExit = exits.some(exit => 
            exit.x === currentX && exit.y === currentY
        );
        
        return atExit ? path : null;
    }

    getDirectionVector(direction) {
        switch (direction) {
            case Direction.UP: return { dx: 0, dy: -1 };
            case Direction.RIGHT: return { dx: 1, dy: 0 };
            case Direction.DOWN: return { dx: 0, dy: 1 };
            case Direction.LEFT: return { dx: -1, dy: 0 };
            default: return { dx: 0, dy: -1 };
        }
    }
}

export class SmokeSimulation {
    constructor(level) {
        this.level = level;
        this.smokeState = {};
        this.extinguishers = [];
    }

    initialize() {
        this.smokeState = {};
        this.level.smokeSources.forEach(source => {
            this.smokeState[`${source.x},${source.y}`] = source.intensity;
        });
        return this.smokeState;
    }

    setExtinguishers(extinguishers) {
        this.extinguishers = extinguishers;
    }

    step(time) {
        const newSmokeState = { ...this.smokeState };
        
        const keys = Object.keys(newSmokeState);
        for (const key of keys) {
            const [x, y] = key.split(',').map(Number);
            const density = newSmokeState[key];
            
            if (density <= 0.05) {
                delete newSmokeState[key];
                continue;
            }
            
            const neighbors = [
                { dx: 0, dy: -1 },
                { dx: 1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: 0 }
            ];
            
            for (const dir of neighbors) {
                const nx = x + dir.dx;
                const ny = y + dir.dy;
                
                if (nx < 0 || nx >= this.level.width || ny < 0 || ny >= this.level.height) continue;
                
                const tile = this.level.grid[ny][nx];
                if (tile === TileType.WALL) continue;
                
                const nearExtinguisher = this.extinguishers.some(e => {
                    const dist = Math.abs(e.x - nx) + Math.abs(e.y - ny);
                    return dist <= 2;
                });
                
                const spreadRate = nearExtinguisher ? 0.02 : 0.08;
                const newKey = `${nx},${ny}`;
                const currentDensity = newSmokeState[newKey] || 0;
                
                if (nearExtinguisher) {
                    newSmokeState[newKey] = Math.max(0, currentDensity - 0.1);
                } else {
                    newSmokeState[newKey] = Math.min(
                        1.0,
                        Math.max(currentDensity, density * spreadRate)
                    );
                }
            }
            
            newSmokeState[key] = Math.min(1.0, density * 0.98);
        }
        
        this.smokeState = newSmokeState;
        return this.smokeState;
    }

    getSmokeDensity(x, y) {
        return this.smokeState[`${x},${y}`] || 0;
    }

    isInDangerousSmoke(x, y) {
        return this.getSmokeDensity(x, y) > 0.4;
    }
}

export class PeopleSimulation {
    constructor(level, placedItems) {
        this.level = level;
        this.placedItems = placedItems;
        this.people = [];
        this.pathFinder = new PathFinder(level, placedItems);
        this.simulationTime = 0;
    }

    initialize() {
        this.people = this.level.people.map(person => ({
            ...person,
            path: [],
            pathIndex: 0,
            escaped: false,
            dead: false,
            beingHelped: false,
            helperId: null,
            speed: person.type === 'disabled' ? 0.5 : 1.0,
            moveTimer: 0,
            currentDirection: null,
            waiting: false,
            waitTime: 0
        }));
        
        const arrows = this.placedItems.filter(item => item.type === 'arrow');
        const exits = this.level.exits;
        
        this.people.forEach(person => {
            let path = null;
            
            if (arrows.length > 0) {
                path = this.pathFinder.findPathUsingArrows(
                    person.x, person.y, arrows, exits
                );
            }
            
            if (!path) {
                const exitTargets = exits.map(e => ({ x: e.x, y: e.y }));
                path = this.pathFinder.findPath(
                    person.x, person.y, exitTargets, false, null
                );
            }
            
            if (path) {
                person.path = path;
                person.pathIndex = 0;
            }
        });
        
        return this.people;
    }

    step(deltaTime, smokeState) {
        this.simulationTime += deltaTime;
        
        this.updateHelperRelationships();
        
        const positionsAtTime = {};
        const stairPositions = {};
        
        this.people.forEach(person => {
            if (person.escaped || person.dead) return;
            
            const posKey = `${Math.round(person.x)},${Math.round(person.y)}`;
            positionsAtTime[posKey] = (positionsAtTime[posKey] || 0) + 1;
            
            const isStair = this.level.stairs.some(s => 
                s.x === Math.round(person.x) && s.y === Math.round(person.y)
            );
            if (isStair) {
                stairPositions[posKey] = (stairPositions[posKey] || 0) + 1;
            }
        });
        
        for (const person of this.people) {
            if (person.escaped || person.dead) continue;
            
            if (smokeState) {
                const key = `${Math.round(person.x)},${Math.round(person.y)}`;
                if (smokeState[key] && smokeState[key] > 0.5) {
                    person.dead = true;
                    continue;
                }
            }
            
            if (person.type === 'disabled' && !person.beingHelped) {
                person.waiting = true;
                continue;
            }
            
            person.moveTimer += deltaTime * person.speed;
            
            const moveInterval = 0.5;
            
            if (person.moveTimer >= moveInterval) {
                person.moveTimer = 0;
                
                if (person.path && person.pathIndex < person.path.length - 1) {
                    const currentPos = { x: Math.round(person.x), y: Math.round(person.y) };
                    const nextPos = person.path[person.pathIndex + 1];
                    
                    const nextKey = `${nextPos.x},${nextPos.y}`;
                    
                    const stairCapacity = this.getStairCapacity(nextPos.x, nextPos.y);
                    if (stairCapacity > 0 && (stairPositions[nextKey] || 0) >= stairCapacity) {
                        person.waiting = true;
                        person.waitTime += deltaTime;
                        continue;
                    }
                    
                    person.waiting = false;
                    person.waitTime = 0;
                    person.x = nextPos.x;
                    person.y = nextPos.y;
                    person.pathIndex++;
                    
                    const atExit = this.level.exits.some(exit => 
                        exit.x === person.x && exit.y === person.y
                    );
                    if (atExit) {
                        person.escaped = true;
                    }
                }
            }
        }
        
        return {
            people: this.people,
            simulationTime: this.simulationTime,
            congestionPoints: this.detectCongestion(positionsAtTime),
            stairCongestion: this.detectStairCongestion(stairPositions)
        };
    }

    updateHelperRelationships() {
        const disabledPeople = this.people.filter(p => p.type === 'disabled' && !p.escaped && !p.dead);
        const helpers = this.people.filter(p => p.type === 'normal' && !p.escaped && !p.dead);
        
        disabledPeople.forEach(disabled => {
            if (disabled.beingHelped) return;
            
            const nearbyHelper = helpers.find(helper => {
                if (helper.helpingId) return false;
                const dist = Math.abs(helper.x - disabled.x) + Math.abs(helper.y - disabled.y);
                return dist <= 2;
            });
            
            if (nearbyHelper) {
                disabled.beingHelped = true;
                disabled.helperId = nearbyHelper.id;
                nearbyHelper.helpingId = disabled.id;
                nearbyHelper.speed = 0.5;
                
                if (nearbyHelper.path) {
                    disabled.path = [...nearbyHelper.path];
                    disabled.pathIndex = nearbyHelper.pathIndex;
                }
            }
        });
    }

    getStairCapacity(x, y) {
        const stair = this.level.stairs.find(s => s.x === x && s.y === y);
        return stair ? stair.capacity : 0;
    }

    detectCongestion(positions) {
        const congestionPoints = [];
        
        Object.entries(positions).forEach(([key, count]) => {
            if (count >= 3) {
                const [x, y] = key.split(',').map(Number);
                congestionPoints.push({ x, y, count });
            }
        });
        
        return congestionPoints;
    }

    detectStairCongestion(stairPositions) {
        const congestion = [];
        
        Object.entries(stairPositions).forEach(([key, count]) => {
            const [x, y] = key.split(',').map(Number);
            const capacity = this.getStairCapacity(x, y);
            
            if (count > capacity) {
                congestion.push({ x, y, count, capacity });
            }
        });
        
        return congestion;
    }

    getEscapedCount() {
        return this.people.filter(p => p.escaped).length;
    }

    getDeadCount() {
        return this.people.filter(p => p.dead).length;
    }

    getUnrescuedDisabled() {
        return this.people.filter(p => 
            p.type === 'disabled' && !p.escaped && !p.dead
        ).length;
    }
}
