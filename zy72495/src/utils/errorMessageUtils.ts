const errorMessages: Record<string, string> = {
  'import/file-type': '请上传 Excel 或 CSV 格式的文件',
  'import/empty-file': '上传的文件是空的，请检查后重新上传',
  'import/duplicate-data': '检测到重复数据，系统已自动去重，未新增记录',
  'import/invalid-format': '文件格式不正确，请使用模板格式',
  'import/missing-required': '缺少必填字段：{field}，请补充后重试',
  'boundary/needs-review': '该点位在街道边界上，已标记为待复核，需项目经理确认',
  'boundary/already-reviewed': '该点位已复核，如需修改请联系项目经理',
  'rollback/failed': '回滚失败，请稍后重试',
  'rollback/no-previous': '没有可回滚的历史版本',
  'validation/required': '{field}不能为空',
  'validation/invalid-date': '日期格式不正确，请使用 YYYY-MM-DD 格式',
  'validation/invalid-time': '时间格式不正确，请使用 HH:mm 格式',
  'network/error': '网络连接异常，请检查网络后重试',
  'permission/denied': '您没有权限执行此操作',
};

export function getErrorMessage(errorCode: string, params?: Record<string, string>): string {
  let message = errorMessages[errorCode] || errorCode;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      message = message.replace(`{${key}}`, value);
    });
  }
  return message;
}

export function showToast(message: string, type: 'success' | 'error' | 'warning' = 'error') {
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
  };
  toast.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg text-white shadow-lg transform transition-all duration-300 translate-x-full ${colors[type]}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-full');
  });
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
