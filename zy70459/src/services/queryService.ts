import db from '../database';
import { ValidationResult, LabSample, ValidationRecord, FailureRecord, AnomalySample } from '../types';

export class QueryService {
  static async queryByBusinessNo(businessNo: string): Promise<ValidationResult & { anomalySamples?: AnomalySample[] }> {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        let sample: any = null;
        let validationRecords: any[] = [];
        let failureRecords: any[] = [];
        let anomalySamples: any[] = [];

        db.get('SELECT * FROM lab_samples WHERE business_no = ?', [businessNo], (err, row) => {
          if (err) reject(err);
          sample = row;
        });

        db.all('SELECT * FROM validation_records WHERE business_no = ? ORDER BY created_at DESC', [businessNo], (err, rows) => {
          if (err) reject(err);
          validationRecords = rows;
        });

        db.all('SELECT * FROM failure_records WHERE business_no = ? ORDER BY created_at DESC', [businessNo], (err, rows) => {
          if (err) reject(err);
          failureRecords = rows;
        });

        db.all('SELECT * FROM anomaly_samples WHERE business_no = ? ORDER BY detected_at DESC', [businessNo], (err, rows) => {
          if (err) reject(err);
          anomalySamples = rows;

          if (!sample && failureRecords.length === 0) {
            resolve({
              businessNo,
              success: false,
              status: 'not_found',
              failureRecord: undefined,
              validationRecord: undefined,
              originalSample: undefined,
              anomalySamples: []
            });
            return;
          }

          const latestValidation = validationRecords[0];
          const latestFailure = failureRecords[0];

          resolve({
            businessNo,
            success: latestValidation?.status === 'success',
            status: latestValidation?.status || latestFailure?.failure_type || 'pending',
            validationRecord: latestValidation ? this.mapValidationRecord(latestValidation) : undefined,
            failureRecord: latestFailure ? this.mapFailureRecord(latestFailure) : undefined,
            originalSample: sample ? this.mapSample(sample) : undefined,
            anomalySamples: anomalySamples.map(a => this.mapAnomalySample(a))
          });
        });
      });
    });
  }

  static async queryAll(params: {
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{
    total: number;
    items: (ValidationResult & { hasAnomaly: boolean; originalSample?: LabSample })[];
  }> {
    const { status, startDate, endDate, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    return new Promise((resolve, reject) => {
      let whereClauses: string[] = [];
      let queryParams: any[] = [];

      if (startDate) {
        whereClauses.push('ls.created_at >= ?');
        queryParams.push(startDate);
      }
      if (endDate) {
        whereClauses.push('ls.created_at <= ?');
        queryParams.push(endDate);
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      db.get(`
        SELECT COUNT(DISTINCT ls.business_no) as total 
        FROM lab_samples ls 
        LEFT JOIN validation_records vr ON ls.business_no = vr.business_no 
        LEFT JOIN failure_records fr ON ls.business_no = fr.business_no 
        ${whereSQL}
      `, queryParams, (err, countRow: any) => {
        if (err) reject(err);

        db.all(`
          SELECT DISTINCT ls.business_no, 
                 ls.*,
                 vr.id as vr_id, vr.status as vr_status, vr.created_at as vr_created_at,
                 fr.id as fr_id, fr.failure_type, fr.created_at as fr_created_at,
                 CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as has_anomaly
          FROM lab_samples ls
          LEFT JOIN validation_records vr ON ls.business_no = vr.business_no
          LEFT JOIN failure_records fr ON ls.business_no = fr.business_no
          LEFT JOIN anomaly_samples a ON ls.business_no = a.business_no
          ${whereSQL}
          ORDER BY ls.created_at DESC
          LIMIT ? OFFSET ?
        `, [...queryParams, pageSize, offset], async (err, rows: any[]) => {
          if (err) reject(err);

          const businessNos = [...new Set(rows.map(r => r.business_no))];
          const items = [];

          for (const businessNo of businessNos) {
            const detail = await this.queryByBusinessNo(businessNo);
            items.push({
              ...detail,
              hasAnomaly: (detail.anomalySamples?.length || 0) > 0
            });
          }

          resolve({
            total: countRow.total,
            items
          });
        });
      });
    });
  }

  static async getFailureRecords(params: {
    failureType?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ total: number; items: FailureRecord[] }> {
    const { failureType, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    return new Promise((resolve, reject) => {
      let whereSQL = '';
      let queryParams: any[] = [];

      if (failureType) {
        whereSQL = 'WHERE failure_type = ?';
        queryParams.push(failureType);
      }

      db.get(`SELECT COUNT(*) as total FROM failure_records ${whereSQL}`, queryParams, (err, countRow: any) => {
        if (err) reject(err);

        db.all(`
          SELECT * FROM failure_records 
          ${whereSQL}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `, [...queryParams, pageSize, offset], (err, rows) => {
          if (err) reject(err);
          resolve({
            total: countRow.total,
            items: rows.map(r => this.mapFailureRecord(r))
          });
        });
      });
    });
  }

  static async getAnomalySamples(params: {
    anomalyType?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ total: number; items: (AnomalySample & { originalSample?: LabSample })[] }> {
    const { anomalyType, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    return new Promise((resolve, reject) => {
      let whereSQL = '';
      let queryParams: any[] = [];

      if (anomalyType) {
        whereSQL = 'WHERE a.anomaly_type = ?';
        queryParams.push(anomalyType);
      }

      db.get(`SELECT COUNT(*) as total FROM anomaly_samples a ${whereSQL}`, queryParams, (err, countRow: any) => {
        if (err) reject(err);

        db.all(`
          SELECT a.*, ls.* 
          FROM anomaly_samples a
          LEFT JOIN lab_samples ls ON a.sample_id = ls.id
          ${whereSQL}
          ORDER BY a.detected_at DESC
          LIMIT ? OFFSET ?
        `, [...queryParams, pageSize, offset], (err, rows) => {
          if (err) reject(err);
          resolve({
            total: countRow.total,
            items: rows.map(r => ({
              ...this.mapAnomalySample(r),
              originalSample: this.mapSample(r)
            }))
          });
        });
      });
    });
  }

  private static mapSample(sample: any): LabSample {
    return {
      id: sample.id,
      businessNo: sample.business_no,
      sampleNo: sample.sample_no,
      patientName: sample.patient_name,
      patientId: sample.patient_id,
      sampleType: sample.sample_type,
      collectTime: new Date(sample.collect_time),
      receiveTime: new Date(sample.receive_time),
      testItems: JSON.parse(sample.test_items || '[]'),
      department: sample.department,
      doctor: sample.doctor,
      status: sample.status,
      rawData: sample.raw_data,
      createdAt: new Date(sample.created_at),
      updatedAt: new Date(sample.updated_at)
    };
  }

  private static mapValidationRecord(record: any): ValidationRecord {
    return {
      id: record.id,
      businessNo: record.business_no,
      sampleId: record.sample_id,
      validationType: record.validation_type,
      windowStart: new Date(record.window_start),
      windowEnd: new Date(record.window_end),
      status: record.status,
      result: record.result,
      operator: record.operator,
      createdAt: new Date(record.created_at)
    };
  }

  private static mapFailureRecord(record: any): FailureRecord {
    return {
      id: record.id,
      businessNo: record.business_no,
      sampleId: record.sample_id,
      validationId: record.validation_id,
      failureType: record.failure_type,
      errorCode: record.error_code,
      errorMessage: record.error_message,
      gatewayError: record.gateway_error,
      correctionSuggestion: record.correction_suggestion,
      conclusion: record.conclusion,
      rawPayload: record.raw_payload,
      retryCount: record.retry_count,
      createdAt: new Date(record.created_at)
    };
  }

  private static mapAnomalySample(anomaly: any): AnomalySample {
    return {
      id: anomaly.id,
      businessNo: anomaly.business_no,
      sampleId: anomaly.sample_id,
      anomalyType: anomaly.anomaly_type,
      description: anomaly.description,
      originalRecordId: anomaly.original_record_id,
      detectedAt: new Date(anomaly.detected_at)
    };
  }
}

export default QueryService;
