import { UserRole, PermissionConfig, SourceType } from '../types';

const allSourceTypes: SourceType[] = ['inspection', 'repair_quote', 'photo_list', 'shift_record', 'manual_price'];

const commonFields = ['id', 'vin', 'plateNumber', 'status', 'sourceRow', 'sourceFile', 'createdAt'];

const rolePermissions: Record<UserRole, PermissionConfig> = {
  entry: {
    visibleFields: {
      inspection: [...commonFields, 'carModel', 'inspector', 'inspectionDate', 'mileage', 'items', 'estimatedCost'],
      repair_quote: [...commonFields, 'repairShop', 'quoteDate', 'itemName', 'quantity', 'unitPrice', 'totalPrice', 'technician'],
      photo_list: [...commonFields, 'photoDate', 'photoType', 'photoCount', 'photographer'],
      shift_record: [...commonFields, 'shiftDate', 'shiftType', 'worker', 'workHours'],
      manual_price: [...commonFields, 'itemName', 'originalPrice', 'adjustedPrice', 'adjustReason', 'adjustDate', 'adjustedBy']
    },
    allowedActions: ['init', 'import', 'check', 'view']
  },
  review: {
    visibleFields: {
      inspection: [...commonFields, 'carModel', 'inspector', 'inspectionDate', 'mileage', 'items', 'estimatedCost', 'batchId'],
      repair_quote: [...commonFields, 'repairShop', 'quoteDate', 'itemName', 'quantity', 'unitPrice', 'totalPrice', 'technician', 'batchId'],
      photo_list: [...commonFields, 'photoDate', 'photoType', 'photoCount', 'photographer', 'batchId'],
      shift_record: [...commonFields, 'shiftDate', 'shiftType', 'worker', 'workHours', 'batchId'],
      manual_price: [...commonFields, 'itemName', 'originalPrice', 'adjustedPrice', 'adjustReason', 'adjustDate', 'adjustedBy', 'batchId']
    },
    allowedActions: ['init', 'import', 'check', 'fix', 'view', 'report']
  },
  supervisor: {
    visibleFields: {
      inspection: ['*'],
      repair_quote: ['*'],
      photo_list: ['*'],
      shift_record: ['*'],
      manual_price: ['*']
    },
    allowedActions: ['init', 'import', 'check', 'fix', 'report', 'history', 'export', 'view', 'verify']
  },
  readonly: {
    visibleFields: {
      inspection: [...commonFields, 'carModel', 'inspectionDate', 'estimatedCost'],
      repair_quote: [...commonFields, 'quoteDate', 'itemName', 'totalPrice'],
      photo_list: [...commonFields, 'photoDate', 'photoCount'],
      shift_record: [...commonFields, 'shiftDate', 'workHours'],
      manual_price: [...commonFields, 'itemName', 'adjustedPrice']
    },
    allowedActions: ['view', 'report']
  }
};

export function getPermission(role: UserRole): PermissionConfig {
  return rolePermissions[role];
}

export function canPerformAction(role: UserRole, action: string): boolean {
  return rolePermissions[role].allowedActions.includes(action);
}

export function getVisibleFields(role: UserRole, sourceType: SourceType): string[] {
  const fields = rolePermissions[role].visibleFields[sourceType];
  if (fields.includes('*')) {
    return ['*'];
  }
  return fields;
}
