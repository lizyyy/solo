import { GameState, Ship, Tug, GameEvent, FailReason } from '../types';
import { TideSystem } from './TideSystem';
import { CollisionSystem } from './CollisionSystem';
import { FuelSystem } from './FuelSystem';
import { ScoringSystem } from './ScoringSystem';
import { distance, moveTowards, angleTo, normalizeAngle, generateId, lerp } from '../utils/math';
export class GameEngine {
    static update(state: GameState, deltaTime: number): GameState {
        if (state.phase !== 'playing')
            return state;
        const newTime = state.time + deltaTime * state.timeSpeed;
        let newTide = TideSystem.updateTide(state.tide, newTime);
        let newShips = [...state.ships];
        let newTugs = [...state.tugs];
        let newBerths = [...state.berths];
        let newEvents = [...state.events];
        let newScore = { ...state.score };
        let newObjectives = [...state.objectives];
        let failReason: FailReason = 'none';
        const addEvent = (type: GameEvent['type'], message: string) => {
            newEvents.push({
                id: generateId(),
                time: newTime,
                type,
                message,
            });
        };
        newTugs = newTugs.map((tug) => {
            let updatedTug = FuelSystem.updateFuel(tug, deltaTime * state.timeSpeed);
            if (FuelSystem.isFuelDepleted(updatedTug)) {
                if (tug.fuel > 0) {
                    addEvent('danger', `${tug.name} 燃油耗尽！`);
                    newScore = ScoringSystem.applyFuelDepletedPenalty(newScore);
                }
                return { ...updatedTug, status: 'idle' as const, assignedShipId: undefined };
            }
            if (FuelSystem.isFuelLow(updatedTug) && tug.fuel > tug.maxFuel * 0.2) {
                addEvent('warning', `${tug.name} 燃油不足！`);
            }
            if (updatedTug.status === 'moving' || updatedTug.status === 'towing') {
                const targetShip = newShips.find((s) => s.id === tug.assignedShipId);
                if (targetShip) {
                    const targetPos = this.getTugTargetPosition(updatedTug, targetShip);
                    const moveSpeed = updatedTug.speed * deltaTime * state.timeSpeed;
                    const newPos = moveTowards(updatedTug.position, targetPos, moveSpeed);
                    const newRotation = angleTo(updatedTug.position, targetPos);
                    updatedTug = {
                        ...updatedTug,
                        position: newPos,
                        rotation: normalizeAngle(lerp(updatedTug.rotation, newRotation, 0.1)),
                    };
                    if (distance(updatedTug.position, targetPos) < 1) {
                        updatedTug = { ...updatedTug, status: 'towing' as const };
                    }
                }
            }
            else if (updatedTug.status === 'returning') {
                const moveSpeed = updatedTug.speed * deltaTime * state.timeSpeed;
                const newPos = moveTowards(updatedTug.position, updatedTug.homePosition, moveSpeed);
                const newRotation = angleTo(updatedTug.position, updatedTug.homePosition);
                updatedTug = {
                    ...updatedTug,
                    position: newPos,
                    rotation: normalizeAngle(lerp(updatedTug.rotation, newRotation, 0.1)),
                };
                if (distance(updatedTug.position, updatedTug.homePosition) < 1) {
                    updatedTug = { ...updatedTug, status: 'idle' as const, assignedShipId: undefined };
                }
            }
            return updatedTug;
        });
        newShips = newShips.map((ship) => {
            let updatedShip = { ...ship };
            const assignedTugs = newTugs.filter((t) => t.assignedShipId === ship.id && t.status === 'towing');
            const hasEnoughTugs = assignedTugs.length >= ship.requiredTugs;
            const canNav = TideSystem.canNavigate(newTide, ship.draft);
            if (ship.status === 'approaching') {
                if (newTime >= ship.arrivalTime) {
                    if (canNav) {
                        const berth = newBerths.find((b) => b.id === ship.targetBerthId);
                        if (berth && !berth.occupied && hasEnoughTugs) {
                            updatedShip.status = 'docking';
                            addEvent('info', `${ship.name} 开始靠泊`);
                        }
                        else if (!canNav) {
                            addEvent('warning', `${ship.name} 等待潮汐窗口`);
                        }
                    }
                }
            }
            else if (ship.status === 'docking' && hasEnoughTugs && canNav) {
                const berth = newBerths.find((b) => b.id === ship.targetBerthId);
                if (berth) {
                    const moveSpeed = ship.speed * 0.5 * deltaTime * state.timeSpeed;
                    const newPos = moveTowards(ship.position, berth.position, moveSpeed);
                    const targetRotation = berth.rotation;
                    updatedShip = {
                        ...updatedShip,
                        position: newPos,
                        rotation: normalizeAngle(lerp(ship.rotation, targetRotation, 0.02)),
                    };
                    if (distance(updatedShip.position, berth.position) < 2) {
                        updatedShip.status = 'docked';
                        updatedShip.actualArrivalTime = newTime;
                        const berthIndex = newBerths.findIndex((b) => b.id === berth.id);
                        newBerths[berthIndex] = { ...berth, occupied: true, occupiedShipId: ship.id };
                        const wasOnTime = newTime <= ship.arrivalTime + 60;
                        if (wasOnTime) {
                            addEvent('success', `${ship.name} 按时完成靠泊！`);
                            newScore = ScoringSystem.addOnTimeCompletion(newScore, ScoringSystem.DOCK_ON_TIME_BONUS);
                            const dockObjective = newObjectives.find((o) => o.type === 'dock');
                            if (dockObjective) {
                                dockObjective.currentValue++;
                                if (dockObjective.currentValue >= dockObjective.targetValue) {
                                    dockObjective.completed = true;
                                }
                            }
                        }
                        else {
                            addEvent('warning', `${ship.name} 靠泊延误`);
                        }
                    }
                }
            }
            else if (ship.status === 'docked') {
                if (newTime >= ship.departureTime && hasEnoughTugs && canNav) {
                    updatedShip.status = 'undocking';
                    addEvent('info', `${ship.name} 开始离泊`);
                }
            }
            else if (ship.status === 'undocking' && hasEnoughTugs && canNav) {
                const berth = newBerths.find((b) => b.occupiedShipId === ship.id);
                if (berth) {
                    const departurePos = { x: berth.position.x, y: 0, z: berth.position.z - 30 };
                    const moveSpeed = ship.speed * 0.5 * deltaTime * state.timeSpeed;
                    const newPos = moveTowards(ship.position, departurePos, moveSpeed);
                    updatedShip = { ...updatedShip, position: newPos };
                    if (distance(updatedShip.position, departurePos) < 2) {
                        updatedShip.status = 'departing';
                        updatedShip.actualDepartureTime = newTime;
                        const berthIndex = newBerths.findIndex((b) => b.id === berth.id);
                        newBerths[berthIndex] = { ...berth, occupied: false, occupiedShipId: undefined };
                        addEvent('success', `${ship.name} 完成离泊！`);
                        newScore = ScoringSystem.addOnTimeCompletion(newScore, ScoringSystem.UNDOCK_ON_TIME_BONUS);
                    }
                }
            }
            else if (ship.status === 'departing') {
                const exitPos = { x: ship.position.x > 0 ? 80 : -80, y: 0, z: -50 };
                const moveSpeed = ship.speed * deltaTime * state.timeSpeed;
                updatedShip = {
                    ...updatedShip,
                    position: moveTowards(ship.position, exitPos, moveSpeed),
                };
            }
            return updatedShip;
        });
        const { warnings, hasCollision, collisionPair } = CollisionSystem.detectWarnings(newShips, newTugs, newTime);
        if (hasCollision && collisionPair) {
            addEvent('danger', `碰撞事故！${collisionPair[0]} 与 ${collisionPair[1]} 相撞`);
            newScore = ScoringSystem.applyCollisionPenalty(newScore);
            failReason = 'collision';
            const safetyObjective = newObjectives.find((o) => o.type === 'safety');
            if (safetyObjective) {
                safetyObjective.currentValue++;
            }
        }
        else if (warnings.length > state.collisionWarnings.length) {
            const newWarnings = warnings.filter((w) => !state.collisionWarnings.some((cw) => cw.id === w.id));
            newWarnings.forEach((w) => {
                addEvent('warning', `碰撞警告：${w.object1Id} 与 ${w.object2Id} 距离过近`);
                newScore = ScoringSystem.applyCollisionWarningPenalty(newScore);
            });
        }
        for (const ship of newShips) {
            if (ship.status === 'approaching' && newTime > ship.arrivalTime + 120) {
                const tideStatus = TideSystem.getTideWindowStatus(newTide, ship.draft, newTime);
                if (!tideStatus.canNav && tideStatus.timeToNextWindow > 60) {
                    addEvent('danger', `${ship.name} 错过潮汐窗口！`);
                    newScore = ScoringSystem.applyTideMissPenalty(newScore);
                    failReason = 'tide_missed';
                }
            }
        }
        const fuelEfficiency = FuelSystem.calculateEfficiency(newTugs, newTime);
        newScore = ScoringSystem.addFuelEfficiency(newScore, fuelEfficiency);
        const fuelObjective = newObjectives.find((o) => o.type === 'fuel');
        if (fuelObjective) {
            fuelObjective.currentValue = Math.floor(fuelEfficiency);
            if (fuelEfficiency >= fuelObjective.targetValue) {
                fuelObjective.completed = true;
            }
        }
        const objectivesScore = ScoringSystem.calculateObjectivesScore(newObjectives);
        newScore.total = newScore.total + objectivesScore - state.score.total + newScore.total - newScore.total;
        newScore = ScoringSystem.updateScore(newScore);
        let newPhase: GameState['phase'] = state.phase;
        if (failReason !== 'none') {
            newPhase = 'ended';
        }
        else if (newTime >= state.maxTime) {
            newPhase = 'ended';
            addEvent('info', '时间到，游戏结束');
        }
        else {
            const allDone = newShips.every((s) => s.status === 'departing' || s.status === 'docked');
            if (allDone && newShips.some((s) => s.status === 'docked')) {
                newPhase = 'ended';
                addEvent('success', '所有任务完成！');
            }
        }
        const newHistory = [...state.history];
        if (newHistory.length === 0 || newTime - newHistory[newHistory.length - 1].time >= 1) {
            newHistory.push({
                time: newTime,
                ships: JSON.parse(JSON.stringify(newShips)),
                tugs: JSON.parse(JSON.stringify(newTugs)),
                tide: { ...newTide },
                events: newEvents.slice(-5).map((e) => e.message),
            });
        }
        return {
            ...state,
            phase: newPhase,
            time: newTime,
            tide: newTide,
            ships: newShips,
            tugs: newTugs,
            berths: newBerths,
            events: newEvents.slice(-50),
            collisionWarnings: warnings,
            score: newScore,
            objectives: newObjectives,
            history: newHistory,
            failReason: failReason !== 'none' ? failReason : state.failReason,
        };
    }
    private static getTugTargetPosition(tug: Tug, ship: Ship) {
        const angle = ship.rotation;
        const side = tug.id.charCodeAt(tug.id.length - 1) % 2 === 0 ? 1 : -1;
        return {
            x: ship.position.x + Math.cos(angle + Math.PI / 2) * side * 3,
            y: 0,
            z: ship.position.z + Math.sin(angle + Math.PI / 2) * side * 3,
        };
    }
}

