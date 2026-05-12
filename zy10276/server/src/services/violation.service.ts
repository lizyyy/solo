import db from '../database/db';
import ViolationDAO from '../dao/violation.dao';
import ShiftDAO from '../dao/shift.dao';
import ProcessingHistoryDAO from '../dao/history.dao';
import AppealDAO from '../dao/appeal.dao';
import PenaltyDAO from '../dao/penalty.dao';
import VehicleDAO from '../dao/vehicle.dao';
import DriverDAO from '../dao/driver.dao';
import { v4 as uuidv4 } from 'uuid';

export interface ImportResult {
  batchId: string;
  fileName: string;
  importedBy: string;
  total: number;
  successful: number;
  duplicate: number;
  importedViolations: any[];
}

export class ViolationService {
  static async importViolations(data: any[], fileName: string, importedBy: string): Promise<ImportResult> {
    return db.transaction(() => {
      const batchId = uuidv4();
      const now = new Date().toISOString();
      let successful = 0;
      let duplicate = 0;
      const importedViolations: any[] = [];

      const batchStmt = db.prepare(`
        INSERT INTO import_batches (id, file_name, imported_by, total_records, successful_records, duplicate_records, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of data) {
        const violationNumber = item.violationNumber || item.违章编号;
        const plateNumber = item.plateNumber || item.车牌号;
        const violationTime = item.violationTime || item.违章时间 || now;

        if (ViolationDAO.checkDuplicate(violationNumber, plateNumber, violationTime)) {
          duplicate++;
          continue;
        }

        const vehicle = VehicleDAO.getByPlateNumber(plateNumber);
        let matchedShiftId: string | undefined;
        let matchedDriverId: string | undefined;
        let status = 'imported';

        if (vehicle) {
          const matchingShifts = ShiftDAO.findMatchingShifts(vehicle.id, violationTime);
          if (matchingShifts.length === 1) {
            matchedShiftId = matchingShifts[0].id;
            matchedDriverId = matchingShifts[0].driverId;
            status = 'pending_confirmation';
          }
        }

        const violation = ViolationDAO.create({
          violationNumber,
          plateNumber,
          vehicleId: vehicle?.id,
          violationTime,
          violationType: item.violationType || item.违章类型 || 'other',
          location: item.location || item.违章地点 || '',
          description: item.description || item.违章描述 || '',
          points: parseInt(item.points || item.扣分 || 0),
          fineAmount: parseFloat(item.fineAmount || item.罚款金额 || 0),
          status,
          matchedShiftId,
          matchedDriverId,
          importBatchId: batchId,
          importedBy,
        });

        successful++;
        importedViolations.push(violation);

        ProcessingHistoryDAO.create({
          violationId: violation.id,
          action: '导入违章记录',
          operator: importedBy,
          operatorId: 'system',
          remarks: `通过文件 ${fileName} 导入`,
        });

        if (status === 'pending_confirmation' && matchedShiftId) {
          ProcessingHistoryDAO.create({
            violationId: violation.id,
            action: '自动匹配班次',
            operator: importedBy,
            operatorId: 'system',
            remarks: `自动匹配到班次: ${matchedShiftId}`,
            oldStatus: 'imported',
            newStatus: 'pending_confirmation',
          });
        }
      }

      batchStmt.run(batchId, fileName, importedBy, data.length, successful, duplicate, now);

      return {
        batchId,
        fileName,
        importedBy,
        total: data.length,
        successful,
        duplicate,
        importedViolations,
      };
    })();
  }

  static async matchShift(violationId: string, shiftId: string, operator: string, operatorId: string): Promise<any> {
    return db.transaction(() => {
      const violation = ViolationDAO.getById(violationId);
      const shift = ShiftDAO.getById(shiftId);

      if (!violation || !shift) {
        throw new Error('违章记录或班次不存在');
      }

      const oldStatus = violation.status;
      const updated = ViolationDAO.update(violationId, {
        matchedShiftId: shiftId,
        matchedDriverId: shift.driverId,
        status: 'pending_confirmation',
      });

      ProcessingHistoryDAO.create({
        violationId,
        action: '人工匹配班次',
        operator,
        operatorId,
        remarks: `匹配班次: ${shiftId}, 司机: ${shift.driverId}`,
        oldStatus,
        newStatus: 'pending_confirmation',
      });

      return updated;
    })();
  }

  static async confirmViolation(violationId: string, driverId: string, operator: string, operatorId: string): Promise<any> {
    return db.transaction(() => {
      const violation = ViolationDAO.getById(violationId);
      if (!violation) {
        throw new Error('违章记录不存在');
      }

      const oldStatus = violation.status;
      const updated = ViolationDAO.update(violationId, {
        matchedDriverId: driverId,
        status: 'confirmed',
      });

      ProcessingHistoryDAO.create({
        violationId,
        action: '司机确认违章',
        operator,
        operatorId,
        remarks: '司机已确认违章信息',
        oldStatus,
        newStatus: 'confirmed',
      });

      return updated;
    })();
  }

  static async submitAppeal(violationId: string, driverId: string, reason: string, materials: any[] = []): Promise<any> {
    return db.transaction(() => {
      const violation = ViolationDAO.getById(violationId);
      if (!violation) {
        throw new Error('违章记录不存在');
      }

      const oldStatus = violation.status;
      ViolationDAO.update(violationId, { status: 'appealing' });

      const appeal = AppealDAO.create({
        violationId,
        driverId,
        reason,
        materials,
        status: 'pending',
      });

      ProcessingHistoryDAO.create({
        violationId,
        action: '提交申诉',
        operator: DriverDAO.getById(driverId)?.name || '未知司机',
        operatorId: driverId,
        remarks: `申诉原因: ${reason}`,
        oldStatus,
        newStatus: 'appealing',
      });

      return appeal;
    })();
  }

  static async reviewAppeal(violationId: string, approved: boolean, reviewNotes: string, reviewer: string, reviewerId: string): Promise<any> {
    return db.transaction(() => {
      const violation = ViolationDAO.getById(violationId);
      if (!violation) {
        throw new Error('违章记录不存在');
      }

      const oldStatus = violation.status;
      const newStatus = approved ? 'appeal_approved' : 'appeal_rejected';
      const statusText = approved ? '通过' : '驳回';

      ViolationDAO.update(violationId, { status: newStatus });

      const appeal = AppealDAO.review(violationId, approved ? 'approved' : 'rejected', reviewNotes, reviewer);

      ProcessingHistoryDAO.create({
        violationId,
        action: `申诉${statusText}`,
        operator: reviewer,
        operatorId: reviewerId,
        remarks: reviewNotes,
        oldStatus,
        newStatus,
      });

      if (approved) {
        const penalty = PenaltyDAO.getByViolationId(violationId);
        if (penalty && !penalty.isRolledBack) {
          PenaltyDAO.rollback(violationId, '申诉通过自动回滚', reviewer);
          ProcessingHistoryDAO.create({
            violationId,
            action: '自动回滚处罚',
            operator: reviewer,
            operatorId: reviewerId,
            remarks: '申诉通过，自动回滚已执行的处罚',
            oldStatus: penalty.isRolledBack ? 'rolled_back' : 'penalized',
            newStatus: 'rolled_back',
          });
        }
      }

      return appeal;
    })();
  }

  static async applyPenalty(violationId: string, operator: string, operatorId: string): Promise<any> {
    return db.transaction(() => {
      const violation = ViolationDAO.getById(violationId);
      if (!violation) {
        throw new Error('违章记录不存在');
      }

      if (!violation.matchedDriverId) {
        throw new Error('未匹配司机，无法执行处罚');
      }

      if (violation.status === 'appeal_approved') {
        throw new Error('申诉通过的违章不能处罚');
      }

      const existingPenalty = PenaltyDAO.getByViolationId(violationId);
      if (existingPenalty && !existingPenalty.isRolledBack) {
        throw new Error('该违章已处罚');
      }

      const oldStatus = violation.status;
      ViolationDAO.update(violationId, { status: 'penalized' });

      const penalty = PenaltyDAO.create({
        violationId,
        driverId: violation.matchedDriverId,
        pointsDeducted: violation.points,
        fineAmount: violation.fineAmount,
      });

      ProcessingHistoryDAO.create({
        violationId,
        action: '执行处罚',
        operator,
        operatorId,
        remarks: `扣除 ${violation.points} 分，罚款 ${violation.fineAmount} 元`,
        oldStatus,
        newStatus: 'penalized',
      });

      return penalty;
    })();
  }

  static async rollbackPenalty(violationId: string, reason: string, operator: string, operatorId: string): Promise<any> {
    return db.transaction(() => {
      const violation = ViolationDAO.getById(violationId);
      if (!violation) {
        throw new Error('违章记录不存在');
      }

      const oldStatus = violation.status;
      ViolationDAO.update(violationId, { status: 'rolled_back' });

      const penalty = PenaltyDAO.rollback(violationId, reason, operator);
      if (!penalty) {
        throw new Error('处罚回滚失败');
      }

      ProcessingHistoryDAO.create({
        violationId,
        action: '回滚处罚',
        operator,
        operatorId,
        remarks: reason,
        oldStatus,
        newStatus: 'rolled_back',
      });

      return penalty;
    })();
  }
}

export default ViolationService;
