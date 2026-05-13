import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { RiskAssessment, RiskLevel } from '../types';
import { OperationLogService } from './OperationLogService';
import { GPSService } from './GPSService';
import { RiderHandoverService } from './RiderHandoverService';
import { TemperatureBoxService } from './TemperatureBoxService';

export class RiskAssessmentService {
  static async assessRisk(
    boxId: string,
    operatorId: string,
    operatorName: string
  ): Promise<RiskAssessment> {
    const factors: string[] = [];
    let score = 0;

    const tempValidation = await GPSService.validateTemperatureContinuity(boxId);
    if (!tempValidation.valid) {
      factors.push(...tempValidation.reasons);
      score += tempValidation.reasons.length * 25;
    }

    const handoverValidation = await RiderHandoverService.validateHandover(boxId);
    if (!handoverValidation.valid) {
      factors.push(...handoverValidation.reasons);
      score += handoverValidation.reasons.length * 20;
    }

    const latestNode = await GPSService.getLatestNode(boxId);
    if (latestNode && latestNode.batteryLevel < 20) {
      factors.push('GPS设备电量不足20%');
      score += 15;
    }

    const box = await TemperatureBoxService.getBox(boxId);
    if (box) {
      if (box.currentTemp < box.minTemp - 2 || box.currentTemp > box.maxTemp + 2) {
        factors.push('当前温度严重偏离范围');
        score += 30;
      }
    }

    let level: RiskLevel;
    if (score < 25) {
      level = RiskLevel.LOW;
    } else if (score < 50) {
      level = RiskLevel.MEDIUM;
    } else if (score < 75) {
      level = RiskLevel.HIGH;
    } else {
      level = RiskLevel.CRITICAL;
    }

    const assessment: RiskAssessment = {
      id: uuidv4(),
      boxId,
      level,
      score,
      factors,
      assessedAt: new Date().toISOString(),
      assessedBy: operatorId
    };

    await db.run(
      `INSERT INTO risk_assessments (id, box_id, level, score, factors, assessed_at, assessed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        assessment.id,
        assessment.boxId,
        assessment.level,
        assessment.score,
        JSON.stringify(assessment.factors),
        assessment.assessedAt,
        assessment.assessedBy
      ]
    );

    await OperationLogService.createLog(
      'assess',
      'risk_assessment',
      assessment.id,
      operatorId,
      operatorName,
      null,
      assessment,
      `风险评估结果: ${level}`
    );

    return assessment;
  }

  static async getLatestAssessment(boxId: string): Promise<RiskAssessment | undefined> {
    const row = await db.get<any>(
      `SELECT * FROM risk_assessments WHERE box_id = ? ORDER BY assessed_at DESC LIMIT 1`,
      [boxId]
    );
    return row ? this.mapRowToAssessment(row) : undefined;
  }

  private static mapRowToAssessment(row: any): RiskAssessment {
    return {
      id: row.id,
      boxId: row.box_id,
      level: row.level as RiskLevel,
      score: row.score,
      factors: JSON.parse(row.factors || '[]'),
      assessedAt: row.assessed_at,
      assessedBy: row.assessed_by
    };
  }
}
