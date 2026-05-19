import {
  PermissionLevel,
  Escort,
  Appointment,
  EscortTask,
  MaskingField,
} from '../types';

export class SecurityService {
  private maskingRules: MaskingField[] = [
    { entity: 'Appointment', field: 'patientPhone', maskType: 'phone', minLevel: 'staff' },
    { entity: 'Appointment', field: 'patientId', maskType: 'idcard', minLevel: 'manager' },
    { entity: 'EscortTask', field: 'patientPhone', maskType: 'phone', minLevel: 'staff' },
    { entity: 'EscortTask', field: 'patientId', maskType: 'idcard', minLevel: 'manager' },
    { entity: 'Escort', field: 'phone', maskType: 'phone', minLevel: 'staff' },
  ];

  private levelOrder: PermissionLevel[] = ['guest', 'staff', 'manager', 'admin'];

  private hasSufficientLevel(userLevel: PermissionLevel, requiredLevel: PermissionLevel): boolean {
    const userIndex = this.levelOrder.indexOf(userLevel);
    const requiredIndex = this.levelOrder.indexOf(requiredLevel);
    return userIndex >= requiredIndex;
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return '***';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }

  private maskIdCard(idCard: string): string {
    if (!idCard || idCard.length < 10) return '***';
    return idCard.slice(0, 4) + '**********' + idCard.slice(-4);
  }

  private maskName(name: string): string {
    if (!name || name.length <= 1) return '*';
    return name[0] + '*'.repeat(name.length - 1);
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `**@${domain}`;
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1] + '@' + domain;
  }

  private applyMask(value: string, maskType: string): string {
    switch (maskType) {
      case 'phone':
        return this.maskPhone(value);
      case 'idcard':
        return this.maskIdCard(value);
      case 'name':
        return this.maskName(value);
      case 'email':
        return this.maskEmail(value);
      default:
        return '*'.repeat(Math.min(value.length, 5));
    }
  }

  maskEscort(escort: Escort, userLevel: PermissionLevel): Escort {
    const masked = { ...escort };
    const entityRules = this.maskingRules.filter(r => r.entity === 'Escort');

    for (const rule of entityRules) {
      if (!this.hasSufficientLevel(userLevel, rule.minLevel)) {
        const field = rule.field as keyof Escort;
        if (masked[field]) {
          (masked as any)[field] = this.applyMask(String(masked[field]), rule.maskType);
        }
      }
    }

    return masked;
  }

  maskAppointment(appointment: Appointment, userLevel: PermissionLevel): Appointment {
    const masked = { ...appointment };
    const entityRules = this.maskingRules.filter(r => r.entity === 'Appointment');

    for (const rule of entityRules) {
      if (!this.hasSufficientLevel(userLevel, rule.minLevel)) {
        const field = rule.field as keyof Appointment;
        if ((masked as any)[field]) {
          (masked as any)[field] = this.applyMask(String((masked as any)[field]), rule.maskType);
        }
      }
    }

    return masked;
  }

  maskTask(task: EscortTask, userLevel: PermissionLevel): EscortTask {
    const masked = { ...task };
    const entityRules = this.maskingRules.filter(r => r.entity === 'EscortTask');

    for (const rule of entityRules) {
      if (!this.hasSufficientLevel(userLevel, rule.minLevel)) {
        const field = rule.field as keyof EscortTask;
        if ((masked as any)[field]) {
          (masked as any)[field] = this.applyMask(String((masked as any)[field]), rule.maskType);
        }
      }
    }

    return masked;
  }

  maskEscorts(escorts: Escort[], userLevel: PermissionLevel): Escort[] {
    return escorts.map(e => this.maskEscort(e, userLevel));
  }

  maskAppointments(appointments: Appointment[], userLevel: PermissionLevel): Appointment[] {
    return appointments.map(a => this.maskAppointment(a, userLevel));
  }

  maskTasks(tasks: EscortTask[], userLevel: PermissionLevel): EscortTask[] {
    return tasks.map(t => this.maskTask(t, userLevel));
  }

  addMaskingRule(rule: MaskingField): void {
    const existingIndex = this.maskingRules.findIndex(
      r => r.entity === rule.entity && r.field === rule.field
    );
    if (existingIndex >= 0) {
      this.maskingRules[existingIndex] = rule;
    } else {
      this.maskingRules.push(rule);
    }
  }

  getMaskingRules(): MaskingField[] {
    return [...this.maskingRules];
  }

  sanitizeLogData(data: any, userLevel: PermissionLevel = 'guest'): any {
    if (!data) return data;

    const sanitized = { ...data };

    const sensitiveFields = ['phone', 'patientPhone', 'patientId', 'patientName', 'idCard', 'email'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        if (field.includes('phone') || field.includes('Phone')) {
          sanitized[field] = this.maskPhone(String(sanitized[field]));
        } else if (field.includes('id') || field.includes('Id')) {
          sanitized[field] = this.maskIdCard(String(sanitized[field]));
        } else if (field.includes('name') || field.includes('Name')) {
          sanitized[field] = this.maskName(String(sanitized[field]));
        } else {
          sanitized[field] = '***';
        }
      }
    }

    return sanitized;
  }

  canPerformAction(
    userLevel: PermissionLevel,
    action: string,
    entityType: string
  ): boolean {
    const actionPermissions: Record<string, PermissionLevel[]> = {
      'create': ['staff', 'manager', 'admin'],
      'read': ['guest', 'staff', 'manager', 'admin'],
      'update': ['staff', 'manager', 'admin'],
      'delete': ['manager', 'admin'],
      'assign': ['staff', 'manager', 'admin'],
      'cancel': ['staff', 'manager', 'admin'],
      'reassign': ['manager', 'admin'],
      'export': ['manager', 'admin'],
      'import': ['manager', 'admin'],
    };

    const allowedLevels = actionPermissions[action] || ['admin'];
    return this.hasSufficientLevel(userLevel, allowedLevels[0]);
  }
}

export const securityService = new SecurityService();
