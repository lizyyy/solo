import { db } from './database';
import {
  Appointment,
  Authorization,
  AppointmentStatus,
  AuthorizationStatus,
  ChangeSource,
  CreateAppointmentRequest,
  ApproveAppointmentRequest,
  RejectAppointmentRequest,
  CheckInRequest,
  CheckOutRequest,
  RevokeRequest
} from './types';

export class ParkingService {
  async createAppointment(req: CreateAppointmentRequest): Promise<{
    success: boolean;
    data?: Appointment;
    error?: string;
    duplicate?: boolean;
  }> {
    const existing = await db.getAppointmentByRequestId(req.requestId);
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

    const conflicts = await db.getConflictingAppointments(
      req.licensePlate,
      req.startTime,
      req.endTime
    );

    if (conflicts.length > 0) {
      return {
        success: false,
        error: `车牌 ${req.licensePlate} 在该时间段已有预约冲突`
      };
    }

    const appointment = await db.createAppointment(req);
    return { success: true, data: appointment };
  }

  async approveAppointment(
    appointmentId: string,
    req: ApproveAppointmentRequest
  ): Promise<{
    success: boolean;
    data?: { appointment: Appointment; authorization: Authorization };
    error?: string;
  }> {
    const appointment = await db.getAppointmentById(appointmentId);
    if (!appointment) {
      return { success: false, error: '预约不存在' };
    }

    if (appointment.status !== AppointmentStatus.PENDING) {
      return { success: false, error: '只有待审批的预约可以被批准' };
    }

    const updatedAppointment = await db.updateAppointmentStatus(
      appointmentId,
      AppointmentStatus.APPROVED,
      ChangeSource.ADMIN_APPROVE,
      req.operatorId,
      req.operatorName,
      req.remark || '审批通过'
    );

    if (!updatedAppointment) {
      return { success: false, error: '更新预约状态失败' };
    }

    const authorization = await db.createAuthorization(
      appointmentId,
      appointment.licensePlate,
      appointment.startTime,
      appointment.endTime,
      ChangeSource.ADMIN_APPROVE,
      req.operatorId,
      req.operatorName
    );

    return { success: true, data: { appointment: updatedAppointment, authorization } };
  }

  async rejectAppointment(
    appointmentId: string,
    req: RejectAppointmentRequest
  ): Promise<{
    success: boolean;
    data?: Appointment;
    error?: string;
  }> {
    const appointment = await db.getAppointmentById(appointmentId);
    if (!appointment) {
      return { success: false, error: '预约不存在' };
    }

    if (appointment.status !== AppointmentStatus.PENDING) {
      return { success: false, error: '只有待审批的预约可以被拒绝' };
    }

    const updatedAppointment = await db.updateAppointmentStatus(
      appointmentId,
      AppointmentStatus.REJECTED,
      ChangeSource.ADMIN_REJECT,
      req.operatorId,
      req.operatorName,
      req.remark
    );

    if (!updatedAppointment) {
      return { success: false, error: '更新预约状态失败' };
    }

    return { success: true, data: updatedAppointment };
  }

  async checkIn(
    appointmentId: string,
    req: CheckInRequest
  ): Promise<{
    success: boolean;
    data?: Appointment;
    error?: string;
  }> {
    const appointment = await db.getAppointmentById(appointmentId);
    if (!appointment) {
      return { success: false, error: '预约不存在' };
    }

    if (appointment.status !== AppointmentStatus.APPROVED) {
      return { success: false, error: '只有已批准的预约可以签到' };
    }

    const authorization = await db.getAuthorizationByAppointmentId(appointmentId);
    if (!authorization || authorization.status !== AuthorizationStatus.ACTIVE) {
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

    const updatedAppointment = await db.updateAppointmentStatus(
      appointmentId,
      AppointmentStatus.CHECKED_IN,
      ChangeSource.GATE_CHECKIN,
      req.gateId,
      req.gateName,
      `通过 ${req.gateName} 门岗签到`
    );

    if (!updatedAppointment) {
      return { success: false, error: '签到失败' };
    }

    return { success: true, data: updatedAppointment };
  }

  async checkOut(
    appointmentId: string,
    req: CheckOutRequest
  ): Promise<{
    success: boolean;
    data?: Appointment;
    error?: string;
  }> {
    const appointment = await db.getAppointmentById(appointmentId);
    if (!appointment) {
      return { success: false, error: '预约不存在' };
    }

    if (appointment.status !== AppointmentStatus.CHECKED_IN) {
      return { success: false, error: '只有已签到的预约可以离场' };
    }

    const authorization = await db.getAuthorizationByAppointmentId(appointmentId);
    if (!authorization) {
      return { success: false, error: '授权记录不存在' };
    }

    const updatedAppointment = await db.updateAppointmentStatus(
      appointmentId,
      AppointmentStatus.CHECKED_OUT,
      ChangeSource.GATE_CHECKOUT,
      req.gateId,
      req.gateName,
      `通过 ${req.gateName} 门岗离场`
    );

    if (!updatedAppointment) {
      return { success: false, error: '离场登记失败' };
    }

    await db.updateAuthorizationStatus(
      authorization.id,
      AuthorizationStatus.INACTIVE,
      ChangeSource.GATE_CHECKOUT,
      req.gateId,
      req.gateName,
      '访客离场，授权自动失效'
    );

    return { success: true, data: updatedAppointment };
  }

  async cancelMeeting(
    appointmentId: string,
    req: RevokeRequest
  ): Promise<{
    success: boolean;
    data?: Appointment;
    error?: string;
  }> {
    const appointment = await db.getAppointmentById(appointmentId);
    if (!appointment) {
      return { success: false, error: '预约不存在' };
    }

    if (appointment.status === AppointmentStatus.CANCELLED ||
        appointment.status === AppointmentStatus.REJECTED ||
        appointment.status === AppointmentStatus.CHECKED_OUT) {
      return { success: false, error: '该预约状态无法取消' };
    }

    const updatedAppointment = await db.updateAppointmentStatus(
      appointmentId,
      AppointmentStatus.CANCELLED,
      ChangeSource.MEETING_CANCEL,
      req.operatorId,
      req.operatorName,
      req.reason
    );

    if (!updatedAppointment) {
      return { success: false, error: '取消会议失败' };
    }

    const authorization = await db.getAuthorizationByAppointmentId(appointmentId);
    if (authorization && authorization.status === AuthorizationStatus.ACTIVE) {
      await db.updateAuthorizationStatus(
        authorization.id,
        AuthorizationStatus.REVOKED,
        ChangeSource.MEETING_CANCEL,
        req.operatorId,
        req.operatorName,
        `会议取消，授权撤销: ${req.reason}`
      );
    }

    return { success: true, data: updatedAppointment };
  }

  async revokeAuthorization(
    authorizationId: string,
    req: RevokeRequest
  ): Promise<{
    success: boolean;
    data?: Authorization;
    error?: string;
  }> {
    const authorization = await db.getAuthorizationById(authorizationId);
    if (!authorization) {
      return { success: false, error: '授权不存在' };
    }

    if (authorization.status !== AuthorizationStatus.ACTIVE) {
      return { success: false, error: '只有活跃的授权可以被撤销' };
    }

    const updatedAuthorization = await db.updateAuthorizationStatus(
      authorizationId,
      AuthorizationStatus.REVOKED,
      ChangeSource.ADMIN_REVOKE,
      req.operatorId,
      req.operatorName,
      req.reason
    );

    if (!updatedAuthorization) {
      return { success: false, error: '撤销授权失败' };
    }

    return { success: true, data: updatedAuthorization };
  }

  async getOverdueAuthorizations(): Promise<{
    success: boolean;
    data?: Authorization[];
    error?: string;
  }> {
    try {
      const overdue = await db.getOverdueAuthorizations();
      return { success: true, data: overdue };
    } catch (e) {
      return { success: false, error: '查询超时授权失败' };
    }
  }

  async getAppointment(appointmentId: string): Promise<{
    success: boolean;
    data?: Appointment;
    error?: string;
  }> {
    const appointment = await db.getAppointmentById(appointmentId);
    if (!appointment) {
      return { success: false, error: '预约不存在' };
    }
    return { success: true, data: appointment };
  }

  async getAuthorization(authorizationId: string): Promise<{
    success: boolean;
    data?: Authorization;
    error?: string;
  }> {
    const authorization = await db.getAuthorizationById(authorizationId);
    if (!authorization) {
      return { success: false, error: '授权不存在' };
    }
    return { success: true, data: authorization };
  }

  async getChangeLogs(entityType: 'appointment' | 'authorization', entityId: string): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      const logs = await db.getChangeLogs(entityType, entityId);
      return { success: true, data: logs };
    } catch (e) {
      return { success: false, error: '查询变更日志失败' };
    }
  }

  async getPendingAppointments(): Promise<{
    success: boolean;
    data?: Appointment[];
    error?: string;
  }> {
    try {
      const pending = await db.getPendingAppointments();
      return { success: true, data: pending };
    } catch (e) {
      return { success: false, error: '查询待审批预约失败' };
    }
  }

  async getAllAppointments(): Promise<{
    success: boolean;
    data?: Appointment[];
    error?: string;
  }> {
    try {
      const appointments = await db.getAllAppointments();
      return { success: true, data: appointments };
    } catch (e) {
      return { success: false, error: '查询预约列表失败' };
    }
  }

  async getAllAuthorizations(): Promise<{
    success: boolean;
    data?: Authorization[];
    error?: string;
  }> {
    try {
      const authorizations = await db.getAllAuthorizations();
      return { success: true, data: authorizations };
    } catch (e) {
      return { success: false, error: '查询授权列表失败' };
    }
  }
}

export const parkingService = new ParkingService();
