const SensorAlert = require('../models/SensorAlert');
const { v4: uuidv4 } = require('uuid');

class JsonParser {
  static parseSensorAlerts(jsonData) {
    const results = {
      success: [],
      errors: [],
      warnings: []
    };

    try {
      let alerts;
      if (typeof jsonData === 'string') {
        alerts = JSON.parse(jsonData);
      } else {
        alerts = jsonData;
      }

      if (!Array.isArray(alerts)) {
        if (alerts.alerts && Array.isArray(alerts.alerts)) {
          alerts = alerts.alerts;
        } else if (alerts.data && Array.isArray(alerts.data)) {
          alerts = alerts.data;
        } else {
          alerts = [alerts];
        }
      }

      alerts.forEach((alert, index) => {
        try {
          const parsedAlert = this.validateAndTransformAlert(alert, index);
          results.success.push(parsedAlert);
        } catch (error) {
          results.errors.push({
            index,
            data: alert,
            error: error.message
          });
        }
      });

    } catch (error) {
      throw new Error(`JSON解析失败: ${error.message}`);
    }

    return results;
  }

  static validateAndTransformAlert(alert, index) {
    const requiredFields = ['cage_id', 'sensor_type', 'measured_value', 'alert_time'];
    const missingFields = requiredFields.filter(field => !alert[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }

    const sensorTypes = ['temperature', 'humidity', 'ammonia', 'light', 'noise', 'vibration'];
    if (!sensorTypes.includes(alert.sensor_type)) {
      throw new Error(`不支持的传感器类型: ${alert.sensor_type}`);
    }

    if (typeof alert.measured_value !== 'number') {
      throw new Error(`测量值必须是数字类型`);
    }

    const alertTime = new Date(alert.alert_time);
    if (isNaN(alertTime.getTime())) {
      throw new Error(`无效的时间格式: ${alert.alert_time}`);
    }

    const severityLevels = ['low', 'warning', 'high', 'critical'];
    const severity = alert.severity || this.calculateSeverity(alert.sensor_type, alert.measured_value, alert.threshold_value);
    if (!severityLevels.includes(severity)) {
      throw new Error(`无效的严重级别: ${severity}`);
    }

    return {
      alert_id: alert.alert_id || `ALT-${Date.now()}-${index}`,
      cage_id: alert.cage_id.trim(),
      sensor_type: alert.sensor_type,
      threshold_value: alert.threshold_value || this.getDefaultThreshold(alert.sensor_type),
      measured_value: alert.measured_value,
      alert_time: alertTime.toISOString(),
      severity: severity,
      status: alert.status || 'open'
    };
  }

  static getDefaultThreshold(sensorType) {
    const defaults = {
      temperature: 26.0,
      humidity: 60.0,
      ammonia: 20.0,
      light: 500.0,
      noise: 85.0,
      vibration: 0.5
    };
    return defaults[sensorType] || 0;
  }

  static calculateSeverity(sensorType, measuredValue, thresholdValue) {
    if (!thresholdValue) {
      return 'warning';
    }

    const ratio = Math.abs(measuredValue - thresholdValue) / thresholdValue;
    
    if (ratio >= 0.3) {
      return 'critical';
    } else if (ratio >= 0.15) {
      return 'high';
    } else if (ratio >= 0.05) {
      return 'warning';
    }
    return 'low';
  }

  static async importSensorAlerts(jsonData, importedBy = 'system') {
    const parseResult = this.parseSensorAlerts(jsonData);
    const imported = [];
    const errors = [];

    for (const alertData of parseResult.success) {
      try {
        const alert = await SensorAlert.create(alertData);
        imported.push(alert);
      } catch (error) {
        errors.push({
          data: alertData,
          error: error.message
        });
      }
    }

    return {
      total: parseResult.success.length + parseResult.errors.length,
      imported: imported.length,
      failed: errors.length + parseResult.errors.length,
      parse_errors: parseResult.errors,
      import_errors: errors,
      imported_records: imported
    };
  }

  static parseVeterinaryOrders(jsonData) {
    const results = {
      success: [],
      errors: [],
      warnings: []
    };

    try {
      let orders;
      if (typeof jsonData === 'string') {
        orders = JSON.parse(jsonData);
      } else {
        orders = jsonData;
      }

      if (!Array.isArray(orders)) {
        if (orders.orders && Array.isArray(orders.orders)) {
          orders = orders.orders;
        } else if (orders.data && Array.isArray(orders.data)) {
          orders = orders.data;
        } else {
          orders = [orders];
        }
      }

      orders.forEach((order, index) => {
        try {
          const parsedOrder = this.validateAndTransformVeterinaryOrder(order, index);
          results.success.push(parsedOrder);
        } catch (error) {
          results.errors.push({
            index,
            data: order,
            error: error.message
          });
        }
      });

    } catch (error) {
      throw new Error(`JSON解析失败: ${error.message}`);
    }

    return results;
  }

  static validateAndTransformVeterinaryOrder(order, index) {
    const requiredFields = ['animal_id', 'examination_date'];
    const missingFields = requiredFields.filter(field => !order[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }

    const examDate = new Date(order.examination_date);
    if (isNaN(examDate.getTime())) {
      throw new Error(`无效的检查日期格式: ${order.examination_date}`);
    }

    const observationDays = order.observation_period_days || 7;
    if (typeof observationDays !== 'number' || observationDays < 1) {
      throw new Error(`观察期必须是大于0的数字`);
    }

    const status = order.status || 'draft';
    const validStatuses = ['draft', 'signed', 'observing', 'completed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`无效的状态: ${status}`);
    }

    return {
      order_id: order.order_id || `VET-${Date.now()}-${index}`,
      animal_id: order.animal_id.trim(),
      examination_date: examDate.toISOString(),
      symptoms: order.symptoms || '',
      diagnosis: order.diagnosis || '',
      treatment_plan: order.treatment_plan || '',
      medications: order.medications || '',
      observation_period_days: observationDays,
      start_observation_date: order.start_observation_date ? new Date(order.start_observation_date).toISOString() : null,
      veterinarian_signature: order.veterinarian_signature || null,
      signature_date: order.signature_date ? new Date(order.signature_date).toISOString() : null,
      status: status,
      notes: order.notes || ''
    };
  }

  static parseCareInspections(jsonData) {
    const results = {
      success: [],
      errors: [],
      warnings: []
    };

    try {
      let inspections;
      if (typeof jsonData === 'string') {
        inspections = JSON.parse(jsonData);
      } else {
        inspections = jsonData;
      }

      if (!Array.isArray(inspections)) {
        if (inspections.inspections && Array.isArray(inspections.inspections)) {
          inspections = inspections.inspections;
        } else if (inspections.data && Array.isArray(inspections.data)) {
          inspections = inspections.data;
        } else {
          inspections = [inspections];
        }
      }

      inspections.forEach((inspection, index) => {
        try {
          const parsedInspection = this.validateAndTransformCareInspection(inspection, index);
          results.success.push(parsedInspection);
        } catch (error) {
          results.errors.push({
            index,
            data: inspection,
            error: error.message
          });
        }
      });

    } catch (error) {
      throw new Error(`JSON解析失败: ${error.message}`);
    }

    return results;
  }

  static validateAndTransformCareInspection(inspection, index) {
    const requiredFields = ['cage_id', 'inspection_date', 'inspector'];
    const missingFields = requiredFields.filter(field => !inspection[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }

    const inspectionDate = new Date(inspection.inspection_date);
    if (isNaN(inspectionDate.getTime())) {
      throw new Error(`无效的巡检日期格式: ${inspection.inspection_date}`);
    }

    const validConditions = ['excellent', 'good', 'fair', 'poor'];
    const generalCondition = inspection.general_condition || 'good';
    if (!validConditions.includes(generalCondition)) {
      throw new Error(`无效的整体状况: ${generalCondition}`);
    }

    return {
      inspection_id: inspection.inspection_id || `INSP-${Date.now()}-${index}`,
      cage_id: inspection.cage_id.trim(),
      inspection_date: inspectionDate.toISOString(),
      inspector: inspection.inspector.trim(),
      general_condition: generalCondition,
      food_level: inspection.food_level || 'normal',
      water_level: inspection.water_level || 'normal',
      bedding_condition: inspection.bedding_condition || 'clean',
      abnormal_signs: inspection.abnormal_signs || '',
      actions_taken: inspection.actions_taken || '',
      status: inspection.status || 'completed',
      notes: inspection.notes || ''
    };
  }
}

module.exports = JsonParser;
