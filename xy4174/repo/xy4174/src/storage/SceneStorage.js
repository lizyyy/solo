import { SceneModel, sceneManager } from '../models/SceneModel.js';

class SceneStorage {
  constructor() {
    this.storageKeyPrefix = 'hanging_point_sandbox_';
    this.sceneListKey = this.storageKeyPrefix + 'scene_list';
    this.autoSaveKey = this.storageKeyPrefix + 'auto_save';
    this.autoSaveInterval = null;
    this.autoSaveEnabled = true;
    this.autoSaveDelay = 5000;
  }

  saveToLocalStorage(scene = null, key = null) {
    const targetScene = scene || sceneManager.currentScene;
    const targetKey = key || this.autoSaveKey;

    try {
      const sceneData = targetScene.toJSON();
      const jsonString = JSON.stringify(sceneData, null, 2);
      localStorage.setItem(targetKey, jsonString);
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }

  loadFromLocalStorage(key = null) {
    const targetKey = key || this.autoSaveKey;

    try {
      const jsonString = localStorage.getItem(targetKey);
      if (!jsonString) {
        return null;
      }

      const sceneData = JSON.parse(jsonString);
      const scene = SceneModel.fromJSON(sceneData);
      return scene;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  saveSceneToList(scene = null, name = null) {
    const targetScene = scene || sceneManager.currentScene;
    const sceneName = name || targetScene.name;

    try {
      let sceneList = this.getSceneList();
      const existingIndex = sceneList.findIndex(s => s.id === targetScene.id);

      const sceneInfo = {
        id: targetScene.id,
        name: sceneName,
        description: targetScene.description,
        createdAt: targetScene.createdAt,
        modifiedAt: targetScene.modifiedAt,
        storageKey: this.storageKeyPrefix + 'scene_' + targetScene.id
      };

      if (existingIndex >= 0) {
        sceneList[existingIndex] = sceneInfo;
      } else {
        sceneList.push(sceneInfo);
      }

      localStorage.setItem(this.sceneListKey, JSON.stringify(sceneList));
      this.saveToLocalStorage(targetScene, sceneInfo.storageKey);

      return true;
    } catch (error) {
      console.error('Failed to save scene to list:', error);
      return false;
    }
  }

  loadSceneFromList(sceneId) {
    try {
      const sceneList = this.getSceneList();
      const sceneInfo = sceneList.find(s => s.id === sceneId);

      if (!sceneInfo) {
        console.error('Scene not found in list:', sceneId);
        return null;
      }

      return this.loadFromLocalStorage(sceneInfo.storageKey);
    } catch (error) {
      console.error('Failed to load scene from list:', error);
      return null;
    }
  }

  deleteSceneFromList(sceneId) {
    try {
      let sceneList = this.getSceneList();
      const sceneInfo = sceneList.find(s => s.id === sceneId);

      if (sceneInfo) {
        localStorage.removeItem(sceneInfo.storageKey);
      }

      sceneList = sceneList.filter(s => s.id !== sceneId);
      localStorage.setItem(this.sceneListKey, JSON.stringify(sceneList));

      return true;
    } catch (error) {
      console.error('Failed to delete scene from list:', error);
      return false;
    }
  }

  getSceneList() {
    try {
      const jsonString = localStorage.getItem(this.sceneListKey);
      if (!jsonString) {
        return [];
      }
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Failed to get scene list:', error);
      return [];
    }
  }

  exportToJSONFile(scene = null) {
    const targetScene = scene || sceneManager.currentScene;

    try {
      const sceneData = targetScene.toJSON();
      const jsonString = JSON.stringify(sceneData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${targetScene.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Failed to export JSON file:', error);
      return false;
    }
  }

  importFromJSONFile(file, callback) {
    if (!file) {
      callback(null, 'No file provided');
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const jsonString = e.target.result;
        const sceneData = JSON.parse(jsonString);
        const scene = SceneModel.fromJSON(sceneData);
        callback(scene, null);
      } catch (error) {
        console.error('Failed to import JSON file:', error);
        callback(null, error.message);
      }
    };

    reader.onerror = () => {
      callback(null, 'File read error');
    };

    reader.readAsText(file);
  }

  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    if (this.autoSaveEnabled) {
      this.autoSaveInterval = setInterval(() => {
        this.saveToLocalStorage();
      }, this.autoSaveDelay);
    }
  }

  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  setAutoSaveEnabled(enabled) {
    this.autoSaveEnabled = enabled;
    if (enabled) {
      this.startAutoSave();
    } else {
      this.stopAutoSave();
    }
  }

  hasAutoSave() {
    return localStorage.getItem(this.autoSaveKey) !== null;
  }

  clearAutoSave() {
    localStorage.removeItem(this.autoSaveKey);
  }

  clearAllData() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.storageKeyPrefix));
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }

  createSceneBackup(scene = null) {
    const targetScene = scene || sceneManager.currentScene;
    const backupKey = this.storageKeyPrefix + 'backup_' + Date.now();
    return this.saveToLocalStorage(targetScene, backupKey);
  }

  getBackups() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.storageKeyPrefix + 'backup_'));
    return keys.map(key => ({
      key: key,
      timestamp: parseInt(key.split('_').pop()),
      date: new Date(parseInt(key.split('_').pop()))
    })).sort((a, b) => b.timestamp - a.timestamp);
  }

  restoreBackup(backupKey) {
    return this.loadFromLocalStorage(backupKey);
  }

  deleteBackup(backupKey) {
    localStorage.removeItem(backupKey);
  }

  getStorageInfo() {
    let totalSize = 0;
    let sceneCount = 0;
    let backupCount = 0;

    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.storageKeyPrefix));
    
    for (const key of keys) {
      try {
        const value = localStorage.getItem(key);
        totalSize += value.length * 2;

        if (key.startsWith(this.storageKeyPrefix + 'scene_')) {
          sceneCount++;
        } else if (key.startsWith(this.storageKeyPrefix + 'backup_')) {
          backupCount++;
        }
      } catch (e) {
        // Ignore errors
      }
    }

    return {
      totalSize: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      sceneCount: sceneCount,
      backupCount: backupCount,
      hasAutoSave: this.hasAutoSave()
    };
  }
}

const sceneStorage = new SceneStorage();

export {
  SceneStorage,
  sceneStorage
};
