const fs = require('fs');
const csv = require('csv-parser');
const Vehicle = require('../models/Vehicle');
const Inventory = require('../models/Inventory');
const MaterialRecord = require('../models/MaterialRecord');
const { generateRecordId } = require('../utils/idGenerator');

class ImportService {
  static async importVehiclesFromJSON(jsonData) {
    try {
      const vehicles = Array.isArray(jsonData) ? jsonData : [jsonData];
      const results = [];

      for (const vehicleData of vehicles) {
        const existingVehicle = await Vehicle.findOne({ vehicleId: vehicleData.vehicleId });
        
        if (existingVehicle) {
          Object.assign(existingVehicle, vehicleData);
          await existingVehicle.save();
          results.push({ vehicleId: vehicleData.vehicleId, status: 'updated', data: existingVehicle });
        } else {
          const newVehicle = new Vehicle(vehicleData);
          await newVehicle.save();
          results.push({ vehicleId: vehicleData.vehicleId, status: 'created', data: newVehicle });
        }
      }

      return { success: true, total: results.length, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async importVehiclesFromFile(filePath) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(fileContent);
      return await this.importVehiclesFromJSON(jsonData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async importInventoryFromCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let rowNumber = 0;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', async (row) => {
          rowNumber++;
          try {
            const inventoryData = {
              materialCode: row.materialCode || row['物料编码'],
              materialName: row.materialName || row['物料名称'],
              specification: row.specification || row['规格'],
              unit: row.unit || row['单位'],
              quantity: parseFloat(row.quantity || row['数量']) || 0,
              batchNumber: row.batchNumber || row['批次号'],
              warehouse: row.warehouse || row['仓库'],
              location: row.location || row['库位'],
              safetyStock: parseFloat(row.safetyStock || row['安全库存']) || 0,
              unitPrice: parseFloat(row.unitPrice || row['单价']) || 0,
              supplier: row.supplier || row['供应商'],
              remarks: row.remarks || row['备注']
            };

            if (!inventoryData.materialCode || !inventoryData.batchNumber) {
              errors.push({ row: rowNumber, error: '缺少物料编码或批次号' });
              return;
            }

            const existingInventory = await Inventory.findOne({
              materialCode: inventoryData.materialCode,
              batchNumber: inventoryData.batchNumber
            });

            if (existingInventory) {
              Object.assign(existingInventory, inventoryData);
              await existingInventory.save();
              results.push({ row: rowNumber, materialCode: inventoryData.materialCode, status: 'updated' });
            } else {
              const newInventory = new Inventory(inventoryData);
              await newInventory.save();
              results.push({ row: rowNumber, materialCode: inventoryData.materialCode, status: 'created' });
            }
          } catch (error) {
            errors.push({ row: rowNumber, error: error.message });
          }
        })
        .on('end', () => {
          resolve({
            success: errors.length === 0,
            total: results.length + errors.length,
            imported: results.length,
            errors: errors.length,
            results,
            errorDetails: errors
          });
        })
        .on('error', (error) => {
          reject({ success: false, error: error.message });
        });
    });
  }

  static async importMaterialRecordsFromCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let rowNumber = 0;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', async (row) => {
          rowNumber++;
          try {
            const recordData = {
              recordId: generateRecordId(),
              orderNumber: row.orderNumber || row['抢修单号'],
              vehicleId: row.vehicleId || row['车辆ID'],
              teamName: row.teamName || row['班组'],
              materialCode: row.materialCode || row['物料编码'],
              materialName: row.materialName || row['物料名称'],
              specification: row.specification || row['规格'],
              unit: row.unit || row['单位'],
              requestedQuantity: parseFloat(row.requestedQuantity || row['申请数量']) || 0,
              actualQuantity: parseFloat(row.actualQuantity || row['实际数量']) || 0,
              batchNumber: row.batchNumber || row['批次号'],
              warehouse: row.warehouse || row['仓库'],
              recordType: row.recordType || row['记录类型'] || 'normal',
              applicant: row.applicant || row['申请人'],
              reason: row.reason || row['原因'],
              remarks: row.remarks || row['备注']
            };

            if (!recordData.orderNumber || !recordData.materialCode) {
              errors.push({ row: rowNumber, error: '缺少抢修单号或物料编码' });
              return;
            }

            const newRecord = new MaterialRecord(recordData);
            newRecord.addAuditTrail('导入创建', recordData.applicant || 'system', 'CSV导入');
            await newRecord.save();
            
            results.push({ row: rowNumber, recordId: recordData.recordId, status: 'created' });
          } catch (error) {
            errors.push({ row: rowNumber, error: error.message });
          }
        })
        .on('end', () => {
          resolve({
            success: errors.length === 0,
            total: results.length + errors.length,
            imported: results.length,
            errors: errors.length,
            results,
            errorDetails: errors
          });
        })
        .on('error', (error) => {
          reject({ success: false, error: error.message });
        });
    });
  }

  static async importInventoryFromJSON(jsonData) {
    try {
      const items = Array.isArray(jsonData) ? jsonData : [jsonData];
      const results = [];

      for (const item of items) {
        const existingItem = await Inventory.findOne({
          materialCode: item.materialCode,
          batchNumber: item.batchNumber
        });

        if (existingItem) {
          Object.assign(existingItem, item);
          await existingItem.save();
          results.push({ materialCode: item.materialCode, batchNumber: item.batchNumber, status: 'updated' });
        } else {
          const newItem = new Inventory(item);
          await newItem.save();
          results.push({ materialCode: item.materialCode, batchNumber: item.batchNumber, status: 'created' });
        }
      }

      return { success: true, total: results.length, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ImportService;
