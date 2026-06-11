const Sensor = require('../models/Sensor');
const store = require('../store/DataStore');

class SensorService {
  static createSensor(data) {
    const sensor = new Sensor(data);
    return store.create('sensors', sensor.toJSON());
  }

  static getSensorById(id) {
    return store.findById('sensors', id);
  }

  static getSensorByPhysicalId(physicalId) {
    return store.findOne('sensors', s => s.physicalId === physicalId);
  }

  static getSensorByCurrentNumber(number) {
    return store.findOne('sensors', s => s.currentNumber === number);
  }

  static getAllSensors() {
    return store.findAll('sensors');
  }

  static getAllActiveSensors() {
    return store.find('sensors', s => s.status === 'active');
  }

  static handleSensorRestart(physicalId, newNumber) {
    const sensorData = this.getSensorByPhysicalId(physicalId);
    if (!sensorData) {
      return this.createSensor({
        physicalId,
        currentNumber: newNumber,
        lastRestartTime: new Date().toISOString(),
        restartCount: 1
      });
    }

    const sensor = new Sensor(sensorData);
    const hasChanged = sensor.handleRestart(newNumber);
    
    if (hasChanged) {
      store.update('sensors', sensor.id, sensor.toJSON());
      return {
        sensor: sensor.toJSON(),
        restartDetected: true,
        oldNumber: sensor.previousNumbers[sensor.previousNumbers.length - 1]?.number
      };
    }

    return {
      sensor: sensor.toJSON(),
      restartDetected: false
    };
  }

  static getSensorNumberAtTime(physicalId, timestamp) {
    const sensorData = this.getSensorByPhysicalId(physicalId);
    if (!sensorData) return null;
    
    const sensor = new Sensor(sensorData);
    return sensor.getNumberAtTime(timestamp);
  }

  static getSensorHistory(physicalId) {
    const sensorData = this.getSensorByPhysicalId(physicalId);
    if (!sensorData) return null;
    
    return {
      currentNumber: sensorData.currentNumber,
      previousNumbers: sensorData.previousNumbers,
      restartCount: sensorData.restartCount
    };
  }

  static findSensorsByNumberAtTime(number, timestamp) {
    const allSensors = this.getAllSensors();
    return allSensors.filter(sensorData => {
      const sensor = new Sensor(sensorData);
      return sensor.getNumberAtTime(timestamp) === number;
    });
  }

  static resolveSensorConflict(sensorNumber, photoTimestamp) {
    const matchingSensors = this.findSensorsByNumberAtTime(sensorNumber, photoTimestamp);
    
    if (matchingSensors.length === 0) {
      return {
        status: 'not_found',
        message: `未找到在 ${photoTimestamp} 时编号为 ${sensorNumber} 的传感器`
      };
    }
    
    if (matchingSensors.length === 1) {
      return {
        status: 'resolved',
        sensor: matchingSensors[0]
      };
    }
    
    return {
      status: 'conflict',
      message: `发现 ${matchingSensors.length} 个传感器在 ${photoTimestamp} 时编号为 ${sensorNumber}，需要人工确认`,
      candidates: matchingSensors
    };
  }

  static updateSensor(id, updates) {
    return store.update('sensors', id, updates);
  }

  static deactivateSensor(id) {
    return store.update('sensors', id, { status: 'inactive' });
  }

  static rollbackSensorNumber(id, targetNumber, reason, operator) {
    const sensorData = this.getSensorById(id);
    if (!sensorData) {
      return { error: '传感器未找到' };
    }

    try {
      const sensor = new Sensor(sensorData);
      const result = sensor.rollbackNumber(targetNumber, reason, operator);
      store.update('sensors', id, sensor.toJSON());
      return {
        success: true,
        ...result,
        sensor: sensor.toJSON()
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  static getSensorRollbackHistory(id) {
    const sensorData = this.getSensorById(id);
    if (!sensorData) return null;
    
    const sensor = new Sensor(sensorData);
    return {
      sensorId: id,
      physicalId: sensor.physicalId,
      rollbackHistory: sensor.getRollbackHistory()
    };
  }
}

module.exports = SensorService;
