import { CURRENT_VERSION } from '../state/StateManager.js';

export class ImportExportManager {
  constructor(stage, deviceLibrary) {
    this.stage = stage;
    this.deviceLibrary = deviceLibrary;
  }
  
  exportToJSON() {
    const exportData = {
      version: CURRENT_VERSION,
      exportDate: new Date().toISOString(),
      stage: this.stage.serialize()
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      
      const validation = this.validateImportData(data);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }
      
      return {
        success: true,
        data: data,
        warnings: validation.warnings
      };
    } catch (error) {
      return {
        success: false,
        errors: [`解析错误: ${error.message}`]
      };
    }
  }
  
  validateImportData(data) {
    const errors = [];
    const warnings = [];
    
    if (!data.version) {
      errors.push('缺少版本信息');
    } else {
      const versionParts = data.version.split('.').map(Number);
      const currentParts = CURRENT_VERSION.split('.').map(Number);
      
      if (versionParts[0] !== currentParts[0]) {
        errors.push(`不兼容的主版本号: ${data.version} (当前版本: ${CURRENT_VERSION})`);
      } else if (versionParts[1] > currentParts[1]) {
        warnings.push(`导入文件版本较新: ${data.version} (当前版本: ${CURRENT_VERSION})，部分功能可能不兼容`);
      }
    }
    
    if (!data.stage) {
      errors.push('缺少舞台数据');
      return { valid: false, errors, warnings };
    }
    
    if (data.stage.settings) {
      const settings = data.stage.settings;
      
      if (settings.width !== undefined && (typeof settings.width !== 'number' || settings.width <= 0)) {
        errors.push('舞台宽度无效');
      }
      if (settings.depth !== undefined && (typeof settings.depth !== 'number' || settings.depth <= 0)) {
        errors.push('舞台深度无效');
      }
      if (settings.height !== undefined && (typeof settings.height !== 'number' || settings.height <= 0)) {
        errors.push('舞台高度无效');
      }
      if (settings.hoistMaxLoad !== undefined && (typeof settings.hoistMaxLoad !== 'number' || settings.hoistMaxLoad <= 0)) {
        errors.push('吊点安全载荷无效');
      }
    }
    
    if (data.stage.devices && Array.isArray(data.stage.devices)) {
      const deviceIds = new Set();
      
      for (const device of data.stage.devices) {
        if (!device.id) {
          errors.push('设备缺少ID');
        } else if (deviceIds.has(device.id)) {
          errors.push(`重复的设备ID: ${device.id}`);
        } else {
          deviceIds.add(device.id);
        }
        
        if (typeof device.weight !== 'number' || device.weight < 0) {
          errors.push(`设备 ${device.id || '未知'} 重量无效`);
        }
        
        if (device.position) {
          if (typeof device.position.x !== 'number') {
            errors.push(`设备 ${device.id || '未知'} 位置X无效`);
          }
          if (typeof device.position.y !== 'number') {
            errors.push(`设备 ${device.id || '未知'} 位置Y无效`);
          }
          if (typeof device.position.z !== 'number') {
            errors.push(`设备 ${device.id || '未知'} 位置Z无效`);
          }
        }
        
        if (device.rotation) {
          if (typeof device.rotation.x !== 'number') {
            warnings.push(`设备 ${device.id || '未知'} 旋转X无效，将使用默认值`);
          }
          if (typeof device.rotation.y !== 'number') {
            warnings.push(`设备 ${device.id || '未知'} 旋转Y无效，将使用默认值`);
          }
          if (typeof device.rotation.z !== 'number') {
            warnings.push(`设备 ${device.id || '未知'} 旋转Z无效，将使用默认值`);
          }
        }
      }
    }
    
    if (data.stage.bars && Array.isArray(data.stage.bars)) {
      for (const bar of data.stage.bars) {
        if (!bar.id) {
          errors.push('横杆缺少ID');
        }
        
        if (typeof bar.startX !== 'number') {
          errors.push(`横杆 ${bar.id || '未知'} 起始位置X无效`);
        }
        if (typeof bar.endX !== 'number') {
          errors.push(`横杆 ${bar.id || '未知'} 结束位置X无效`);
        }
        if (typeof bar.startZ !== 'number') {
          errors.push(`横杆 ${bar.id || '未知'} 起始位置Z无效`);
        }
        if (typeof bar.endZ !== 'number') {
          errors.push(`横杆 ${bar.id || '未知'} 结束位置Z无效`);
        }
        if (typeof bar.height !== 'number') {
          errors.push(`横杆 ${bar.id || '未知'} 高度无效`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  downloadJSON(filename = 'stage-layout.json') {
    const jsonContent = this.exportToJSON();
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
  
  createFileInput(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = this.importFromJSON(event.target.result);
        callback(result);
      };
      reader.onerror = () => {
        callback({
          success: false,
          errors: ['文件读取失败']
        });
      };
      reader.readAsText(file);
    });
    
    input.click();
  }
}
