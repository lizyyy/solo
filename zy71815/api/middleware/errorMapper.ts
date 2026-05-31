import { type Request, type Response, type NextFunction } from "express";

const SQLITE_CONSTRAINT_UNIQUE = "SQLITE_CONSTRAINT_UNIQUE";
const SQLITE_CONSTRAINT_FOREIGNKEY = "SQLITE_CONSTRAINT_FOREIGNKEY";
const SQLITE_CONSTRAINT_CHECK = "SQLITE_CONSTRAINT_CHECK";
const SQLITE_CONSTRAINT_NOTNULL = "SQLITE_CONSTRAINT_NOTNULL";

interface AppError extends Error {
  status?: number;
  code?: string;
  field?: string;
}

function mapSqliteError(error: AppError): { message: string; status: number } {
  const msg = error.message || "";

  if (msg.includes("UNIQUE constraint failed") || error.code === SQLITE_CONSTRAINT_UNIQUE) {
    return { message: "该记录已存在，请勿重复导入", status: 409 };
  }

  if (msg.includes("FOREIGN KEY constraint failed") || error.code === SQLITE_CONSTRAINT_FOREIGNKEY) {
    return { message: "关联数据不存在，请检查后再试", status: 400 };
  }

  if (msg.includes("CHECK constraint failed") || error.code === SQLITE_CONSTRAINT_CHECK) {
    if (msg.includes("status")) {
      return { message: "记录状态不合法，无法执行此操作", status: 400 };
    }
    return { message: "数据格式不正确，请检查后重试", status: 400 };
  }

  if (msg.includes("NOT NULL constraint failed") || error.code === SQLITE_CONSTRAINT_NOTNULL) {
    return { message: "必填字段不能为空，请完善信息后重试", status: 400 };
  }

  return { message: "数据处理异常，请稍后重试", status: 500 };
}

const FIELD_MESSAGES: Record<string, string> = {
  store_name: "门店名称不能为空",
  activity_name: "活动名称不能为空",
  settlement_period: "结算期间不能为空",
  serial_number: "流水号不能为空",
  amount: "金额不能为空",
  reason: "操作原因不能为空",
  record_ids: "请选择要操作的记录",
  file: "请上传文件",
};

const STATUS_MESSAGES: Record<string, string> = {
  "pending->confirmed": "只有待确认状态的记录才能确认",
  "confirmed->confirmed": "该记录已确认，无需重复操作",
  "confirmed->withdrawn": "确认后撤回需要提供原因",
  "withdrawn->withdrawn": "该记录已撤回，无需重复操作",
  "conflict->confirmed": "冲突记录需先解决冲突才能确认",
  "conflict->withdrawn": "冲突记录需先解决冲突才能撤回",
  "pending->withdrawn": "待确认的记录无需撤回",
  "withdrawn->confirmed": "已撤回的记录需重新导入才能确认",
  "referenced": "该记录已被后续批次引用，无法单独撤回",
};

function mapValidationField(error: AppError): string | null {
  if (error.field && FIELD_MESSAGES[error.field]) {
    return FIELD_MESSAGES[error.field];
  }
  const msg = error.message || "";
  for (const [field, message] of Object.entries(FIELD_MESSAGES)) {
    if (msg.toLowerCase().includes(field.toLowerCase()) || msg.includes(field)) {
      return message;
    }
  }
  return null;
}

function errorMapper(error: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const validationMsg = mapValidationField(error);
  if (validationMsg) {
    res.status(error.status || 400).json({
      success: false,
      error: validationMsg,
    });
    return;
  }

  if (error.message && STATUS_MESSAGES[error.message]) {
    res.status(error.status || 400).json({
      success: false,
      error: STATUS_MESSAGES[error.message],
    });
    return;
  }

  const isSqlite =
    error.message?.includes("constraint") ||
    error.message?.includes("SQLITE") ||
    error.code?.startsWith("SQLITE");

  if (isSqlite) {
    const mapped = mapSqliteError(error);
    res.status(mapped.status).json({
      success: false,
      error: mapped.message,
    });
    return;
  }

  const status = error.status || 500;
  const message =
    status === 400
      ? error.message || "请求参数有误，请检查后重试"
      : status === 404
        ? "请求的资源不存在"
        : status === 409
          ? error.message || "数据冲突，请刷新后重试"
          : "服务器内部错误，请稍后重试";

  res.status(status).json({
    success: false,
    error: message,
  });
}

export { errorMapper };
export type { AppError };
