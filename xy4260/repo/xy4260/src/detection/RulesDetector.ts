import { 
  LayoutModel, 
  DetectionResult, 
  HeatZone, 
  VisionOcclusion, 
  FireExitIssue, 
  EntranceExitConflict,
  Position
} from '../types';

export interface DetectionConfig {
  minEntranceExitDistance: number;
  minFireExitWidth: number;
  crowdDensityThreshold: number;
  occlusionThreshold: number;
}

const DEFAULT_CONFIG: DetectionConfig = {
  minEntranceExitDistance: 8,
  minFireExitWidth: 1.2,
  crowdDensityThreshold: 0.7,
  occlusionThreshold: 0.3,
};

export class RulesDetector {
  private config: DetectionConfig;

  constructor(config: Partial<DetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public detect(model: LayoutModel): DetectionResult {
    const heatZones = this.detectHeatZones(model);
    const visionOcclusions = this.detectVisionOcclusions(model);
    const fireExitIssues = this.detectFireExitIssues(model);
    const entranceExitConflicts = this.detectEntranceExitConflicts(model);

    const totalIssues = 
      heatZones.length + 
      visionOcclusions.length + 
      fireExitIssues.length + 
      entranceExitConflicts.length;

    return {
      heatZones,
      visionOcclusions,
      fireExitIssues,
      entranceExitConflicts,
      totalIssues,
    };
  }

  private detectHeatZones(model: LayoutModel): HeatZone[] {
    const heatZones: HeatZone[] = [];
    const elements = model.elements;

    const entrances = elements.filter(e => e.type === 'entrance');
    const exits = elements.filter(e => e.type === 'exit');
    const cabinets = elements.filter(e => e.type === 'cabinet');
    const interactiveScreens = elements.filter(e => e.type === 'interactive_screen');

    entrances.forEach(entrance => {
      const nearbyCabinets = cabinets.filter(cabinet => 
        this.getDistance(entrance.position, cabinet.position) < 6
      );
      
      if (nearbyCabinets.length > 0) {
        heatZones.push({
          position: {
            x: entrance.position.x,
            y: entrance.position.y,
            z: entrance.position.z,
          },
          intensity: Math.min(nearbyCabinets.length * 0.2, 1),
          radius: 3 + nearbyCabinets.length * 0.5,
          reason: `入口 "${entrance.name}" 附近有 ${nearbyCabinets.length} 个展柜，容易造成人流拥堵`,
        });
      }
    });

    exits.forEach(exit => {
      const nearbyCabinets = cabinets.filter(cabinet => 
        this.getDistance(exit.position, cabinet.position) < 4
      );

      if (nearbyCabinets.length > 0) {
        heatZones.push({
          position: {
            x: exit.position.x,
            y: exit.position.y,
            z: exit.position.z,
          },
          intensity: Math.min(nearbyCabinets.length * 0.3, 1),
          radius: 2.5 + nearbyCabinets.length * 0.3,
          reason: `出口 "${exit.name}" 附近有 ${nearbyCabinets.length} 个展柜，紧急疏散时可能造成危险`,
        });
      }
    });

    interactiveScreens.forEach(screen => {
      const nearbyElements = elements.filter(e => 
        e.id !== screen.id && 
        this.getDistance(screen.position, e.position) < 3
      );

      if (nearbyElements.length > 2) {
        heatZones.push({
          position: {
            x: screen.position.x,
            y: screen.position.y,
            z: screen.position.z,
          },
          intensity: Math.min(nearbyElements.length * 0.15, 0.8),
          radius: 2 + nearbyElements.length * 0.2,
          reason: `互动屏 "${screen.name}" 附近有 ${nearbyElements.length} 个元素，互动区域过于拥挤`,
        });
      }
    });

    cabinets.forEach((cabinet, index) => {
      const nearbyCabinets = cabinets.filter((c, i) => 
        i !== index && 
        this.getDistance(cabinet.position, c.position) < 2.5
      );

      if (nearbyCabinets.length > 2) {
        heatZones.push({
          position: {
            x: cabinet.position.x,
            y: cabinet.position.y,
            z: cabinet.position.z,
          },
          intensity: Math.min(nearbyCabinets.length * 0.2, 0.9),
          radius: 2 + nearbyCabinets.length * 0.3,
          reason: `展柜 "${cabinet.name}" 附近聚集了 ${nearbyCabinets.length + 1} 个展柜，密度过高`,
        });
      }
    });

    return heatZones;
  }

  private detectVisionOcclusions(model: LayoutModel): VisionOcclusion[] {
    const occlusions: VisionOcclusion[] = [];
    const elements = model.elements;

    const cabinets = elements.filter(e => e.type === 'cabinet');
    const interactiveScreens = elements.filter(e => e.type === 'interactive_screen');
    const checkList = [...cabinets, ...interactiveScreens];

    for (let i = 0; i < checkList.length; i++) {
      for (let j = i + 1; j < checkList.length; j++) {
        const element1 = checkList[i];
        const element2 = checkList[j];

        const distance = this.getDistance(element1.position, element2.position);
        
        const minimumDistance = 
          Math.max(
            (element1.scale.x + element1.scale.z) / 2,
            (element2.scale.x + element2.scale.z) / 2
          ) + 0.5;

        if (distance < minimumDistance) {
          const overlapPercentage = Math.min(
            ((minimumDistance - distance) / minimumDistance) * 100,
            100
          );

          if (overlapPercentage > this.config.occlusionThreshold * 100) {
            occlusions.push({
              elementId: element1.id,
              elementName: element1.name,
              occludedBy: element2.id,
              occludedByName: element2.name,
              occlusionPercentage: Math.round(overlapPercentage),
            });

            occlusions.push({
              elementId: element2.id,
              elementName: element2.name,
              occludedBy: element1.id,
              occludedByName: element1.name,
              occlusionPercentage: Math.round(overlapPercentage),
            });
          }
        }
      }
    }

    return occlusions;
  }

  private detectFireExitIssues(model: LayoutModel): FireExitIssue[] {
    const issues: FireExitIssue[] = [];
    const elements = model.elements;

    const fireExits = elements.filter(e => e.type === 'fire_exit');
    const otherElements = elements.filter(e => e.type !== 'fire_exit');

    fireExits.forEach(fireExit => {
      const actualWidth = fireExit.width || fireExit.scale.x * 2;
      const requiredWidth = fireExit.minimumRequiredWidth || this.config.minFireExitWidth;

      if (actualWidth < requiredWidth) {
        issues.push({
          elementId: fireExit.id,
          elementName: fireExit.name,
          issue: 'width_insufficient',
          details: `消防通道宽度不足。当前宽度: ${actualWidth.toFixed(1)}米，要求宽度: ${requiredWidth.toFixed(1)}米`,
        });
      }

      otherElements.forEach(element => {
        const distance = this.getDistance(fireExit.position, element.position);
        
        const safeDistance = 
          Math.max(
            (fireExit.scale.x + fireExit.scale.z) / 2,
            (element.scale.x + element.scale.z) / 2
          ) + 1;

        if (distance < safeDistance) {
          issues.push({
            elementId: fireExit.id,
            elementName: fireExit.name,
            issue: 'blocked',
            details: `消防通道被 "${element.name}" 阻挡。距离: ${distance.toFixed(2)}米，安全距离要求: ${safeDistance.toFixed(2)}米`,
          });
        }
      });
    });

    return issues;
  }

  private detectEntranceExitConflicts(model: LayoutModel): EntranceExitConflict[] {
    const conflicts: EntranceExitConflict[] = [];
    const elements = model.elements;

    const entrances = elements.filter(e => e.type === 'entrance');
    const exits = elements.filter(e => e.type === 'exit');

    entrances.forEach(entrance => {
      exits.forEach(exit => {
        const distance = this.getDistance(entrance.position, exit.position);

        if (distance < this.config.minEntranceExitDistance) {
          conflicts.push({
            entranceId: entrance.id,
            entranceName: entrance.name,
            exitId: exit.id,
            exitName: exit.name,
            distance: Math.round(distance * 100) / 100,
            minimumRequiredDistance: this.config.minEntranceExitDistance,
          });
        }
      });
    });

    return conflicts;
  }

  private getDistance(pos1: Position, pos2: Position): number {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  public getConfig(): DetectionConfig {
    return { ...this.config };
  }

  public setConfig(config: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
