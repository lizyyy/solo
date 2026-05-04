const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { 
  Material, 
  MaterialInventory, 
  Machine, 
  Nozzle, 
  Task, 
  GCodeInfo, 
  MaintenanceRecord 
} = require('../models');

class DataImporter {
  constructor() {
    this.supportedFormats = {
      csv: this.parseCSV.bind(this),
      json: this.parseJSON.bind(this)
    };
  }

  async importFromFile(filePath, dataType) {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    
    if (!this.supportedFormats[ext]) {
      throw new Error(`不支持的文件格式: ${ext}`);
    }

    const parser = this.supportedFormats[ext];
    return parser(filePath, dataType);
  }

  async importFromDirectory(dirPath) {
    const results = {
      materials: [],
      materialInventories: [],
      machines: [],
      tasks: [],
      maintenanceRecords: [],
      gcodeFiles: []
    };

    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        continue;
      }
      
      const ext = path.extname(file).toLowerCase();
      
      if (ext === '.gcode' || ext === '.g') {
        const gcodeInfo = this.parseGCodeHeader(fullPath);
        if (gcodeInfo) {
          results.gcodeFiles.push(gcodeInfo);
        }
      } else if (ext === '.csv') {
        const csvData = await this.parseCSVGeneric(fullPath);
        this.classifyCSVData(csvData, results);
      } else if (ext === '.json') {
        try {
          const jsonData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          this.classifyJSONData(jsonData, results);
        } catch (e) {
          console.error(`解析JSON文件失败: ${file}`, e.message);
        }
      }
    }
    
    return results;
  }

  parseGCodeHeader(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').slice(0, 100); // 只读取前100行
      
      const gcodeInfo = {
        fileName: path.basename(filePath),
        estimatedPrintTime: 0,
        nozzleTemp: 0,
        bedTemp: 0,
        materialType: 'PLA',
        layerHeight: 0.2,
        infillPercentage: 20
      };

      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        
        // 解析预计打印时间
        if (lowerLine.includes('estimated time') || lowerLine.includes('print time')) {
          const timeMatch = line.match(/(\d+)\s*(h|hour|hours|m|min|minutes|s|sec|seconds)?/i);
          if (timeMatch) {
            const value = parseInt(timeMatch[1]);
            const unit = (timeMatch[2] || 'm').toLowerCase();
            if (unit.startsWith('h')) {
              gcodeInfo.estimatedPrintTime += value * 60;
            } else if (unit.startsWith('s')) {
              gcodeInfo.estimatedPrintTime += value / 60;
            } else {
              gcodeInfo.estimatedPrintTime += value;
            }
          }
        }
        
        // 解析喷嘴温度
        if (lowerLine.includes('temperature') || lowerLine.includes('nozzle') || lowerLine.includes('extruder')) {
          const tempMatch = line.match(/(\d+)\s*[cC]?/);
          if (tempMatch && (lowerLine.includes('nozzle') || lowerLine.includes('extruder'))) {
            gcodeInfo.nozzleTemp = parseInt(tempMatch[1]);
          }
        }
        
        // 解析热床温度
        if (lowerLine.includes('bed') || lowerLine.includes('heated bed')) {
          const tempMatch = line.match(/(\d+)\s*[cC]?/);
          if (tempMatch) {
            gcodeInfo.bedTemp = parseInt(tempMatch[1]);
          }
        }
        
        // 解析材料类型
        if (lowerLine.includes('material') || lowerLine.includes('filament')) {
          const materialMatch = line.match(/(PLA|ABS|PETG|TPU|Nylon|PC|PP)/i);
          if (materialMatch) {
            gcodeInfo.materialType = materialMatch[1].toUpperCase();
          }
        }
        
        // 解析层高度
        if (lowerLine.includes('layer height') || lowerLine.includes('layer_height')) {
          const layerMatch = line.match(/(\d+\.?\d*)/);
          if (layerMatch) {
            gcodeInfo.layerHeight = parseFloat(layerMatch[1]);
          }
        }
        
        // 解析填充密度
        if (lowerLine.includes('infill') || lowerLine.includes('fill density')) {
          const infillMatch = line.match(/(\d+)%?/);
          if (infillMatch) {
            gcodeInfo.infillPercentage = parseInt(infillMatch[1]);
          }
        }
      }

      // 如果没有找到温度，尝试从G-code命令中提取
      if (gcodeInfo.nozzleTemp === 0) {
        const tempMatch = content.match(/M104\s+S(\d+)/i) || content.match(/M109\s+S(\d+)/i);
        if (tempMatch) {
          gcodeInfo.nozzleTemp = parseInt(tempMatch[1]);
        }
      }
      
      if (gcodeInfo.bedTemp === 0) {
        const bedMatch = content.match(/M140\s+S(\d+)/i) || content.match(/M190\s+S(\d+)/i);
        if (bedMatch) {
          gcodeInfo.bedTemp = parseInt(bedMatch[1]);
        }
      }

      return gcodeInfo;
    } catch (e) {
      console.error(`解析G-code文件失败: ${filePath}`, e.message);
      return null;
    }
  }

  async parseCSV(filePath, dataType) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          try {
            const parsedData = this.convertCSVToModels(results, dataType);
            resolve(parsedData);
          } catch (e) {
            reject(e);
          }
        })
        .on('error', reject);
    });
  }

  async parseCSVGeneric(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  convertCSVToModels(csvData, dataType) {
    switch (dataType) {
      case 'materials':
        return csvData.map(row => new Material(
          row.name || row.material_name || row.material,
          row.type || row.material_type,
          parseInt(row.nozzleTempMin || row.min_temp || row.temp_min),
          parseInt(row.nozzleTempMax || row.max_temp || row.temp_max),
          parseInt(row.bedTemp || row.bed_temp || row.heated_bed),
          row.color
        ));
      
      case 'materialInventories':
        return csvData.map(row => new MaterialInventory(
          row.materialId || row.material_id,
          row.spoolId || row.spool_id || row.id,
          parseFloat(row.remainingWeight || row.remaining || row.remaining_weight),
          parseFloat(row.totalWeight || row.total || row.total_weight),
          row.location || row.location_name,
          row.lastUpdated || row.last_updated ? new Date(row.lastUpdated || row.last_updated) : null
        ));
      
      case 'machines':
        return csvData.map(row => {
          const machine = new Machine(
            row.name || row.machine_name || row.printer_name,
            row.model || row.machine_model,
            row.type || row.machine_type || 'FDM',
            row.status || 'available'
          );
          
          // 如果有喷嘴信息
          if (row.nozzleSize || row.nozzle_size || row.nozzle_material) {
            machine.nozzle = new Nozzle(
              machine.id,
              row.nozzleSize || row.nozzle_size || '0.4mm',
              row.nozzleMaterial || row.nozzle_material || 'brass',
              row.lastChangedDate || row.last_changed_date,
              parseFloat(row.printHoursSinceChange || row.print_hours || 0),
              parseFloat(row.maxPrintHours || row.max_hours || 1000)
            );
          }
          
          return machine;
        });
      
      case 'tasks':
        return csvData.map(row => {
          const gcodeInfo = row.gcodeFileName || row.file_name ? new GCodeInfo(
            row.gcodeFileName || row.file_name,
            parseFloat(row.estimatedPrintTime || row.estimated_time || row.print_time || 0),
            parseInt(row.nozzleTemp || row.nozzle_temp || 0),
            parseInt(row.bedTemp || row.bed_temp || 0),
            row.materialType || row.material_type || 'PLA',
            parseFloat(row.layerHeight || row.layer_height || 0.2),
            parseInt(row.infillPercentage || row.infill || 20)
          ) : null;
          
          return new Task(
            row.userId || row.user_id,
            row.userName || row.user_name || row.user,
            row.machineId || row.machine_id || row.printer_id,
            gcodeInfo,
            row.materialId || row.material_id,
            row.scheduledStartTime || row.start_time || row.scheduled_start,
            row.scheduledEndTime || row.end_time || row.scheduled_end,
            row.status || 'pending',
            row.priority || 'normal'
          );
        });
      
      case 'maintenanceRecords':
        return csvData.map(row => new MaintenanceRecord(
          row.machineId || row.machine_id || row.printer_id,
          row.type || row.maintenance_type,
          row.description || row.maintenance_description,
          row.performedBy || row.performed_by || row.technician,
          row.performedDate || row.performed_date || row.date,
          row.nextMaintenanceDate || row.next_maintenance_date || row.next_date,
          row.notes || row.comments
        ));
      
      default:
        return csvData;
    }
  }

  classifyCSVData(csvData, results) {
    if (csvData.length === 0) return;
    
    const firstRow = csvData[0];
    const keys = Object.keys(firstRow).map(k => k.toLowerCase());
    
    // 判断数据类型
    if (keys.includes('material_name') || keys.includes('nozzletempmin') || keys.includes('nozzle_temp_min')) {
      results.materials.push(...this.convertCSVToModels(csvData, 'materials'));
    } else if (keys.includes('remainingweight') || keys.includes('remaining_weight') || keys.includes('spool_id')) {
      results.materialInventories.push(...this.convertCSVToModels(csvData, 'materialInventories'));
    } else if (keys.includes('machine_name') || keys.includes('printer_name') || keys.includes('nozzle_size')) {
      results.machines.push(...this.convertCSVToModels(csvData, 'machines'));
    } else if (keys.includes('user_name') || keys.includes('scheduled_start_time') || keys.includes('gcode_file_name')) {
      results.tasks.push(...this.convertCSVToModels(csvData, 'tasks'));
    } else if (keys.includes('maintenance_type') || keys.includes('performed_by') || keys.includes('next_maintenance_date')) {
      results.maintenanceRecords.push(...this.convertCSVToModels(csvData, 'maintenanceRecords'));
    }
  }

  async parseJSON(filePath, dataType) {
    try {
      const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return this.convertJSONToModels(jsonData, dataType);
    } catch (e) {
      throw new Error(`解析JSON文件失败: ${e.message}`);
    }
  }

  convertJSONToModels(jsonData, dataType) {
    // 处理数组
    if (Array.isArray(jsonData)) {
      return jsonData.map(item => this.convertSingleJSONToModel(item, dataType));
    }
    
    // 处理单个对象
    return this.convertSingleJSONToModel(jsonData, dataType);
  }

  convertSingleJSONToModel(jsonItem, dataType) {
    switch (dataType) {
      case 'material':
        return Material.fromJSON(jsonItem);
      case 'materialInventory':
        return MaterialInventory.fromJSON(jsonItem);
      case 'machine':
        return Machine.fromJSON(jsonItem);
      case 'task':
        return Task.fromJSON(jsonItem);
      case 'maintenanceRecord':
        return MaintenanceRecord.fromJSON(jsonItem);
      case 'gcodeInfo':
        return GCodeInfo.fromJSON(jsonItem);
      default:
        return jsonItem;
    }
  }

  classifyJSONData(jsonData, results) {
    // 处理数组
    if (Array.isArray(jsonData)) {
      for (const item of jsonData) {
        this.classifySingleJSONItem(item, results);
      }
      return;
    }
    
    // 处理单个对象
    this.classifySingleJSONItem(jsonData, results);
  }

  classifySingleJSONItem(item, results) {
    // 根据字段判断类型
    if (item.nozzleTempMin !== undefined || item.material_type !== undefined) {
      results.materials.push(Material.fromJSON(item));
    } else if (item.remainingWeight !== undefined || item.spoolId !== undefined) {
      results.materialInventories.push(MaterialInventory.fromJSON(item));
    } else if (item.model !== undefined || item.nozzle !== undefined) {
      results.machines.push(Machine.fromJSON(item));
    } else if (item.userId !== undefined || item.scheduledStartTime !== undefined) {
      results.tasks.push(Task.fromJSON(item));
    } else if (item.performedBy !== undefined || item.nextMaintenanceDate !== undefined) {
      results.maintenanceRecords.push(MaintenanceRecord.fromJSON(item));
    } else if (item.fileName !== undefined || item.estimatedPrintTime !== undefined) {
      results.gcodeFiles.push(GCodeInfo.fromJSON(item));
    }
  }
}

module.exports = DataImporter;
