import { Position, RouteNode, Restaurant, Station, Truck } from '../types/game';

export class RoutePlanner {
  static calculateManhattanDistance(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  static calculateRouteDistance(
    route: RouteNode[],
    startPosition: Position,
    distanceModifier: number = 0
  ): number {
    if (route.length === 0) return 0;

    let totalDistance = 0;
    let currentPos = startPosition;

    for (const node of route) {
      totalDistance += this.calculateManhattanDistance(currentPos, node.position);
      currentPos = node.position;
    }

    if (distanceModifier !== 0) {
      totalDistance = Math.round(totalDistance * (1 + distanceModifier / 100));
    }

    return totalDistance;
  }

  static calculateExpectedCollection(
    route: RouteNode[],
    restaurants: Restaurant[]
  ): Record<string, number> {
    const collection: Record<string, number> = {};

    for (const node of route) {
      if (node.type === 'restaurant') {
        const restaurant = restaurants.find(r => r.id === node.id);
        if (restaurant) {
          collection[node.id] = restaurant.currentOil;
        }
      }
    }

    return collection;
  }

  static calculateTotalCollection(collection: Record<string, number>): number {
    return Object.values(collection).reduce((sum, amount) => sum + amount, 0);
  }

  static validateRoute(
    route: RouteNode[],
    truck: Truck,
    restaurants: Restaurant[],
    startPosition: Position,
    distanceModifier: number = 0
  ): { valid: boolean; reason?: string } {
    const totalDistance = this.calculateRouteDistance(route, startPosition, distanceModifier);
    if (totalDistance > truck.maxDistancePerTurn) {
      return {
        valid: false,
        reason: `路线总距离(${totalDistance})超过车辆最大行驶距离(${truck.maxDistancePerTurn})`,
      };
    }

    const expectedCollection = this.calculateExpectedCollection(route, restaurants);
    const totalCollection = this.calculateTotalCollection(expectedCollection);
    if (totalCollection > truck.capacity) {
      return {
        valid: false,
        reason: `预计收集量(${totalCollection})超过车辆容量(${truck.capacity})`,
      };
    }

    const endsAtStation = route.length > 0 && route[route.length - 1].type === 'station';
    if (!endsAtStation && totalCollection > 0) {
      return {
        valid: false,
        reason: '收集油脂后必须返回回收站卸货',
      };
    }

    return { valid: true };
  }

  static ensureEndsAtStation(route: RouteNode[], station: Station): RouteNode[] {
    if (route.length === 0) return route;

    const lastNode = route[route.length - 1];
    if (lastNode.type === 'station') {
      return route;
    }

    return [
      ...route,
      {
        type: 'station',
        id: station.id,
        position: station.position,
      },
    ];
  }

  static getOptimalRoute(
    restaurants: Restaurant[],
    station: Station,
    truck: Truck,
    startPosition: Position
  ): RouteNode[] {
    const sortedByUrgency = [...restaurants]
      .filter(r => r.currentOil > 0)
      .sort((a, b) => {
        const urgencyA = a.currentOil / a.barrelCapacity;
        const urgencyB = b.currentOil / b.barrelCapacity;
        return urgencyB - urgencyA;
      });

    const route: RouteNode[] = [];
    let currentLoad = 0;
    let currentPos = startPosition;
    let totalDistance = 0;

    for (const restaurant of sortedByUrgency) {
      const distanceToRestaurant = this.calculateManhattanDistance(currentPos, restaurant.position);
      const distanceFromRestaurantToStation = this.calculateManhattanDistance(
        restaurant.position,
        station.position
      );

      if (
        currentLoad + restaurant.currentOil <= truck.capacity &&
        totalDistance + distanceToRestaurant + distanceFromRestaurantToStation <= truck.maxDistancePerTurn
      ) {
        route.push({
          type: 'restaurant',
          id: restaurant.id,
          position: restaurant.position,
        });
        currentLoad += restaurant.currentOil;
        totalDistance += distanceToRestaurant;
        currentPos = restaurant.position;
      }
    }

    if (route.length > 0) {
      route.push({
        type: 'station',
        id: station.id,
        position: station.position,
      });
    }

    return route;
  }
}
