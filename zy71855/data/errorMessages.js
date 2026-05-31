const friendlyErrors = {
  MISSING_PART: {
    code: 'MISSING_PART',
    message: '零件清单不对哦，缺少了 {partName}',
    suggestion: '请检查零件盒里有没有 {partName}，确认后再继续下一步'
  },
  WRONG_ORDER: {
    code: 'WRONG_ORDER',
    message: '操作顺序不对，当前应该做第 {expectedStep} 步，不是第 {actualStep} 步',
    suggestion: '往前翻一下视频，找到第 {expectedStep} 步的正确做法'
  },
  STEP_SKIPPED: {
    code: 'STEP_SKIPPED',
    message: '好像跳过了第 {skippedStep} 步哦',
    suggestion: '{stepDescription} 这一步很重要，先回去做完吧'
  },
  VIDEO_NOT_MATCH: {
    code: 'VIDEO_NOT_MATCH',
    message: '视频内容和之前的版本不一样',
    suggestion: '看看下面的变更提醒，确认是不是正确的版本再继续'
  },
  INVALID_MATERIAL_ID: {
    code: 'INVALID_MATERIAL_ID',
    message: '找不到这批材料的记录',
    suggestion: '检查一下材料编号是不是输错了，或者先创建新材料记录'
  },
  PART_DAMAGED: {
    code: 'PART_DAMAGED',
    message: '{partName} 看起来有损坏',
    suggestion: '先换一个好的 {partName}，避免影响后面的步骤'
  },
  TOOL_MISSING: {
    code: 'TOOL_MISSING',
    message: '需要用 {toolName} 才能进行这一步',
    suggestion: '去工具箱找找 {toolName}，拿过来再继续'
  }
};

function getFriendlyError(errorCode, params = {}) {
  const error = friendlyErrors[errorCode];
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: '遇到了点小问题，请稍等一下再试试',
      suggestion: '如果一直出现，可以找技术同事帮忙看看'
    };
  }
  
  let message = error.message;
  let suggestion = error.suggestion;
  
  Object.keys(params).forEach(key => {
    const value = params[key];
    message = message.replace(`{${key}}`, value);
    suggestion = suggestion.replace(`{${key}}`, value);
  });
  
  return {
    code: error.code,
    message,
    suggestion,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  friendlyErrors,
  getFriendlyError
};
