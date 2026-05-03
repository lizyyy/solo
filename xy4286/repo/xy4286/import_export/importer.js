const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const models = require('../models');
const repositories = require('../repositories');
const { AUDIT_ACTIONS, ENTITY_TYPES } = require('../models/auditEvent');

class Importer {
  constructor() {
    this.temperatureLogRepo = new repositories.TemperatureLogRepository();
    this.vehicleTrajectoryRepo = new repositories.VehicleTrajectoryRepository();
    this.handoverFormRepo = new repositories.HandoverFormRepository();
    this.auditEventRepo = new repositories.AuditEventRepository();
  }

  async importTemperatureCSV(filePath, boxId) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let lineNumber = 0;

      fs.createReadStream(filePath)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase()
        }))
        .on('headers', (headers) => {
          lineNumber = 1;
        })
        .on('data', (data) => {
          lineNumber++;
          try {
            const log = this._parseTemperatureLog(data, boxId, lineNumber);
            if (log) {
              results.push(log);
            }
          } catch (error) {
            errors.push({
              line: lineNumber,
              error: error.message,
              data
            });
          }
        })
        .on('end', () => {
          const savedLogs = [];
          results.forEach(log => {
            try {
              const saved = this.temperatureLogRepo.create(log);
              savedLogs.push(saved);
              
              this.auditEventRepo.create(new models.AuditEvent({
                action: AUDIT_ACTIONS.IMPORT,
                entityType: ENTITY_TYPES.TEMPERATURE_LOG,
                entityId: saved.id,
                details: {
                  source: 'csv_import',
                  file: path.basename(filePath)
                }
              }));
            } catch (error) {
              errors.push({
                line: 0,
                error: `Failed to save log: ${error.message}`,
                data: log
              });
            }
          });

          resolve({
            success: true,
            imported: savedLogs.length,
            failed: errors.length,
            logs: savedLogs,
            errors
          });
        })
        .on('error', (error) => {
          reject({
            success: false,
            error: error.message
          });
        });
    });
  }

  _parseTemperatureLog(data, boxId, lineNumber) {
    const timestamp = data.timestamp || data.time || data.date;
    const temperature = data.temperature || data.temp || data.value;

    if (!timestamp) {
      throw new Error(`Missing timestamp field at line ${lineNumber}`);
    }

    if (temperature === undefined || temperature === null || temperature === '') {
      throw new Error(`Missing temperature value at line ${lineNumber}`);
    }

    const parsedTemp = parseFloat(temperature);
    if (isNaN(parsedTemp)) {
      throw new Error(`Invalid temperature value: ${temperature} at line ${lineNumber}`);
    }

    return new models.TemperatureLog({
      boxId: boxId,
      timestamp: this._parseTimestamp(timestamp),
      temperature: parsedTemp,
      unit: data.unit || 'C',
      source: data.source || 'imported'
    });
  }

  _parseTimestamp(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    
    return new Date().toISOString();
  }

  importVehicleTrajectoryJSON(filePath, batchId = null, boxId = null) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      const trajectory = new models.VehicleTrajectory({
        vehiclePlate: data.vehiclePlate || data.plate || data.vehicle || '',
        batchId: batchId || data.batchId,
        boxId: boxId || data.boxId,
        points: data.points || data.trajectory || data.gps || [],
        source: data.source || 'imported',
        startTime: data.startTime || data.start,
        endTime: data.endTime || data.end,
        totalDistance: data.totalDistance || data.distance || 0
      });

      const saved = this.vehicleTrajectoryRepo.create(trajectory);

      this.auditEventRepo.create(new models.AuditEvent({
        action: AUDIT_ACTIONS.IMPORT,
        entityType: ENTITY_TYPES.VEHICLE_TRAJECTORY,
        entityId: saved.id,
        details: {
          source: 'json_import',
          file: path.basename(filePath)
        }
      }));

      return {
        success: true,
        trajectory: saved,
        pointsCount: saved.points.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  importHandoverForm(data) {
    try {
      const form = new models.HandoverForm({
        formNumber: data.formNumber,
        batchId: data.batchId,
        boxId: data.boxId,
        fromStationId: data.fromStationId,
        toStationId: data.toStationId,
        senderPersonId: data.senderPersonId,
        receiverPersonId: data.receiverPersonId,
        handoffTime: data.handoffTime,
        actualReceiveTime: data.actualReceiveTime,
        temperatureAtHandover: data.temperatureAtHandover,
        vehiclePlate: data.vehiclePlate,
        notes: data.notes
      });

      if (data.senderSignature) {
        form.signSender(data.senderSignature, data.senderPersonId);
      }

      if (data.receiverSignature) {
        form.signReceiver(data.receiverSignature, data.receiverPersonId);
      }

      const saved = this.handoverFormRepo.create(form);

      this.auditEventRepo.create(new models.AuditEvent({
        action: AUDIT_ACTIONS.CREATE,
        entityType: ENTITY_TYPES.HANDOVER_FORM,
        entityId: saved.id,
        details: {
          source: 'imported'
        }
      }));

      return {
        success: true,
        handoverForm: saved
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = Importer;
