const ERROR_MESSAGES = {
  DUPLICATE_NAMES: {
    code: 'E001',
    message: '障碍物【{obstacleId}】有 {count} 个不同的名称：{names}。请先确认正确名称，不要自动合并！',
    suggestion: '请培训学员复核后选择正确名称，或联系标注人员确认'
  },
  CAD_RANGE_CONFLICT: {
    code: 'E002',
    message: '障碍物【{obstacleId}】数据不一致：CAD图上算出来是 {cadDistance}米，但测距仪量的是 {rangeDistance}米，差了 {difference}米',
    suggestion: '请老梁审核：是CAD图层不准，还是测距仪记录写错了？'
  },
  DUPLICATE_IMPORT: {
    code: 'E003',
    message: '检测到重复导入：CAD图层「{layerName}」已经导入过了，上次是 {lastImportTime} 由 {lastImportBy} 导入的',
    suggestion: '如果是补录数据，请选择「补充导入」模式，不要直接重复导入'
  },
  EXPORT_MISMATCH: {
    code: 'E004',
    message: '导出检查失败：三维视图里有 {viewCount} 个标注，但历史记录里只有 {historyCount} 条记录',
    suggestion: '请先运行自检，确保所有标注都有对应的操作记录'
  },
  MISSING_TRAINEE_REVIEW: {
    code: 'E005',
    message: '障碍物【{obstacleId}】有名称冲突，还没经过培训学员复核，不能直接标记为正常',
    suggestion: '别急！留给学员练习一下，他们复核完你再确认'
  },
  SELF_CHECK_FAILED: {
    code: 'E006',
    message: '自检发现 {count} 个问题，请看详细报告',
    suggestion: '建议每次导入后都跑一遍自检，省得后面返工'
  },
  PENDING_CAD_RANGE_CONFLICT: {
    code: 'E007',
    message: '障碍物【{obstacleId}】还有 {count} 条待处理的CAD与测距仪冲突，不能更新三维视图。先把证据交给老梁确认或驳回！',
    suggestion: '每条测距冲突都要老梁亲自确认或驳回后，才能进入三维视图更新'
  }
};

function getErrorMessage(errorKey, params = {}) {
  const error = ERROR_MESSAGES[errorKey];
  if (!error) {
    return {
      code: 'E999',
      message: '未知错误：' + errorKey,
      suggestion: '请联系技术支持'
    };
  }
  let message = error.message;
  for (const [key, value] of Object.entries(params)) {
    message = message.replace(new RegExp('\\{' + key + '\\}', 'g'), value);
  }
  return {
    code: error.code,
    message,
    suggestion: error.suggestion,
    userFriendly: true
  };
}

function formatError(errorObj) {
  return (
    '\n⚠️  【' + errorObj.code + '】' + errorObj.message +
    '\n💡  提示：' + errorObj.suggestion +
    '\n  '
  ).trim();
}

module.exports = {
  ERROR_MESSAGES,
  getErrorMessage,
  formatError
};
