import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { SignOffRequest, SignOffResponse, SignOffResult, RiskLevel, TemperatureBoxStatus } from '../types';
import { OperationLogService } from './OperationLogService';
import { TemperatureBoxService } from './TemperatureBoxService';
import { RiderHandoverService } from './RiderHandoverService';
import { GPSService } from './GPSService';
import { SignOffPersonService } from './SignOffPersonService';
import { RiskAssessmentService } from './RiskAssessmentService';

export class SignOffService {
  static async executeSignOff(request: SignOffRequest): Promise<SignOffResponse> {
    const duplicateCheck = await db.get<any>(
      `SELECT * FROM sign_off_records WHERE box_id = ? AND sign_off_person_id = ?`,
      [request.boxId, request.signOffPersonId]
    );

    if (duplicateCheck) {
      return {
        success: false,
        result: SignOffResult.DUPLICATE,
        message: '该温度箱已由此签收人签收'
      };
    }

    const blockedReasons: string[] = [];

    const personValidation = await SignOffPersonService.validateSignOffPerson(request.signOffPersonId);
    if (!personValidation.valid) {
      blockedReasons.push(...personValidation.reasons);
    }

    const handoverValidation = await RiderHandoverService.validateHandover(request.boxId);
    if (!handoverValidation.valid) {
      blockedReasons.push(...handoverValidation.reasons);
    }

    const tempValidation = await GPSService.validateTemperatureContinuity(request.boxId);
    if (!tempValidation.valid) {
      blockedReasons.push(...tempValidation.reasons);
    }

    const assessment = await RiskAssessmentService.assessRisk(
      request.boxId,
      request.operatorId,
      request.operatorName
    );

    if (assessment.level === RiskLevel.CRITICAL || assessment.level === RiskLevel.HIGH) {
      blockedReasons.push(`风险等级为 ${assessment.level}，需要人工复核`);
    }

    if (blockedReasons.length > 0 && assessment.level === RiskLevel.CRITICAL) {
      await this.saveSignOffRecord(request, SignOffResult.BLOCKED, assessment.level, blockedReasons);
      return {
        success: false,
        result: SignOffResult.BLOCKED,
        message: '签收被规则拦截',
        riskLevel: assessment.level,
        blockedReasons
      };
    }

    if (blockedReasons.length > 0) {
      await this.saveSignOffRecord(request, SignOffResult.NEEDS_REVIEW, assessment.level, blockedReasons);
      return {
        success: false,
        result: SignOffResult.NEEDS_REVIEW,
        message: '需要人工复核',
        riskLevel: assessment.level,
        blockedReasons
      };
    }

    await TemperatureBoxService.updateBoxStatus(
      request.boxId,
      TemperatureBoxStatus.DELIVERED,
      request.temperature,
      request.operatorId,
      request.operatorName
    );

    await this.saveSignOffRecord(request, SignOffResult.SUCCESS, assessment.level, []);

    return {
      success: true,
      result: SignOffResult.SUCCESS,
      message: '签收成功',
      riskLevel: assessment.level
    };
  }

  private static async saveSignOffRecord(
    request: SignOffRequest,
    result: SignOffResult,
    riskLevel: RiskLevel,
    blockedReasons: string[]
  ): Promise<void> {
    const id = uuidv4();
    await db.run(
      `INSERT INTO sign_off_records (id, box_id, sign_off_person_id, sign_off_time, temperature, location, result, risk_level, blocked_reasons, operator_id, operator_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        request.boxId,
        request.signOffPersonId,
        request.signOffTime,
        request.temperature,
        request.location,
        result,
        riskLevel,
        JSON.stringify(blockedReasons),
        request.operatorId,
        request.operatorName
      ]
    );

    await OperationLogService.createLog(
      'signoff',
      'sign_off_record',
      id,
      request.operatorId,
      request.operatorName,
      null,
      { request, result, riskLevel, blockedReasons },
      `签收结果: ${result}`
    );
  }

  static async manualReview(
    boxId: string,
    signOffPersonId: string,
    operatorId: string,
    operatorName: string,
    approved: boolean
  ): Promise<SignOffResponse> {
    const pendingRecord = await db.get<any>(
      `SELECT * FROM sign_off_records WHERE box_id = ? AND result IN (?, ?) ORDER BY sign_off_time DESC LIMIT 1`,
      [boxId, SignOffResult.NEEDS_REVIEW, SignOffResult.BLOCKED]
    );

    if (!pendingRecord) {
      throw new Error('没有待复核的签收记录');
    }

    if (approved) {
      await TemperatureBoxService.updateBoxStatus(
        boxId,
        TemperatureBoxStatus.DELIVERED,
        pendingRecord.temperature,
        operatorId,
        operatorName
      );

      await db.run(
        `UPDATE sign_off_records SET result = ? WHERE id = ?`,
        [SignOffResult.SUCCESS, pendingRecord.id]
      );

      await OperationLogService.createLog(
        'review_approve',
        'sign_off_record',
        pendingRecord.id,
        operatorId,
        operatorName,
        null,
        { approved: true },
        '人工复核通过'
      );

      return {
        success: true,
        result: SignOffResult.SUCCESS,
        message: '人工复核通过，签收成功'
      };
    } else {
      await OperationLogService.createLog(
        'review_reject',
        'sign_off_record',
        pendingRecord.id,
        operatorId,
        operatorName,
        null,
        { approved: false },
        '人工复核拒绝'
      );

      return {
        success: false,
        result: SignOffResult.BLOCKED,
        message: '人工复核拒绝签收'
      };
    }
  }

  static async getSignOffRecords(boxId?: string) {
    let sql = `SELECT * FROM sign_off_records`;
    const params: any[] = [];
    
    if (boxId) {
      sql += ` WHERE box_id = ?`;
      params.push(boxId);
    }
    sql += ` ORDER BY sign_off_time DESC`;
    
    const rows = await db.all<any>(sql, params);
    return rows.map(row => ({
      id: row.id,
      boxId: row.box_id,
      signOffPersonId: row.sign_off_person_id,
      signOffTime: row.sign_off_time,
      temperature: row.temperature,
      location: row.location,
      result: row.result,
      riskLevel: row.risk_level,
      blockedReasons: JSON.parse(row.blocked_reasons || '[]'),
      operatorId: row.operator_id,
      operatorName: row.operator_name
    }));
  }
}
