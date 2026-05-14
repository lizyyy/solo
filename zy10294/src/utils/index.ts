import type { InvoiceApplication, BlockReason, OperationLog } from '../types';

export const validateTaxId = (taxId: string): boolean => {
  const regex = /^[A-Z0-9]{15,20}$/;
  return regex.test(taxId.trim().toUpperCase());
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY'
  }).format(amount);
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const checkDuplicateProject = (
  projectId: string,
  invoices: InvoiceApplication[],
  excludeInvoiceId?: string
): boolean => {
  return invoices.some(inv => 
    inv.projectId === projectId && 
    inv.id !== excludeInvoiceId &&
    ['approved', 'invoiced', 'reopened'].includes(inv.status)
  );
};

export const checkAlreadyInvoiced = (
  customerId: string,
  projectId: string,
  invoices: InvoiceApplication[]
): boolean => {
  return invoices.some(inv => 
    inv.customerId === customerId &&
    inv.projectId === projectId &&
    inv.status === 'invoiced'
  );
};

export const checkRedFlushNotReopened = (
  customerId: string,
  invoices: InvoiceApplication[]
): InvoiceApplication | null => {
  const redFlushInvoices = invoices.filter(inv => 
    inv.customerId === customerId &&
    inv.status === 'red_flush' &&
    !inv.isReopened
  );
  return redFlushInvoices.length > 0 ? redFlushInvoices[0] : null;
};

export const validateInvoiceApplication = (
  invoice: Partial<InvoiceApplication>,
  allInvoices: InvoiceApplication[]
): { valid: boolean; blockReason?: BlockReason; blockMessage?: string } => {
  if (invoice.taxId && !validateTaxId(invoice.taxId)) {
    return {
      valid: false,
      blockReason: 'tax_id_invalid',
      blockMessage: '税号格式异常，请检查税号是否正确（15-20位字母数字）'
    };
  }

  if (invoice.customerId && invoice.projectId) {
    if (checkAlreadyInvoiced(invoice.customerId, invoice.projectId, allInvoices)) {
      return {
        valid: false,
        blockReason: 'already_invoiced',
        blockMessage: '该客户此项目已开票，如需修改请先走红冲流程'
      };
    }
  }

  if (invoice.customerId) {
    const redFlushNotReopened = checkRedFlushNotReopened(invoice.customerId, allInvoices);
    if (redFlushNotReopened) {
      return {
        valid: false,
        blockReason: 'red_flush_not_reopened',
        blockMessage: `该客户存在红冲未重开的发票（${redFlushNotReopened.invoiceNumber}），请先重开`
      };
    }
  }

  if (invoice.projectId && checkDuplicateProject(invoice.projectId, allInvoices, invoice.id)) {
    return {
      valid: false,
      blockReason: 'duplicate_project',
      blockMessage: '同一项目存在重复申请，请核实是否需要重复开票'
    };
  }

  return { valid: true };
};

export const createOperationLog = (
  invoiceId: string,
  operator: string,
  operation: string,
  remark?: string,
  oldValue?: string,
  newValue?: string
): OperationLog => {
  return {
    id: generateId(),
    invoiceId,
    operator,
    operation,
    timestamp: new Date().toISOString(),
    remark,
    oldValue,
    newValue
  };
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: '待复核',
    approved: '已通过',
    rejected: '已驳回',
    invoiced: '已开票',
    red_flush: '已红冲',
    reopened: '已重开',
    blocked: '已拦截'
  };
  return labels[status] || status;
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    invoiced: 'bg-blue-100 text-blue-800',
    red_flush: 'bg-orange-100 text-orange-800',
    reopened: 'bg-purple-100 text-purple-800',
    blocked: 'bg-gray-100 text-gray-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getBlockReasonLabel = (reason: string): string => {
  const labels: Record<string, string> = {
    tax_id_invalid: '税号格式异常',
    already_invoiced: '已开票申请继续改抬头',
    red_flush_not_reopened: '红冲后未重开',
    duplicate_project: '同一项目重复申请'
  };
  return labels[reason] || reason;
};
