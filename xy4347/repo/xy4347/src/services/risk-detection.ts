import { DatabaseService } from './database';
import { RiskItem, RiskReport, Route, WallZone, Hold, Feedback } from '../types';

type RiskType = 'difficulty_gap' | 'hold_expired' | 'children_conflict';
type Severity = 'low' | 'medium' | 'high' | 'critical';

export class RiskDetectionService {
  private db: DatabaseService;
  private readonly DIFFICULTY_GAP_THRESHOLD = 3;
  private readonly USE_COUNT_WARNING_RATIO = 0.8;
  private readonly USE_COUNT_DANGER_RATIO = 0.95;
  private readonly POSITION_OVERLAP_THRESHOLD = 20;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  detectAllRisks(): RiskReport {
    const risks: RiskItem[] = [];

    risks.push(...this.detectDifficultyGaps());
    risks.push(...this.detectExpiredHolds());
    risks.push(...this.detectChildrenRouteConflicts());

    const bySeverity = {
      critical: risks.filter(r => r.severity === 'critical').length,
      high: risks.filter(r => r.severity === 'high').length,
      medium: risks.filter(r => r.severity === 'medium').length,
      low: risks.filter(r => r.severity === 'low').length
    };

    const byType = {
      difficulty_gap: risks.filter(r => r.type === 'difficulty_gap').length,
      hold_expired: risks.filter(r => r.type === 'hold_expired').length,
      children_conflict: risks.filter(r => r.type === 'children_conflict').length
    };

    return {
      totalRisks: risks.length,
      bySeverity,
      byType,
      risks: risks.sort((a, b) => {
        const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      generatedAt: new Date().toISOString()
    };
  }

  private detectDifficultyGaps(): RiskItem[] {
    const risks: RiskItem[] = [];
    const zones = this.db.getWallZones();

    for (const zone of zones) {
      const zoneRoutes = this.db.getRoutesByZone(zone.code).filter(r => !r.isChildrenRoute);
      
      if (zoneRoutes.length === 0) continue;

      const difficulties = zoneRoutes.map(r => r.difficulty).sort((a, b) => a - b);
      
      for (let i = 1; i < difficulties.length; i++) {
        const gap = difficulties[i] - difficulties[i - 1];
        
        if (gap >= this.DIFFICULTY_GAP_THRESHOLD) {
          const affectedRoutes = zoneRoutes.filter(r => 
            r.difficulty === difficulties[i] || r.difficulty === difficulties[i - 1]
          );

          const severity: Severity = gap >= 5 ? 'critical' : gap >= 4 ? 'high' : 'medium';
          
          risks.push({
            id: `gap_${zone.code}_${difficulties[i-1]}_${difficulties[i]}`,
            type: 'difficulty_gap',
            severity,
            title: `区域 "${zone.name}" 存在难度断层`,
            description: `区域内难度 ${difficulties[i - 1]} 和 ${difficulties[i]} 之间存在 ${gap} 级的断层，超出建议阈值 ${this.DIFFICULTY_GAP_THRESHOLD} 级`,
            location: `区域: ${zone.name} (${zone.code})`,
            affectedItems: affectedRoutes.map(r => `${r.name} (${r.code}) - 难度: ${r.difficulty}`),
            recommendations: [
              `建议在难度 ${difficulties[i - 1]} 和 ${difficulties[i]} 之间补充难度级别`,
              `或者调整现有线路难度以缩小断层`,
              `考虑该区域是否适合不同水平的攀岩者`
            ],
            detectedAt: new Date().toISOString()
          });
        }
      }

      const minZone = zone.difficultyRangeMin;
      const maxZone = zone.difficultyRangeMax;
      const actualMin = Math.min(...difficulties);
      const actualMax = Math.max(...difficulties);

      if (actualMin > minZone + this.DIFFICULTY_GAP_THRESHOLD) {
        risks.push({
          id: `gap_lower_${zone.code}`,
          type: 'difficulty_gap',
          severity: 'medium',
          title: `区域 "${zone.name}" 缺少低级难度线路`,
          description: `区域设计难度下限为 ${minZone}，但实际最低难度为 ${actualMin}，差距过大`,
          location: `区域: ${zone.name} (${zone.code})`,
          affectedItems: ['无低难度线路'],
          recommendations: [
            `建议在该区域增加难度 ${minZone} 到 ${actualMin - 1} 的线路`,
            `或者调整区域难度范围设置`
          ],
          detectedAt: new Date().toISOString()
        });
      }

      if (actualMax < maxZone - this.DIFFICULTY_GAP_THRESHOLD) {
        risks.push({
          id: `gap_upper_${zone.code}`,
          type: 'difficulty_gap',
          severity: 'medium',
          title: `区域 "${zone.name}" 缺少高级难度线路`,
          description: `区域设计难度上限为 ${maxZone}，但实际最高难度为 ${actualMax}，差距过大`,
          location: `区域: ${zone.name} (${zone.code})`,
          affectedItems: ['无高难度线路'],
          recommendations: [
            `建议在该区域增加难度 ${actualMax + 1} 到 ${maxZone} 的线路`,
            `或者调整区域难度范围设置`
          ],
          detectedAt: new Date().toISOString()
        });
      }
    }

    return risks;
  }

  private detectExpiredHolds(): RiskItem[] {
    const risks: RiskItem[] = [];
    const holds = this.db.getAllHolds();

    for (const hold of holds) {
      const useRatio = hold.currentUseCount / hold.maxUseCount;
      
      if (useRatio >= this.USE_COUNT_WARNING_RATIO) {
        let severity: Severity = 'low';
        let title = '';
        let description = '';

        if (useRatio >= this.USE_COUNT_DANGER_RATIO) {
          severity = 'critical';
          title = `抓点 "${hold.name}" 严重磨损，需立即更换`;
          description = `抓点已使用 ${hold.currentUseCount} 次，达到最大使用次数 ${hold.maxUseCount} 的 ${(useRatio * 100).toFixed(1)}%，存在安全风险`;
        } else if (useRatio >= 0.9) {
          severity = 'high';
          title = `抓点 "${hold.name}" 接近使用寿命终点`;
          description = `抓点已使用 ${hold.currentUseCount} 次，达到最大使用次数 ${hold.maxUseCount} 的 ${(useRatio * 100).toFixed(1)}%，建议近期更换`;
        } else {
          severity = 'medium';
          title = `抓点 "${hold.name}" 磨损预警`;
          description = `抓点已使用 ${hold.currentUseCount} 次，达到最大使用次数 ${hold.maxUseCount} 的 ${(useRatio * 100).toFixed(1)}%，建议关注`;
        }

        const wearRecords = this.db.getWearRecordsByHold(hold.code);
        const latestWear = wearRecords[0];

        risks.push({
          id: `hold_${hold.code}`,
          type: 'hold_expired',
          severity,
          title,
          description,
          location: `位置: ${hold.position} (${hold.code})`,
          affectedItems: [
            `抓点: ${hold.name}`,
            `类型: ${hold.type}`,
            `当前使用: ${hold.currentUseCount}/${hold.maxUseCount}`,
            latestWear ? `最近检查: ${latestWear.recordDate}, 磨损等级: ${latestWear.wearLevel}` : '无检查记录'
          ],
          recommendations: severity === 'critical' ? [
            '立即安排更换该抓点',
            '临时关闭涉及该抓点的线路',
            '记录更换日期并重置使用计数'
          ] : severity === 'high' ? [
            '安排在1-2周内更换',
            '增加检查频率',
            '准备好替换抓点'
          ] : [
            '纳入下次维护计划',
            '继续监控使用情况'
          ],
          detectedAt: new Date().toISOString()
        });
      }

      if (hold.status === 'maintenance') {
        risks.push({
          id: `hold_maint_${hold.code}`,
          type: 'hold_expired',
          severity: 'high',
          title: `抓点 "${hold.name}" 处于维护状态`,
          description: `该抓点当前状态为维护中，涉及的线路可能无法正常使用`,
          location: `位置: ${hold.position} (${hold.code})`,
          affectedItems: [
            `抓点: ${hold.name}`,
            `状态: ${hold.status}`,
            `最后检查: ${hold.lastInspectionDate || '未知'}`
          ],
          recommendations: [
            '检查维护进度',
            '确认涉及线路是否需要临时关闭',
            '完成维护后更新状态'
          ],
          detectedAt: new Date().toISOString()
        });
      }
    }

    return risks;
  }

  private detectChildrenRouteConflicts(): RiskItem[] {
    const risks: RiskItem[] = [];
    const childrenRoutes = this.db.getChildrenRoutes();

    if (childrenRoutes.length < 2) return risks;

    const routePositions: Map<string, { x: number; y: number }[]> = new Map();

    for (const route of childrenRoutes) {
      try {
        const positions = route.holdPositions ? JSON.parse(route.holdPositions) : [];
        const posList: { x: number; y: number }[] = [];

        if (route.startPosition) {
          const [sx, sy] = route.startPosition.split(',').map(Number);
          if (!isNaN(sx) && !isNaN(sy)) {
            posList.push({ x: sx, y: sy });
          }
        }

        for (const pos of positions) {
          if (pos.x !== undefined && pos.y !== undefined) {
            posList.push({ x: pos.x, y: pos.y });
          }
        }

        routePositions.set(route.code, posList);
      } catch (e) {
        continue;
      }
    }

    const checkedPairs = new Set<string>();
    const routeCodes = childrenRoutes.map(r => r.code);

    for (let i = 0; i < routeCodes.length; i++) {
      for (let j = i + 1; j < routeCodes.length; j++) {
        const code1 = routeCodes[i];
        const code2 = routeCodes[j];
        const pairKey = `${code1}_${code2}`;

        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        const pos1 = routePositions.get(code1) || [];
        const pos2 = routePositions.get(code2) || [];

        let overlappingPoints = 0;
        const overlappingDetails: string[] = [];

        for (const p1 of pos1) {
          for (const p2 of pos2) {
            const distance = Math.sqrt(
              Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)
            );

            if (distance < this.POSITION_OVERLAP_THRESHOLD) {
              overlappingPoints++;
              overlappingDetails.push(
                `点位接近: (${p1.x},${p1.y}) 与 (${p2.x},${p2.y}), 距离: ${distance.toFixed(1)}`
              );
            }
          }
        }

        if (overlappingPoints > 0) {
          const route1 = childrenRoutes.find(r => r.code === code1)!;
          const route2 = childrenRoutes.find(r => r.code === code2)!;

          const severity: Severity = overlappingPoints >= 3 ? 'high' : 
                                     overlappingPoints >= 2 ? 'medium' : 'low';

          risks.push({
            id: `child_conflict_${code1}_${code2}`,
            type: 'children_conflict',
            severity,
            title: `儿童线路 "${route1.name}" 与 "${route2.name}" 落点冲突`,
            description: `两条儿童线路存在 ${overlappingPoints} 个距离过近的抓点，可能导致儿童攀爬时互相干扰`,
            location: `区域: ${route1.zoneCode || '未知'}`,
            affectedItems: [
              `线路1: ${route1.name} (${route1.code})`,
              `线路2: ${route2.name} (${route2.code})`,
              ...overlappingDetails
            ],
            recommendations: [
              '考虑调整其中一条线路的抓点位置',
              '如果是共用抓点，需要评估是否适合儿童线路',
              '可以考虑将两条线路安排在不同时间段开放'
            ],
            detectedAt: new Date().toISOString()
          });
        }
      }
    }

    return risks;
  }

  getRiskSummary(): { [key: string]: number } {
    const report = this.detectAllRisks();
    return {
      total: report.totalRisks,
      critical: report.bySeverity.critical,
      high: report.bySeverity.high,
      medium: report.bySeverity.medium,
      low: report.bySeverity.low
    };
  }
}
