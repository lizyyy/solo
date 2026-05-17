const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const {
    APPLICATION_STATUS,
    OPERATOR_TYPE,
    OPERATION_TYPE,
    ERROR_CODES,
    ERROR_MESSAGES
} = require('../constants/status');

class RecoveryService {
    generateApplicationNo() {
        return 'APP' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
    }

    async logOperation(applicationId, operatorType, operatorId, operatorName, operationType, oldStatus, newStatus, remark) {
        await db.run(
            `INSERT INTO operation_logs (application_id, operator_type, operator_id, operator_name, operation_type, old_status, new_status, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [applicationId, operatorType, operatorId, operatorName, operationType, oldStatus, newStatus, remark]
        );
    }

    async validateApplication(registrationId, excludeApplicationId = null) {
        const registration = await db.get(
            'SELECT * FROM exam_registrations WHERE id = ?',
            [registrationId]
        );

        if (!registration) {
            return { valid: false, errorCode: ERROR_CODES.VALIDATION_ERROR, errorMessage: '报名记录不存在' };
        }

        if (!registration.is_absent) {
            return { valid: false, errorCode: ERROR_CODES.NOT_ABSENT, errorMessage: ERROR_MESSAGES[ERROR_CODES.NOT_ABSENT] };
        }

        if (registration.has_retaken) {
            return { valid: false, errorCode: ERROR_CODES.ALREADY_RETOOK, errorMessage: ERROR_MESSAGES[ERROR_CODES.ALREADY_RETOOK] };
        }

        let sql = `SELECT id FROM recovery_applications 
                   WHERE registration_id = ? AND status IN (?, ?, ?)`;
        let params = [registrationId, APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.APPROVED];
        
        if (excludeApplicationId) {
            sql += ' AND id != ?';
            params.push(excludeApplicationId);
        }

        const existingApplication = await db.get(sql, params);
        if (existingApplication) {
            return { valid: false, errorCode: ERROR_CODES.DUPLICATE_REQUEST, errorMessage: ERROR_MESSAGES[ERROR_CODES.DUPLICATE_REQUEST] };
        }

        return { valid: true, registration };
    }

    async createApplication(data) {
        const { registrationId, absenceReasonId, reasonDetail, applicantRemark, operatorId, operatorName } = data;

        const validation = await this.validateApplication(registrationId);
        if (!validation.valid) {
            return { success: false, ...validation };
        }

        const applicationNo = this.generateApplicationNo();
        const registration = validation.registration;

        const result = await db.run(
            `INSERT INTO recovery_applications 
             (application_no, registration_id, examinee_id, exam_id, absence_reason_id, reason_detail, status, applicant_remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [applicationNo, registrationId, registration.examinee_id, registration.exam_id, absenceReasonId, reasonDetail, APPLICATION_STATUS.DRAFT, applicantRemark]
        );

        await this.logOperation(
            result.lastID,
            OPERATOR_TYPE.APPLICANT,
            operatorId,
            operatorName,
            OPERATION_TYPE.CREATE,
            null,
            APPLICATION_STATUS.DRAFT,
            '创建申请'
        );

        return { success: true, applicationId: result.lastID, applicationNo };
    }

    async submitApplication(applicationId, operatorId, operatorName) {
        const application = await db.get('SELECT * FROM recovery_applications WHERE id = ?', [applicationId]);
        if (!application) {
            return { success: false, errorCode: ERROR_CODES.VALIDATION_ERROR, errorMessage: '申请不存在' };
        }

        if (application.status !== APPLICATION_STATUS.DRAFT) {
            return { success: false, errorCode: ERROR_CODES.INVALID_STATUS, errorMessage: ERROR_MESSAGES[ERROR_CODES.INVALID_STATUS] };
        }

        const validation = await this.validateApplication(application.registration_id, applicationId);
        if (!validation.valid) {
            return { success: false, ...validation };
        }

        await db.run(
            'UPDATE recovery_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [APPLICATION_STATUS.SUBMITTED, applicationId]
        );

        await this.logOperation(
            applicationId,
            OPERATOR_TYPE.APPLICANT,
            operatorId,
            operatorName,
            OPERATION_TYPE.SUBMIT,
            APPLICATION_STATUS.DRAFT,
            APPLICATION_STATUS.SUBMITTED,
            '提交申请'
        );

        return { success: true };
    }

    async withdrawApplication(applicationId, operatorId, operatorName, reason) {
        const application = await db.get('SELECT * FROM recovery_applications WHERE id = ?', [applicationId]);
        if (!application) {
            return { success: false, errorCode: ERROR_CODES.VALIDATION_ERROR, errorMessage: '申请不存在' };
        }

        if (application.status !== APPLICATION_STATUS.DRAFT && application.status !== APPLICATION_STATUS.SUBMITTED) {
            return { success: false, errorCode: ERROR_CODES.INVALID_STATUS, errorMessage: ERROR_MESSAGES[ERROR_CODES.INVALID_STATUS] };
        }

        const oldStatus = application.status;
        await db.run(
            'UPDATE recovery_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [APPLICATION_STATUS.WITHDRAWN, applicationId]
        );

        await this.logOperation(
            applicationId,
            OPERATOR_TYPE.APPLICANT,
            operatorId,
            operatorName,
            OPERATION_TYPE.WITHDRAW,
            oldStatus,
            APPLICATION_STATUS.WITHDRAWN,
            reason || '撤回申请'
        );

        return { success: true };
    }

    async reviewApplication(applicationId, isApproved, reviewerId, reviewerName, reviewerRemark) {
        const application = await db.get('SELECT * FROM recovery_applications WHERE id = ?', [applicationId]);
        if (!application) {
            return { success: false, errorCode: ERROR_CODES.VALIDATION_ERROR, errorMessage: '申请不存在' };
        }

        if (application.status !== APPLICATION_STATUS.SUBMITTED) {
            return { success: false, errorCode: ERROR_CODES.INVALID_STATUS, errorMessage: ERROR_MESSAGES[ERROR_CODES.INVALID_STATUS] };
        }

        const newStatus = isApproved ? APPLICATION_STATUS.APPROVED : APPLICATION_STATUS.REJECTED;
        const expireTime = isApproved ? moment().add(1, 'year').format('YYYY-MM-DD HH:mm:ss') : null;

        await db.run(
            `UPDATE recovery_applications 
             SET status = ?, reviewer_id = ?, reviewer_remark = ?, review_time = CURRENT_TIMESTAMP, expire_time = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newStatus, reviewerId, reviewerRemark, expireTime, applicationId]
        );

        await this.logOperation(
            applicationId,
            OPERATOR_TYPE.REVIEWER,
            reviewerId,
            reviewerName,
            OPERATION_TYPE.REVIEW,
            APPLICATION_STATUS.SUBMITTED,
            newStatus,
            isApproved ? '审核通过' : '审核拒绝'
        );

        return { success: true };
    }

    async getApplicationList(params = {}) {
        const { examineeId, examId, status, page = 1, pageSize = 10 } = params;
        
        let whereConditions = [];
        let queryParams = [];

        if (examineeId) {
            whereConditions.push('ra.examinee_id = ?');
            queryParams.push(examineeId);
        }
        if (examId) {
            whereConditions.push('ra.exam_id = ?');
            queryParams.push(examId);
        }
        if (status !== undefined && status !== null) {
            whereConditions.push('ra.status = ?');
            queryParams.push(status);
        }

        const whereSql = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        const countResult = await db.get(
            `SELECT COUNT(*) as total FROM recovery_applications ra ${whereSql}`,
            queryParams
        );

        const offset = (page - 1) * pageSize;
        const list = await db.all(
            `SELECT ra.*, e.name as examinee_name, e.examinee_no, ex.exam_name, ex.exam_date, ar.reason_name
             FROM recovery_applications ra
             LEFT JOIN examinees e ON ra.examinee_id = e.id
             LEFT JOIN exams ex ON ra.exam_id = ex.id
             LEFT JOIN absence_reasons ar ON ra.absence_reason_id = ar.id
             ${whereSql}
             ORDER BY ra.created_at DESC
             LIMIT ? OFFSET ?`,
            [...queryParams, pageSize, offset]
        );

        return {
            list,
            total: countResult.total,
            page,
            pageSize
        };
    }

    async getApplicationDetail(applicationId) {
        const application = await db.get(
            `SELECT ra.*, e.name as examinee_name, e.examinee_no, e.id_card, e.phone, e.department,
                    ex.exam_name, ex.exam_date, ar.reason_name
             FROM recovery_applications ra
             LEFT JOIN examinees e ON ra.examinee_id = e.id
             LEFT JOIN exams ex ON ra.exam_id = ex.id
             LEFT JOIN absence_reasons ar ON ra.absence_reason_id = ar.id
             WHERE ra.id = ?`,
            [applicationId]
        );

        if (!application) {
            return null;
        }

        const materials = await db.all(
            'SELECT * FROM proof_materials WHERE application_id = ?',
            [applicationId]
        );

        const logs = await db.all(
            'SELECT * FROM operation_logs WHERE application_id = ? ORDER BY created_at DESC',
            [applicationId]
        );

        return {
            ...application,
            materials,
            logs
        };
    }

    async getOperationLogs(applicationId) {
        return await db.all(
            `SELECT ol.*, ast1.status_text as old_status_text, ast2.status_text as new_status_text
             FROM operation_logs ol
             LEFT JOIN (SELECT 0 as status, '草稿' as status_text UNION SELECT 1, '已提交待审核' 
                        UNION SELECT 2, '审核通过已恢复' UNION SELECT 3, '审核拒绝' 
                        UNION SELECT 4, '已撤回' UNION SELECT 5, '已失效') ast1 ON ol.old_status = ast1.status
             LEFT JOIN (SELECT 0 as status, '草稿' as status_text UNION SELECT 1, '已提交待审核' 
                        UNION SELECT 2, '审核通过已恢复' UNION SELECT 3, '审核拒绝' 
                        UNION SELECT 4, '已撤回' UNION SELECT 5, '已失效') ast2 ON ol.new_status = ast2.status
             WHERE ol.application_id = ? ORDER BY ol.created_at DESC`,
            [applicationId]
        );
    }

    async importApplications(batchNo, dataList) {
        const errors = [];
        const successList = [];

        for (let i = 0; i < dataList.length; i++) {
            const row = dataList[i];
            try {
                const result = await this.createApplication({
                    registrationId: row.registrationId,
                    absenceReasonId: row.absenceReasonId,
                    reasonDetail: row.reasonDetail,
                    applicantRemark: row.applicantRemark,
                    operatorId: row.operatorId,
                    operatorName: row.operatorName
                });

                if (result.success) {
                    successList.push({ row: i + 1, ...result });
                } else {
                    errors.push({
                        row: i + 1,
                        rowData: JSON.stringify(row),
                        errorMessage: result.errorMessage,
                        errorCode: result.errorCode
                    });
                }
            } catch (err) {
                errors.push({
                    row: i + 1,
                    rowData: JSON.stringify(row),
                    errorMessage: err.message
                });
            }
        }

        for (const error of errors) {
            await db.run(
                `INSERT INTO import_errors (batch_no, row_number, row_data, error_message)
                 VALUES (?, ?, ?, ?)`,
                [batchNo, error.row, error.rowData, error.errorMessage]
            );
        }

        return {
            success: successList.length,
            failed: errors.length,
            errors
        };
    }

    async getImportErrors(batchNo) {
        return await db.all(
            'SELECT * FROM import_errors WHERE batch_no = ? ORDER BY row_number',
            [batchNo]
        );
    }
}

module.exports = new RecoveryService();
