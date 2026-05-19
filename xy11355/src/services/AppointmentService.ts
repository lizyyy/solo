import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import { Appointment, VerificationStatus, Visitor } from '../models/types';
import {
  generateIdempotencyKey,
  isExpired,
  isWithinTimeRange,
  logger,
  maskObject
} from '../utils';

export interface CreateAppointmentParams {
  visitorName: string;
  visitorPhone: string;
  visitorCompany?: string;
  plateNumber?: string;
  visitDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  hostName: string;
  hostPhone: string;
  operator: string;
  idempotencyKey?: string;
}

export class AppointmentService {
  private getOrCreateVisitor(
    name: string,
    phone: string,
    company?: string
  ): Visitor {
    let visitor = storage.visitors.findOne(v => v.phone === phone);
    if (!visitor) {
      visitor = storage.visitors.create({
        name,
        phone,
        company
      } as Visitor);
      logger.info('创建新访客', { visitorId: visitor.id, name, phone });
    }
    return visitor;
  }

  private updateExpiredAppointments(): void {
    const now = new Date();
    const appointments = storage.appointments.findMany(
      a => a.status === 'approved' || a.status === 'pending'
    );

    for (const apt of appointments) {
      const endDateTime = new Date(`${apt.visitDate}T${apt.endTime}`);
      if (now > endDateTime && apt.status !== 'expired') {
        storage.appointments.update(apt.id, { status: 'expired' });
        logger.info('预约已过期', { appointmentId: apt.id });
      }
    }
  }

  create(params: CreateAppointmentParams): Appointment {
    const idempotencyKey = params.idempotencyKey || generateIdempotencyKey(
      params.visitorPhone,
      params.visitDate,
      params.startTime
    );

    const existing = storage.appointments.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      logger.info('幂等性命中，返回已存在预约', {
        appointmentId: existing.id,
        idempotencyKey
      });
      return maskObject(existing);
    }

    const visitor = this.getOrCreateVisitor(
      params.visitorName,
      params.visitorPhone,
      params.visitorCompany
    );

    const appointment = storage.appointments.create({
      visitorId: visitor.id,
      visitorName: params.visitorName,
      visitorPhone: params.visitorPhone,
      visitorCompany: params.visitorCompany,
      plateNumber: params.plateNumber,
      visitDate: params.visitDate,
      startTime: params.startTime,
      endTime: params.endTime,
      reason: params.reason,
      hostName: params.hostName,
      hostPhone: params.hostPhone,
      status: 'approved',
      idempotencyKey
    } as Appointment, idempotencyKey);

    logger.audit('创建预约', {
      appointmentId: appointment.id,
      operator: params.operator,
      visitorName: params.visitorName,
      visitDate: params.visitDate
    });

    return maskObject(appointment);
  }

  getById(id: string): Appointment | undefined {
    this.updateExpiredAppointments();
    const appointment = storage.appointments.findById(id);
    return appointment ? maskObject(appointment) : undefined;
  }

  getByPhone(phone: string): Appointment[] {
    this.updateExpiredAppointments();
    const appointments = storage.appointments.findMany(
      a => a.visitorPhone === phone && a.status === 'approved'
    );
    return appointments.map(a => maskObject(a));
  }

  getByPlateNumber(plateNumber: string): Appointment[] {
    this.updateExpiredAppointments();
    const normalizedPlate = plateNumber.toUpperCase().replace(/\s+/g, '');
    const appointments = storage.appointments.findMany(
      a => a.plateNumber?.toUpperCase().replace(/\s+/g, '') === normalizedPlate &&
           a.status === 'approved'
    );
    return appointments.map(a => maskObject(a));
  }

  getByDate(date: string): Appointment[] {
    this.updateExpiredAppointments();
    const appointments = storage.appointments.findMany(
      a => a.visitDate === date
    );
    return appointments.map(a => maskObject(a));
  }

  getAll(): Appointment[] {
    this.updateExpiredAppointments();
    const appointments = storage.appointments.findMany();
    return appointments.map(a => maskObject(a));
  }

  verifyAppointment(phone: string, plateNumber?: string): {
    valid: boolean;
    appointment?: Appointment;
    reason: string;
  } {
    this.updateExpiredAppointments();

    let appointments = this.getByPhone(phone);

    if (plateNumber) {
      const plateAppointments = this.getByPlateNumber(plateNumber);
      const phoneAppointments = appointments;
      appointments = plateAppointments.filter(pa =>
        phoneAppointments.some(pa2 => pa2.id === pa.id)
      );
    }

    if (appointments.length === 0) {
      return { valid: false, reason: '未找到有效预约' };
    }

    const validAppointment = appointments.find(a =>
      isWithinTimeRange(a.visitDate, a.startTime, a.endTime)
    );

    if (!validAppointment) {
      const hasExpired = appointments.some(a => {
        const endDateTime = new Date(`${a.visitDate}T${a.endTime}`);
        return new Date() > endDateTime;
      });
      return {
        valid: false,
        reason: hasExpired ? '预约已过期' : '不在预约时间段内'
      };
    }

    return {
      valid: true,
      appointment: validAppointment,
      reason: '预约核验通过'
    };
  }

  cancel(id: string, operator: string): boolean {
    const appointment = storage.appointments.findById(id);
    if (!appointment) {
      return false;
    }

    storage.appointments.update(id, { status: 'rejected' });

    logger.audit('取消预约', {
      appointmentId: id,
      operator,
      visitorName: appointment.visitorName
    });

    return true;
  }

  importBatch(
    appointments: Omit<CreateAppointmentParams, 'operator'>[],
    operator: string
  ): { total: number; created: number; skipped: number } {
    let created = 0;
    let skipped = 0;

    for (const apt of appointments) {
      const result = this.create({ ...apt, operator });
      if (storage.appointments.findByIdempotencyKey(
        apt.idempotencyKey || generateIdempotencyKey(apt.visitorPhone, apt.visitDate, apt.startTime)
      )) {
        skipped++;
      } else {
        created++;
      }
    }

    logger.audit('批量导入预约', {
      total: appointments.length,
      created,
      skipped,
      operator
    });

    return { total: appointments.length, created, skipped };
  }
}

export const appointmentService = new AppointmentService();
