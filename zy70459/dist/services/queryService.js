"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryService = void 0;
const database_1 = require("../database");
class QueryService {
    static async queryByBusinessNo(businessNo) {
        return new Promise((resolve, reject) => {
            (0, database_1.getDb)().serialize(() => {
                let sample = null;
                let validationRecords = [];
                let failureRecords = [];
                let anomalySamples = [];
                (0, database_1.getDb)().get('SELECT * FROM lab_samples WHERE business_no = ?', [businessNo], (err, row) => {
                    if (err)
                        reject(err);
                    sample = row;
                });
                (0, database_1.getDb)().all('SELECT * FROM validation_records WHERE business_no = ? ORDER BY created_at DESC', [businessNo], (err, rows) => {
                    if (err)
                        reject(err);
                    validationRecords = rows;
                });
                (0, database_1.getDb)().all('SELECT * FROM failure_records WHERE business_no = ? ORDER BY created_at DESC', [businessNo], (err, rows) => {
                    if (err)
                        reject(err);
                    failureRecords = rows;
                });
                (0, database_1.getDb)().all('SELECT * FROM anomaly_samples WHERE business_no = ? ORDER BY detected_at DESC', [businessNo], (err, rows) => {
                    if (err)
                        reject(err);
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
    static async queryAll(params = {}) {
        const { status, startDate, endDate, page = 1, pageSize = 20 } = params;
        const offset = (page - 1) * pageSize;
        return new Promise((resolve, reject) => {
            let whereClauses = [];
            let queryParams = [];
            if (startDate) {
                whereClauses.push('ls.created_at >= ?');
                queryParams.push(startDate);
            }
            if (endDate) {
                whereClauses.push('ls.created_at <= ?');
                queryParams.push(endDate);
            }
            const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
            (0, database_1.getDb)().get(`
        SELECT COUNT(DISTINCT ls.business_no) as total 
        FROM lab_samples ls 
        LEFT JOIN validation_records vr ON ls.business_no = vr.business_no 
        LEFT JOIN failure_records fr ON ls.business_no = fr.business_no 
        ${whereSQL}
      `, queryParams, (err, countRow) => {
                if (err)
                    reject(err);
                (0, database_1.getDb)().all(`
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
        `, [...queryParams, pageSize, offset], async (err, rows) => {
                    if (err)
                        reject(err);
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
    static async getFailureRecords(params = {}) {
        const { failureType, page = 1, pageSize = 20 } = params;
        const offset = (page - 1) * pageSize;
        return new Promise((resolve, reject) => {
            let whereSQL = '';
            let queryParams = [];
            if (failureType) {
                whereSQL = 'WHERE failure_type = ?';
                queryParams.push(failureType);
            }
            (0, database_1.getDb)().get(`SELECT COUNT(*) as total FROM failure_records ${whereSQL}`, queryParams, (err, countRow) => {
                if (err)
                    reject(err);
                (0, database_1.getDb)().all(`
          SELECT * FROM failure_records 
          ${whereSQL}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `, [...queryParams, pageSize, offset], (err, rows) => {
                    if (err)
                        reject(err);
                    resolve({
                        total: countRow.total,
                        items: rows.map(r => this.mapFailureRecord(r))
                    });
                });
            });
        });
    }
    static async getAnomalySamples(params = {}) {
        const { anomalyType, page = 1, pageSize = 20 } = params;
        const offset = (page - 1) * pageSize;
        return new Promise((resolve, reject) => {
            let whereSQL = '';
            let queryParams = [];
            if (anomalyType) {
                whereSQL = 'WHERE a.anomaly_type = ?';
                queryParams.push(anomalyType);
            }
            (0, database_1.getDb)().get(`SELECT COUNT(*) as total FROM anomaly_samples a ${whereSQL}`, queryParams, (err, countRow) => {
                if (err)
                    reject(err);
                (0, database_1.getDb)().all(`
          SELECT a.*, ls.* 
          FROM anomaly_samples a
          LEFT JOIN lab_samples ls ON a.sample_id = ls.id
          ${whereSQL}
          ORDER BY a.detected_at DESC
          LIMIT ? OFFSET ?
        `, [...queryParams, pageSize, offset], (err, rows) => {
                    if (err)
                        reject(err);
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
    static mapSample(sample) {
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
    static mapValidationRecord(record) {
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
    static mapFailureRecord(record) {
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
    static mapAnomalySample(anomaly) {
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
exports.QueryService = QueryService;
exports.default = QueryService;
