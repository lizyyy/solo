import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { ValidationRecord, FailureRecord, ValidationResult } from '../types';

const freezeWindows = {
  morning: { start: '06:00', end: '10:00' },
  afternoon: { start: '14:00', end: '18:00' },
  night: { start: '22:00', end: '02:00' }
};

export class ValidationService {
  static isInFreezeWindow(time: Date): { inWindow: boolean; windowType: string; windowStart: Date; windowEnd: Date } {
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const timeValue = hours * 60 + minutes;

    const parseTime = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    for (const [windowType, window] of Object.entries(freezeWindows)) {
      const start = parseTime(window.start);
      const end = parseTime(window.end);
      
      let inWindow = false;
      if (start < end) {
        inWindow = timeValue >= start && timeValue <= end;
      } else {
        inWindow = timeValue >= start || timeValue <= end;
      }

      if (inWindow) {
        const windowStart = new Date(time);
        windowStart.setHours(Math.floor(start / 60), start % 60, 0, 0);
        const windowEnd = new Date(time);
        windowEnd.setHours(Math.floor(end / 60), end % 60, 0, 0);
        if (start > end) windowEnd.setDate(windowEnd.getDate() + 1);
        
        return { inWindow: true, windowType, windowStart, windowEnd };
      }
    }

    const defaultStart = new Date(time);
    defaultStart.setHours(6, 0, 0, 0);
    const defaultEnd = new Date(time);
    defaultEnd.setHours(10, 0, 0, 0);
    return { inWindow: false, windowType: 'none', windowStart: defaultStart, windowEnd: defaultEnd };
  }

  static async validateSample(businessNo: string, operator: string, simulateConcurrency: boolean = false): Promise<ValidationResult> {
    return new Promise((resolve) => {
      getDb().get('SELECT * FROM lab_samples WHERE business_no = ?', [businessNo], async (err, sample: any) => {
        if (err || !sample) {
          const failureRecord = await this.recordFailure(
            businessNo,
            '',
            'SAMPLE_NOT_FOUND',
            '样本不存在',
            '404',
            JSON.stringify({ businessNo, error: err?.message }),
            '未找到对应样本记录，请检查业务单号是否正确',
            '需要重新提交正确的样本信息'
          );
          resolve({
            businessNo,
            success: false,
            status: 'failed',
            failureRecord
          });
          return;
        }

        const now = new Date();
        const { inWindow, windowType, windowStart, windowEnd } = this.isInFreezeWindow(now);

        if (simulateConcurrency) {
          await this.simulateConcurrentOverride(businessNo, sample, operator, windowStart, windowEnd, windowType);
        }

        if (!inWindow) {
          const failureRecord = await this.recordFailure(
            businessNo,
            sample.id,
            'OUTSIDE_FREEZE_WINDOW',
            `当前时间不在冻结窗口内，当前窗口类型: ${windowType}`,
            '403',
            JSON.stringify({ businessNo, currentTime: now.toISOString(), windowType }),
            '请在指定的冻结窗口时间内进行操作',
            '操作被拒绝，需要在窗口时间内重试'
          );

          resolve({
            businessNo,
            success: false,
            status: 'failed',
            failureRecord,
            originalSample: this.mapSample(sample)
          });
          return;
        }

        const validationId = uuidv4();
        const validationRecord: ValidationRecord = {
          id: validationId,
          businessNo,
          sampleId: sample.id,
          validationType: windowType,
          windowStart,
          windowEnd,
          status: 'success',
          result: '校验通过，样本已进入冻结状态',
          operator,
          createdAt: now
        };

        getDb().run(`
          INSERT INTO validation_records (id, business_no, sample_id, validation_type, window_start, window_end, status, result, operator, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          validationId,
          businessNo,
          sample.id,
          windowType,
          windowStart.toISOString(),
          windowEnd.toISOString(),
          'success',
          validationRecord.result,
          operator,
          now.toISOString()
        ]);

        getDb().run('UPDATE lab_samples SET status = ?, updated_at = ? WHERE business_no = ?', 
          ['validated', now.toISOString(), businessNo]);

        resolve({
          businessNo,
          success: true,
          status: 'success',
          validationRecord,
          originalSample: this.mapSample(sample)
        });
      });
    });
  }

  private static async simulateConcurrentOverride(
    businessNo: string, 
    sample: any, 
    operator: string, 
    windowStart: Date, 
    windowEnd: Date, 
    windowType: string
  ): Promise<void> {
    const now = new Date();
    const fakeValidationId = uuidv4();
    
    const conflictingOperations = [];
    for (let i = 0; i < 3; i++) {
      conflictingOperations.push({
        id: uuidv4(),
        operator: `并发用户${i + 1}`,
        timestamp: new Date(now.getTime() - 100 * i).toISOString(),
        data: {
          status: ['pending', 'validating', 'validated'][i],
          note: `第${i + 1}次写入覆盖`
        }
      });
    }

    const gatewayError = JSON.stringify({
      code: 'CONCURRENT_OVERRIDE',
      message: '检测到并发写入冲突',
      conflictingOperations,
      finalState: '数据被最后一次写入覆盖，中间状态丢失',
      lostData: [
        { field: 'status', oldValue: 'validating', newValue: 'validated' },
        { field: 'operator', oldValue: conflictingOperations[1].operator, newValue: operator },
        { field: 'updated_at', oldValue: conflictingOperations[1].timestamp, newValue: now.toISOString() }
      ]
    }, null, 2);

    await this.recordFailure(
      businessNo,
      sample.id,
      'CONCURRENT_WRITE_OVERRIDE',
      '并发写入导致数据互相覆盖，中间状态丢失',
      '409',
      JSON.stringify({ businessNo, conflictingOperations, windowType }),
      '检测到并发写入冲突，建议：1. 增加乐观锁机制 2. 使用版本号控制 3. 对关键操作进行串行化处理',
      '数据完整性受损，需要进行数据核对和恢复。建议实现分布式锁机制防止此类问题再次发生。',
      fakeValidationId,
      gatewayError
    );

    await this.recordAnomalySample(
      businessNo,
      sample.id,
      'CONCURRENT_OVERRIDE',
      '该样本在冻结窗口校验过程中发生并发写入覆盖，中间状态数据丢失',
      fakeValidationId
    );
  }

  private static async recordFailure(
    businessNo: string,
    sampleId: string,
    failureType: string,
    errorMessage: string,
    errorCode: string,
    rawPayload: string,
    correctionSuggestion: string,
    conclusion: string,
    validationId?: string,
    gatewayError?: string
  ): Promise<FailureRecord> {
    return new Promise((resolve) => {
      const failureId = uuidv4();
      const now = new Date();
      
      getDb().run(`
        INSERT INTO failure_records (
          id, business_no, sample_id, validation_id, failure_type, error_code, 
          error_message, gateway_error, correction_suggestion, conclusion, raw_payload, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        failureId, businessNo, sampleId, validationId || null, failureType, errorCode,
        errorMessage, gatewayError || null, correctionSuggestion, conclusion, rawPayload, now.toISOString()
      ]);

      resolve({
        id: failureId,
        businessNo,
        sampleId,
        validationId,
        failureType,
        errorCode,
        errorMessage,
        gatewayError,
        correctionSuggestion,
        conclusion,
        rawPayload,
        retryCount: 0,
        createdAt: now
      });
    });
  }

  private static async recordAnomalySample(
    businessNo: string,
    sampleId: string,
    anomalyType: string,
    description: string,
    originalRecordId: string
  ): Promise<void> {
    return new Promise((resolve) => {
      const anomalyId = uuidv4();
      getDb().run(`
        INSERT INTO anomaly_samples (id, business_no, sample_id, anomaly_type, description, original_record_id, detected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [anomalyId, businessNo, sampleId, anomalyType, description, originalRecordId, new Date().toISOString()], () => {
        resolve();
      });
    });
  }

  private static mapSample(sample: any) {
    return {
      id: sample.id,
      businessNo: sample.business_no,
      sampleNo: sample.sample_no,
      patientName: sample.patient_name,
      patientId: sample.patient_id,
      sampleType: sample.sample_type,
      collectTime: new Date(sample.collect_time),
      receiveTime: new Date(sample.receive_time),
      testItems: JSON.parse(sample.test_items),
      department: sample.department,
      doctor: sample.doctor,
      status: sample.status,
      rawData: sample.raw_data,
      createdAt: new Date(sample.created_at),
      updatedAt: new Date(sample.updated_at)
    };
  }
}

export default ValidationService;
