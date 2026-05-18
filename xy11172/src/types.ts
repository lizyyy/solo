export interface InventoryRecord {
  车辆编号: string;
  回库日期: string;
  药品编码: string;
  药品名称: string;
  批号: string;
  出库数量: number;
  销售数量: number;
  回库数量: number;
  途中报损数量: number;
  报损原因: string;
  拆分批号: string;
  拆分后数量: number;
  状态: string;
  处理标记: string;
  备注: string;
}

export interface ProcessingResult {
  success: InventoryRecord[];
  skipped: InventoryRecord[];
  failed: FailedRecord[];
}

export interface FailedRecord extends InventoryRecord {
  错误类型: ErrorType;
  错误信息: string;
  修复建议: string;
}

export type ErrorType = 
  | '途中报损异常'
  | '批号拆分异常'
  | '数据校验失败'
  | '数量不匹配'
  | '必填项缺失';

export interface FileSummary {
  filename: string;
  totalRecords: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  errors: FailedRecord[];
}

export interface ProcessingSummary {
  totalFiles: number;
  totalRecords: number;
  totalSuccess: number;
  totalSkipped: number;
  totalFailed: number;
  fileSummaries: FileSummary[];
  errorSummary: {
    途中报损异常: FailedRecord[];
    批号拆分异常: FailedRecord[];
    数据校验失败: FailedRecord[];
    数量不匹配: FailedRecord[];
    必填项缺失: FailedRecord[];
  };
}
