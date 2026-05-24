const exitCodes = {
  SUCCESS: 0,
  INVALID_ARGUMENTS: 1,
  FILE_NOT_FOUND: 2,
  INVALID_FILE_FORMAT: 3,
  PARSING_ERROR: 4,
  CIRCULAR_REFERENCE: 5,
  RUNTIME_ERROR: 6,
  SELF_TEST_FAILED: 7,
  EXTERNAL_LINKS: 8,
};

const exitMessages = {
  [exitCodes.SUCCESS]: '执行成功',
  [exitCodes.INVALID_ARGUMENTS]: '无效参数',
  [exitCodes.FILE_NOT_FOUND]: '文件未找到',
  [exitCodes.INVALID_FILE_FORMAT]: '无效文件格式',
  [exitCodes.PARSING_ERROR]: '解析错误',
  [exitCodes.CIRCULAR_REFERENCE]: '检测到循环引用',
  [exitCodes.RUNTIME_ERROR]: '运行时错误',
  [exitCodes.SELF_TEST_FAILED]: '自检失败',
  [exitCodes.EXTERNAL_LINKS]: '检测到外部链接',
};

function getExitMessage(code) {
  return exitMessages[code] || '未知错误';
}

module.exports = exitCodes;
module.exports.getExitMessage = getExitMessage;
