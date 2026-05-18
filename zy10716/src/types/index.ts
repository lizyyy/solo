export interface EquityTransaction {
  兑换码: string;
  用户ID: string;
  用户名: string;
  兑换时间: string;
  权益名称: string;
  权益类型: string;
  发放状态: string;
  发放时间?: string;
  转赠状态: string;
  转赠时间?: string;
  冲正状态: string;
  冲正时间?: string;
  原始文件名: string;
  原始行号: number;
}

export enum ReconciliationType {
  发放延迟 = '发放延迟',
  码被转赠 = '码被转赠',
  重复冲正 = '重复冲正'
}

export interface ReconciliationResult {
  兑换码: string;
  用户ID: string;
  用户名: string;
  权益名称: string;
  冲正类型: ReconciliationType;
  问题描述: string;
  兑换时间: string;
  原始文件名: string;
  原始行号: number;
  核对时间: string;
  处理建议: string;
}

export interface ProcessSummary {
  输入文件数: number;
  总记录数: number;
  需冲正记录数: number;
  发放延迟数: number;
  码被转赠数: number;
  重复冲正数: number;
  核对时间: string;
  耗时毫秒: number;
}

export interface ProcessLog {
  兑换码: string;
  步骤: string;
  详情: string;
  时间: string;
}

export interface CliOptions {
  input: string;
  output: string;
  verbose?: boolean;
  force?: boolean;
}
