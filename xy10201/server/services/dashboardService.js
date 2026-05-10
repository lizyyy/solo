const { getDatabase } = require('../config/database');
const materialService = require('./materialService');
const replenishmentService = require('./replenishmentService');
const consumptionService = require('./consumptionService');
const treatmentService = require('./treatmentService');

const db = getDatabase();

function getDashboardStats() {
  const lowStock = materialService.getLowStockMaterials();
  const statusCounts = replenishmentService.getStatusCounts();
  
  const totalMaterials = db.prepare(`SELECT COUNT(*) as count FROM materials`).get().count;
  const totalTreatments = db.prepare(`SELECT COUNT(*) as count FROM treatments WHERE is_active = 1`).get().count;
  
  const recentConsumption = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_amount
    FROM consumption_records
    WHERE created_at >= datetime('now', '-7 days')
  `).get();
  
  return {
    total_materials: totalMaterials,
    low_stock_count: lowStock.length,
    out_of_stock_count: lowStock.filter(m => m.stock_status === 'OUT_OF_STOCK').length,
    total_treatments: totalTreatments,
    pending_requests: statusCounts.PENDING || 0,
    approved_requests: statusCounts.APPROVED || 0,
    recent_consumption_count: recentConsumption.count,
    recent_consumption_amount: recentConsumption.total_amount
  };
}

function getCurrentBlockages() {
  const lowStock = materialService.getLowStockMaterials();
  const pendingRequests = replenishmentService.getRequests({ status: 'PENDING', limit: 5 });
  
  const blockages = [];
  
  lowStock.slice(0, 5).forEach(m => {
    blockages.push({
      id: `stock-${m.id}`,
      type: 'STOCK_SHORTAGE',
      type_label: '库存短缺',
      severity: m.current_stock <= 0 ? 'CRITICAL' : 'WARNING',
      title: `${m.name} 库存不足`,
      description: `当前库存 ${m.current_stock}${m.unit}，预警值 ${m.min_stock}${m.unit}，缺口 ${Math.max(0, m.min_stock - m.current_stock)}${m.unit}`,
      context: { material_id: m.id, material_code: m.code, category: m.category },
      created_at: m.updated_at
    });
  });
  
  pendingRequests.slice(0, 5).forEach(r => {
    blockages.push({
      id: `audit-${r.id}`,
      type: 'AUDIT_PENDING',
      type_label: '待审核',
      severity: 'MEDIUM',
      title: `补货申请待审核`,
      description: `${r.requester} 申请 ${r.material_name} ${r.requested_quantity}${r.unit}，申请时间 ${r.created_at}`,
      context: { request_id: r.id, request_no: r.request_no, department: r.department_name },
      created_at: r.created_at
    });
  });
  
  return blockages;
}

function getTreatmentSuggestions() {
  const activeTreatments = treatmentService.getAllTreatments(true);
  const suggestions = [];
  
  for (const t of activeTreatments) {
    const check = treatmentService.checkTreatmentStock(t.id);
    if (!check.can_perform) {
      suggestions.push({
        type: 'TREATMENT_BLOCKED',
        priority: 'HIGH',
        title: `[${t.name}] 无法执行`,
        message: `缺少 ${check.shortage_count} 种耗材`,
        details: check.issues,
        treatment_id: t.id
      });
    }
  }
  
  const allMaterials = materialService.getAllMaterials();
  const soonEmpty = allMaterials.filter(m => {
    if (m.current_stock <= m.min_stock) return false;
    const remaining = m.current_stock - m.min_stock;
    return remaining <= 5;
  });
  
  soonEmpty.slice(0, 5).forEach(m => {
    suggestions.push({
      type: 'STOCK_SOON_EMPTY',
      priority: 'LOW',
      title: `${m.name} 即将低于预警值`,
      message: `当前 ${m.current_stock}${m.unit}，预警值 ${m.min_stock}${m.unit}，剩余可用 ${m.current_stock - m.min_stock}${m.unit}`,
      material_id: m.id
    });
  });
  
  return suggestions.sort((a, b) => {
    const priority = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (priority[b.priority] || 0) - (priority[a.priority] || 0);
  });
}

function getRecentHistory(limit = 20) {
  const consumption = consumptionService.getConsumptionRecords({ limit });
  const requests = replenishmentService.getRequests({ limit });
  
  const history = [];
  
  consumption.forEach(c => {
    history.push({
      id: `consume-${c.id}`,
      type: 'CONSUMPTION',
      type_label: '耗材消耗',
      title: `${c.material_name} x${c.quantity}${c.unit}`,
      subtitle: c.treatment_name ? `诊疗: ${c.treatment_name}` : '手动消耗',
      operator: c.operator,
      detail: `消耗金额 ¥${c.total_amount.toFixed(2)}`,
      created_at: c.created_at
    });
  });
  
  requests.forEach(r => {
    const statusInfo = replenishmentService.STATUS_FLOW[r.status] || {};
    history.push({
      id: `request-${r.id}`,
      type: 'REPLENISHMENT',
      type_label: '补货申请',
      title: `${r.request_no}: ${r.material_name} x${r.requested_quantity}${r.unit}`,
      subtitle: `申请人: ${r.requester}`,
      operator: r.requester,
      status: r.status,
      status_label: statusInfo.label,
      status_color: statusInfo.color,
      detail: r.reason || '无备注',
      created_at: r.created_at
    });
  });
  
  return history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
}

function getMaterialTrend(materialId, days = 14) {
  const snapshots = db.prepare(`
    SELECT 
      DATE(created_at) as date,
      snapshot_type,
      SUM(change_quantity) as net_change,
      AVG(after_quantity) as avg_stock
    FROM inventory_snapshots
    WHERE material_id = ? AND created_at >= datetime('now', ?)
    GROUP BY DATE(created_at), snapshot_type
    ORDER BY date
  `).all(materialId, `-${days} days`);
  
  return snapshots;
}

function getBusinessFlowStatus() {
  const lowStock = materialService.getLowStockMaterials();
  const requests = replenishmentService.getRequests();
  
  const flowStages = [
    {
      stage: 'CONSUMPTION',
      name: '耗材消耗',
      status: 'NORMAL',
      message: '消耗流程正常',
      details: {
        active_treatments: treatmentService.getAllTreatments(true).length,
        recent_consumption: consumptionService.getConsumptionStats(7).length
      }
    },
    {
      stage: 'STOCK_CHECK',
      name: '库存预警',
      status: lowStock.length > 0 ? (lowStock.some(m => m.current_stock <= 0) ? 'CRITICAL' : 'WARNING') : 'NORMAL',
      message: lowStock.length > 0 
        ? `${lowStock.length} 种耗材库存不足${lowStock.some(m => m.current_stock <= 0) ? '，含已断货' : ''}` 
        : '所有耗材库存充足',
      details: {
        low_stock_count: lowStock.length,
        out_of_stock_count: lowStock.filter(m => m.current_stock <= 0).length
      }
    },
    {
      stage: 'REQUEST',
      name: '补货申请',
      status: requests.filter(r => r.status === 'PENDING').length > 0 ? 'WARNING' : 'NORMAL',
      message: `待审核 ${requests.filter(r => r.status === 'PENDING').length} 单`,
      details: {
        total_requests: requests.length,
        pending: requests.filter(r => r.status === 'PENDING').length,
        approved: requests.filter(r => r.status === 'APPROVED').length,
        fulfilled: requests.filter(r => r.status === 'FULFILLED').length,
        rejected: requests.filter(r => r.status === 'REJECTED').length
      }
    },
    {
      stage: 'FULFILLMENT',
      name: '补货执行',
      status: requests.filter(r => r.status === 'APPROVED').length > 0 ? 'WARNING' : 'NORMAL',
      message: requests.filter(r => r.status === 'APPROVED').length > 0 
        ? `${requests.filter(r => r.status === 'APPROVED').length} 单待执行` 
        : '补货执行正常',
      details: {
        approved_pending: requests.filter(r => r.status === 'APPROVED').length
      }
    }
  ];
  
  const hasBlocking = flowStages.some(s => s.status === 'CRITICAL');
  const hasWarning = flowStages.some(s => s.status === 'WARNING');
  
  return {
    overall_status: hasBlocking ? 'CRITICAL' : (hasWarning ? 'WARNING' : 'NORMAL'),
    blockages: getCurrentBlockages(),
    suggestions: getTreatmentSuggestions(),
    stages: flowStages
  };
}

module.exports = {
  getDashboardStats,
  getCurrentBlockages,
  getTreatmentSuggestions,
  getRecentHistory,
  getMaterialTrend,
  getBusinessFlowStatus
};
