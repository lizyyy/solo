import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { REPAIR_STATUS, RISK_STATUS, RISK_TYPE } from '../context/PhotoScanContext';

class DataService {
  constructor() {
    this.storageKey = 'photoScanState';
  }

  saveState(state) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('保存状态失败', e);
      return false;
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('加载状态失败', e);
    }
    return null;
  }

  exportAsJSON(state) {
    return JSON.stringify(state, null, 2);
  }

  importFromJSON(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error('解析 JSON 失败', e);
      return null;
    }
  }

  createRecord(data) {
    return {
      id: uuidv4(),
      createdTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      updatedTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      boxId: data.boxId || '',
      frameNumber: data.frameNumber || '',
      scanFile: data.scanFile || '',
      scanResolution: data.scanResolution || 0,
      scanFileSize: data.scanFileSize || 0,
      repairStatus: data.repairStatus || REPAIR_STATUS.NOT_REPAIRED,
      repairNotes: data.repairNotes || '',
      deliveryFile: data.deliveryFile || '',
      responsiblePerson: data.responsiblePerson || '',
      remarks: data.remarks || '',
      reviewed: false,
      reviewStatus: null,
      reviewNotes: ''
    };
  }

  createRisk(data) {
    return {
      id: uuidv4(),
      createdTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      status: RISK_STATUS.PENDING,
      recordId: data.recordId || '',
      riskType: data.riskType || RISK_TYPE.MISSING_FILE,
      description: data.description || '',
      handler: '',
      handledTime: null,
      handleNotes: ''
    };
  }

  generateUniqueId(boxId, frameNumber) {
    return `${boxId}_${frameNumber}`.toUpperCase();
  }
}

export default new DataService();
