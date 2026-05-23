import {
  OrderCalendar,
  CleaningMessage,
  MaintenanceNote,
  ApprovalEmail,
  SupplierStatement,
  DirtyType,
  SourceType
} from '../types';
import { insertDirtyRecord, getFactRecord, generateFactId } from '../database';

interface ValidationResult {
  isValid: boolean;
  dirtyTypes: DirtyType[];
  issues: ValidationIssue[];
}

interface ValidationIssue {
  dirtyType: DirtyType;
  fieldName?: string;
  originalValue?: string;
  expectedValue?: string;
  description: string;
}

export async function validateOrderCalendar(
  order: OrderCalendar,
  recordId: string
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  const requiredFields: (keyof OrderCalendar)[] = [
    'orderId', 'roomId', 'guestName', 'checkInDate', 'checkOutDate', 'nights'
  ];
  
  for (const field of requiredFields) {
    if (order[field] === undefined || order[field] === null || order[field] === '') {
      issues.push({
        dirtyType: 'missing_fields',
        fieldName: field,
        description: `订单${order.orderId}缺少必填字段: ${field}`
      });
    }
  }

  if (order.checkInDate && order.checkOutDate) {
    const checkIn = new Date(order.checkInDate);
    const checkOut = new Date(order.checkOutDate);
    const diffDays = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays !== order.nights) {
      issues.push({
        dirtyType: 'quantity_conflict',
        fieldName: 'nights',
        originalValue: String(order.nights),
        expectedValue: String(diffDays),
        description: `订单${order.orderId}入住天数冲突: 声明${order.nights}晚, 实际计算${diffDays}晚`
      });
    }
  }

  if (order.checkInDate && order.checkOutDate) {
    const checkIn = new Date(order.checkInDate);
    const checkOut = new Date(order.checkOutDate);
    const diffDays = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1 && order.isContinuousStay) {
      const factId = generateFactId(order.roomId, order.checkInDate);
      const existingFact = await getFactRecord(factId);
      
      if (existingFact?.orderInfo) {
        const existingGuest = existingFact.orderInfo.guestName;
        if (existingGuest !== order.guestName) {
          issues.push({
            dirtyType: 'name_change',
            fieldName: 'guestName',
            originalValue: existingGuest,
            expectedValue: order.guestName,
            description: `连住订单客人姓名不一致: 原记录"${existingGuest}", 新记录"${order.guestName}"`
          });
        }
      }
    }
  }

  for (const issue of issues) {
    await insertDirtyRecord(
      recordId,
      'order_calendar',
      issue.dirtyType,
      issue.description,
      issue.fieldName,
      issue.originalValue,
      issue.expectedValue
    );
  }

  return {
    isValid: issues.length === 0,
    dirtyTypes: issues.map(i => i.dirtyType),
    issues
  };
}

export async function validateCleaningMessage(
  cleaning: CleaningMessage,
  recordId: string,
  existingOrders?: OrderCalendar[]
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  const requiredFields: (keyof CleaningMessage)[] = [
    'messageId', 'roomId', 'cleanerName', 'scheduledDate', 'cleaningType', 'status'
  ];
  
  for (const field of requiredFields) {
    if (cleaning[field] === undefined || cleaning[field] === null || cleaning[field] === '') {
      issues.push({
        dirtyType: 'missing_fields',
        fieldName: field,
        description: `保洁消息${cleaning.messageId}缺少必填字段: ${field}`
      });
    }
  }

  if (existingOrders && existingOrders.length > 0) {
    const scheduledDate = new Date(cleaning.scheduledDate);
    
    for (const order of existingOrders) {
      const checkIn = new Date(order.checkInDate);
      const checkOut = new Date(order.checkOutDate);
      
      if (scheduledDate >= checkIn && scheduledDate < checkOut) {
        if (order.isContinuousStay && !order.linenChangeRequired) {
          if (cleaning.cleaningType === 'linen_change') {
            issues.push({
              dirtyType: 'quantity_conflict',
              fieldName: 'cleaningType',
              originalValue: cleaning.cleaningType,
              expectedValue: 'daily',
              description: `保洁${cleaning.messageId}类型冲突: 连住客人未要求换布草, 但安排了换布草保洁`
            });
          }
        }
        
        if (scheduledDate.getTime() === checkOut.getTime() - 86400000) {
          if (cleaning.cleaningType !== 'checkout') {
            issues.push({
              dirtyType: 'quantity_conflict',
              fieldName: 'cleaningType',
              originalValue: cleaning.cleaningType,
              expectedValue: 'checkout',
              description: `保洁${cleaning.messageId}类型冲突: 退房日应安排退房保洁, 当前为${cleaning.cleaningType}`
            });
          }
        }
      }
    }
  }

  const factId = generateFactId(cleaning.roomId, cleaning.scheduledDate);
  const existingFact = await getFactRecord(factId);
  
  if (existingFact?.cleaningInfo) {
    const existingCleaner = existingFact.cleaningInfo.cleanerName;
    if (existingCleaner !== cleaning.cleanerName && existingCleaner) {
      issues.push({
        dirtyType: 'name_change',
        fieldName: 'cleanerName',
        originalValue: existingCleaner,
        expectedValue: cleaning.cleanerName,
        description: `保洁员姓名变更: 原记录"${existingCleaner}", 新记录"${cleaning.cleanerName}"`
      });
    }
  }

  for (const issue of issues) {
    await insertDirtyRecord(
      recordId,
      'cleaning_group',
      issue.dirtyType,
      issue.description,
      issue.fieldName,
      issue.originalValue,
      issue.expectedValue
    );
  }

  return {
    isValid: issues.length === 0,
    dirtyTypes: issues.map(i => i.dirtyType),
    issues
  };
}

export async function validateMaintenanceNote(
  maint: MaintenanceNote,
  recordId: string
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  const requiredFields: (keyof MaintenanceNote)[] = [
    'noteId', 'roomId', 'reportedBy', 'reportedAt', 'issueType', 'description', 'priority', 'status'
  ];
  
  for (const field of requiredFields) {
    if (maint[field] === undefined || maint[field] === null || maint[field] === '') {
      issues.push({
        dirtyType: 'missing_fields',
        fieldName: field,
        description: `维修记录${maint.noteId}缺少必填字段: ${field}`
      });
    }
  }

  if (maint.status === 'resolved' && !maint.resolvedAt) {
    issues.push({
      dirtyType: 'missing_fields',
      fieldName: 'resolvedAt',
      description: `维修记录${maint.noteId}标记为已解决但缺少解决时间`
    });
  }

  if (maint.status === 'resolved' && !maint.resolution) {
    issues.push({
      dirtyType: 'missing_fields',
      fieldName: 'resolution',
      description: `维修记录${maint.noteId}标记为已解决但缺少解决说明`
    });
  }

  const date = maint.reportedAt.split('T')[0];
  const factId = generateFactId(maint.roomId, date);
  const existingFact = await getFactRecord(factId);
  
  if (existingFact?.maintenanceInfo && existingFact.maintenanceInfo.length > 0) {
    const existingNote = existingFact.maintenanceInfo.find(n => n.noteId === maint.noteId);
    if (existingNote && existingNote.reportedBy !== maint.reportedBy) {
      issues.push({
        dirtyType: 'name_change',
        fieldName: 'reportedBy',
        originalValue: existingNote.reportedBy,
        expectedValue: maint.reportedBy,
        description: `维修记录上报人不一致: 原记录"${existingNote.reportedBy}", 新记录"${maint.reportedBy}"`
      });
    }
  }

  for (const issue of issues) {
    await insertDirtyRecord(
      recordId,
      'maintenance_note',
      issue.dirtyType,
      issue.description,
      issue.fieldName,
      issue.originalValue,
      issue.expectedValue
    );
  }

  return {
    isValid: issues.length === 0,
    dirtyTypes: issues.map(i => i.dirtyType),
    issues
  };
}

export async function validateApprovalEmail(
  approval: ApprovalEmail,
  recordId: string
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  const requiredFields: (keyof ApprovalEmail)[] = [
    'emailId', 'requestType', 'requester', 'requestedAt', 'status', 'reason'
  ];
  
  for (const field of requiredFields) {
    if (approval[field] === undefined || approval[field] === null || approval[field] === '') {
      issues.push({
        dirtyType: 'missing_fields',
        fieldName: field,
        description: `审批邮件${approval.emailId}缺少必填字段: ${field}`
      });
    }
  }

  if (approval.status === 'approved' && !approval.approver) {
    issues.push({
      dirtyType: 'missing_fields',
      fieldName: 'approver',
      description: `审批邮件${approval.emailId}已批准但缺少审批人`
    });
  }

  if (approval.status === 'approved' && !approval.approvedAt) {
    issues.push({
      dirtyType: 'missing_fields',
      fieldName: 'approvedAt',
      description: `审批邮件${approval.emailId}已批准但缺少批准时间`
    });
  }

  if ((approval.requestType === 'refund' || approval.requestType === 'discount') && !approval.amount) {
    issues.push({
      dirtyType: 'missing_fields',
      fieldName: 'amount',
      description: `审批邮件${approval.emailId}为${approval.requestType}类型但缺少金额`
    });
  }

  if (approval.amount !== undefined && approval.amount < 0) {
    issues.push({
      dirtyType: 'amount_conflict',
      fieldName: 'amount',
      originalValue: String(approval.amount),
      expectedValue: '>= 0',
      description: `审批邮件${approval.emailId}金额为负数: ${approval.amount}`
    });
  }

  for (const issue of issues) {
    await insertDirtyRecord(
      recordId,
      'approval_email',
      issue.dirtyType,
      issue.description,
      issue.fieldName,
      issue.originalValue,
      issue.expectedValue
    );
  }

  return {
    isValid: issues.length === 0,
    dirtyTypes: issues.map(i => i.dirtyType),
    issues
  };
}

export async function validateSupplierStatement(
  statement: SupplierStatement,
  recordId: string,
  factRecords: Array<{ date: string; roomId: string; verifiedAmount?: number }>
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  const requiredFields: (keyof SupplierStatement)[] = [
    'statementId', 'supplierName', 'periodStart', 'periodEnd', 'items', 'totalAmount'
  ];
  
  for (const field of requiredFields) {
    if (statement[field] === undefined || statement[field] === null) {
      issues.push({
        dirtyType: 'missing_fields',
        fieldName: field,
        description: `对账单${statement.statementId}缺少必填字段: ${field}`
      });
    }
  }

  if (statement.items && statement.items.length > 0) {
    let calculatedTotal = 0;
    for (const item of statement.items) {
      calculatedTotal += item.subtotal || 0;
      
      if (item.quantity && item.unitPrice) {
        const expectedSubtotal = item.quantity * item.unitPrice;
        if (Math.abs(expectedSubtotal - (item.subtotal || 0)) > 0.01) {
          issues.push({
            dirtyType: 'amount_conflict',
            fieldName: `items[${item.itemId}].subtotal`,
            originalValue: String(item.subtotal),
            expectedValue: String(expectedSubtotal),
            description: `对账单明细${item.itemId}金额计算错误: ${item.quantity} * ${item.unitPrice} = ${expectedSubtotal}, 当前为${item.subtotal}`
          });
        }
      }

      if (item.quantity !== undefined && item.quantity < 0) {
        issues.push({
          dirtyType: 'quantity_conflict',
          fieldName: `items[${item.itemId}].quantity`,
          originalValue: String(item.quantity),
          expectedValue: '>= 0',
          description: `对账单明细${item.itemId}数量为负数: ${item.quantity}`
        });
      }
    }

    if (Math.abs(calculatedTotal - statement.totalAmount) > 0.01) {
      issues.push({
        dirtyType: 'amount_conflict',
        fieldName: 'totalAmount',
        originalValue: String(statement.totalAmount),
        expectedValue: String(calculatedTotal),
        description: `对账单${statement.statementId}总金额不符: 明细合计${calculatedTotal}, 账单声明${statement.totalAmount}`
      });
    }
  }

  if (statement.items && factRecords.length > 0) {
    for (const item of statement.items) {
      if (item.date && item.roomId) {
        const matchingFact = factRecords.find(
          f => f.date === item.date && f.roomId === item.roomId
        );
        
        if (!matchingFact) {
          issues.push({
            dirtyType: 'cross_day',
            fieldName: `items[${item.itemId}]`,
            originalValue: `${item.date}/${item.roomId}`,
            description: `对账单明细${item.itemId}找不到对应事实记录: ${item.date} 房间${item.roomId}`
          });
        } else if (matchingFact.verifiedAmount !== undefined) {
          if (Math.abs(matchingFact.verifiedAmount - item.subtotal) > 0.01) {
            issues.push({
              dirtyType: 'amount_conflict',
              fieldName: `items[${item.itemId}].subtotal`,
              originalValue: String(item.subtotal),
              expectedValue: String(matchingFact.verifiedAmount),
              description: `对账单明细${item.itemId}与事实记录金额不符: 账单${item.subtotal}, 实际${matchingFact.verifiedAmount}`
            });
          }
        }
      }
    }
  }

  for (const issue of issues) {
    await insertDirtyRecord(
      recordId,
      'supplier_statement',
      issue.dirtyType,
      issue.description,
      issue.fieldName,
      issue.originalValue,
      issue.expectedValue
    );
  }

  return {
    isValid: issues.length === 0,
    dirtyTypes: issues.map(i => i.dirtyType),
    issues
  };
}
