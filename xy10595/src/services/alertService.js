const SparePart = require('../models/sparePart');
const Equipment = require('../models/equipment');
const MinStock = require('../models/minStock');
const PurchaseOrder = require('../models/purchaseOrder');
const Alert = require('../models/alert');
const { STOCK_ALERT_LEVEL } = require('../utils/constants');

const checkAndCreateAlert = (partId) => {
  const part = SparePart.findById(partId);
  if (!part) return null;
  
  const minStock = MinStock.getMinQuantity(partId);
  const inTransit = PurchaseOrder.getInTransitQuantity(partId);
  const effectiveStock = part.current_stock + inTransit;
  
  let alertLevel = null;
  if (part.current_stock <= 0) {
    alertLevel = STOCK_ALERT_LEVEL.CRITICAL;
  } else if (part.current_stock < minStock * 0.5) {
    alertLevel = STOCK_ALERT_LEVEL.CRITICAL;
  } else if (part.current_stock < minStock) {
    alertLevel = STOCK_ALERT_LEVEL.WARNING;
  }
  
  if (alertLevel) {
    const equipments = Equipment.getByPart(partId);
    const affectedEquipments = equipments.map(eq => ({
      id: eq.id,
      code: eq.code,
      name: eq.name,
      criticality: eq.criticality
    }));
    
    const existingAlerts = Alert.findActive().filter(a => a.part_id === partId);
    existingAlerts.forEach(a => Alert.resolve(a.id));
    
    const alertId = Alert.create({
      partId,
      alertLevel,
      currentStock: part.current_stock,
      minStock,
      inTransitQuantity: inTransit,
      affectedEquipments
    });
    
    return {
      id: alertId,
      part,
      alertLevel,
      currentStock: part.current_stock,
      minStock,
      effectiveStock,
      inTransit,
      affectedEquipments
    };
  }
  
  return null;
};

const checkAllParts = () => {
  const parts = SparePart.findAll();
  const alerts = [];
  parts.forEach(part => {
    const alert = checkAndCreateAlert(part.id);
    if (alert) alerts.push(alert);
  });
  return alerts;
};

const getActiveAlerts = () => {
  const alerts = Alert.findActive();
  return alerts.map(alert => ({
    ...alert,
    affected_equipments: alert.affected_equipments ? JSON.parse(alert.affected_equipments) : []
  }));
};

module.exports = {
  checkAndCreateAlert,
  checkAllParts,
  getActiveAlerts
};
