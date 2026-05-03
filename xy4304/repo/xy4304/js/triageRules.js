/**
 * 分诊规则判定模块
 * 负责验证患者分诊是否正确，检测风险因素，提供提示信息
 */

export const triageRules = {
  /**
   * 检查患者分诊是否正确
   * @param {Object} patient - 患者信息对象
   * @param {string} selectedZone - 选择的分诊区域（red/yellow/green/black）
   * @returns {Object} 包含是否正确、错误信息、提示信息的对象
   */
  validateTriage(patient, selectedZone) {
    const correctZone = patient.correctTriage;
    const isCorrect = selectedZone === correctZone;
    
    let errorMessage = '';
    let warnings = [];
    let riskHints = [];
    
    // 检查风险因素
    riskHints = this.checkRiskFactors(patient);
    
    // 如果分诊错误，生成错误信息
    if (!isCorrect) {
      errorMessage = this.generateErrorMessage(patient, selectedZone, correctZone);
      
      // 检查是否有严重错误（如将红区患者分到绿区）
      const severityError = this.checkSeverityError(selectedZone, correctZone);
      if (severityError) {
        errorMessage = `${errorMessage} ${severityError}`;
      }
    }
    
    // 检查特殊提示情况
    const specialHints = this.checkSpecialHints(patient, selectedZone);
    warnings = [...warnings, ...specialHints];
    
    return {
      isCorrect,
      errorMessage,
      warnings,
      riskHints,
      correctZone
    };
  },
  
  /**
   * 检查患者的风险因素
   * @param {Object} patient - 患者信息对象
   * @returns {Array} 风险提示列表
   */
  checkRiskFactors(patient) {
    const hints = [];
    const { chiefComplaint, vitalSigns, age } = patient;
    
    // 胸痛伴低血压
    if (
      chiefComplaint.includes('胸痛') && 
      vitalSigns.bloodPressure.systolic < 90
    ) {
      hints.push('⚠️ 胸痛伴低血压：提示可能为急性心肌梗死或主动脉夹层，需紧急处理！');
    }
    
    // 儿童高热
    if (
      age < 14 && 
      vitalSigns.temperature > 39
    ) {
      hints.push('⚠️ 儿童高热：需警惕热性惊厥，触发复测提示！');
    }
    
    // 意识改变伴发热
    if (
      chiefComplaint.includes('意识') || 
      chiefComplaint.includes('昏迷') ||
      chiefComplaint.includes('嗜睡')
    ) {
      if (vitalSigns.temperature > 38.5) {
        hints.push('⚠️ 意识改变伴发热：提示可能为中枢神经系统感染！');
      }
    }
    
    // 外伤伴低血压
    if (
      (chiefComplaint.includes('外伤') || 
       chiefComplaint.includes('车祸') ||
       chiefComplaint.includes('坠落')) &&
      vitalSigns.bloodPressure.systolic < 90
    ) {
      hints.push('⚠️ 外伤伴低血压：提示可能为失血性休克！');
    }
    
    // 过敏史提示
    if (patient.allergies && patient.allergies.length > 0) {
      hints.push(`ℹ️ 过敏史：${patient.allergies.join('、')}，用药需注意！`);
    }
    
    // 呼吸困难伴低氧
    if (
      (chiefComplaint.includes('呼吸困难') || 
       chiefComplaint.includes('气促')) &&
      vitalSigns.oxygenSaturation < 92
    ) {
      hints.push('⚠️ 呼吸困难伴低氧血症：需紧急处理！');
    }
    
    // 高龄患者
    if (age > 75) {
      hints.push('ℹ️ 高龄患者：病情变化可能较快，需密切观察！');
    }
    
    return hints;
  },
  
  /**
   * 检查严重程度错误（如将红区患者分到绿区）
   * @param {string} selectedZone - 选择的分诊区域
   * @param {string} correctZone - 正确的分诊区域
   * @returns {string|null} 严重错误信息，如果没有则返回null
   */
  checkSeverityError(selectedZone, correctZone) {
    const zoneSeverity = {
      'red': 4,
      'yellow': 3,
      'green': 2,
      'black': 1
    };
    
    const selectedSeverity = zoneSeverity[selectedZone];
    const correctSeverity = zoneSeverity[correctZone];
    
    // 如果差距超过2个等级（如红区分到绿区，或黄区分到黑区）
    if (Math.abs(selectedSeverity - correctSeverity) >= 2) {
      if (selectedSeverity < correctSeverity) {
        return '严重错误：低估了患者病情严重程度！';
      } else {
        return '注意：高估了患者病情严重程度，可能导致医疗资源浪费。';
      }
    }
    
    return null;
  },
  
  /**
   * 检查特殊提示情况
   * @param {Object} patient - 患者信息对象
   * @param {string} selectedZone - 选择的分诊区域
   * @returns {Array} 特殊提示列表
   */
  checkSpecialHints(patient, selectedZone) {
    const hints = [];
    
    // 示例：如果患者有胸痛但分到了黄区，提醒需要密切观察
    if (
      patient.chiefComplaint.includes('胸痛') && 
      selectedZone === 'yellow'
    ) {
      hints.push('提示：胸痛患者即使生命体征稳定，也需密切观察病情变化！');
    }
    
    // 示例：如果患者有过敏史，提醒在任何区域都需要注意
    if (patient.allergies && patient.allergies.length > 0) {
      hints.push('提示：无论分诊到哪个区域，都需注意患者的过敏史！');
    }
    
    return hints;
  },
  
  /**
   * 生成错误信息
   * @param {Object} patient - 患者信息对象
   * @param {string} selectedZone - 选择的分诊区域
   * @param {string} correctZone - 正确的分诊区域
   * @returns {string} 错误信息
   */
  generateErrorMessage(patient, selectedZone, correctZone) {
    const zoneNames = {
      'red': '红区（紧急）',
      'yellow': '黄区（较重）',
      'green': '绿区（普通）',
      'black': '黑区（死亡/濒死）'
    };
    
    const selectedName = zoneNames[selectedZone];
    const correctName = zoneNames[correctZone];
    
    let reason = '';
    
    // 根据患者情况生成具体的错误原因
    if (correctZone === 'red') {
      reason = this.getRedZoneReason(patient);
    } else if (correctZone === 'yellow') {
      reason = this.getYellowZoneReason(patient);
    } else if (correctZone === 'green') {
      reason = this.getGreenZoneReason(patient);
    } else if (correctZone === 'black') {
      reason = this.getBlackZoneReason(patient);
    }
    
    return `错误：将患者分诊到${selectedName}，但正确分诊应为${correctName}。${reason}`;
  },
  
  /**
   * 获取红区分诊原因
   * @param {Object} patient - 患者信息对象
   * @returns {string} 原因描述
   */
  getRedZoneReason(patient) {
    const { vitalSigns, chiefComplaint } = patient;
    
    if (vitalSigns.bloodPressure.systolic < 90) {
      return '患者存在低血压（休克），属于紧急情况。';
    }
    
    if (vitalSigns.oxygenSaturation < 90) {
      return '患者血氧饱和度严重降低，属于紧急情况。';
    }
    
    if (chiefComplaint.includes('胸痛') && vitalSigns.bloodPressure.systolic < 90) {
      return '胸痛伴低血压提示可能为急性心肌梗死或主动脉夹层，需紧急处理。';
    }
    
    if (chiefComplaint.includes('昏迷') || chiefComplaint.includes('意识不清')) {
      return '患者意识障碍，属于紧急情况。';
    }
    
    return '根据患者病情，应分诊到红区进行紧急处理。';
  },
  
  /**
   * 获取黄区分诊原因
   * @param {Object} patient - 患者信息对象
   * @returns {string} 原因描述
   */
  getYellowZoneReason(patient) {
    const { vitalSigns, chiefComplaint, age } = patient;
    
    if (vitalSigns.temperature > 39) {
      if (age < 14) {
        return '儿童高热需警惕热性惊厥，应分诊到黄区优先处理。';
      }
      return '患者高热，需优先处理。';
    }
    
    if (chiefComplaint.includes('胸痛') && vitalSigns.bloodPressure.systolic >= 90) {
      return '胸痛患者即使生命体征稳定，也需优先处理。';
    }
    
    if (chiefComplaint.includes('腹痛') && chiefComplaint.includes('剧烈')) {
      return '剧烈腹痛可能为急腹症，需优先处理。';
    }
    
    return '根据患者病情，应分诊到黄区优先处理。';
  },
  
  /**
   * 获取绿区分诊原因
   * @param {Object} patient - 患者信息对象
   * @returns {string} 原因描述
   */
  getGreenZoneReason(patient) {
    const { vitalSigns, chiefComplaint } = patient;
    
    if (
      vitalSigns.temperature < 38 &&
      vitalSigns.bloodPressure.systolic >= 90 &&
      vitalSigns.bloodPressure.systolic < 140 &&
      vitalSigns.oxygenSaturation >= 95
    ) {
      return '患者生命体征稳定，病情较轻。';
    }
    
    if (
      chiefComplaint.includes('感冒') || 
      chiefComplaint.includes('咳嗽') ||
      chiefComplaint.includes('鼻塞')
    ) {
      return '患者症状较轻，属于常规就诊。';
    }
    
    return '根据患者病情，应分诊到绿区常规处理。';
  },
  
  /**
   * 获取黑区分诊原因
   * @param {Object} patient - 患者信息对象
   * @returns {string} 原因描述
   */
  getBlackZoneReason(patient) {
    const { vitalSigns, chiefComplaint } = patient;
    
    if (
      vitalSigns.pulse === 0 && 
      vitalSigns.respiration === 0
    ) {
      return '患者无生命体征，已死亡。';
    }
    
    if (chiefComplaint.includes('死亡') || chiefComplaint.includes('遗体')) {
      return '患者已死亡。';
    }
    
    return '根据患者情况，应分诊到黑区。';
  },
  
  /**
   * 计算分诊得分
   * @param {Object} validationResult - 验证结果对象
   * @param {number} comboCount - 当前连击数
   * @returns {Object} 包含得分变化和连击变化的对象
   */
  calculateScore(validationResult, comboCount) {
    let scoreChange = 0;
    let newCombo = comboCount;
    
    if (validationResult.isCorrect) {
      // 基础分
      scoreChange = 100;
      
      // 连击加成
      if (comboCount > 0) {
        const comboBonus = Math.min(comboCount * 10, 50); // 最多加50分
        scoreChange += comboBonus;
      }
      
      // 增加连击
      newCombo = comboCount + 1;
    } else {
      // 错误扣分
      scoreChange = -50;
      
      // 严重错误额外扣分
      if (validationResult.errorMessage.includes('严重错误')) {
        scoreChange -= 100;
      }
      
      // 重置连击
      newCombo = 0;
    }
    
    return {
      scoreChange,
      newCombo
    };
  },
  
  /**
   * 获取分诊区域优先级
   * @param {string} zone - 分诊区域
   * @returns {number} 优先级数值（越高越紧急）
   */
  getZonePriority(zone) {
    const priorities = {
      'red': 4,
      'yellow': 3,
      'green': 2,
      'black': 1
    };
    return priorities[zone] || 0;
  },
  
  /**
   * 判断是否需要复测
   * @param {Object} patient - 患者信息对象
   * @returns {boolean} 是否需要复测
   */
  needsRecheck(patient) {
    // 儿童高热需要复测
    if (patient.age < 14 && patient.vitalSigns.temperature > 39) {
      return true;
    }
    
    // 低血压患者需要复测
    if (patient.vitalSigns.bloodPressure.systolic < 90) {
      return true;
    }
    
    // 血氧饱和度低的患者需要复测
    if (patient.vitalSigns.oxygenSaturation < 92) {
      return true;
    }
    
    return false;
  }
};

export default triageRules;
