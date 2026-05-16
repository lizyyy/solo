class CompatibilityChecker {
  constructor() {
    this.issues = [];
    this.summary = {
      errors: 0,
      warnings: 0,
      infos: 0,
      total: 0
    };
  }

  toMap(arrOrMap, keyFn) {
    if (arrOrMap instanceof Map) {
      return arrOrMap;
    }
    return new Map(arrOrMap.map(item => [keyFn(item), item]));
  }

  check(oldSnapshot, newData) {
    this.issues = [];
    this.summary = { errors: 0, warnings: 0, infos: 0, total: 0 };

    if (!oldSnapshot) {
      this.addIssue({
        type: 'info',
        code: 'FIRST_SNAPSHOT',
        message: '首次运行，创建初始快照，无历史数据可对比',
        details: {}
      });
      return {
        isCompatible: true,
        issues: this.issues,
        summary: this.summary
      };
    }

    this.checkMessages(oldSnapshot.messages, newData.messages);
    this.checkEnums(oldSnapshot.enums, newData.enums);
    this.checkServices(oldSnapshot.services, newData.services);

    return {
      isCompatible: this.summary.errors === 0,
      issues: this.issues,
      summary: this.summary
    };
  }

  checkMessages(oldMessages, newMessages) {
    const oldMsgMap = new Map(oldMessages.map(m => [m.fullName, m]));
    const newMsgMap = new Map(newMessages.map(m => [m.fullName, m]));

    for (const oldMsg of oldMessages) {
      const newMsg = newMsgMap.get(oldMsg.fullName);
      if (!newMsg) {
        this.addIssue({
          type: 'warning',
          code: 'MESSAGE_REMOVED',
          message: `消息 ${oldMsg.fullName} 被删除`,
          details: {
            messageName: oldMsg.fullName,
            fileName: oldMsg.fileName,
            line: oldMsg.startLine
          }
        });
        continue;
      }

      this.checkMessageFields(oldMsg, newMsg);
    }

    for (const newMsg of newMessages) {
      if (!oldMsgMap.has(newMsg.fullName)) {
        this.addIssue({
          type: 'info',
          code: 'MESSAGE_ADDED',
          message: `新增消息 ${newMsg.fullName}`,
          details: {
            messageName: newMsg.fullName,
            fileName: newMsg.fileName,
            line: newMsg.startLine
          }
        });
      }
    }
  }

  checkMessageFields(oldMsg, newMsg) {
    const oldFields = this.toMap(oldMsg.fields, f => f.number);
    const newFields = this.toMap(newMsg.fields, f => f.number);

    const oldFieldNameMap = new Map();
    const oldFieldNumMap = new Map();
    
    for (const [num, field] of oldFields) {
      oldFieldNameMap.set(field.name, field);
      oldFieldNumMap.set(num, field);
    }

    const newFieldNameMap = new Map();
    const newFieldNumMap = new Map();
    
    for (const [num, field] of newFields) {
      newFieldNameMap.set(field.name, field);
      newFieldNumMap.set(num, field);
    }

    for (const [oldNum, oldField] of oldFields) {
      const newFieldByNum = newFieldNumMap.get(oldNum);
      const newFieldByName = newFieldNameMap.get(oldField.name);

      if (!newFieldByNum && !newFieldByName) {
        this.addIssue({
          type: 'warning',
          code: 'FIELD_REMOVED',
          message: `字段 ${oldMsg.fullName}.${oldField.name} (编号 ${oldNum}) 被删除`,
          details: {
            messageName: oldMsg.fullName,
            fieldName: oldField.name,
            fieldNumber: oldNum,
            fileName: oldField.fileName,
            line: oldField.line,
            field: oldField
          }
        });
        continue;
      }

      if (newFieldByNum && newFieldByNum.name !== oldField.name) {
        this.addIssue({
          type: 'error',
          code: 'FIELD_NUMBER_REUSED',
          message: `字段编号 ${oldNum} 被复用: 原字段 "${oldField.name}" -> 新字段 "${newFieldByNum.name}"`,
          details: {
            messageName: oldMsg.fullName,
            fieldNumber: oldNum,
            oldFieldName: oldField.name,
            newFieldName: newFieldByNum.name,
            oldFileName: oldField.fileName,
            oldLine: oldField.line,
            newFileName: newFieldByNum.fileName,
            newLine: newFieldByNum.line
          }
        });
      }

      if (newFieldByName && newFieldByName.number !== oldNum) {
        this.addIssue({
          type: 'error',
          code: 'FIELD_NUMBER_CHANGED',
          message: `字段 ${oldMsg.fullName}.${oldField.name} 的编号改变: ${oldNum} -> ${newFieldByName.number}`,
          details: {
            messageName: oldMsg.fullName,
            fieldName: oldField.name,
            oldNumber: oldNum,
            newNumber: newFieldByName.number,
            oldFileName: oldField.fileName,
            oldLine: oldField.line,
            newFileName: newFieldByName.fileName,
            newLine: newFieldByName.line
          }
        });
      }

      if (newFieldByNum && newFieldByNum.type !== oldField.type) {
        this.addIssue({
          type: 'error',
          code: 'FIELD_TYPE_CHANGED',
          message: `字段 ${oldMsg.fullName}.${oldField.name} (编号 ${oldNum}) 的类型改变: ${oldField.type} -> ${newFieldByNum.type}`,
          details: {
            messageName: oldMsg.fullName,
            fieldName: oldField.name,
            fieldNumber: oldNum,
            oldType: oldField.type,
            newType: newFieldByNum.type,
            fileName: newFieldByNum.fileName,
            line: newFieldByNum.line
          }
        });
      }

      if (newFieldByNum && newFieldByNum.repeated !== oldField.repeated) {
        this.addIssue({
          type: 'warning',
          code: 'FIELD_REPEATED_CHANGED',
          message: `字段 ${oldMsg.fullName}.${oldField.name} (编号 ${oldNum}) 的 repeated 属性改变`,
          details: {
            messageName: oldMsg.fullName,
            fieldName: oldField.name,
            fieldNumber: oldNum,
            oldRepeated: oldField.repeated,
            newRepeated: newFieldByNum.repeated,
            fileName: newFieldByNum.fileName,
            line: newFieldByNum.line
          }
        });
      }
    }

    for (const [newNum, newField] of newFields) {
      if (!oldFieldNumMap.has(newNum) && !oldFieldNameMap.has(newField.name)) {
        this.addIssue({
          type: 'info',
          code: 'FIELD_ADDED',
          message: `新增字段 ${oldMsg.fullName}.${newField.name} (编号 ${newNum})`,
          details: {
            messageName: oldMsg.fullName,
            fieldName: newField.name,
            fieldNumber: newNum,
            fieldType: newField.type,
            fileName: newField.fileName,
            line: newField.line
          }
        });
      }
    }
  }

  checkEnums(oldEnums, newEnums) {
    const oldEnumMap = new Map(oldEnums.map(e => [e.fullName, e]));
    const newEnumMap = new Map(newEnums.map(e => [e.fullName, e]));

    for (const oldEnum of oldEnums) {
      const newEnum = newEnumMap.get(oldEnum.fullName);
      if (!newEnum) {
        this.addIssue({
          type: 'warning',
          code: 'ENUM_REMOVED',
          message: `枚举 ${oldEnum.fullName} 被删除`,
          details: {
            enumName: oldEnum.fullName,
            fileName: oldEnum.fileName,
            line: oldEnum.startLine
          }
        });
        continue;
      }

      this.checkEnumValues(oldEnum, newEnum);
    }

    for (const newEnum of newEnums) {
      if (!oldEnumMap.has(newEnum.fullName)) {
        this.addIssue({
          type: 'info',
          code: 'ENUM_ADDED',
          message: `新增枚举 ${newEnum.fullName}`,
          details: {
            enumName: newEnum.fullName,
            fileName: newEnum.fileName,
            line: newEnum.startLine
          }
        });
      }
    }
  }

  checkEnumValues(oldEnum, newEnum) {
    const oldValueMap = this.toMap(oldEnum.values, v => v.number);
    const newValueMap = this.toMap(newEnum.values, v => v.number);

    for (const [num, oldValue] of oldValueMap) {
      const newValue = newValueMap.get(num);
      
      if (!newValue) {
        this.addIssue({
          type: 'warning',
          code: 'ENUM_VALUE_REMOVED',
          message: `枚举值 ${oldEnum.fullName}.${oldValue.name} (编号 ${num}) 被删除`,
          details: {
            enumName: oldEnum.fullName,
            valueName: oldValue.name,
            valueNumber: num,
            line: oldValue.line
          }
        });
        continue;
      }

      if (newValue.name !== oldValue.name) {
        this.addIssue({
          type: 'error',
          code: 'ENUM_VALUE_NUMBER_REUSED',
          message: `枚举值编号 ${num} 被复用: 原名称 "${oldValue.name}" -> 新名称 "${newValue.name}"`,
          details: {
            enumName: oldEnum.fullName,
            valueNumber: num,
            oldName: oldValue.name,
            newName: newValue.name,
            oldLine: oldValue.line,
            newLine: newValue.line
          }
        });
      }
    }

    for (const [num, newValue] of newValueMap) {
      if (!oldValueMap.has(num)) {
        this.addIssue({
          type: 'info',
          code: 'ENUM_VALUE_ADDED',
          message: `新增枚举值 ${newEnum.fullName}.${newValue.name} (编号 ${num})`,
          details: {
            enumName: newEnum.fullName,
            valueName: newValue.name,
            valueNumber: num,
            line: newValue.line
          }
        });
      }
    }
  }

  checkServices(oldServices, newServices) {
    const oldSvcMap = new Map(oldServices.map(s => [s.fullName, s]));
    const newSvcMap = new Map(newServices.map(s => [s.fullName, s]));

    for (const oldSvc of oldServices) {
      const newSvc = newSvcMap.get(oldSvc.fullName);
      if (!newSvc) {
        this.addIssue({
          type: 'warning',
          code: 'SERVICE_REMOVED',
          message: `服务 ${oldSvc.fullName} 被删除`,
          details: {
            serviceName: oldSvc.fullName,
            fileName: oldSvc.fileName,
            line: oldSvc.startLine
          }
        });
        continue;
      }

      this.checkServiceMethods(oldSvc, newSvc);
    }

    for (const newSvc of newServices) {
      if (!oldSvcMap.has(newSvc.fullName)) {
        this.addIssue({
          type: 'info',
          code: 'SERVICE_ADDED',
          message: `新增服务 ${newSvc.fullName}`,
          details: {
            serviceName: newSvc.fullName,
            fileName: newSvc.fileName,
            line: newSvc.startLine
          }
        });
      }
    }
  }

  checkServiceMethods(oldSvc, newSvc) {
    const oldMethodMap = this.toMap(oldSvc.methods, m => m.name);
    const newMethodMap = this.toMap(newSvc.methods, m => m.name);

    for (const [name, oldMethod] of oldMethodMap) {
      const newMethod = newMethodMap.get(name);
      
      if (!newMethod) {
        this.addIssue({
          type: 'warning',
          code: 'METHOD_REMOVED',
          message: `方法 ${oldSvc.fullName}.${name} 被删除`,
          details: {
            serviceName: oldSvc.fullName,
            methodName: name,
            line: oldMethod.line
          }
        });
        continue;
      }

      if (newMethod.input !== oldMethod.input) {
        this.addIssue({
          type: 'error',
          code: 'METHOD_INPUT_CHANGED',
          message: `方法 ${oldSvc.fullName}.${name} 的输入类型改变: ${oldMethod.input} -> ${newMethod.input}`,
          details: {
            serviceName: oldSvc.fullName,
            methodName: name,
            oldInput: oldMethod.input,
            newInput: newMethod.input,
            line: newMethod.line
          }
        });
      }

      if (newMethod.output !== oldMethod.output) {
        this.addIssue({
          type: 'error',
          code: 'METHOD_OUTPUT_CHANGED',
          message: `方法 ${oldSvc.fullName}.${name} 的输出类型改变: ${oldMethod.output} -> ${newMethod.output}`,
          details: {
            serviceName: oldSvc.fullName,
            methodName: name,
            oldOutput: oldMethod.output,
            newOutput: newMethod.output,
            line: newMethod.line
          }
        });
      }
    }

    for (const [name, newMethod] of newMethodMap) {
      if (!oldMethodMap.has(name)) {
        this.addIssue({
          type: 'info',
          code: 'METHOD_ADDED',
          message: `新增方法 ${newSvc.fullName}.${name}`,
          details: {
            serviceName: newSvc.fullName,
            methodName: name,
            line: newMethod.line
          }
        });
      }
    }
  }

  addIssue(issue) {
    issue.id = `${issue.code}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    this.issues.push(issue);
    
    switch (issue.type) {
      case 'error':
        this.summary.errors++;
        break;
      case 'warning':
        this.summary.warnings++;
        break;
      case 'info':
        this.summary.infos++;
        break;
    }
    this.summary.total++;
  }
}

module.exports = CompatibilityChecker;
