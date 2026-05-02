/**
 * 关卡导入校验系统模块
 * 验证关卡数据的完整性和正确性
 */

const ValidationError = {
  MISSING_FIELD: 'missing_field',
  INVALID_TYPE: 'invalid_type',
  INVALID_VALUE: 'invalid_value',
  DUPLICATE_ID: 'duplicate_id',
  TIMELINE_OUT_OF_ORDER: 'timeline_out_of_order',
  INVALID_ACTION: 'invalid_action',
  CONFLICTING_CONDITIONS: 'conflicting_conditions',
  INVALID_TRIAGE_LEVEL: 'invalid_triage_level',
  INVALID_DURATION: 'invalid_duration'
};

const ValidTriageLevels = ['red', 'yellow', 'green', 'observation'];

const ValidActionTypes = [
  'measure_vitals',
  'ecg',
  'blood_test',
  'fluids',
  'call_doctor',
  'isolation',
  'calm_family',
  'discharge'
];

class LevelValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  reset() {
    this.errors = [];
    this.warnings = [];
  }

  addError(errorType, field, message, details = {}) {
    this.errors.push({
      type: errorType,
      field: field,
      message: message,
      details: details,
      severity: 'error'
    });
  }

  addWarning(warningType, field, message, details = {}) {
    this.warnings.push({
      type: warningType,
      field: field,
      message: message,
      details: details,
      severity: 'warning'
    });
  }

  validate(levelData) {
    this.reset();

    if (!levelData || typeof levelData !== 'object') {
      this.addError(
        ValidationError.INVALID_TYPE,
        'root',
        '关卡数据必须是一个对象'
      );
      return this.getResult();
    }

    this.validateBasicInfo(levelData);
    this.validatePatients(levelData);
    this.validateResources(levelData);
    this.validateTriggers(levelData);

    return this.getResult();
  }

  validateBasicInfo(levelData) {
    if (!levelData.id) {
      this.addError(
        ValidationError.MISSING_FIELD,
        'id',
        '关卡ID是必填字段'
      );
    } else if (typeof levelData.id !== 'string') {
      this.addError(
        ValidationError.INVALID_TYPE,
        'id',
        '关卡ID必须是字符串类型'
      );
    }

    if (!levelData.name) {
      this.addError(
        ValidationError.MISSING_FIELD,
        'name',
        '关卡名称是必填字段'
      );
    } else if (typeof levelData.name !== 'string') {
      this.addError(
        ValidationError.INVALID_TYPE,
        'name',
        '关卡名称必须是字符串类型'
      );
    }

    if (levelData.description !== undefined && typeof levelData.description !== 'string') {
      this.addError(
        ValidationError.INVALID_TYPE,
        'description',
        '关卡描述必须是字符串类型'
      );
    }

    if (levelData.duration === undefined) {
      this.addError(
        ValidationError.MISSING_FIELD,
        'duration',
        '关卡持续时间是必填字段'
      );
    } else if (typeof levelData.duration !== 'number') {
      this.addError(
        ValidationError.INVALID_TYPE,
        'duration',
        '关卡持续时间必须是数字类型'
      );
    } else if (levelData.duration < 480 || levelData.duration > 720) {
      this.addWarning(
        ValidationError.INVALID_DURATION,
        'duration',
        '关卡持续时间建议在8-12分钟（480-720秒）之间',
        { current: levelData.duration }
      );
    }
  }

  validatePatients(levelData) {
    if (!levelData.patients) {
      this.addError(
        ValidationError.MISSING_FIELD,
        'patients',
        '患者列表是必填字段'
      );
      return;
    }

    if (!Array.isArray(levelData.patients)) {
      this.addError(
        ValidationError.INVALID_TYPE,
        'patients',
        '患者列表必须是数组类型'
      );
      return;
    }

    if (levelData.patients.length === 0) {
      this.addWarning(
        ValidationError.INVALID_VALUE,
        'patients',
        '患者列表为空，这可能不是预期的'
      );
    }

    const patientIds = new Set();
    let previousArrivalTime = -1;

    for (let i = 0; i < levelData.patients.length; i++) {
      const patient = levelData.patients[i];
      const fieldPrefix = `patients[${i}]`;

      this.validatePatient(patient, fieldPrefix, patientIds);

      if (patient.arrivalTime !== undefined) {
        if (patient.arrivalTime < previousArrivalTime) {
          this.addError(
            ValidationError.TIMELINE_OUT_OF_ORDER,
            `${fieldPrefix}.arrivalTime`,
            `患者到达时间倒序：当前患者到达时间(${patient.arrivalTime})早于前一个患者(${previousArrivalTime})`,
            {
              currentIndex: i,
              currentTime: patient.arrivalTime,
              previousTime: previousArrivalTime
            }
          );
        }
        previousArrivalTime = patient.arrivalTime;
      }
    }
  }

  validatePatient(patient, fieldPrefix, patientIds) {
    if (!patient.id) {
      this.addError(
        ValidationError.MISSING_FIELD,
        `${fieldPrefix}.id`,
        '患者ID是必填字段'
      );
    } else if (typeof patient.id !== 'string') {
      this.addError(
        ValidationError.INVALID_TYPE,
        `${fieldPrefix}.id`,
        '患者ID必须是字符串类型'
      );
    } else {
      if (patientIds.has(patient.id)) {
        this.addError(
          ValidationError.DUPLICATE_ID,
          `${fieldPrefix}.id`,
          `患者ID重复：${patient.id}`,
          { duplicateId: patient.id }
        );
      }
      patientIds.add(patient.id);
    }

    if (patient.arrivalTime === undefined) {
      this.addError(
        ValidationError.MISSING_FIELD,
        `${fieldPrefix}.arrivalTime`,
        '患者到达时间是必填字段'
      );
    } else if (typeof patient.arrivalTime !== 'number') {
      this.addError(
        ValidationError.INVALID_TYPE,
        `${fieldPrefix}.arrivalTime`,
        '患者到达时间必须是数字类型'
      );
    } else if (patient.arrivalTime < 0) {
      this.addError(
        ValidationError.INVALID_VALUE,
        `${fieldPrefix}.arrivalTime`,
        '患者到达时间不能为负数'
      );
    }

    if (!patient.chiefComplaint) {
      this.addError(
        ValidationError.MISSING_FIELD,
        `${fieldPrefix}.chiefComplaint`,
        '患者主诉是必填字段'
      );
    } else if (typeof patient.chiefComplaint !== 'string') {
      this.addError(
        ValidationError.INVALID_TYPE,
        `${fieldPrefix}.chiefComplaint`,
        '患者主诉必须是字符串类型'
      );
    }

    if (patient.vitalSigns !== undefined) {
      if (typeof patient.vitalSigns !== 'object' || patient.vitalSigns === null) {
        this.addError(
          ValidationError.INVALID_TYPE,
          `${fieldPrefix}.vitalSigns`,
          '生命体征必须是对象类型'
        );
      }
    }

    if (patient.riskFactors !== undefined) {
      if (!Array.isArray(patient.riskFactors)) {
        this.addError(
          ValidationError.INVALID_TYPE,
          `${fieldPrefix}.riskFactors`,
          '风险因素必须是数组类型'
        );
      } else {
        for (let i = 0; i < patient.riskFactors.length; i++) {
          if (typeof patient.riskFactors[i] !== 'string') {
            this.addError(
              ValidationError.INVALID_TYPE,
              `${fieldPrefix}.riskFactors[${i}]`,
              '风险因素必须是字符串类型'
            );
          }
        }
      }
    }

    if (!patient.correctTriage) {
      this.addError(
        ValidationError.MISSING_FIELD,
        `${fieldPrefix}.correctTriage`,
        '正确分诊级别是必填字段'
      );
    } else if (!ValidTriageLevels.includes(patient.correctTriage)) {
      this.addError(
        ValidationError.INVALID_TRIAGE_LEVEL,
        `${fieldPrefix}.correctTriage`,
        `无效的分诊级别：${patient.correctTriage}，有效值为：${ValidTriageLevels.join(', ')}`,
        {
          invalidValue: patient.correctTriage,
          validValues: ValidTriageLevels
        }
      );
    }

    if (patient.requiredActions !== undefined) {
      if (!Array.isArray(patient.requiredActions)) {
        this.addError(
          ValidationError.INVALID_TYPE,
          `${fieldPrefix}.requiredActions`,
          '必要动作必须是数组类型'
        );
      } else {
        for (let i = 0; i < patient.requiredActions.length; i++) {
          const action = patient.requiredActions[i];
          if (!ValidActionTypes.includes(action)) {
            this.addError(
              ValidationError.INVALID_ACTION,
              `${fieldPrefix}.requiredActions[${i}]`,
              `无效的动作类型：${action}，有效值为：${ValidActionTypes.join(', ')}`,
              {
                invalidValue: action,
                validValues: ValidActionTypes
              }
            );
          }
        }
      }
    }

    if (patient.deteriorationTime !== undefined) {
      if (typeof patient.deteriorationTime !== 'number') {
        this.addError(
          ValidationError.INVALID_TYPE,
          `${fieldPrefix}.deteriorationTime`,
          '恶化时间必须是数字类型'
        );
      } else if (patient.deteriorationTime < 0) {
        this.addError(
          ValidationError.INVALID_VALUE,
          `${fieldPrefix}.deteriorationTime`,
          '恶化时间不能为负数'
        );
      }
    }

    if (patient.needsIsolation !== undefined && typeof patient.needsIsolation !== 'boolean') {
      this.addError(
        ValidationError.INVALID_TYPE,
        `${fieldPrefix}.needsIsolation`,
        '隔离需求必须是布尔类型'
      );
    }
  }

  validateResources(levelData) {
    if (levelData.resources === undefined) {
      return;
    }

    if (typeof levelData.resources !== 'object' || levelData.resources === null) {
      this.addError(
        ValidationError.INVALID_TYPE,
        'resources',
        '资源配置必须是对象类型'
      );
      return;
    }

    const validResourceTypes = [
      'nurse',
      'ecg_machine',
      'lab',
      'doctor',
      'isolation_room'
    ];

    for (const [resourceType, config] of Object.entries(levelData.resources)) {
      if (!validResourceTypes.includes(resourceType)) {
        this.addWarning(
          ValidationError.INVALID_VALUE,
          `resources.${resourceType}`,
          `未知的资源类型：${resourceType}`,
          { unknownType: resourceType }
        );
      }

      if (config.count === undefined) {
        continue;
      }

      if (typeof config.count !== 'number') {
        this.addError(
          ValidationError.INVALID_TYPE,
          `resources.${resourceType}.count`,
          '资源数量必须是数字类型'
        );
      } else if (config.count < 0) {
        this.addError(
          ValidationError.INVALID_VALUE,
          `resources.${resourceType}.count`,
          '资源数量不能为负数'
        );
      }
    }
  }

  validateTriggers(levelData) {
    if (levelData.triggers === undefined) {
      return;
    }

    if (!Array.isArray(levelData.triggers)) {
      this.addError(
        ValidationError.INVALID_TYPE,
        'triggers',
        '触发器必须是数组类型'
      );
      return;
    }

    for (let i = 0; i < levelData.triggers.length; i++) {
      const trigger = levelData.triggers[i];
      const fieldPrefix = `triggers[${i}]`;

      if (!trigger.condition) {
        this.addError(
          ValidationError.MISSING_FIELD,
          `${fieldPrefix}.condition`,
          '触发器条件是必填字段'
        );
      }

      if (!trigger.action) {
        this.addError(
          ValidationError.MISSING_FIELD,
          `${fieldPrefix}.action`,
          '触发器动作是必填字段'
        );
      }

      if (trigger.condition && trigger.action) {
        this.validateTriggerConditionConflict(trigger, fieldPrefix, levelData.triggers, i);
      }
    }
  }

  validateTriggerConditionConflict(trigger, fieldPrefix, allTriggers, currentIndex) {
    for (let j = 0; j < currentIndex; j++) {
      const otherTrigger = allTriggers[j];

      if (this.haveConflictingConditions(trigger, otherTrigger)) {
        this.addError(
          ValidationError.CONFLICTING_CONDITIONS,
          fieldPrefix,
          `触发器与索引为${j}的触发器条件冲突`,
          {
            currentIndex: currentIndex,
            conflictingIndex: j,
            currentCondition: trigger.condition,
            conflictingCondition: otherTrigger.condition
          }
        );
      }
    }
  }

  haveConflictingConditions(trigger1, trigger2) {
    const cond1 = trigger1.condition;
    const cond2 = trigger2.condition;

    if (cond1.type !== cond2.type) {
      return false;
    }

    if (cond1.type === 'time') {
      const timeOverlap = this.timeRangesOverlap(
        cond1.startTime, cond1.endTime,
        cond2.startTime, cond2.endTime
      );

      if (timeOverlap && trigger1.action === trigger2.action) {
        return true;
      }
    }

    if (cond1.type === 'patient_state' && cond1.patientId === cond2.patientId) {
      if (cond1.state === cond2.state) {
        return true;
      }
    }

    return false;
  }

  timeRangesOverlap(start1, end1, start2, end2) {
    const s1 = start1 || 0;
    const e1 = end1 || Infinity;
    const s2 = start2 || 0;
    const e2 = end2 || Infinity;

    return s1 < e2 && s2 < e1;
  }

  getResult() {
    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
      errorCount: this.errors.length,
      warningCount: this.warnings.length
    };
  }

  getErrorMessage(result) {
    if (result.valid) {
      return '关卡数据验证通过';
    }

    const messages = result.errors.map((error, index) => {
      return `${index + 1}. [${error.field}] ${error.message}`;
    });

    return `验证失败，发现 ${result.errorCount} 个错误：\n${messages.join('\n')}`;
  }
}

function validateLevel(levelData) {
  const validator = new LevelValidator();
  return validator.validate(levelData);
}

export {
  LevelValidator,
  ValidationError,
  ValidTriageLevels,
  ValidActionTypes,
  validateLevel
};
