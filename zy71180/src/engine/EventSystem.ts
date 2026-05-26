import { GameEvent, Restaurant, Truck } from '../types/game';

interface EventOriginalState {
  restaurants: Map<string, number>;
  truckCapacity?: number;
  truckMaxDistance?: number;
  distanceMultiplier?: number;
}

type EventEffectType = 'oil_increase' | 'complaint' | 'capacity_change' | 'road_block' | 'bonus_score';

export class EventSystem {
  private originalState: EventOriginalState | null = null;

  applyEventEffect(
    event: GameEvent,
    restaurants: Restaurant[],
    truck: Truck,
    complaints: { current: number },
    score: { current: number },
    distanceMultiplier: { current: number }
  ): void {
    this.originalState = {
      restaurants: new Map(),
    };

    const { effect } = event;

    switch (effect.type) {
      case 'oil_increase':
        for (const restaurant of restaurants) {
          this.originalState.restaurants.set(restaurant.id, restaurant.oilPerTurn);
          const increase = restaurant.oilPerTurn * (effect.value / 100);
          restaurant.oilPerTurn = Math.max(0, restaurant.oilPerTurn + increase);
        }
        break;

      case 'complaint':
        complaints.current += effect.value;
        break;

      case 'capacity_change': {
        this.originalState.truckCapacity = truck.capacity;
        this.originalState.truckMaxDistance = truck.maxDistancePerTurn;
        const capacityChange = truck.capacity * (effect.value / 100);
        truck.capacity = Math.max(1, truck.capacity + capacityChange);
        const distanceChange = truck.maxDistancePerTurn * (effect.value / 100);
        truck.maxDistancePerTurn = Math.max(1, truck.maxDistancePerTurn + distanceChange);
        break;
      }

      case 'road_block':
        this.originalState.distanceMultiplier = distanceMultiplier.current;
        distanceMultiplier.current = 1 + (effect.value / 100);
        break;

      case 'bonus_score':
        score.current += effect.value;
        break;
    }
  }

  revertEventEffect(
    restaurants: Restaurant[],
    truck: Truck,
    distanceMultiplier: { current: number }
  ): void {
    if (!this.originalState) {
      return;
    }

    for (const restaurant of restaurants) {
      const originalOilPerTurn = this.originalState.restaurants.get(restaurant.id);
      if (originalOilPerTurn !== undefined) {
        restaurant.oilPerTurn = originalOilPerTurn;
      }
    }

    if (this.originalState.truckCapacity !== undefined) {
      truck.capacity = this.originalState.truckCapacity;
    }
    if (this.originalState.truckMaxDistance !== undefined) {
      truck.maxDistancePerTurn = this.originalState.truckMaxDistance;
    }

    if (this.originalState.distanceMultiplier !== undefined) {
      distanceMultiplier.current = this.originalState.distanceMultiplier;
    }

    this.originalState = null;
  }

  getEventColor(eventType: EventEffectType): string {
    switch (eventType) {
      case 'oil_increase':
        return '#f59e0b';
      case 'complaint':
        return '#ef4444';
      case 'capacity_change':
        return '#3b82f6';
      case 'road_block':
        return '#f97316';
      case 'bonus_score':
        return '#10b981';
      default:
        return '#6b7280';
    }
  }
}
