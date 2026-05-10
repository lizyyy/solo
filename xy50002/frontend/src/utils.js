export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleString();
}

export function formatDateShort(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return 'N/A';
  return '$' + Number(amount).toFixed(2);
}

export function calculateSlaStatus(deadlineStr) {
  if (!deadlineStr) return { status: 'unknown', label: 'N/A' };
  
  const deadline = new Date(deadlineStr);
  const now = new Date();
  const diffMs = deadline - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffMs < 0) {
    const overdueHours = Math.abs(diffHours).toFixed(1);
    return { status: 'critical', label: `Overdue by ${overdueHours}h`, className: 'critical' };
  }
  
  if (diffHours < 4) {
    return { status: 'warning', label: `${diffHours.toFixed(1)}h remaining`, className: 'warning' };
  }
  
  return { status: 'ok', label: `${(diffHours / 24).toFixed(1)}d remaining`, className: 'ok' };
}

export function getTicketTypeLabel(type) {
  const labels = {
    damage: 'Damage',
    missing_parts: 'Missing Parts',
    warranty: 'Warranty',
    return: 'Return',
    refund: 'Refund',
    exchange: 'Exchange',
    shipping: 'Shipping Issue',
    other: 'Other'
  };
  return labels[type] || type;
}

export function getStatusLabel(status) {
  const labels = {
    open: 'Open',
    in_progress: 'In Progress',
    waiting_customer: 'Waiting for Customer',
    resolved: 'Resolved',
    closed: 'Closed',
    pending: 'Pending',
    shipped: 'Shipped',
    delivered: 'Delivered'
  };
  return labels[status] || status;
}

export function getPriorityLabel(priority) {
  const labels = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  };
  return labels[priority] || priority;
}

export function getRiskLabel(risk) {
  const labels = {
    high: 'High Risk',
    medium: 'Medium Risk',
    low: 'Low Risk'
  };
  return labels[risk] || risk;
}

export function getLogisticsStatusLabel(status) {
  const labels = {
    shipped: 'Shipped',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    export: 'Export',
    customs: 'Customs'
  };
  return labels[status] || status;
}

export function getActionTypeLabel(type) {
  const labels = {
    review: 'Review',
    email: 'Email Sent',
    call: 'Phone Call',
    proposal: 'Proposal',
    stock_check: 'Stock Check',
    resolution: 'Resolution',
    refund: 'Refund Processed',
    return_initiated: 'Return Initiated',
    other: 'Other'
  };
  return labels[type] || type;
}

export function isWarrantyValid(orderDateStr, warrantyMonths) {
  if (!orderDateStr || !warrantyMonths) return true;
  
  const orderDate = new Date(orderDateStr);
  const warrantyEnd = new Date(orderDate);
  warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths);
  
  return new Date() <= warrantyEnd;
}

export function getWarrantyEndDate(orderDateStr, warrantyMonths) {
  if (!orderDateStr || !warrantyMonths) return 'N/A';
  
  const orderDate = new Date(orderDateStr);
  const warrantyEnd = new Date(orderDate);
  warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths);
  
  return formatDateShort(warrantyEnd.toISOString());
}

export function generateTicketId() {
  return `TKT-${Date.now().toString().slice(-4)}`;
}

export function generateOrderId() {
  const year = new Date().getFullYear();
  const suffix = Date.now().toString().slice(-4);
  return `ORD-${year}-${suffix}`;
}
