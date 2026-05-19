import { storage } from '../storage';
import { VerificationRecord, RecordType } from '../models/types';
import { appointmentService } from './AppointmentService';
import { blacklistService } from './BlacklistService';
import { temporaryPlateService } from './TemporaryPlateService';
import { logger, maskObject } from '../utils';

export interface VerifyParams {
  visitorPhone: string;
  visitorName: string;
  plateNumber?: string;
  type: RecordType;
  gate: string;
  operator: string;
}

export interface VerifyResult {
  allowed: boolean;
  reason: string;
  record?: VerificationRecord;
  details: {
    blacklistCheck: { passed: boolean; reason: string };
    appointmentCheck: { passed: boolean; reason: string };
    plateCheck?: { passed: boolean; reason: string };
  };
}

export class VerificationService {
  verify(params: VerifyParams): VerifyResult {
    const details: VerifyResult['details'] = {
      blacklistCheck: { passed: true, reason: '' },
      appointmentCheck: { passed: true, reason: '' },
      plateCheck: params.plateNumber ? { passed: true, reason: '' } : undefined
    };

    const blacklistResult = blacklistService.verify(
      params.visitorPhone,
      params.plateNumber
    );
    if (blacklistResult.blocked) {
      details.blacklistCheck = { passed: false, reason: blacklistResult.reason };
      return this.createRecordAndReturn(params, false, blacklistResult.reason, details);
    }

    const appointmentResult = appointmentService.verifyAppointment(
      params.visitorPhone,
      params.plateNumber
    );

    if (params.plateNumber) {
      const plateResult = temporaryPlateService.verify(params.plateNumber);
      details.plateCheck = {
        passed: plateResult.valid,
        reason: plateResult.reason
      };

      if (!plateResult.valid && !appointmentResult.valid) {
        details.appointmentCheck = { passed: false, reason: appointmentResult.reason };
        return this.createRecordAndReturn(
          params,
          false,
          '无有效预约或临时车牌',
          details
        );
      }

      if (plateResult.valid) {
        details.appointmentCheck = { passed: true, reason: '通过临时车牌核验' };
        return this.createRecordAndReturn(
          params,
          true,
          '通过临时车牌核验放行',
          details
        );
      }
    }

    if (!appointmentResult.valid) {
      details.appointmentCheck = { passed: false, reason: appointmentResult.reason };
      return this.createRecordAndReturn(
        params,
        false,
        appointmentResult.reason,
        details
      );
    }

    return this.createRecordAndReturn(
      params,
      true,
      '预约核验通过放行',
      details,
      appointmentResult.appointment?.id
    );
  }

  private createRecordAndReturn(
    params: VerifyParams,
    allowed: boolean,
    reason: string,
    details: VerifyResult['details'],
    appointmentId?: string
  ): VerifyResult {
    const record = storage.verificationRecords.create({
      type: params.type,
      timestamp: new Date().toISOString(),
      visitorName: params.visitorName,
      visitorPhone: params.visitorPhone,
      plateNumber: params.plateNumber,
      appointmentId,
      result: allowed ? 'allowed' : 'denied',
      reason,
      operator: params.operator,
      gate: params.gate,
      details: details as any
    } as VerificationRecord);

    logger.audit(allowed ? '放行' : '拒绝', {
      recordId: record.id,
      visitorName: params.visitorName,
      visitorPhone: params.visitorPhone,
      plateNumber: params.plateNumber,
      gate: params.gate,
      operator: params.operator,
      reason
    });

    return {
      allowed,
      reason,
      record: maskObject(record),
      details
    };
  }

  getRecords(
    filters?: {
      startDate?: string;
      endDate?: string;
      result?: 'allowed' | 'denied';
      gate?: string;
      operator?: string;
    },
    limit: number = 100
  ): VerificationRecord[] {
    let records = storage.verificationRecords.findMany();

    if (filters) {
      const startDate = filters.startDate;
      if (startDate) {
        records = records.filter(r => r.timestamp >= startDate);
      }

      const endDate = filters.endDate;
      if (endDate) {
        records = records.filter(r => r.timestamp <= endDate);
      }

      if (filters.result) {
        records = records.filter(r => r.result === filters.result);
      }

      if (filters.gate) {
        records = records.filter(r => r.gate === filters.gate);
      }

      if (filters.operator) {
        records = records.filter(r => r.operator === filters.operator);
      }
    }

    records = records
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return records.map(r => maskObject(r));
  }

  getStats(startDate?: string, endDate?: string): {
    total: number;
    allowed: number;
    denied: number;
    allowedRate: string;
  } {
    const records = this.getRecords({ startDate, endDate }, 10000);
    const allowed = records.filter(r => r.result === 'allowed').length;
    const denied = records.filter(r => r.result === 'denied').length;
    const allowedRate = records.length > 0
      ? ((allowed / records.length) * 100).toFixed(2) + '%'
      : '0%';

    return {
      total: records.length,
      allowed,
      denied,
      allowedRate
    };
  }

  exportRecords(
    filters?: Parameters<typeof this.getRecords>[0],
    limit: number = 1000
  ): string {
    const records = this.getRecords(filters, limit);
    return JSON.stringify(records, null, 2);
  }
}

export const verificationService = new VerificationService();
