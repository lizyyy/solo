const ERROR_MESSAGES = {
  CAD_LAYER_DUPLICATE: '检测到重复的CAD图层名，系统已自动跳过重复项，未新增温区记录',
  ROUTE_LENGTH_NOT_RECALCULATED: '补录路线未重新计算长度，请先确认测距仪记录后再继续',
  TEMPERATURE_ZONE_INVALID: '温区数据不完整，请检查CAD图层和测距仪记录是否匹配',
  HISTORY_NOT_FOUND: '未找到历史记录，无法进行版本对比',
  EXPORT_FAILED_CUSTOMER_REVIEW: '存在待复核的补录路线，请先完成客户复核后再导出截图',
  REMARK_UPDATE_ONLY: '仅更新了备注信息，温区三维分层数据未变更，历史记录已保存',
  THREE_D_LINK_BROKEN: '3D展示链接失效，无法追溯到原始CAD图层或测距仪记录',
  DATA_NEEDS_REVIEW: '数据存在异常，已标记为待复核，请勿直接标记为正常',
  MEASUREMENT_RECORD_MISMATCH: '测距仪记录与CAD图层不匹配，请核对后再导入',
  BOUNDARY_RULE_VIOLATION: '违反温区分层边界规则，请检查温区范围是否重叠或超出冷链库'
};

function getUserFriendlyError(errorCode, details = {}) {
  const baseMessage = ERROR_MESSAGES[errorCode] || '发生未知错误，请联系技术支持';
  if (Object.keys(details).length === 0) {
    return baseMessage;
  }
  const detailStr = Object.entries(details)
    .map(([key, value]) => `${key}: ${value}`)
    .join('；');
  return `${baseMessage}（${detailStr}）`;
}

module.exports = { ERROR_MESSAGES, getUserFriendlyError };
