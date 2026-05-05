const STORAGE_KEYS = {
  CURRENT_DRAFT_ID: 'procurement_current_draft_id',
  CURRENT_STEP: 'procurement_current_step',
  UNSAVED_DATA: 'procurement_unsaved_data',
  DRAFT_VERSION: 'procurement_draft_version',
  SCHEMA_VERSION: 'procurement_schema_version',
  LAST_SAVE_TIME: 'procurement_last_save_time',
};

const AUTO_SAVE_INTERVAL = 30000;

class LocalStorageManager {
  constructor() {
    this.storage = window.localStorage;
  }

  get(key) {
    try {
      const value = this.storage.getItem(key);
      if (value === null) return null;
      return JSON.parse(value);
    } catch (e) {
      return this.storage.getItem(key);
    }
  }

  set(key, value) {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      this.storage.setItem(key, serialized);
      return true;
    } catch (e) {
      console.error('Storage save error:', e);
      return false;
    }
  }

  remove(key) {
    this.storage.removeItem(key);
  }

  clearDraftState() {
    Object.values(STORAGE_KEYS).forEach(key => {
      this.remove(key);
    });
  }

  getCurrentDraftId() {
    return this.get(STORAGE_KEYS.CURRENT_DRAFT_ID);
  }

  setCurrentDraftId(id) {
    return this.set(STORAGE_KEYS.CURRENT_DRAFT_ID, id);
  }

  getCurrentStep() {
    return this.get(STORAGE_KEYS.CURRENT_STEP) || 0;
  }

  setCurrentStep(step) {
    return this.set(STORAGE_KEYS.CURRENT_STEP, step);
  }

  getUnsavedData() {
    return this.get(STORAGE_KEYS.UNSAVED_DATA);
  }

  setUnsavedData(data) {
    return this.set(STORAGE_KEYS.UNSAVED_DATA, data);
  }

  getDraftVersion() {
    return this.get(STORAGE_KEYS.DRAFT_VERSION) || 1;
  }

  setDraftVersion(version) {
    return this.set(STORAGE_KEYS.DRAFT_VERSION, version);
  }

  getLastSaveTime() {
    return this.get(STORAGE_KEYS.LAST_SAVE_TIME);
  }

  setLastSaveTime(time) {
    return this.set(STORAGE_KEYS.LAST_SAVE_TIME, time);
  }
}

class AutoSaveManager {
  constructor(wizard, apiClient) {
    this.wizard = wizard;
    this.api = apiClient;
    this.storage = new LocalStorageManager();
    this.intervalId = null;
    this.isSaving = false;
    this.hasUnsyncedChanges = false;
  }

  start() {
    if (this.intervalId) return;
    
    console.log('Auto-save started, interval:', AUTO_SAVE_INTERVAL);
    this.intervalId = setInterval(() => this.autoSave(), AUTO_SAVE_INTERVAL);
    
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsyncedChanges) {
        const saved = this.tryLocalSave();
        if (!saved) {
          e.preventDefault();
          e.returnValue = '您有未保存的更改，确定要离开吗？';
          return e.returnValue;
        }
      }
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Auto-save stopped');
    }
  }

  markAsChanged() {
    this.hasUnsyncedChanges = true;
  }

  async autoSave() {
    if (this.isSaving || !this.hasUnsyncedChanges) return;
    
    const draftId = this.storage.getCurrentDraftId();
    if (!draftId) return;

    this.isSaving = true;
    this.wizard.updateSaveStatus('saving');

    try {
      const data = this.wizard.collectFormData();
      const currentStep = this.wizard.getCurrentStep();
      const version = this.storage.getDraftVersion();

      const result = await this.api.updateDraft(draftId, data, {
        current_step: currentStep,
        version: version,
        isAutoSave: true,
      });

      if (result.success) {
        this.storage.setDraftVersion(result.data.version);
        this.storage.setLastSaveTime(result.data.updated_at);
        this.hasUnsyncedChanges = false;
        this.wizard.updateSaveStatus('saved');
        console.log('Auto-save successful');
      }
    } catch (error) {
      if (error.isConflict && error.isConflict()) {
        this.wizard.handleConflict(error);
      } else {
        console.error('Auto-save failed:', error);
        this.tryLocalSave();
        this.wizard.updateSaveStatus('error');
      }
    } finally {
      this.isSaving = false;
    }
  }

  tryLocalSave() {
    try {
      const data = this.wizard.collectFormData();
      const currentStep = this.wizard.getCurrentStep();
      
      this.storage.setUnsavedData({
        data,
        currentStep,
        timestamp: Date.now(),
      });
      
      console.log('Saved to local storage');
      return true;
    } catch (e) {
      console.error('Local save failed:', e);
      return false;
    }
  }

  async manualSave() {
    if (this.isSaving) return;
    
    const draftId = this.storage.getCurrentDraftId();
    if (!draftId) return;

    this.isSaving = true;
    this.wizard.updateSaveStatus('saving');

    try {
      const data = this.wizard.collectFormData();
      const currentStep = this.wizard.getCurrentStep();
      const version = this.storage.getDraftVersion();

      const result = await this.api.updateDraft(draftId, data, {
        current_step: currentStep,
        version: version,
        isAutoSave: false,
      });

      if (result.success) {
        this.storage.setDraftVersion(result.data.version);
        this.storage.setLastSaveTime(result.data.updated_at);
        this.hasUnsyncedChanges = false;
        this.wizard.updateSaveStatus('saved');
        console.log('Manual save successful');
        return true;
      }
    } catch (error) {
      if (error.isConflict && error.isConflict()) {
        this.wizard.handleConflict(error);
      } else {
        console.error('Manual save failed:', error);
        this.wizard.updateSaveStatus('error');
      }
    } finally {
      this.isSaving = false;
    }
    return false;
  }
}

const storage = new LocalStorageManager();
