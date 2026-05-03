/**
 * 关卡加载模块
 * 负责加载、验证和管理关卡数据
 */

export const levelLoader = {
  // 缓存已加载的关卡数据
  _cache: new Map(),
  
  // 默认关卡路径
  _defaultLevelPath: 'levels/',
  
  /**
   * 加载单个关卡
   * @param {string} levelId - 关卡ID（对应文件名，不含.json）
   * @returns {Promise<Object>} 关卡数据对象
   */
  async loadLevel(levelId) {
    // 检查缓存
    if (this._cache.has(levelId)) {
      return this._cache.get(levelId);
    }
    
    try {
      const response = await fetch(`${this._defaultLevelPath}${levelId}.json`);
      
      if (!response.ok) {
        throw new Error(`无法加载关卡 ${levelId}: ${response.status} ${response.statusText}`);
      }
      
      const levelData = await response.json();
      
      // 验证关卡数据
      const validation = this.validateLevel(levelData);
      if (!validation.isValid) {
        throw new Error(`关卡 ${levelId} 数据无效: ${validation.error}`);
      }
      
      // 缓存关卡数据
      this._cache.set(levelId, levelData);
      
      return levelData;
    } catch (error) {
      console.error(`加载关卡 ${levelId} 失败:`, error);
      throw error;
    }
  },
  
  /**
   * 加载多个关卡
   * @param {Array<string>} levelIds - 关卡ID数组
   * @returns {Promise<Array<Object>>} 关卡数据数组
   */
  async loadLevels(levelIds) {
    const promises = levelIds.map(id => this.loadLevel(id));
    return Promise.all(promises);
  },
  
  /**
   * 获取所有可用关卡列表
   * 注意：由于浏览器安全限制，此方法依赖于预定义的关卡列表
   * @returns {Array<Object>} 关卡列表（包含id、name、description）
   */
  getAvailableLevels() {
    // 预定义的关卡列表
    return [
      {
        id: 'basic',
        name: '基础关卡',
        description: '适合初学者，包含常见的急诊病例，帮助掌握基本分诊规则。',
        difficulty: '简单',
        estimatedTime: '5分钟'
      },
      {
        id: 'intermediate',
        name: '中级关卡',
        description: '包含更多复杂病例，需要综合判断生命体征和症状。',
        difficulty: '中等',
        estimatedTime: '8分钟'
      },
      {
        id: 'advanced',
        name: '高级关卡',
        description: '高难度关卡，包含罕见病例和紧急情况，考验应急处理能力。',
        difficulty: '困难',
        estimatedTime: '10分钟'
      }
    ];
  },
  
  /**
   * 验证关卡数据的有效性
   * @param {Object} levelData - 关卡数据对象
   * @returns {Object} 包含isValid和error字段的验证结果
   */
  validateLevel(levelData) {
    try {
      // 检查必要的顶层字段
      if (!levelData.name) {
        return { isValid: false, error: '缺少必要字段: name' };
      }
      
      if (!levelData.timeLimit || typeof levelData.timeLimit !== 'number' || levelData.timeLimit <= 0) {
        return { isValid: false, error: 'timeLimit 必须是大于0的数字' };
      }
      
      if (!levelData.patients || !Array.isArray(levelData.patients) || levelData.patients.length === 0) {
        return { isValid: false, error: 'patients 必须是非空数组' };
      }
      
      // 验证每个患者数据
      const validTriageZones = ['red', 'yellow', 'green', 'black'];
      
      for (let i = 0; i < levelData.patients.length; i++) {
        const patient = levelData.patients[i];
        const index = i + 1;
        
        // 检查必要字段
        if (!patient.id) {
          return { isValid: false, error: `患者 ${index} 缺少必要字段: id` };
        }
        
        if (!patient.name) {
          return { isValid: false, error: `患者 ${index} 缺少必要字段: name` };
        }
        
        if (!patient.age || typeof patient.age !== 'number' || patient.age < 0) {
          return { isValid: false, error: `患者 ${index} 的 age 必须是非负数字` };
        }
        
        if (!patient.gender || !['男', '女'].includes(patient.gender)) {
          return { isValid: false, error: `患者 ${index} 的 gender 必须是"男"或"女"` };
        }
        
        if (!patient.chiefComplaint) {
          return { isValid: false, error: `患者 ${index} 缺少必要字段: chiefComplaint` };
        }
        
        // 验证生命体征
        if (!patient.vitalSigns) {
          return { isValid: false, error: `患者 ${index} 缺少必要字段: vitalSigns` };
        }
        
        const { vitalSigns } = patient;
        
        if (vitalSigns.temperature === undefined || vitalSigns.temperature < 30 || vitalSigns.temperature > 45) {
          return { isValid: false, error: `患者 ${index} 的 temperature 必须在30-45范围内` };
        }
        
        if (vitalSigns.pulse === undefined || vitalSigns.pulse < 0 || vitalSigns.pulse > 250) {
          return { isValid: false, error: `患者 ${index} 的 pulse 必须在0-250范围内` };
        }
        
        if (vitalSigns.respiration === undefined || vitalSigns.respiration < 0 || vitalSigns.respiration > 60) {
          return { isValid: false, error: `患者 ${index} 的 respiration 必须在0-60范围内` };
        }
        
        if (!vitalSigns.bloodPressure) {
          return { isValid: false, error: `患者 ${index} 缺少必要字段: vitalSigns.bloodPressure` };
        }
        
        if (vitalSigns.bloodPressure.systolic === undefined || 
            vitalSigns.bloodPressure.systolic < 0 || 
            vitalSigns.bloodPressure.systolic > 250) {
          return { isValid: false, error: `患者 ${index} 的 systolic 必须在0-250范围内` };
        }
        
        if (vitalSigns.bloodPressure.diastolic === undefined || 
            vitalSigns.bloodPressure.diastolic < 0 || 
            vitalSigns.bloodPressure.diastolic > 150) {
          return { isValid: false, error: `患者 ${index} 的 diastolic 必须在0-150范围内` };
        }
        
        if (vitalSigns.oxygenSaturation === undefined || 
            vitalSigns.oxygenSaturation < 0 || 
            vitalSigns.oxygenSaturation > 100) {
          return { isValid: false, error: `患者 ${index} 的 oxygenSaturation 必须在0-100范围内` };
        }
        
        // 验证过敏史
        if (patient.allergies !== undefined && !Array.isArray(patient.allergies)) {
          return { isValid: false, error: `患者 ${index} 的 allergies 必须是数组` };
        }
        
        // 验证正确分诊区域
        if (!patient.correctTriage || !validTriageZones.includes(patient.correctTriage)) {
          return { isValid: false, error: `患者 ${index} 的 correctTriage 必须是 ${validTriageZones.join('、')} 之一` };
        }
        
        // 验证风险因素（可选）
        if (patient.riskFactors !== undefined && !Array.isArray(patient.riskFactors)) {
          return { isValid: false, error: `患者 ${index} 的 riskFactors 必须是数组` };
        }
      }
      
      // 检查患者ID是否唯一
      const patientIds = levelData.patients.map(p => p.id);
      const uniqueIds = new Set(patientIds);
      
      if (uniqueIds.size !== patientIds.length) {
        const duplicates = patientIds.filter((id, index) => patientIds.indexOf(id) !== index);
        return { isValid: false, error: `存在重复的患者ID: ${duplicates.join('、')}` };
      }
      
      return { isValid: true, error: null };
    } catch (error) {
      return { isValid: false, error: `验证过程中发生错误: ${error.message}` };
    }
  },
  
  /**
   * 从关卡数据中获取患者列表
   * @param {Object} levelData - 关卡数据对象
   * @returns {Array<Object>} 患者列表
   */
  getPatients(levelData) {
    return levelData.patients || [];
  },
  
  /**
   * 获取关卡的时间限制
   * @param {Object} levelData - 关卡数据对象
   * @returns {number} 时间限制（秒）
   */
  getTimeLimit(levelData) {
    return levelData.timeLimit || 300;
  },
  
  /**
   * 格式化时间显示
   * @param {number} seconds - 秒数
   * @returns {string} 格式化的时间字符串（MM:SS）
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },
  
  /**
   * 清除关卡缓存
   * @param {string} [levelId] - 要清除的关卡ID，如果不提供则清除所有缓存
   */
  clearCache(levelId) {
    if (levelId) {
      this._cache.delete(levelId);
    } else {
      this._cache.clear();
    }
  },
  
  /**
   * 获取缓存的关卡数量
   * @returns {number} 缓存的关卡数量
   */
  getCacheSize() {
    return this._cache.size;
  },
  
  /**
   * 检查关卡是否已缓存
   * @param {string} levelId - 关卡ID
   * @returns {boolean} 是否已缓存
   */
  isCached(levelId) {
    return this._cache.has(levelId);
  }
};

export default levelLoader;
