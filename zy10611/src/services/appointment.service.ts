import { v4 as uuidv4 } from 'uuid';
import {
  Appointment,
  AppointmentStatus,
  FlowType,
  AppointmentHistory,
  LARGE_INDEX_THRESHOLD,
  ErrorCode
} from '../types';
import { store } from '../store';
import { conflictService } from './conflict.service';

interface CreateAppointmentRequest {
  indexName: string;
  dataSize: number;
  timeWindow: { start: string; end: string };
  impactScope: string[];
  createdBy: string;
  remark?: string;
}

export class AppointmentService {
  createAppointment(request: CreateAppointmentRequest): {
    success: boolean;
    data?: Appointment;
    error?: { code: ErrorCode; message: string; details?: any };
  } {
    const validation = this.validateRequest(request);
    if (!validation.success) {
      return validation;
    }

    const isLargeIndex = request.dataSize >= LARGE_INDEX_THRESHOLD;

    const newAppointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'> = {
      indexName: request.indexName,
      dataSize: request.dataSize,
      timeWindow: request.timeWindow,
      impactScope: request.impactScope,
      status: AppointmentStatus.PENDING_CONFIRM,
      flowType: FlowType.NORMAL,
      isLargeIndex,
      createdBy: request.createdBy,
      remark: request.remark
    };

    const conflict = conflictService.checkConflict(newAppointment);
    if (conflict.hasConflict) {
      return {
        success: false,
        error: {
          code: ErrorCode.CONFLICT_DETECTED,
          message: conflict.message,
          details: conflict.conflictAppointments
        }
      };
    }

    const appointment: Appointment = {
      ...newAppointment,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    store.saveAppointment(appointment);
    this.saveHistory(appointment.id, undefined, appointment.status, appointment.flowType, request.createdBy);

    return { success: true, data: appointment };
  }

  private validateRequest(request: CreateAppointmentRequest): {
    success: boolean;
    error?: { code: ErrorCode; message: string };
  } {
    if (!request.indexName || !request.dataSize || !request.timeWindow || !request.impactScope || !request.createdBy) {
      return {
        success: false,
        error: {
          code: ErrorCode.MISSING_REQUIRED_FIELDS,
          message: '缺少必填字段：indexName, dataSize, timeWindow, impactScope, createdBy'
        }
      };
    }

    if (typeof request.indexName !== 'string' || request.indexName.trim().length === 0) {
      return {
        success: false,
        error: { code: ErrorCode.INVALID_INDEX_NAME, message: '索引名无效' }
      };
    }

    if (typeof request.dataSize !== 'number' || request.dataSize <= 0) {
      return {
        success: false,
        error: { code: ErrorCode.INVALID_DATA_SIZE, message: '数据量必须大于0' }
      };
    }

    const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(request.timeWindow.start) || !timePattern.test(request.timeWindow.end)) {
      return {
        success: false,
        error: { code: ErrorCode.INVALID_TIME_WINDOW, message: '时间窗口格式无效，应为 HH:MM' }
      };
    }

    return { success: true };
  }

  getAppointment(id: string): Appointment | undefined {
    return store.getAppointment(id);
  }

  listAppointments(filters?: { status?: string; indexName?: string }): Appointment[] {
    let appointments = store.getAllAppointments();

    if (filters?.status) {
      appointments = appointments.filter(a => a.status === filters.status);
    }
    if (filters?.indexName) {
      appointments = appointments.filter(a => a.indexName.includes(filters.indexName!));
    }

    return appointments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAppointmentHistories(appointmentId: string): AppointmentHistory[] {
    return store.getHistories(appointmentId);
  }

  lockWindow(id: string, operator: string): {
    success: boolean;
    data?: Appointment;
    error?: { code: ErrorCode; message: string };
  } {
    const appointment = store.getAppointment(id);
    if (!appointment) {
      return { success: false, error: { code: ErrorCode.APPOINTMENT_NOT_FOUND, message: '预约记录不存在' } };
    }

    if (appointment.status !== AppointmentStatus.PENDING_CONFIRM && appointment.status !== AppointmentStatus.MANUAL_REVIEW) {
      return {
        success: false,
        error: { code: ErrorCode.INVALID_STATUS_TRANSITION, message: '当前状态不允许锁窗' }
      };
    }

    appointment.status = AppointmentStatus.LOCKED;
    appointment.updatedAt = new Date().toISOString();
    store.saveAppointment(appointment);
    this.saveHistory(id, appointment.status, AppointmentStatus.LOCKED, appointment.flowType, operator);

    return { success: true, data: appointment };
  }

  startRebuild(id: string, operator: string): {
    success: boolean;
    data?: Appointment;
    error?: { code: ErrorCode; message: string };
  } {
    const appointment = store.getAppointment(id);
    if (!appointment) {
      return { success: false, error: { code: ErrorCode.APPOINTMENT_NOT_FOUND, message: '预约记录不存在' } };
    }

    if (appointment.status !== AppointmentStatus.LOCKED) {
      return {
        success: false,
        error: { code: ErrorCode.INVALID_STATUS_TRANSITION, message: '只有已锁窗状态才能开始重建' }
      };
    }

    appointment.status = AppointmentStatus.REBUILDING;
    appointment.updatedAt = new Date().toISOString();
    store.saveAppointment(appointment);
    this.saveHistory(id, AppointmentStatus.LOCKED, AppointmentStatus.REBUILDING, appointment.flowType, operator);

    return { success: true, data: appointment };
  }

  completeRebuild(id: string, operator: string): {
    success: boolean;
    data?: Appointment;
    error?: { code: ErrorCode; message: string };
  } {
    const appointment = store.getAppointment(id);
    if (!appointment) {
      return { success: false, error: { code: ErrorCode.APPOINTMENT_NOT_FOUND, message: '预约记录不存在' } };
    }

    if (appointment.status !== AppointmentStatus.REBUILDING) {
      return {
        success: false,
        error: { code: ErrorCode.INVALID_STATUS_TRANSITION, message: '只有重建中状态才能完成' }
      };
    }

    appointment.status = AppointmentStatus.COMPLETED;
    appointment.updatedAt = new Date().toISOString();
    store.saveAppointment(appointment);
    this.saveHistory(id, AppointmentStatus.REBUILDING, AppointmentStatus.COMPLETED, appointment.flowType, operator);

    return { success: true, data: appointment };
  }

  reject(id: string, operator: string, reason: string): {
    success: boolean;
    data?: Appointment;
    error?: { code: ErrorCode; message: string };
  } {
    const appointment = store.getAppointment(id);
    if (!appointment) {
      return { success: false, error: { code: ErrorCode.APPOINTMENT_NOT_FOUND, message: '预约记录不存在' } };
    }

    const validStatuses = [AppointmentStatus.PENDING_CONFIRM, AppointmentStatus.MANUAL_REVIEW];
    if (!validStatuses.includes(appointment.status)) {
      return {
        success: false,
        error: { code: ErrorCode.INVALID_STATUS_TRANSITION, message: '当前状态不允许驳回' }
      };
    }

    const fromStatus = appointment.status;
    appointment.status = AppointmentStatus.REJECTED;
    appointment.flowType = FlowType.REJECT;
    appointment.rejectReason = reason;
    appointment.updatedAt = new Date().toISOString();
    store.saveAppointment(appointment);
    this.saveHistory(id, fromStatus, AppointmentStatus.REJECTED, FlowType.REJECT, operator, reason);

    return { success: true, data: appointment };
  }

  requestManualReview(id: string, operator: string, remark?: string): {
    success: boolean;
    data?: Appointment;
    error?: { code: ErrorCode; message: string };
  } {
    const appointment = store.getAppointment(id);
    if (!appointment) {
      return { success: false, error: { code: ErrorCode.APPOINTMENT_NOT_FOUND, message: '预约记录不存在' } };
    }

    if (appointment.status !== AppointmentStatus.PENDING_CONFIRM) {
      return {
        success: false,
        error: { code: ErrorCode.INVALID_STATUS_TRANSITION, message: '只有待确认状态才能申请人工复核' }
      };
    }

    appointment.status = AppointmentStatus.MANUAL_REVIEW;
    appointment.flowType = FlowType.MANUAL_REVIEW;
    appointment.remark = remark;
    appointment.updatedAt = new Date().toISOString();
    store.saveAppointment(appointment);
    this.saveHistory(id, AppointmentStatus.PENDING_CONFIRM, AppointmentStatus.MANUAL_REVIEW, FlowType.MANUAL_REVIEW, operator, remark);

    return { success: true, data: appointment };
  }

  private saveHistory(
    appointmentId: string,
    fromStatus: AppointmentStatus | undefined,
    toStatus: AppointmentStatus,
    flowType: FlowType,
    operator: string,
    remark?: string
  ): void {
    const history: AppointmentHistory = {
      id: uuidv4(),
      appointmentId,
      fromStatus,
      toStatus,
      flowType,
      operator,
      remark,
      createdAt: new Date().toISOString()
    };
    store.saveHistory(history);
  }
}

export const appointmentService = new AppointmentService();
