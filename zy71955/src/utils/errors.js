class UserFriendlyError extends Error {
  constructor(message, { cause, details, suggestion, code } = {}) {
    super(message);
    this.name = 'UserFriendlyError';
    this.cause = cause;
    this.details = details;
    this.suggestion = suggestion;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }

  toHumanReadable() {
    let output = `\n⚠️  ${this.message}\n`;
    
    if (this.details) {
      output += `📋 详细情况: ${this.details}\n`;
    }
    
    if (this.suggestion) {
      output += `💡 建议操作: ${this.suggestion}\n`;
    }
    
    return output;
  }
}

const ERROR_TEMPLATES = {
  KML_PARSE_FAILED: (filename) => ({
    message: `航线文件 "${filename}" 打不开`,
    details: '这个KML文件格式可能有问题，或者不是标准的航线导出文件',
    suggestion: '请重新从飞控软件导出航线，确认是.kml格式文件后再试'
  }),
  
  NO_COORDINATES: (filename) => ({
    message: `航线文件 "${filename}" 里找不到航点坐标`,
    details: '文件能打开，但里面没有记录实际的飞行路径点',
    suggestion: '检查一下飞控是不是真的记录了航线，别导出了一个空文件'
  }),
  
  BATTERY_FILE_EMPTY: (filename) => ({
    message: `电池记录 "${filename}" 是空的`,
    details: '文件里一行数据都没有',
    suggestion: '重新抄一遍电池记录表，确保把起飞、降落的电压都写上'
  }),
  
  INVALID_BATTERY_RECORD: (lineNum, content) => ({
    message: `电池记录第 ${lineNum} 行看不懂`,
    details: `这行写的是: "${content}"`,
    suggestion: '按"时间 电池号 电压 剩余电量"格式来写，比如: "14:30 BAT01 22.8V 85%"'
  }),
  
  MISSION_ALREADY_EXISTS: (missionId) => ({
    message: `任务 "${missionId}" 之前已经分析过了`,
    details: '同一批材料不用重复跑，历史记录都留着',
    suggestion: '要看之前的分析结果直接查历史就行，不用重新导入'
  }),
  
  NO_FLY_ZONE_VIOLATION: (zoneName, distance) => ({
    message: `航线擦到禁飞区了！`,
    details: `离"${zoneName}"最近只有 ${Math.round(distance)} 米`,
    suggestion: '这条线不能飞！赶紧跟指挥汇报，要么绕路，要么申请空域'
  }),
  
  BATTERY_TOO_LOW: (batteryId, voltage) => ({
    message: `电池 "${batteryId}" 电压过低`,
    details: `最低降到 ${voltage}V，已经低于安全值`,
    suggestion: '这块电池下次别用了，或者只飞短航线，降落电压留够余量'
  }),
  
  WEATHER_DATA_MISSING: () => ({
    message: '没看到气象记录',
    details: '飞行复盘需要知道当时的风速、能见度',
    suggestion: '把当时的气象截图或者手填的风速记录补过来'
  }),
  
  FILE_NOT_FOUND: (filename) => ({
    message: `找不到文件 "${filename}"`,
    details: '你说的这个文件在文件夹里不存在',
    suggestion: '检查一下文件名有没有写错，或者文件是不是放错文件夹了'
  }),
  
  VERSION_CONFLICT: (fieldName, oldVal, newVal) => ({
    message: `同一条记录有两个版本！`,
    details: `"${fieldName}" 之前记的是 ${oldVal}，现在变成 ${newVal} 了`,
    suggestion: '问问之前值班的同事，哪个数是对的，别直接盖掉旧记录'
  })
};

function createError(errorType, ...args) {
  const template = ERROR_TEMPLATES[errorType];
  if (!template) {
    return new UserFriendlyError('出了点问题，麻烦找技术支持', {
      code: errorType,
      suggestion: '把出错时的操作步骤告诉技术同事'
    });
  }
  const data = template(...args);
  return new UserFriendlyError(data.message, {
    details: data.details,
    suggestion: data.suggestion,
    code: errorType
  });
}

function wrapError(originalError, context) {
  if (originalError instanceof UserFriendlyError) {
    return originalError;
  }
  
  return new UserFriendlyError(`${context} 时出问题了`, {
    cause: originalError,
    details: originalError.message,
    suggestion: '如果重试还不行，把这个错误截图发给技术支持'
  });
}

module.exports = {
  UserFriendlyError,
  createError,
  wrapError
};
