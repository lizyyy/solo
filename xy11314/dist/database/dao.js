"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dao = exports.BusSchedulerDAO = void 0;
const init_1 = require("./init");
class BusSchedulerDAO {
    constructor() {
        this.db = null;
    }
    async getDB() {
        if (!this.db) {
            this.db = await (0, init_1.getDatabase)();
        }
        return this.db;
    }
    async insertStopSchedule(schedule) {
        const db = await this.getDB();
        const result = await db.run(`INSERT OR IGNORE INTO stop_schedules 
       (route_id, stop_id, stop_name, scheduled_time, latitude, longitude, import_batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, schedule.routeId, schedule.stopId, schedule.stopName, schedule.scheduledTime, schedule.latitude, schedule.longitude, schedule.importBatchId);
        return result.lastID || 0;
    }
    async insertGPSRecord(record) {
        const db = await this.getDB();
        const result = await db.run(`INSERT OR IGNORE INTO gps_records 
       (device_id, driver_id, timestamp, latitude, longitude, speed, accuracy, import_batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, record.deviceId, record.driverId, record.timestamp, record.latitude, record.longitude, record.speed, record.accuracy, record.importBatchId);
        return result.lastID || 0;
    }
    async insertDriverCheckin(checkin) {
        const db = await this.getDB();
        const result = await db.run(`INSERT OR IGNORE INTO driver_checkins 
       (driver_id, route_id, stop_id, checkin_time, checkin_type, import_batch_id)
       VALUES (?, ?, ?, ?, ?, ?)`, checkin.driverId, checkin.routeId, checkin.stopId, checkin.checkinTime, checkin.checkinType, checkin.importBatchId);
        return result.lastID || 0;
    }
    async insertParentComplaint(complaint) {
        const db = await this.getDB();
        const result = await db.run(`INSERT OR IGNORE INTO parent_complaints 
       (complaint_id, parent_name, parent_phone, student_name, route_id, stop_id, 
        scheduled_date, scheduled_time, actual_arrival_time, complaint_type, description, status, import_batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, complaint.complaintId, complaint.parentName, complaint.parentPhone, complaint.studentName, complaint.routeId, complaint.stopId, complaint.scheduledDate, complaint.scheduledTime, complaint.actualArrivalTime || null, complaint.complaintType, complaint.description, complaint.status, complaint.importBatchId);
        return result.lastID || 0;
    }
    async insertBadRecord(record) {
        const db = await this.getDB();
        const result = await db.run(`INSERT INTO bad_records 
       (import_batch_id, source_type, raw_data, row_number, failure_reason, suggested_fix)
       VALUES (?, ?, ?, ?, ?, ?)`, record.importBatchId, record.sourceType, record.rawData, record.rowNumber || null, record.failureReason, record.suggestedFix);
        return result.lastID || 0;
    }
    async insertMatchRecord(match) {
        const db = await this.getDB();
        const result = await db.run(`INSERT OR REPLACE INTO match_records 
       (complaint_id, gps_records_json, checkin_records_json, stop_schedule_id, 
        match_confidence, time_discrepancy_minutes, distance_discrepancy_meters, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, match.complaintId, JSON.stringify(match.gpsRecords), JSON.stringify(match.checkinRecords), match.stopScheduleId, match.matchConfidence, match.timeDiscrepancyMinutes, match.distanceDiscrepancyMeters, match.status);
        return result.lastID || 0;
    }
    async insertAdjudication(adjudication) {
        const db = await this.getDB();
        const result = await db.run(`INSERT OR REPLACE INTO adjudications 
       (match_id, complaint_id, result, confidence, reasons_json, evidence_json, 
        adjudicator, adjudicated_at, review_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, adjudication.matchId, adjudication.complaintId, adjudication.result, adjudication.confidence, JSON.stringify(adjudication.reasons), JSON.stringify(adjudication.evidence), adjudication.adjudicator, adjudication.adjudicatedAt, adjudication.reviewStatus);
        return result.lastID || 0;
    }
    async insertAuditLog(log) {
        const db = await this.getDB();
        const result = await db.run(`INSERT INTO audit_logs 
       (entity_type, entity_id, action, old_value, new_value, operator, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, log.entityType, log.entityId, log.action, log.oldValue || null, log.newValue || null, log.operator, log.details || null);
        return result.lastID || 0;
    }
    async getComplaintsByStatus(status) {
        const db = await this.getDB();
        const rows = await db.all(`SELECT * FROM parent_complaints WHERE status = ?`, status);
        return rows.map(row => this.mapComplaintRow(row));
    }
    async getComplaintById(id) {
        const db = await this.getDB();
        const row = await db.get(`SELECT * FROM parent_complaints WHERE id = ?`, id);
        return row ? this.mapComplaintRow(row) : null;
    }
    async getGPSByDriverAndTimeRange(driverId, startTime, endTime) {
        const db = await this.getDB();
        const rows = await db.all(`SELECT * FROM gps_records 
       WHERE driver_id = ? AND timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp ASC`, driverId, startTime, endTime);
        return rows.map(row => this.mapGPSRow(row));
    }
    async getCheckinsByRouteAndStop(routeId, stopId, date) {
        const db = await this.getDB();
        const rows = await db.all(`SELECT * FROM driver_checkins 
       WHERE route_id = ? AND stop_id = ? AND checkin_time LIKE ?
       ORDER BY checkin_time ASC`, routeId, stopId, `${date}%`);
        return rows.map(row => this.mapCheckinRow(row));
    }
    async getStopSchedule(routeId, stopId, scheduledTime) {
        const db = await this.getDB();
        const row = await db.get(`SELECT * FROM stop_schedules 
       WHERE route_id = ? AND stop_id = ? AND scheduled_time LIKE ?
       LIMIT 1`, routeId, stopId, `%${scheduledTime}%`);
        return row ? this.mapScheduleRow(row) : null;
    }
    async getMatchByComplaintId(complaintId) {
        const db = await this.getDB();
        const row = await db.get(`SELECT * FROM match_records WHERE complaint_id = ?`, complaintId);
        return row ? this.mapMatchRow(row) : null;
    }
    async getAdjudicationByMatchId(matchId) {
        const db = await this.getDB();
        const row = await db.get(`SELECT * FROM adjudications WHERE match_id = ?`, matchId);
        return row ? this.mapAdjudicationRow(row) : null;
    }
    async getAdjudicationByComplaintId(complaintId) {
        const db = await this.getDB();
        const row = await db.get(`SELECT * FROM adjudications WHERE complaint_id = ?`, complaintId);
        return row ? this.mapAdjudicationRow(row) : null;
    }
    async updateComplaintStatus(id, status) {
        const db = await this.getDB();
        await db.run(`UPDATE parent_complaints SET status = ? WHERE id = ?`, status, id);
    }
    async updateAdjudicationReview(id, reviewStatus, reviewedBy, reviewNotes) {
        const db = await this.getDB();
        await db.run(`UPDATE adjudications 
       SET review_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?
       WHERE id = ?`, reviewStatus, reviewedBy, reviewNotes, id);
    }
    async getBadRecords(batchId) {
        const db = await this.getDB();
        let query = `SELECT * FROM bad_records`;
        const params = [];
        if (batchId) {
            query += ` WHERE import_batch_id = ?`;
            params.push(batchId);
        }
        query += ` ORDER BY created_at DESC`;
        const rows = await db.all(query, ...params);
        return rows.map(row => this.mapBadRecordRow(row));
    }
    async getAllAdjudications() {
        const db = await this.getDB();
        const rows = await db.all(`SELECT * FROM adjudications ORDER BY created_at DESC`);
        return rows.map(row => this.mapAdjudicationRow(row));
    }
    async getAuditLogs(entityType, entityId) {
        const db = await this.getDB();
        let query = `SELECT * FROM audit_logs`;
        const params = [];
        const conditions = [];
        if (entityType) {
            conditions.push(`entity_type = ?`);
            params.push(entityType);
        }
        if (entityId !== undefined) {
            conditions.push(`entity_id = ?`);
            params.push(entityId);
        }
        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }
        query += ` ORDER BY timestamp DESC`;
        const rows = await db.all(query, ...params);
        return rows;
    }
    mapComplaintRow(row) {
        return {
            id: row.id,
            complaintId: row.complaint_id,
            parentName: row.parent_name,
            parentPhone: row.parent_phone,
            studentName: row.student_name,
            routeId: row.route_id,
            stopId: row.stop_id,
            scheduledDate: row.scheduled_date,
            scheduledTime: row.scheduled_time,
            actualArrivalTime: row.actual_arrival_time,
            complaintType: row.complaint_type,
            description: row.description,
            status: row.status,
            importBatchId: row.import_batch_id,
            createdAt: row.created_at
        };
    }
    mapGPSRow(row) {
        return {
            id: row.id,
            deviceId: row.device_id,
            driverId: row.driver_id,
            timestamp: row.timestamp,
            latitude: row.latitude,
            longitude: row.longitude,
            speed: row.speed,
            accuracy: row.accuracy,
            importBatchId: row.import_batch_id,
            createdAt: row.created_at
        };
    }
    mapCheckinRow(row) {
        return {
            id: row.id,
            driverId: row.driver_id,
            routeId: row.route_id,
            stopId: row.stop_id,
            checkinTime: row.checkin_time,
            checkinType: row.checkin_type,
            importBatchId: row.import_batch_id,
            createdAt: row.created_at
        };
    }
    mapScheduleRow(row) {
        return {
            id: row.id,
            routeId: row.route_id,
            stopId: row.stop_id,
            stopName: row.stop_name,
            scheduledTime: row.scheduled_time,
            latitude: row.latitude,
            longitude: row.longitude,
            importBatchId: row.import_batch_id,
            createdAt: row.created_at
        };
    }
    mapMatchRow(row) {
        return {
            id: row.id,
            complaintId: row.complaint_id,
            gpsRecords: JSON.parse(row.gps_records_json || '[]'),
            checkinRecords: JSON.parse(row.checkin_records_json || '[]'),
            stopScheduleId: row.stop_schedule_id,
            matchConfidence: row.match_confidence,
            timeDiscrepancyMinutes: row.time_discrepancy_minutes,
            distanceDiscrepancyMeters: row.distance_discrepancy_meters,
            status: row.status,
            createdAt: row.created_at
        };
    }
    mapAdjudicationRow(row) {
        return {
            id: row.id,
            matchId: row.match_id,
            complaintId: row.complaint_id,
            result: row.result,
            confidence: row.confidence,
            reasons: JSON.parse(row.reasons_json || '[]'),
            evidence: JSON.parse(row.evidence_json || '{}'),
            adjudicator: row.adjudicator,
            adjudicatedAt: row.adjudicated_at,
            reviewStatus: row.review_status,
            reviewedBy: row.reviewed_by,
            reviewedAt: row.reviewed_at,
            reviewNotes: row.review_notes,
            createdAt: row.created_at
        };
    }
    mapBadRecordRow(row) {
        return {
            id: row.id,
            importBatchId: row.import_batch_id,
            sourceType: row.source_type,
            rawData: row.raw_data,
            rowNumber: row.row_number,
            failureReason: row.failure_reason,
            suggestedFix: row.suggested_fix,
            createdAt: row.created_at
        };
    }
}
exports.BusSchedulerDAO = BusSchedulerDAO;
exports.dao = new BusSchedulerDAO();
