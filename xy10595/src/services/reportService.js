const SparePart = require('../models/sparePart');
const Equipment = require('../models/equipment');
const MinStock = require('../models/minStock');
const PurchaseOrder = require('../models/purchaseOrder');
const PurchaseCycle = require('../models/purchaseCycle');
const AlternativePart = require('../models/alternativePart');
const alertService = require('./alertService');

const generateRiskReport = () => {
  const alerts = alertService.getActiveAlerts();
  
  const criticalParts = alerts.filter(a => a.alert_level === 'CRITICAL');
  const warningParts = alerts.filter(a => a.alert_level === 'WARNING');
  
  const affectedEquipmentIds = new Set();
  alerts.forEach(a => {
    (a.affected_equipments || []).forEach(eq => affectedEquipmentIds.add(eq.id));
  });
  
  const equipments = Equipment.findAll();
  const criticalEquipments = equipments.filter(e => e.criticality === 'CRITICAL');
  
  const affectedCriticalEquipments = criticalEquipments.filter(e =>
    alerts.some(a => (a.affected_equipments || []).some(eq => eq.id === e.id))
  );
  
  const risks = alerts.map(alert => {
    const part = SparePart.findById(alert.part_id);
    const inTransitOrders = PurchaseOrder.getInTransitOrders(alert.part_id);
    const alternatives = AlternativePart.findAlternatives(alert.part_id);
    
    return {
      part: {
        id: alert.part_id,
        code: alert.part_code,
        name: alert.part_name
      },
      alertLevel: alert.alert_level,
      currentStock: alert.current_stock,
      minStock: alert.min_stock,
      deficit: Math.max(alert.min_stock - alert.current_stock, 0),
      inTransit: alert.in_transit_quantity,
      inTransitOrders,
      hasAlternatives: alternatives.length > 0,
      alternatives,
      affectedEquipments: alert.affected_equipments || [],
      urgent: alert.alert_level === 'CRITICAL' &&
        (alert.affected_equipments || []).some(e => e.criticality === 'CRITICAL')
    };
  });
  
  const urgentRisks = risks.filter(r => r.urgent);
  
  return {
    summary: {
      totalAlerts: alerts.length,
      criticalAlerts: criticalParts.length,
      warningAlerts: warningParts.length,
      affectedEquipmentCount: affectedEquipmentIds.size,
      totalCriticalEquipments: criticalEquipments.length,
      affectedCriticalEquipments: affectedCriticalEquipments.length,
      urgentRiskCount: urgentRisks.length
    },
    risks: risks.sort((a, b) => {
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      if (a.alertLevel === 'CRITICAL' && b.alertLevel !== 'CRITICAL') return -1;
      if (a.alertLevel !== 'CRITICAL' && b.alertLevel === 'CRITICAL') return 1;
      return b.deficit - a.deficit;
    }),
    generatedAt: Date.now()
  };
};

const generateEquipmentImpactReport = () => {
  const equipments = Equipment.findAll();
  const alerts = alertService.getActiveAlerts();
  
  const equipmentRiskMap = {};
  
  equipments.forEach(eq => {
    const parts = Equipment.getParts(eq.id);
    const partAlerts = parts
      .map(p => alerts.find(a => a.part_id === p.id))
      .filter(Boolean);
    
    const hasCriticalAlert = partAlerts.some(a => a.alert_level === 'CRITICAL');
    const hasWarningAlert = partAlerts.some(a => a.alert_level === 'WARNING');
    
    let impactLevel = 'NONE';
    if (eq.criticality === 'CRITICAL' && hasCriticalAlert) {
      impactLevel = 'SEVERE';
    } else if (hasCriticalAlert) {
      impactLevel = 'HIGH';
    } else if (hasWarningAlert) {
      impactLevel = 'MEDIUM';
    }
    
    equipmentRiskMap[eq.id] = {
      equipment: {
        id: eq.id,
        code: eq.code,
        name: eq.name,
        criticality: eq.criticality,
        department: eq.department
      },
      impactLevel,
      affectedParts: partAlerts.map(a => ({
        partId: a.part_id,
        code: a.part_code,
        name: a.part_name,
        alertLevel: a.alert_level,
        currentStock: a.current_stock,
        minStock: a.min_stock
      })),
      totalParts: parts.length,
      affectedPartCount: partAlerts.length
    };
  });
  
  const impactSummary = {
    SEVERE: 0,
    HIGH: 0,
    MEDIUM: 0,
    NONE: 0
  };
  Object.values(equipmentRiskMap).forEach(v => {
    impactSummary[v.impactLevel]++;
  });
  
  return {
    summary: {
      totalEquipments: equipments.length,
      ...impactSummary,
      equipmentsAtRisk: impactSummary.SEVERE + impactSummary.HIGH + impactSummary.MEDIUM
    },
    equipments: Object.values(equipmentRiskMap).sort((a, b) => {
      const order = { SEVERE: 0, HIGH: 1, MEDIUM: 2, NONE: 3 };
      if (order[a.impactLevel] !== order[b.impactLevel]) {
        return order[a.impactLevel] - order[b.impactLevel];
      }
      const critOrder = { CRITICAL: 0, IMPORTANT: 1, NORMAL: 2 };
      return critOrder[a.equipment.criticality] - critOrder[b.equipment.criticality];
    }),
    generatedAt: Date.now()
  };
};

const generatePurchaseSuggestionReport = () => {
  const parts = SparePart.findAll();
  
  const suggestions = [];
  
  parts.forEach(part => {
    const minStock = MinStock.getMinQuantity(part.id);
    const inTransit = PurchaseOrder.getInTransitQuantity(part.id);
    const effectiveStock = part.current_stock + inTransit;
    
    if (effectiveStock >= minStock) return;
    
    const deficit = minStock - effectiveStock;
    const cycleDays = PurchaseOrder.getMaxCycleDays(part.id);
    const primaryCycle = (PurchaseCycle.getPrimaryCycle ? require('./stockCalculator') : null);
    
    const alternatives = AlternativePart.findAlternatives(part.id);
    const availableAlternatives = alternatives.filter(a => a.alt_stock > 0);
    
    const equipments = Equipment.getByPart(part.id);
    const hasCriticalEquipment = equipments.some(e => e.criticality === 'CRITICAL');
    
    let urgency = 'NORMAL';
    if (hasCriticalEquipment && part.current_stock <= 0) {
      urgency = 'URGENT';
    } else if (part.current_stock <= 0) {
      urgency = 'HIGH';
    } else if (deficit > minStock * 0.5) {
      urgency = 'HIGH';
    }
    
    suggestions.push({
      part: {
        id: part.id,
        code: part.code,
        name: part.name,
        category: part.category,
        unit: part.unit
      },
      currentStock: part.current_stock,
      inTransit,
      minStock,
      effectiveStock,
      deficit,
      suggestedQuantity: deficit + Math.ceil(deficit * 0.3),
      cycleDays,
      purchaseCycle: {
        primary: PurchaseCycle.getPrimaryCycle(part.id),
        all: PurchaseCycle.findByPart(part.id)
      },
      alternatives: availableAlternatives,
      affectedEquipments: equipments.map(e => ({
        id: e.id,
        code: e.code,
        name: e.name,
        criticality: e.criticality
      })),
      hasCriticalEquipment,
      urgency
    });
  });
  
  const urgencySummary = {
    URGENT: suggestions.filter(s => s.urgency === 'URGENT').length,
    HIGH: suggestions.filter(s => s.urgency === 'HIGH').length,
    NORMAL: suggestions.filter(s => s.urgency === 'NORMAL').length
  };
  
  return {
    summary: {
      totalSuggestions: suggestions.length,
      ...urgencySummary,
      totalSuggestedQuantity: suggestions.reduce((sum, s) => sum + s.suggestedQuantity, 0)
    },
    suggestions: suggestions.sort((a, b) => {
      const order = { URGENT: 0, HIGH: 1, NORMAL: 2 };
      if (order[a.urgency] !== order[b.urgency]) {
        return order[a.urgency] - order[b.urgency];
      }
      if (a.hasCriticalEquipment && !b.hasCriticalEquipment) return -1;
      if (!a.hasCriticalEquipment && b.hasCriticalEquipment) return 1;
      return b.deficit - a.deficit;
    }),
    generatedAt: Date.now()
  };
};

const generateFullReport = () => {
  const risk = generateRiskReport();
  const eqImpact = generateEquipmentImpactReport();
  const purchase = generatePurchaseSuggestionReport();
  
  return {
    riskReport: risk,
    equipmentImpactReport: eqImpact,
    purchaseSuggestionReport: purchase,
    summary: {
      riskReport: risk.summary,
      equipmentImpactReport: eqImpact.summary,
      purchaseSuggestionReport: purchase.summary
    },
    generatedAt: Date.now()
  };
};

module.exports = {
  generateRiskReport,
  generateEquipmentImpactReport,
  generatePurchaseSuggestionReport,
  generateFullReport
};
