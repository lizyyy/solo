import {
  LightingScenario,
  Risk,
  RiskType,
  TrayCoverage,
  DailyConsumption,
  HeatLevel,
  LightFixture,
  LightModel,
  TimeSlot,
} from '../models/types.js';
import { CostCalculator } from './cost-calculator.js';
import { IlluminanceCalculator } from './illuminance-calculator.js';

export interface RiskAssessmentInput {
  scenario: LightingScenario;
  trayCoverages: TrayCoverage[];
  consumption: DailyConsumption;
}

export class RiskAssessor {
  private costCalculator: CostCalculator;
  private illuminanceCalculator: IlluminanceCalculator;

  constructor() {
    this.costCalculator = new CostCalculator();
    this.illuminanceCalculator = new IlluminanceCalculator();
  }

  assess(input: RiskAssessmentInput): Risk[] {
    const risks: Risk[] = [];

    risks.push(...this.assessDarkZones(input));
    risks.push(...this.assessOverlapWaste(input));
    risks.push(...this.assessHeatRisk(input));
    risks.push(...this.assessTimeConflicts(input));
    risks.push(...this.assessBudget(input));

    return risks;
  }

  private assessDarkZones(input: RiskAssessmentInput): Risk[] {
    const risks: Risk[] = [];

    const uncoveredTrays = input.trayCoverages.filter(t => !t.meetsRequirement);

    if (uncoveredTrays.length > 0) {
      for (const tray of uncoveredTrays) {
        const coveragePercent = (tray.coverageRatio * 100).toFixed(1);
        
        const samplePoints = tray.samplePoints;
        const overlapPoints = samplePoints.filter(p => p.contributingLights.length > 0);
        const darkPoints = samplePoints.filter(p => p.totalLux < tray.samplePoints[0]?.requiredLux);
        
        const hasOverlapWithDarkZone = overlapPoints.length > 0 && darkPoints.length > 0;

        if (hasOverlapWithDarkZone) {
          risks.push({
            type: RiskType.DARK_ZONE,
            severity: 'high',
            message: `托盘 "${tray.trayName || tray.trayId}" 存在暗区，且存在灯具照射范围重叠但仍有光照不足的区域。覆盖率: ${coveragePercent}%，有 ${darkPoints.length} 个采样点照度不足`,
            details: {
              trayId: tray.trayId,
              trayName: tray.trayName,
              coveragePercent: Number(coveragePercent),
              darkPointCount: darkPoints.length,
              totalPoints: tray.totalPoints,
              hasOverlappingLights: true,
            },
          });
        } else {
          risks.push({
            type: RiskType.DARK_ZONE,
            severity: 'high',
            message: `托盘 "${tray.trayName || tray.trayId}" 光照覆盖率不足。覆盖率: ${coveragePercent}%`,
            details: {
              trayId: tray.trayId,
              trayName: tray.trayName,
              coveragePercent: Number(coveragePercent),
              darkPointCount: tray.darkZones.length,
              totalPoints: tray.totalPoints,
            },
          });
        }
      }
    }

    return risks;
  }

  private assessOverlapWaste(input: RiskAssessmentInput): Risk[] {
    const risks: Risk[] = [];
    const { scenario } = input;

    const overlapInfos = this.findOverlappingFixtures(scenario);

    for (const overlap of overlapInfos) {
      const fixture1 = scenario.fixtures.find(f => f.id === overlap.fixtureId1);
      const fixture2 = scenario.fixtures.find(f => f.id === overlap.fixtureId2);
      const model1 = scenario.lightModels.find(m => m.id === fixture1?.modelId);
      const model2 = scenario.lightModels.find(m => m.id === fixture2?.modelId);

      const name1 = fixture1?.name || fixture1?.id || 'unknown';
      const name2 = fixture2?.name || fixture2?.id || 'unknown';

      const hasTimeOverlap = this.checkFixtureTimeOverlap(fixture1, fixture2);

      if (hasTimeOverlap) {
        const totalPower = (model1?.power || 0) + (model2?.power || 0);
        
        risks.push({
          type: RiskType.OVERLAP_WASTE,
          severity: totalPower > 100 ? 'medium' : 'low',
          message: `灯具 "${name1}" 和 "${name2}" 照射范围有重叠，且开启时段也有重叠，可能造成电力浪费`,
          details: {
            fixtureId1: overlap.fixtureId1,
            fixtureId2: overlap.fixtureId2,
            overlapDistance: overlap.distance,
            totalPower,
            hasTimeOverlap: true,
          },
        });
      } else {
        risks.push({
          type: RiskType.OVERLAP_WASTE,
          severity: 'low',
          message: `灯具 "${name1}" 和 "${name2}" 照射范围有重叠，但开启时段不同，浪费风险较低`,
          details: {
            fixtureId1: overlap.fixtureId1,
            fixtureId2: overlap.fixtureId2,
            overlapDistance: overlap.distance,
            hasTimeOverlap: false,
          },
        });
      }
    }

    return risks;
  }

  private findOverlappingFixtures(scenario: LightingScenario): Array<{
    fixtureId1: string;
    fixtureId2: string;
    distance: number;
  }> {
    const overlaps: Array<{
      fixtureId1: string;
      fixtureId2: string;
      distance: number;
    }> = [];

    const maxTrayHeight = Math.max(...scenario.plantTrays.map(t => t.height), 0);

    for (let i = 0; i < scenario.fixtures.length; i++) {
      for (let j = i + 1; j < scenario.fixtures.length; j++) {
        const fixture1 = scenario.fixtures[i];
        const fixture2 = scenario.fixtures[j];
        const model1 = scenario.lightModels.find(m => m.id === fixture1.modelId);
        const model2 = scenario.lightModels.find(m => m.id === fixture2.modelId);

        if (!model1 || !model2) continue;

        const dx = fixture1.position.x - fixture2.position.x;
        const dy = fixture1.position.y - fixture2.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (this.illuminanceCalculator.checkLightOverlap(
          fixture1, fixture2, model1, model2, maxTrayHeight
        )) {
          overlaps.push({
            fixtureId1: fixture1.id,
            fixtureId2: fixture2.id,
            distance,
          });
        }
      }
    }

    return overlaps;
  }

  private checkFixtureTimeOverlap(
    fixture1: LightFixture | undefined,
    fixture2: LightFixture | undefined
  ): boolean {
    if (!fixture1 || !fixture2) return false;

    for (const slot1 of fixture1.timeSlots) {
      for (const slot2 of fixture2.timeSlots) {
        if (this.costCalculator.doSlotsOverlap(slot1, slot2)) {
          return true;
        }
      }
    }

    return false;
  }

  private assessHeatRisk(input: RiskAssessmentInput): Risk[] {
    const risks: Risk[] = [];
    const { scenario } = input;

    const highHeatFixtures = scenario.fixtures.filter(f => {
      const model = scenario.lightModels.find(m => m.id === f.modelId);
      return model?.heatLevel === HeatLevel.HIGH;
    });

    for (const fixture of highHeatFixtures) {
      const model = scenario.lightModels.find(m => m.id === fixture.modelId);
      const name = fixture.name || fixture.id;

      for (const tray of scenario.plantTrays) {
        const trayCenterX = tray.position.x + tray.position.width / 2;
        const trayCenterY = tray.position.y + tray.position.depth / 2;
        
        const dx = fixture.position.x - trayCenterX;
        const dy = fixture.position.y - trayCenterY;
        const horizontalDistance = Math.sqrt(dx * dx + dy * dy);
        const verticalDistance = fixture.position.z - tray.height;

        if (verticalDistance < 0.5) {
          risks.push({
            type: RiskType.HEAT_RISK,
            severity: 'high',
            message: `高发热灯具 "${name}" 安装位置过低 (${verticalDistance.toFixed(2)}m)，可能灼伤植物托盘 "${tray.name || tray.id}"`,
            details: {
              fixtureId: fixture.id,
              fixtureName: fixture.name,
              trayId: tray.id,
              trayName: tray.name,
              verticalDistance,
              horizontalDistance,
              heatLevel: model?.heatLevel,
            },
          });
        } else if (verticalDistance < 1.0) {
          risks.push({
            type: RiskType.HEAT_RISK,
            severity: 'medium',
            message: `高发热灯具 "${name}" 距离植物托盘 "${tray.name || tray.id}" 较近 (${verticalDistance.toFixed(2)}m)，请注意通风散热`,
            details: {
              fixtureId: fixture.id,
              fixtureName: fixture.name,
              trayId: tray.id,
              trayName: tray.name,
              verticalDistance,
              heatLevel: model?.heatLevel,
            },
          });
        }
      }
    }

    const concurrentHighHeat = this.findConcurrentHighHeat(scenario);
    if (concurrentHighHeat.length > 1) {
      risks.push({
        type: RiskType.HEAT_RISK,
        severity: 'medium',
        message: `有 ${concurrentHighHeat.length} 个高发热灯具在同一时段开启，请注意房间散热`,
        details: {
          fixtureIds: concurrentHighHeat,
          count: concurrentHighHeat.length,
        },
      });
    }

    return risks;
  }

  private findConcurrentHighHeat(scenario: LightingScenario): string[] {
    const highHeatFixtures = scenario.fixtures.filter(f => {
      const model = scenario.lightModels.find(m => m.id === f.modelId);
      return model?.heatLevel === HeatLevel.HIGH;
    });

    const concurrentFixtures: string[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const activeAtHour = highHeatFixtures.filter(f =>
        f.timeSlots.some(slot => hour >= slot.startHour && hour < slot.endHour)
      );

      if (activeAtHour.length > 1) {
        for (const f of activeAtHour) {
          if (!concurrentFixtures.includes(f.id)) {
            concurrentFixtures.push(f.id);
          }
        }
      }
    }

    return concurrentFixtures;
  }

  private assessTimeConflicts(input: RiskAssessmentInput): Risk[] {
    const risks: Risk[] = [];
    const { scenario } = input;

    for (const fixture of scenario.fixtures) {
      const overlaps = this.costCalculator.findOverlappingSlots(fixture.timeSlots);
      
      if (overlaps.length > 0) {
        const name = fixture.name || fixture.id;
        
        risks.push({
          type: RiskType.TIME_CONFLICT,
          severity: 'low',
          message: `灯具 "${name}" 的开启时段存在重叠，计算时会自动合并`,
          details: {
            fixtureId: fixture.id,
            fixtureName: fixture.name,
            overlappingSlotPairs: overlaps,
          },
        });
      }
    }

    return risks;
  }

  private assessBudget(input: RiskAssessmentInput): Risk[] {
    const risks: Risk[] = [];
    const { consumption } = input;

    if (consumption.budgetExceeded) {
      risks.push({
        type: RiskType.BUDGET_EXCEEDED,
        severity: 'high',
        message: `每日电费超出预算！预算: ¥${consumption.totalCost - consumption.budgetExcess}，实际: ¥${consumption.totalCost.toFixed(2)}，超出: ¥${consumption.budgetExcess.toFixed(2)}`,
        details: {
          budget: consumption.totalCost - consumption.budgetExcess,
          actual: consumption.totalCost,
          excess: consumption.budgetExcess,
        },
      });
    }

    return risks;
  }
}
