import { EquipmentBooking, BadRecord, BadRecordType, BookingStatus, EquipmentIntensity, ContraindicationType } from '../types';

export class ValidationService {
  private existingBookings: Map<string, EquipmentBooking> = new Map();

  setExistingBookings(bookings: EquipmentBooking[]): void {
    this.existingBookings.clear();
    bookings.forEach(booking => {
      this.existingBookings.set(booking.预约编号, booking);
    });
  }

  validateBooking(booking: Partial<EquipmentBooking>, rowIndex: number): BadRecord | null {
    const errors: string[] = [];
    const badRecordType = this.checkRequiredFields(booking, errors);
    
    if (errors.length > 0) {
      return this.createBadRecord(booking, rowIndex, errors.join('; '), badRecordType || BadRecordType.MISSING_REQUIRED_FIELD);
    }

    const formatError = this.validateFormats(booking as EquipmentBooking);
    if (formatError) {
      return formatError;
    }

    const duplicateError = this.checkDuplicateBooking(booking as EquipmentBooking, rowIndex);
    if (duplicateError) {
      return duplicateError;
    }

    const statusError = this.checkStatusTransition(booking as EquipmentBooking, rowIndex);
    if (statusError) {
      return statusError;
    }

    const contraindicationError = this.checkContraindicationConflict(booking as EquipmentBooking, rowIndex);
    if (contraindicationError) {
      return contraindicationError;
    }

    const consistencyError = this.checkConsistency(booking as EquipmentBooking, rowIndex);
    if (consistencyError) {
      return consistencyError;
    }

    return null;
  }

  private checkRequiredFields(booking: Partial<EquipmentBooking>, errors: string[]): BadRecordType | null {
    const requiredFields: Array<keyof EquipmentBooking> = [
      '预约编号', '门店名称', '患者姓名', '患者手机号', 
      '器械编号', '器械名称', '预约日期', '预约开始时间', 
      '预约结束时间', '治疗师姓名', '预约状态'
    ];

    const missingFields: string[] = [];
    requiredFields.forEach(field => {
      if (!booking[field] || booking[field] === '') {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      errors.push(`缺少必填字段: ${missingFields.join(', ')}`);
      return BadRecordType.MISSING_REQUIRED_FIELD;
    }
    return null;
  }

  private validateFormats(booking: EquipmentBooking): BadRecord | null {
    const errors: string[] = [];

    if (!/^1[3-9]\d{9}$/.test(booking.患者手机号)) {
      errors.push('手机号格式不正确');
    }

    if (booking.患者身份证号 && !/^\d{17}[\dXx]$/.test(booking.患者身份证号)) {
      errors.push('身份证号格式不正确');
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.预约日期)) {
      errors.push('预约日期格式不正确，应为YYYY-MM-DD');
    }

    if (!/^\d{2}:\d{2}$/.test(booking.预约开始时间)) {
      errors.push('预约开始时间格式不正确，应为HH:MM');
    }

    if (!/^\d{2}:\d{2}$/.test(booking.预约结束时间)) {
      errors.push('预约结束时间格式不正确，应为HH:MM');
    }

    if (errors.length > 0) {
      return {
        原始数据: booking,
        行号: 0,
        错误原因: errors.join('; '),
        错误类型: BadRecordType.INVALID_FORMAT,
        后续处理建议: '请修正格式错误后重新导入',
        人工备注: '',
        是否允许继续: false
      };
    }
    return null;
  }

  private checkDuplicateBooking(booking: EquipmentBooking, rowIndex: number): BadRecord | null {
    if (this.existingBookings.has(booking.预约编号)) {
      return {
        原始数据: booking,
        行号: rowIndex + 1,
        错误原因: `预约编号 ${booking.预约编号} 已存在`,
        错误类型: BadRecordType.DUPLICATE_BOOKING,
        后续处理建议: '请检查是否重复提交，或使用新的预约编号',
        人工备注: '',
        是否允许继续: false
      };
    }
    return null;
  }

  private checkStatusTransition(booking: EquipmentBooking, rowIndex: number): BadRecord | null {
    const statusOrder: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
      BookingStatus.COMPLETED
    ];

    const existing = this.existingBookings.get(booking.预约编号);
    if (existing) {
      const currentIndex = statusOrder.indexOf(existing.预约状态);
      const newIndex = statusOrder.indexOf(booking.预约状态);
      
      if (newIndex - currentIndex > 1) {
        return {
          原始数据: booking,
          行号: rowIndex + 1,
          错误原因: `状态越级: 无法从 ${existing.预约状态} 直接跳转到 ${booking.预约状态}`,
          错误类型: BadRecordType.STATUS_TRANSITION_ERROR,
          后续处理建议: '请按状态流转顺序逐步更新，或添加人工备注说明特殊情况',
          人工备注: '',
          是否允许继续: true
        };
      }
    }
    return null;
  }

  private checkContraindicationConflict(booking: EquipmentBooking, rowIndex: number): BadRecord | null {
    const highRiskContraindications: ContraindicationType[] = [
      ContraindicationType.HEART_DISEASE,
      ContraindicationType.HIGH_BLOOD_PRESSURE,
      ContraindicationType.RECENT_SURGERY
    ];

    if (highRiskContraindications.includes(booking.患者禁忌情况) && 
        booking.器械强度等级 === EquipmentIntensity.HIGH) {
      return {
        原始数据: booking,
        行号: rowIndex + 1,
        错误原因: `禁忌患者 ${booking.患者姓名} (${booking.患者禁忌情况}) 被安排使用高强度器械 ${booking.器械名称}`,
        错误类型: BadRecordType.CONTRAINDICATION_CONFLICT,
        后续处理建议: '建议更换为低/中等强度器械，或由主治医生评估后添加人工备注确认',
        人工备注: '',
        是否允许继续: true
      };
    }
    return null;
  }

  private checkConsistency(booking: EquipmentBooking, rowIndex: number): BadRecord | null {
    const errors: string[] = [];

    const startTime = this.timeToMinutes(booking.预约开始时间);
    const endTime = this.timeToMinutes(booking.预约结束时间);
    
    if (startTime >= endTime) {
      errors.push('预约结束时间必须晚于开始时间');
    }

    if (endTime - startTime < 15) {
      errors.push('预约时长至少为15分钟');
    }

    if (errors.length > 0) {
      return {
        原始数据: booking,
        行号: rowIndex + 1,
        错误原因: errors.join('; '),
        错误类型: BadRecordType.CONSISTENCY_ERROR,
        后续处理建议: '请调整预约时间确保逻辑一致',
        人工备注: '',
        是否允许继续: true
      };
    }
    return null;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private createBadRecord(
    booking: Partial<EquipmentBooking>, 
    rowIndex: number, 
    errorReason: string, 
    errorType: BadRecordType
  ): BadRecord {
    return {
      原始数据: booking,
      行号: rowIndex + 1,
      错误原因: errorReason,
      错误类型: errorType,
      后续处理建议: this.getSuggestion(errorType),
      人工备注: '',
      是否允许继续: this.isAllowContinue(errorType)
    };
  }

  private getSuggestion(errorType: BadRecordType): string {
    const suggestions: Record<BadRecordType, string> = {
      [BadRecordType.MISSING_REQUIRED_FIELD]: '请补充所有必填字段后重新导入',
      [BadRecordType.INVALID_FORMAT]: '请修正格式错误后重新导入',
      [BadRecordType.DUPLICATE_BOOKING]: '请检查是否重复提交，或使用新的预约编号',
      [BadRecordType.STATUS_TRANSITION_ERROR]: '请按状态流转顺序逐步更新，或添加人工备注说明特殊情况',
      [BadRecordType.CONTRAINDICATION_CONFLICT]: '建议更换为低/中等强度器械，或由主治医生评估后添加人工备注确认',
      [BadRecordType.TIME_CONFLICT]: '请调整预约时间避免与其他预约冲突',
      [BadRecordType.CONSISTENCY_ERROR]: '请调整预约信息确保逻辑一致'
    };
    return suggestions[errorType] || '请检查数据后重新导入';
  }

  private isAllowContinue(errorType: BadRecordType): boolean {
    const allowContinueTypes: BadRecordType[] = [
      BadRecordType.STATUS_TRANSITION_ERROR,
      BadRecordType.CONTRAINDICATION_CONFLICT,
      BadRecordType.CONSISTENCY_ERROR
    ];
    return allowContinueTypes.includes(errorType);
  }
}
