class SaveManager {
  constructor() {
    this.storagePrefix = 'forklift_sim_';
  }

  async save(slotName, data) {
    return new Promise((resolve, reject) => {
      try {
        const key = this.storagePrefix + slotName;
        const jsonString = JSON.stringify(data);
        localStorage.setItem(key, jsonString);
        resolve(true);
      } catch (error) {
        console.error('保存失败:', error);
        reject(error);
      }
    });
  }

  async load(slotName) {
    return new Promise((resolve, reject) => {
      try {
        const key = this.storagePrefix + slotName;
        const jsonString = localStorage.getItem(key);
        
        if (!jsonString) {
          resolve(null);
          return;
        }
        
        const data = JSON.parse(jsonString);
        resolve(data);
      } catch (error) {
        console.error('加载失败:', error);
        reject(error);
      }
    });
  }

  async delete(slotName) {
    return new Promise((resolve, reject) => {
      try {
        const key = this.storagePrefix + slotName;
        localStorage.removeItem(key);
        resolve(true);
      } catch (error) {
        console.error('删除失败:', error);
        reject(error);
      }
    });
  }

  async listSaves() {
    return new Promise((resolve, reject) => {
      try {
        const saves = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          
          if (key && key.startsWith(this.storagePrefix)) {
            const slotName = key.replace(this.storagePrefix, '');
            const jsonString = localStorage.getItem(key);
            
            if (jsonString) {
              try {
                const data = JSON.parse(jsonString);
                saves.push({
                  slotName: slotName,
                  timestamp: data.timestamp,
                  levelName: data.level?.name || '未知关卡',
                  elapsedTime: data.simulationTime || 0
                });
              } catch (e) {
                console.warn(`解析存档 ${slotName} 失败`, e);
              }
            }
          }
        }
        
        saves.sort((a, b) => b.timestamp - a.timestamp);
        resolve(saves);
      } catch (error) {
        console.error('列出存档失败:', error);
        reject(error);
      }
    });
  }

  exportJSON(filename, data) {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `${filename}_${timestamp}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      console.log('JSON 已导出');
      return true;
    } catch (error) {
      console.error('导出失败:', error);
      return false;
    }
  }

  async importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          resolve(data);
        } catch (error) {
          reject(new Error('JSON 解析失败'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };
      
      reader.readAsText(file);
    });
  }

  async saveToFile(filename, data) {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('保存到文件失败:', error);
      return false;
    }
  }

  checkStorageAvailable() {
    try {
      const testKey = this.storagePrefix + 'test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('LocalStorage 不可用:', e);
      return false;
    }
  }

  clearAllSaves() {
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.storagePrefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log(`已清除 ${keysToRemove.length} 个存档`);
  }

  getStorageUsage() {
    let totalSize = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += key.length + value.length;
        }
      }
    }
    
    return {
      bytes: totalSize,
      kilobytes: (totalSize / 1024).toFixed(2),
      megabytes: (totalSize / 1024 / 1024).toFixed(2)
    };
  }
}

export default SaveManager;
