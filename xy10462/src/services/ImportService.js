const fs = require('fs-extra');
const path = require('path');

class ImportService {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  async importFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.json') {
      return this.importFromJSON(filePath);
    } else if (ext === '.csv') {
      return this.importFromCSV(filePath);
    } else {
      throw new Error(`不支持的文件格式: ${ext}。请使用 JSON 或 CSV 文件。`);
    }
  }

  async importFromJSON(filePath) {
    const data = await fs.readJson(filePath);
    const results = {
      vehicles: { imported: 0, errors: [] },
      preparationItems: { imported: 0, errors: [] },
      costs: { imported: 0, errors: [] }
    };

    if (data.vehicles) {
      for (const vehicleData of data.vehicles) {
        try {
          let vehicle = this.dataStore.getVehicleByVin(vehicleData.vin);
          if (!vehicle) {
            vehicle = this.dataStore.addVehicle(vehicleData);
            results.vehicles.imported++;
          } else {
            results.vehicles.errors.push(`车辆已存在 (VIN: ${vehicleData.vin})`);
          }
        } catch (error) {
          results.vehicles.errors.push(`${vehicleData.vin || '未知'}: ${error.message}`);
        }
      }
    }

    if (data.preparationItems) {
      for (const itemData of data.preparationItems) {
        try {
          const vehicle = this.findVehicle(itemData);
          if (!vehicle) {
            results.preparationItems.errors.push(`未找到关联车辆: ${JSON.stringify(itemData)}`);
            continue;
          }
          this.dataStore.addPreparationItem(vehicle.id, itemData);
          results.preparationItems.imported++;
        } catch (error) {
          results.preparationItems.errors.push(error.message);
        }
      }
    }

    if (data.costs) {
      for (const costData of data.costs) {
        try {
          const vehicle = this.findVehicle(costData);
          if (!vehicle) {
            results.costs.errors.push(`未找到关联车辆 - ${JSON.stringify(costData)}`);
            continue;
          }
          this.dataStore.addCost(vehicle.id, costData);
          results.costs.imported++;
        } catch (error) {
          results.costs.errors.push(error.message);
        }
      }
    }

    await this.dataStore.save();
    return results;
  }

  async importFromCSV(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const results = {
      vehicles: { imported: 0, errors: [] },
      preparationItems: { imported: 0, errors: [] },
      costs: { imported: 0, errors: [] }
    };

    if (lines.length < 2) return results;

    const headers = lines[0].split(',').map(h => h.trim());
    
    if (headers.includes('vin') && headers.includes('brand')) {
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCSVLine(lines[i]);
          const data = this.mapToObject(headers, values);
          
          if (data.vin) {
            let vehicle = this.dataStore.getVehicleByVin(data.vin);
            if (!vehicle) {
              vehicle = this.dataStore.addVehicle(data);
              results.vehicles.imported++;
            }
          }
        } catch (error) {
          results.vehicles.errors.push(`第${i + 1}行: ${error.message}`);
        }
      }
    }

    await this.dataStore.save();
    return results;
  }

  findVehicle(data) {
    if (data.vehicleId) {
      return this.dataStore.getVehicleById(data.vehicleId);
    }
    if (data.vin) {
      return this.dataStore.getVehicleByVin(data.vin);
    }
    if (data.plateNumber) {
      return this.dataStore.getVehicleByPlate(data.plateNumber);
    }
    return null;
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  mapToObject(headers, values) {
    const obj = {};
    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        let value = values[index];
        if (!isNaN(value) && value !== '') {
          value = Number(value);
        }
        obj[header] = value;
      }
    });
    return obj;
  }
}

module.exports = ImportService;
