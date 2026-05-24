const exitCodes = {
  SUCCESS: 0,
  WARNINGS: 1,
  ERRORS: 2,
  INVALID_INPUT: 3,
  FILE_NOT_FOUND: 4,
  FATAL_ERROR: 5
};

const exitCodeDescriptions = {
  [exitCodes.SUCCESS]: '所有检查通过',
  [exitCodes.WARNINGS]: '存在警告',
  [exitCodes.ERRORS]: '存在错误',
  [exitCodes.INVALID_INPUT]: '输入参数无效',
  [exitCodes.FILE_NOT_FOUND]: '文件未找到',
  [exitCodes.FATAL_ERROR]: '致命错误'
};

module.exports = {
  exitCodes,
  exitCodeDescriptions
};
