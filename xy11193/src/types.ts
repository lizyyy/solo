export interface TrainingRecord {
  员工编号: string;
  员工姓名: string;
  所属部门: string;
  培训课程: string;
  培训日期: string;
  培训时长: string;
  考试成绩: string;
  是否通过: string;
  讲师: string;
  培训地点: string;
  来源文件: string;
  行号: number;
}

export interface ProcessedResult {
  normalRecords: TrainingRecord[];
  abnormalRecords: AbnormalRecord[];
  skippedFiles: string[];
  failedFiles: FailedFile[];
  statistics: Statistics;
}

export interface AbnormalRecord extends TrainingRecord {
  异常类型: string;
  异常说明: string;
}

export interface FailedFile {
  文件名: string;
  错误信息: string;
}

export interface Statistics {
  总文件数: number;
  成功处理文件数: number;
  跳过文件数: number;
  失败文件数: number;
  总记录数: number;
  正常记录数: number;
  异常记录数: number;
  同名员工数: number;
  部门调整数: number;
  可复跑输出数: number;
  数据异常数: number;
}

export interface ProcessOptions {
  verbose: boolean;
  outputDir: string;
}
