import * as THREE from 'three';
import { PVComponent, Tree, Roof, SolarPosition } from '../types';
import { RealTimeShadowResult, AccumulatedShadowData } from '../store/useSceneStore';
import { calculateSolarPosition, getSunriseSunset } from './solarMath';
import { createSceneOccluders, calculateComponentShadowRate } from './shadowUtils';

export interface TimePointShadowResult {
  hour: number;
  componentShadows: RealTimeShadowResult[];
}

export interface DayShadowCalculationResult {
  month: number;
  day: number;
  timePoints: TimePointShadowResult[];
  accumulatedShadows: AccumulatedShadowData[];
}

export class ShadowCalculator {
  private raycaster: THREE.Raycaster;
  private occluders: THREE.Object3D[] = [];

  constructor() {
    this.raycaster = new THREE.Raycaster();
  }

  updateOccluders(trees: Tree[], roof: Roof): void {
    this.occluders = createSceneOccluders(trees, roof);
  }

  calculateTimePointShadows(
    components: PVComponent[],
    sunPosition: SolarPosition,
    gridSize: number = 3
  ): RealTimeShadowResult[] {
    if (sunPosition.altitude <= 0) {
      return components.map((c) => ({
        componentId: c.id,
        shadowRate: 100,
        shadowedPoints: gridSize * gridSize,
        totalPoints: gridSize * gridSize,
      }));
    }

    return components.map((component) => {
      const result = calculateComponentShadowRate(
        component,
        sunPosition,
        this.occluders,
        this.raycaster,
        gridSize
      );
      return {
        componentId: component.id,
        shadowRate: result.shadowRate,
        shadowedPoints: result.shadowedPoints,
        totalPoints: result.totalPoints,
      };
    });
  }

  calculateShadowsAtTime(
    components: PVComponent[],
    month: number,
    day: number,
    hour: number,
    latitude: number = 39.9,
    gridSize: number = 3
  ): RealTimeShadowResult[] {
    const sunPosition = calculateSolarPosition(month, day, hour, latitude);
    return this.calculateTimePointShadows(components, sunPosition, gridSize);
  }

  calculateDayAccumulatedShadows(
    components: PVComponent[],
    month: number,
    day: number,
    latitude: number = 39.9,
    stepHours: number = 0.25,
    gridSize: number = 3
  ): DayShadowCalculationResult {
    const { sunrise, sunset } = getSunriseSunset(month, day, latitude);
    const timePoints: TimePointShadowResult[] = [];
    const accumulatedMap = new Map<string, number>();

    components.forEach((c) => accumulatedMap.set(c.id, 0));

    for (let hour = sunrise; hour <= sunset; hour += stepHours) {
      const shadows = this.calculateShadowsAtTime(
        components,
        month,
        day,
        hour,
        latitude,
        gridSize
      );

      timePoints.push({ hour, componentShadows: shadows });

      shadows.forEach((shadow) => {
        const current = accumulatedMap.get(shadow.componentId) || 0;
        const shadowHours = (shadow.shadowRate / 100) * stepHours;
        accumulatedMap.set(shadow.componentId, current + shadowHours);
      });
    }

    const accumulatedShadows: AccumulatedShadowData[] = components.map((c) => ({
      componentId: c.id,
      accumulatedShadowHours: accumulatedMap.get(c.id) || 0,
      lastProcessedHour: sunset,
    }));

    return {
      month,
      day,
      timePoints,
      accumulatedShadows,
    };
  }

  calculateAccumulatedUntilHour(
    dayResult: DayShadowCalculationResult,
    targetHour: number
  ): AccumulatedShadowData[] {
    const componentIds = dayResult.accumulatedShadows.map((a) => a.componentId);
    const accumulatedMap = new Map<string, number>();

    componentIds.forEach((id) => accumulatedMap.set(id, 0));

    for (const timePoint of dayResult.timePoints) {
      if (timePoint.hour > targetHour) break;

      const prevHour = dayResult.timePoints[dayResult.timePoints.indexOf(timePoint) - 1]?.hour || 
        dayResult.timePoints[0].hour - 0.25;
      const stepHours = Math.min(timePoint.hour - prevHour, targetHour - prevHour);

      timePoint.componentShadows.forEach((shadow) => {
        const current = accumulatedMap.get(shadow.componentId) || 0;
        const shadowHours = (shadow.shadowRate / 100) * Math.max(0, stepHours);
        accumulatedMap.set(shadow.componentId, current + shadowHours);
      });
    }

    return componentIds.map((id) => ({
      componentId: id,
      accumulatedShadowHours: accumulatedMap.get(id) || 0,
      lastProcessedHour: targetHour,
    }));
  }
}

export const shadowCalculator = new ShadowCalculator();
