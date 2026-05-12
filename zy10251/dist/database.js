"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.Database = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const uuid_1 = require("uuid");
const types_1 = require("./types");
class Database {
    constructor(dbPath = './parking.db') {
        this.db = new sqlite3_1.default.Database(dbPath);
    }
    async init() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(`
          CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY,
            request_id TEXT UNIQUE NOT NULL,
            visitor_name TEXT NOT NULL,
            visitor_phone TEXT NOT NULL,
            visitor_company TEXT NOT NULL,
            host_name TEXT NOT NULL,
            host_department TEXT NOT NULL,
            license_plate TEXT NOT NULL,
            meeting_subject TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
                this.db.run(`
          CREATE TABLE IF NOT EXISTS authorizations (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            license_plate TEXT NOT NULL,
            valid_from TEXT NOT NULL,
            valid_to TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id)
          )
        `);
                this.db.run(`
          CREATE TABLE IF NOT EXISTS change_logs (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            field TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            source TEXT NOT NULL,
            operator_id TEXT,
            operator_name TEXT,
            remark TEXT,
            created_at TEXT NOT NULL
          )
        `);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_license_plate ON appointments(license_plate)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_request_id ON appointments(request_id)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_authorizations_license_plate ON authorizations(license_plate)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_authorizations_status ON authorizations(status)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_change_logs_entity ON change_logs(entity_type, entity_id)`);
                resolve();
            });
        });
    }
    async runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async getOne(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row || null);
            });
        });
    }
    async getAll(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
    }
    mapToAppointment(row) {
        return {
            id: row.id,
            requestId: row.request_id,
            visitorName: row.visitor_name,
            visitorPhone: row.visitor_phone,
            visitorCompany: row.visitor_company,
            hostName: row.host_name,
            hostDepartment: row.host_department,
            licensePlate: row.license_plate,
            meetingSubject: row.meeting_subject,
            startTime: row.start_time,
            endTime: row.end_time,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
    mapToAuthorization(row) {
        return {
            id: row.id,
            appointmentId: row.appointment_id,
            licensePlate: row.license_plate,
            validFrom: row.valid_from,
            validTo: row.valid_to,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
    mapToChangeLog(row) {
        return {
            id: row.id,
            entityType: row.entity_type,
            entityId: row.entity_id,
            field: row.field,
            oldValue: row.old_value,
            newValue: row.new_value,
            source: row.source,
            operatorId: row.operator_id,
            operatorName: row.operator_name,
            remark: row.remark,
            createdAt: row.created_at
        };
    }
    async createAppointment(req) {
        const now = new Date().toISOString();
        const id = (0, uuid_1.v4)();
        const appointment = {
            id,
            requestId: req.requestId,
            visitorName: req.visitorName,
            visitorPhone: req.visitorPhone,
            visitorCompany: req.visitorCompany,
            hostName: req.hostName,
            hostDepartment: req.hostDepartment,
            licensePlate: req.licensePlate,
            meetingSubject: req.meetingSubject,
            startTime: req.startTime,
            endTime: req.endTime,
            status: types_1.AppointmentStatus.PENDING,
            createdAt: now,
            updatedAt: now
        };
        await this.runQuery(`INSERT INTO appointments (
        id, request_id, visitor_name, visitor_phone, visitor_company,
        host_name, host_department, license_plate, meeting_subject,
        start_time, end_time, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            appointment.id,
            appointment.requestId,
            appointment.visitorName,
            appointment.visitorPhone,
            appointment.visitorCompany,
            appointment.hostName,
            appointment.hostDepartment,
            appointment.licensePlate,
            appointment.meetingSubject,
            appointment.startTime,
            appointment.endTime,
            appointment.status,
            appointment.createdAt,
            appointment.updatedAt
        ]);
        await this.logChange('appointment', appointment.id, 'status', null, appointment.status, types_1.ChangeSource.USER_CREATE, null, null, '创建预约');
        return appointment;
    }
    async getAppointmentById(id) {
        const row = await this.getOne('SELECT * FROM appointments WHERE id = ?', [id]);
        return row ? this.mapToAppointment(row) : null;
    }
    async getAppointmentByRequestId(requestId) {
        const row = await this.getOne('SELECT * FROM appointments WHERE request_id = ?', [requestId]);
        return row ? this.mapToAppointment(row) : null;
    }
    async getConflictingAppointments(licensePlate, startTime, endTime, excludeAppointmentId) {
        let sql = `
      SELECT * FROM appointments 
      WHERE license_plate = ?
      AND status NOT IN (?, ?, ?)
      AND (
        (start_time <= ? AND end_time >= ?) OR
        (start_time >= ? AND start_time <= ?) OR
        (end_time >= ? AND end_time <= ?)
      )
    `;
        const params = [
            licensePlate,
            types_1.AppointmentStatus.REJECTED,
            types_1.AppointmentStatus.CANCELLED,
            types_1.AppointmentStatus.CHECKED_OUT,
            endTime,
            startTime,
            startTime,
            endTime,
            startTime,
            endTime
        ];
        if (excludeAppointmentId) {
            sql += ' AND id != ?';
            params.push(excludeAppointmentId);
        }
        const rows = await this.getAll(sql, params);
        return rows.map(this.mapToAppointment);
    }
    async updateAppointmentStatus(id, status, source, operatorId, operatorName, remark) {
        const appointment = await this.getAppointmentById(id);
        if (!appointment)
            return null;
        const oldStatus = appointment.status;
        const now = new Date().toISOString();
        await this.runQuery('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
        await this.logChange('appointment', id, 'status', oldStatus, status, source, operatorId, operatorName, remark);
        return this.getAppointmentById(id);
    }
    async createAuthorization(appointmentId, licensePlate, validFrom, validTo, source, operatorId, operatorName) {
        const now = new Date().toISOString();
        const id = (0, uuid_1.v4)();
        const authorization = {
            id,
            appointmentId,
            licensePlate,
            validFrom,
            validTo,
            status: types_1.AuthorizationStatus.ACTIVE,
            createdAt: now,
            updatedAt: now
        };
        await this.runQuery(`INSERT INTO authorizations (
        id, appointment_id, license_plate, valid_from, valid_to,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            authorization.id,
            authorization.appointmentId,
            authorization.licensePlate,
            authorization.validFrom,
            authorization.validTo,
            authorization.status,
            authorization.createdAt,
            authorization.updatedAt
        ]);
        await this.logChange('authorization', authorization.id, 'status', null, authorization.status, source, operatorId, operatorName, '创建车牌授权');
        return authorization;
    }
    async getAuthorizationById(id) {
        const row = await this.getOne('SELECT * FROM authorizations WHERE id = ?', [id]);
        return row ? this.mapToAuthorization(row) : null;
    }
    async getAuthorizationByAppointmentId(appointmentId) {
        const row = await this.getOne('SELECT * FROM authorizations WHERE appointment_id = ?', [appointmentId]);
        return row ? this.mapToAuthorization(row) : null;
    }
    async getActiveAuthorizationsByLicensePlate(licensePlate) {
        const rows = await this.getAll('SELECT * FROM authorizations WHERE license_plate = ? AND status = ?', [licensePlate, types_1.AuthorizationStatus.ACTIVE]);
        return rows.map(this.mapToAuthorization);
    }
    async updateAuthorizationStatus(id, status, source, operatorId, operatorName, remark) {
        const authorization = await this.getAuthorizationById(id);
        if (!authorization)
            return null;
        const oldStatus = authorization.status;
        const now = new Date().toISOString();
        await this.runQuery('UPDATE authorizations SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
        await this.logChange('authorization', id, 'status', oldStatus, status, source, operatorId, operatorName, remark);
        return this.getAuthorizationById(id);
    }
    async logChange(entityType, entityId, field, oldValue, newValue, source, operatorId, operatorName, remark) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        await this.runQuery(`INSERT INTO change_logs (
        id, entity_type, entity_id, field, old_value, new_value,
        source, operator_id, operator_name, remark, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, entityType, entityId, field, oldValue, newValue, source, operatorId, operatorName, remark, now]);
    }
    async getChangeLogs(entityType, entityId) {
        const rows = await this.getAll('SELECT * FROM change_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC', [entityType, entityId]);
        return rows.map(this.mapToChangeLog);
    }
    async getOverdueAuthorizations() {
        const now = new Date().toISOString();
        const rows = await this.getAll(`SELECT * FROM authorizations 
       WHERE status = ? AND valid_to < ?`, [types_1.AuthorizationStatus.ACTIVE, now]);
        return rows.map(this.mapToAuthorization);
    }
    async getPendingAppointments() {
        const rows = await this.getAll('SELECT * FROM appointments WHERE status = ? ORDER BY created_at ASC', [types_1.AppointmentStatus.PENDING]);
        return rows.map(this.mapToAppointment);
    }
    async getAllAppointments() {
        const rows = await this.getAll('SELECT * FROM appointments ORDER BY created_at DESC');
        return rows.map(this.mapToAppointment);
    }
    async getAllAuthorizations() {
        const rows = await this.getAll('SELECT * FROM authorizations ORDER BY created_at DESC');
        return rows.map(this.mapToAuthorization);
    }
    async close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
}
exports.Database = Database;
exports.db = new Database();
