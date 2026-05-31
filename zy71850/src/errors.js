const errorMessages = {
  PART_NOT_FOUND: {
    message: '找不到零件',
    template: (details) => `零件"${details.partName}"不在清单上。请检查零件编号是否正确，或者联系管理员更新零件清单。`,
    suggestion: '你可以先去零件清单里查一下这个零件的准确名称'
  },
  DUPLICATE_PART: {
    message: '零件重复',
    template: (details) => `零件"${details.partName}"已经在清单里了，不能重复添加。上次是${details.lastModifiedBy}在${details.lastModifiedAt}添加的。`,
    suggestion: '如果需要修改数量，请使用"更新零件数量"功能'
  },
  MISSING_VIDEO: {
    message: '缺少操作视频',
    template: (details) => `第${details.stepNumber}步"${details.stepName}"需要上传操作视频，但你还没传。没有视频的话，后面的同学没法跟着学哦。`,
    suggestion: '请拍摄一段30秒-2分钟的操作示范视频上传'
  },
  STUDENT_MISOPERATION: {
    message: '学生操作有误',
    template: (details) => `学生${details.studentName}在第${details.stepNumber}步操作出错了：${details.errorDetail}。这已经是第${details.errorCount}次同样的错误了。`,
    suggestion: '建议停下来重点讲解这一步，或者让操作正确的同学示范一下'
  },
  PARTS_LIST_MODIFIED: {
    message: '零件清单已被修改',
    template: (details) => `注意！你用的零件清单"${details.listName}"在${details.modifiedAt}被${details.modifiedBy}改过。改动内容：${details.changeSummary}。`,
    suggestion: '上课前最好跟修改人确认一下改动的原因，避免用错零件'
  },
  INVALID_QUANTITY: {
    message: '零件数量不对',
    template: (details) => `"${details.partName}"的数量${details.quantity}不合理。正常这个零件应该是${details.expectedQuantity}个。`,
    suggestion: '请检查一下是不是输错数字了，或者确认一下发动机型号对不对'
  },
  CLASSROOM_ALREADY_EXISTS: {
    message: '课堂记录已存在',
    template: (details) => `课堂"${details.classroomId}"已经有记录了，这是第${details.existingRunCount}次运行。系统会保留历史记录，不会覆盖之前的数据。`,
    suggestion: '你可以继续这次课堂，或者用"查看历史"命令看看之前的情况'
  },
  STEP_OUT_OF_ORDER: {
    message: '步骤顺序不对',
    template: (details) => `现在应该做第${details.expectedStep}步，但你直接跳去做第${details.actualStep}步了。发动机拆装顺序很重要，不能乱跳。`,
    suggestion: '请按顺序操作，先退回去完成上一步'
  },
  REQUIRED_PART_MISSING: {
    message: '缺少必需零件',
    template: (details) => `这一步需要用到"${details.partName}"，但零件清单显示还没准备。`,
    suggestion: '请先确认零件是否齐全，或者联系管理员添加'
  },
  UNKNOWN_ERROR: {
    message: '出了点小问题',
    template: () => '系统遇到了一个意外情况，不过别担心，你的数据已经保存了。',
    suggestion: '可以重试一下，或者把刚才的操作告诉技术支持'
  }
};

export class ClassroomError extends Error {
  constructor(errorCode, details = {}) {
    const errorInfo = errorMessages[errorCode] || errorMessages.UNKNOWN_ERROR;
    const userMessage = errorInfo.template(details);
    
    super(userMessage);
    this.name = 'ClassroomError';
    this.errorCode = errorCode;
    this.details = details;
    this.userMessage = userMessage;
    this.suggestion = errorInfo.suggestion;
  }

  toDisplayString() {
    return `
⚠️  ${this.message}

💡  建议：${this.suggestion}

ℹ️  错误标识：${this.errorCode}
    `.trim();
  }
}

export function handleError(error) {
  if (error instanceof ClassroomError) {
    console.log(error.toDisplayString());
    return error;
  }
  
  const friendlyError = new ClassroomError('UNKNOWN_ERROR', {});
  console.log(friendlyError.toDisplayString());
  console.log('\n技术细节（给懂的人看）：', error.message);
  return friendlyError;
}

export function validateInput(validationRules, input) {
  for (const rule of validationRules) {
    const { field, validate, errorCode, getDetails } = rule;
    if (!validate(input[field], input)) {
      throw new ClassroomError(errorCode, getDetails(input));
    }
  }
}
