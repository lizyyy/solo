export const STORAGE_KEY = 'hoist-point-rehearsal-studio';
export const CURRENT_VERSION = '1.0.0';

export class StateManager {
  constructor(stage) {
    this.stage = stage;
    this.lastSave = null;
  }
  
  save() {
    const state = {
      version: CURRENT_VERSION,
      timestamp: Date.now(),
      stage: this.stage.serialize()
    };
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.lastSave = new Date();
      return { success: true, timestamp: this.lastSave };
    } catch (error) {
      console.error('Failed to save state:', error);
      return { success: false, error: error.message };
    }
  }
  
  load() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (!savedData) {
        return { success: false, error: 'No saved data found' };
      }
      
      const state = JSON.parse(savedData);
      
      const validation = this.validateState(state);
      if (!validation.valid) {
        return { success: false, error: validation.errors.join('\n') };
      }
      
      return { success: true, state: state };
    } catch (error) {
      console.error('Failed to load state:', error);
      return { success: false, error: error.message };
    }
  }
  
  hasSavedData() {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }
  
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      this.lastSave = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  validateState(state) {
    const errors = [];
    
    if (!state.version) {
      errors.push('缺少版本信息');
    } else if (!this.isVersionCompatible(state.version)) {
      errors.push(`不兼容的版本: ${state.version}`);
    }
    
    if (!state.stage) {
      errors.push('缺少舞台数据');
    } else {
      if (!state.stage.settings) {
        errors.push('缺少舞台设置');
      }
      
      if (state.stage.bars && !Array.isArray(state.stage.bars)) {
        errors.push('横杆数据格式错误');
      }
      
      if (state.stage.devices && !Array.isArray(state.stage.devices)) {
        errors.push('设备数据格式错误');
      }
      
      if (state.stage.devices) {
        for (let i = 0; i < state.stage.devices.length; i++) {
          const device = state.stage.devices[i];
          if (!device.id) {
            errors.push(`设备 ${i} 缺少ID`);
          }
          if (typeof device.weight !== 'number' || device.weight < 0) {
            errors.push(`设备 ${device.id || i} 重量无效`);
          }
          if (device.position) {
            if (typeof device.position.x !== 'number') {
              errors.push(`设备 ${device.id || i} 位置X无效`);
            }
            if (typeof device.position.y !== 'number') {
              errors.push(`设备 ${device.id || i} 位置Y无效`);
            }
            if (typeof device.position.z !== 'number') {
              errors.push(`设备 ${device.id || i} 位置Z无效`);
            }
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
  
  isVersionCompatible(version) {
    const [major, minor, patch] = version.split('.').map(Number);
    const [currentMajor, currentMinor, currentPatch] = CURRENT_VERSION.split('.').map(Number);
    
    if (major > currentMajor) return false;
    if (major < currentMajor) return false;
    if (minor > currentMinor) return false;
    
    return true;
  }
  
  getLastSaveTime() {
    return this.lastSave;
  }
}
