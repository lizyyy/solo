"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parkingService = exports.ParkingService = void 0;
const database_1 = require("./database");
const types_1 = require("./types");
class ParkingService {
    async createAppointment(req) {
        const existing = await database_1.db.getAppointmentByRequestId(req.requestId);
        if (existing) {
            return { success: true, data: existing, duplicate: true };
        }
        const startTime = new Date(req.startTime);
        const endTime = new Date(req.endTime);
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            return { success: false, error: '无效的时间格式' };
        }
        if (endTime <= startTime) {
            return { success: false, error: '结束时间必须晚于开始时间' };
        }
        const conflicts = await database_1.db.getConflictingAppointments(req.licensePlate, req.startTime, req.endTime);
        if (conflicts.length > 0) {
            return {
                success: false,
                error: `车牌 ${req.licensePlate} 在该时间段已有预约冲突`
            };
        }
        const appointment = await database_1.db.createAppointment(req);
        return { success: true, data: appointment };
    }
    async approveAppointment(appointmentId, req) {
        const appointment = await database_1.db.getAppointmentById(appointmentId);
        if (!appointment) {
            return { success: false, error: '预约不存在' };
        }
        if (appointment.status !== types_1.AppointmentStatus.PENDING) {
            return { success: false, error: '只有待审批的预约可以被批准' };
        }
        const updatedAppointment = await database_1.db.updateAppointmentStatus(appointmentId, types_1.AppointmentStatus.APPROVED, types_1.ChangeSource.ADMIN_APPROVE, req.operatorId, req.operatorName, req.remark || '审批通过');
        if (!updatedAppointment) {
            return { success: false, error: '更新预约状态失败' };
        }
        const authorization = await database_1.db.createAuthorization(appointmentId, appointment.licensePlate, appointment.startTime, appointment.endTime, types_1.ChangeSource.ADMIN_APPROVE, req.operatorId, req.operatorName);
        return { success: true, data: { appointment: updatedAppointment, authorization } };
    }
    async rejectAppointment(appointmentId, req) {
        const appointment = await database_1.db.getAppointmentById(appointmentId);
        if (!appointment) {
            return { success: false, error: '预约不存在' };
        }
        if (appointment.status !== types_1.AppointmentStatus.PENDING) {
            return { success: false, error: '只有待审批的预约可以被拒绝' };
        }
        const updatedAppointment = await database_1.db.updateAppointmentStatus(appointmentId, types_1.AppointmentStatus.REJECTED, types_1.ChangeSource.ADMIN_REJECT, req.operatorId, req.operatorName, req.remark);
        if (!updatedAppointment) {
            return { success: false, error: '更新预约状态失败' };
        }
        return { success: true, data: updatedAppointment };
    }
    async checkIn(appointmentId, req) {
        const appointment = await database_1.db.getAppointmentById(appointmentId);
        if (!appointment) {
            return { success: false, error: '预约不存在' };
        }
        if (appointment.status !== types_1.AppointmentStatus.APPROVED) {
            return { success: false, error: '只有已批准的预约可以签到' };
        }
        const authorization = await database_1.db.getAuthorizationByAppointmentId(appointmentId);
        if (!authorization || authorization.status !== types_1.AuthorizationStatus.ACTIVE) {
            return { success: false, error: '车牌授权无效或已被撤销' };
        }
        const now = new Date();
        const validFrom = new Date(authorization.validFrom);
        const validTo = new Date(authorization.validTo);
        if (now < validFrom) {
            return { success: false, error: '授权尚未生效，请稍后进入' };
        }
        if (now > validTo) {
            return { success: false, error: '授权已过期' };
        }
        const updatedAppointment = await database_1.db.updateAppointmentStatus(appointmentId, types_1.AppointmentStatus.CHECKED_IN, types_1.ChangeSource.GATE_CHECKIN, req.gateId, req.gateName, `通过 ${req.gateName} 门岗签到`);
        if (!updatedAppointment) {
            return { success: false, error: '签到失败' };
        }
        return { success: true, data: updatedAppointment };
    }
    async checkOut(appointmentId, req) {
        const appointment = await database_1.db.getAppointmentById(appointmentId);
        if (!appointment) {
            return { success: false, error: '预约不存在' };
        }
        if (appointment.status !== types_1.AppointmentStatus.CHECKED_IN) {
            return { success: false, error: '只有已签到的预约可以离场' };
        }
        const authorization = await database_1.db.getAuthorizationByAppointmentId(appointmentId);
        if (!authorization) {
            return { success: false, error: '授权记录不存在' };
        }
        const updatedAppointment = await database_1.db.updateAppointmentStatus(appointmentId, types_1.AppointmentStatus.CHECKED_OUT, types_1.ChangeSource.GATE_CHECKOUT, req.gateId, req.gateName, `通过 ${req.gateName} 门岗离场`);
        if (!updatedAppointment) {
            return { success: false, error: '离场登记失败' };
        }
        await database_1.db.updateAuthorizationStatus(authorization.id, types_1.AuthorizationStatus.INACTIVE, types_1.ChangeSource.GATE_CHECKOUT, req.gateId, req.gateName, '访客离场，授权自动失效');
        return { success: true, data: updatedAppointment };
    }
    async cancelMeeting(appointmentId, req) {
        const appointment = await database_1.db.getAppointmentById(appointmentId);
        if (!appointment) {
            return { success: false, error: '预约不存在' };
        }
        if (appointment.status === types_1.AppointmentStatus.CANCELLED ||
            appointment.status === types_1.AppointmentStatus.REJECTED ||
            appointment.status === types_1.AppointmentStatus.CHECKED_OUT) {
            return { success: false, error: '该预约状态无法取消' };
        }
        const updatedAppointment = await database_1.db.updateAppointmentStatus(appointmentId, types_1.AppointmentStatus.CANCELLED, types_1.ChangeSource.MEETING_CANCEL, req.operatorId, req.operatorName, req.reason);
        if (!updatedAppointment) {
            return { success: false, error: '取消会议失败' };
        }
        const authorization = await database_1.db.getAuthorizationByAppointmentId(appointmentId);
        if (authorization && authorization.status === types_1.AuthorizationStatus.ACTIVE) {
            await database_1.db.updateAuthorizationStatus(authorization.id, types_1.AuthorizationStatus.REVOKED, types_1.ChangeSource.MEETING_CANCEL, req.operatorId, req.operatorName, `会议取消，授权撤销: ${req.reason}`);
        }
        return { success: true, data: updatedAppointment };
    }
    async revokeAuthorization(authorizationId, req) {
        const authorization = await database_1.db.getAuthorizationById(authorizationId);
        if (!authorization) {
            return { success: false, error: '授权不存在' };
        }
        if (authorization.status !== types_1.AuthorizationStatus.ACTIVE) {
            return { success: false, error: '只有活跃的授权可以被撤销' };
        }
        const updatedAuthorization = await database_1.db.updateAuthorizationStatus(authorizationId, types_1.AuthorizationStatus.REVOKED, types_1.ChangeSource.ADMIN_REVOKE, req.operatorId, req.operatorName, req.reason);
        if (!updatedAuthorization) {
            return { success: false, error: '撤销授权失败' };
        }
        return { success: true, data: updatedAuthorization };
    }
    async getOverdueAuthorizations() {
        try {
            const overdue = await database_1.db.getOverdueAuthorizations();
            return { success: true, data: overdue };
        }
        catch (e) {
            return { success: false, error: '查询超时授权失败' };
        }
    }
    async getAppointment(appointmentId) {
        const appointment = await database_1.db.getAppointmentById(appointmentId);
        if (!appointment) {
            return { success: false, error: '预约不存在' };
        }
        return { success: true, data: appointment };
    }
    async getAuthorization(authorizationId) {
        const authorization = await database_1.db.getAuthorizationById(authorizationId);
        if (!authorization) {
            return { success: false, error: '授权不存在' };
        }
        return { success: true, data: authorization };
    }
    async getChangeLogs(entityType, entityId) {
        try {
            const logs = await database_1.db.getChangeLogs(entityType, entityId);
            return { success: true, data: logs };
        }
        catch (e) {
            return { success: false, error: '查询变更日志失败' };
        }
    }
    async getPendingAppointments() {
        try {
            const pending = await database_1.db.getPendingAppointments();
            return { success: true, data: pending };
        }
        catch (e) {
            return { success: false, error: '查询待审批预约失败' };
        }
    }
    async getAllAppointments() {
        try {
            const appointments = await database_1.db.getAllAppointments();
            return { success: true, data: appointments };
        }
        catch (e) {
            return { success: false, error: '查询预约列表失败' };
        }
    }
    async getAllAuthorizations() {
        try {
            const authorizations = await database_1.db.getAllAuthorizations();
            return { success: true, data: authorizations };
        }
        catch (e) {
            return { success: false, error: '查询授权列表失败' };
        }
    }
}
exports.ParkingService = ParkingService;
exports.parkingService = new ParkingService();
