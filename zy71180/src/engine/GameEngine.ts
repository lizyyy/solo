import {
  Level,
  Restaurant,
  Truck,
  Station,
  RouteNode,
  TurnAction,
  GameEvent,
  GameHistory,
} from '../types/game';
import { RoutePlanner } from './RoutePlanner';
import { TurnManager } from './TurnManager';
import { EventSystem } from './EventSystem';
import { ScoreCalculator } from './ScoreCalculator';
import { getRandomEvent, shouldTriggerEvent } from '../data/events';
import { generateGameId } from '../utils/storage';

export interface ExecuteTurnResult {
  turnAction: TurnAction;
  isGameOver: boolean;
  isWin: boolean;
  failureReason?: string;
  event?: GameEvent;
}

export class GameEngine {
  private level: Level;
  private restaurants: Restaurant[];
  private station: Station;
  private truck: Truck;
  private currentTurn: number;
  private score: { current: number };
  private complaints: { current: number };
  private turnHistory: TurnAction[];
  private turnManager: TurnManager;
  private eventSystem: EventSystem;
  private distanceMultiplier: { current: number };
  private currentEvent: GameEvent | null = null;
  private initialRestaurants: Restaurant[];

  constructor(level: Level) {
    this.level = level;
    this.currentTurn = 1;
    this.score = { current: 0 };
    this.complaints = { current: 0 };
    this.turnHistory = [];
    this.distanceMultiplier = { current: 1 };
    this.turnManager = new TurnManager(this.complaints);
    this.eventSystem = new EventSystem();

    this.restaurants = level.restaurants.map(r => ({
      ...r,
      currentOil: r.oilPerTurn,
    }));

    this.initialRestaurants = JSON.parse(JSON.stringify(this.restaurants));

    this.station = level.station;
    this.truck = {
      ...level.truck,
      position: { ...level.station.position },
    };
  }

  getState() {
    return {
      level: this.level,
      restaurants: JSON.parse(JSON.stringify(this.restaurants)),
      station: { ...this.station },
      truck: { ...this.truck, position: { ...this.truck.position } },
      currentTurn: this.currentTurn,
      score: this.score.current,
      complaints: this.complaints.current,
      turnHistory: JSON.parse(JSON.stringify(this.turnHistory)),
      distanceMultiplier: this.distanceMultiplier.current,
      currentEvent: this.currentEvent,
    };
  }

  checkForEvent(): GameEvent | null {
    if (shouldTriggerEvent(this.level.eventProbability)) {
      this.currentEvent = getRandomEvent();
      return this.currentEvent;
    }
    this.currentEvent = null;
    return null;
  }

  applyEvent(event: GameEvent): void {
    this.eventSystem.applyEventEffect(
      event,
      this.restaurants,
      this.truck,
      this.complaints,
      this.score,
      this.distanceMultiplier
    );
  }

  validateRoute(route: RouteNode[]): { valid: boolean; reason?: string } {
    const distanceModifier = (this.distanceMultiplier.current - 1) * 100;
    return RoutePlanner.validateRoute(
      route,
      this.truck,
      this.restaurants,
      this.truck.position,
      distanceModifier
    );
  }

  calculateRouteDistance(route: RouteNode[]): number {
    const distanceModifier = (this.distanceMultiplier.current - 1) * 100;
    return RoutePlanner.calculateRouteDistance(
      route,
      this.truck.position,
      distanceModifier
    );
  }

  calculateExpectedCollection(route: RouteNode[]): Record<string, number> {
    return RoutePlanner.calculateExpectedCollection(route, this.restaurants);
  }

  ensureEndsAtStation(route: RouteNode[]): RouteNode[] {
    return RoutePlanner.ensureEndsAtStation(route, this.station);
  }

  getOptimalRoute(): RouteNode[] {
    return RoutePlanner.getOptimalRoute(
      this.restaurants,
      this.station,
      this.truck,
      this.truck.position
    );
  }

  executeTurn(route: RouteNode[]): ExecuteTurnResult {
    const validation = this.validateRoute(route);
    if (!validation.valid) {
      throw new Error(validation.reason || '无效的路线');
    }

    const totalDistance = this.calculateRouteDistance(route);
    const collectedOil: Record<string, number> = {};
    let totalCollected = 0;

    for (const node of route) {
      this.truck.position = { ...node.position };

      if (node.type === 'restaurant') {
        const restaurant = this.restaurants.find(r => r.id === node.id);
        if (restaurant) {
          const availableSpace = this.truck.capacity - this.truck.currentLoad;
          const collectAmount = Math.min(restaurant.currentOil, availableSpace);
          
          if (collectAmount > 0) {
            collectedOil[restaurant.id] = collectAmount;
            restaurant.currentOil -= collectAmount;
            this.truck.currentLoad += collectAmount;
            totalCollected += collectAmount;
          }
        }
      } else if (node.type === 'station') {
        this.truck.currentLoad = 0;
      }
    }

    const isWin = this.turnManager.checkVictory(this.restaurants);

    const overflowing = this.turnManager.incrementOil(this.restaurants);
    const overflowCount = overflowing.length;

    const eventBonus = this.currentEvent?.effect.type === 'bonus_score' ? this.currentEvent.effect.value : 0;
    const turnScore = ScoreCalculator.calculateTurnScore(
      totalDistance,
      this.truck.maxDistancePerTurn,
      totalCollected,
      this.truck.capacity,
      overflowCount,
      0,
      eventBonus
    );

    this.score.current += turnScore;

    if (this.currentEvent) {
      this.eventSystem.revertEventEffect(this.restaurants, this.truck, this.distanceMultiplier);
    }

    const restaurantStates = this.restaurants.map(r => ({
      id: r.id,
      currentOil: r.currentOil,
      isOverflowing: r.currentOil > r.barrelCapacity,
    }));

    const turnAction: TurnAction = {
      turn: this.currentTurn,
      route: JSON.parse(JSON.stringify(route)),
      totalDistance,
      collectedOil,
      complaints: overflowCount,
      scoreThisTurn: turnScore,
      restaurantStates,
      event: this.currentEvent || undefined,
    };

    this.turnHistory.push(turnAction);

    const isGameOver = isWin
      ? false
      : this.turnManager.checkGameOver(this.currentTurn, this.level);

    let failureReason: string | undefined;
    if (isGameOver && !isWin) {
      failureReason = this.turnManager.getFailureReason(this.currentTurn, this.level);
      
      const firstOverflow = overflowing[0];
      if (firstOverflow) {
        failureReason = `第 ${this.currentTurn} 回合：「${firstOverflow.name}」油桶溢出 (${firstOverflow.currentOil}/${firstOverflow.barrelCapacity})，${failureReason}`;
      }
    }

    const executedEvent = this.currentEvent;
    this.currentEvent = null;

    if (!isGameOver && !isWin) {
      this.currentTurn++;
    }

    return {
      turnAction,
      isGameOver,
      isWin,
      failureReason,
      event: executedEvent || undefined,
    };
  }

  generateHistory(isWin: boolean, failureReason?: string): GameHistory {
    const finalScoreBreakdown = ScoreCalculator.calculateFinalScore(
      this.turnHistory,
      this.level.maxTurns,
      isWin
    );

    const history: GameHistory = {
      id: generateGameId(),
      timestamp: new Date().toISOString(),
      levelId: this.level.id,
      levelName: this.level.name,
      isWin,
      finalScore: finalScoreBreakdown.total,
      totalTurns: this.turnHistory.length,
      maxTurns: this.level.maxTurns,
      failureReason: failureReason || null,
      turns: JSON.parse(JSON.stringify(this.turnHistory)),
      initialRestaurants: JSON.parse(JSON.stringify(this.initialRestaurants)),
    };

    return history;
  }

  getScoreBreakdown(isWin: boolean) {
    return ScoreCalculator.calculateFinalScore(
      this.turnHistory,
      this.level.maxTurns,
      isWin
    );
  }
}
