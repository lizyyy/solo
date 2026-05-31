const ERROR_MAP: [RegExp, string][] = [
  [/UNIQUE constraint failed/i, "该记录已存在，请勿重复导入"],
  [/duplicate.*key/i, "该记录已存在，请勿重复导入"],
  [/duplicate.*entry/i, "该记录已存在，请勿重复导入"],
  [/record not found/i, "未找到该记录，可能已被删除"],
  [/cannot withdraw.*referenced/i, "该记录已被后续批次引用，无法单独撤回"],
  [/invalid.*status/i, "当前记录状态不允许此操作"],
  [/invalid.*file.*format/i, "文件格式不正确，请上传 Excel 或 CSV 文件"],
  [/file.*too.*large/i, "文件大小超出限制，请缩小文件后重试"],
  [/empty.*file/i, "上传文件内容为空，请检查文件后重新上传"],
  [/missing.*required.*field/i, "文件缺少必填字段，请检查文件格式"],
  [/parse.*error/i, "文件解析失败，请检查文件格式是否正确"],
  [/batch.*in.*progress/i, "该批次正在处理中，请稍后再试"],
  [/already.*confirmed/i, "该记录已确认，无需重复操作"],
  [/already.*withdrawn/i, "该记录已撤回，无需重复操作"],
  [/unauthorized/i, "您没有权限执行此操作"],
  [/forbidden/i, "您没有权限执行此操作"],
  [/network.*error/i, "网络连接异常，请检查网络后重试"],
  [/Failed to fetch/i, "网络连接异常，请检查网络后重试"],
  [/timeout/i, "请求超时，请稍后重试"],
  [/5\d{2}/, "服务器内部错误，请稍后重试"],
];

const NETWORK_MESSAGES = [
  "Failed to fetch",
  "NetworkError",
  "Network request failed",
  "ERR_NETWORK",
  "ERR_CONNECTION_REFUSED",
  "ERR_CONNECTION_TIMED_OUT",
  "net::ERR_",
];

export function mapErrorMessage(error: unknown): string {
  if (!error) return "操作遇到问题，请刷新页面后重试，如仍失败请联系管理员";

  const message =
    error instanceof Error ? error.message : String(error);

  if (!message) return "操作遇到问题，请刷新页面后重试，如仍失败请联系管理员";

  const isNetworkError = NETWORK_MESSAGES.some((p) => message.includes(p));
  if (isNetworkError) {
    return "网络连接异常，请检查网络后重试";
  }

  for (const [pattern, friendlyMsg] of ERROR_MAP) {
    if (pattern.test(message)) {
      return friendlyMsg;
    }
  }

  return "操作遇到问题，请刷新页面后重试，如仍失败请联系管理员";
}
