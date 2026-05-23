export interface VisitRecord {
  原始行号: number;
  客户电话: string;
  归一化电话: string;
  客户姓名?: string;
  来访日期?: string;
  来访时间?: string;
  置业顾问?: string;
  渠道名称?: string;
  认领状态?: string;
  备注?: string;
  [key: string]: any;
}

export interface ChannelRecord {
  原始行号: number;
  客户电话: string;
  归一化电话: string;
  客户姓名?: string;
  渠道名称: string;
  渠道类型?: string;
  置业顾问?: string;
  认领状态?: string;
  认领时间?: string;
  备注?: string;
  [key: string]: any;
}

export interface MergedRecord {
  归一化电话: string;
  客户姓名: string;
  最终渠道: string;
  最终置业顾问: string;
  最终认领状态: string;
  首次来访日期?: string;
  来访次数: number;
  涉及渠道数量: number;
  涉及顾问数量: number;
  是否重复认领: boolean;
  重复认领渠道: string[];
  重复认领顾问: string[];
  原始来访记录行号: number[];
  原始渠道记录行号: number[];
  所有来访记录: VisitRecord[];
  所有渠道记录: ChannelRecord[];
}

export interface AdvisorSummary {
  置业顾问: string;
  认领客户数: number;
  重复认领数: number;
  涉及渠道: string[];
}

export interface ChannelSummary {
  渠道名称: string;
  认领客户数: number;
  重复认领数: number;
  涉及顾问: string[];
}

export interface BadRecord {
  来源文件: '来访表' | '渠道表';
  原始行号: number;
  错误原因: string;
  原始数据: any;
}

export interface MergeResult {
  合并记录: MergedRecord[];
  顾问汇总: AdvisorSummary[];
  渠道汇总: ChannelSummary[];
  坏记录: BadRecord[];
  统计: {
    原始来访记录数: number;
    原始渠道记录数: number;
    有效来访记录数: number;
    有效渠道记录数: number;
    合并后客户数: number;
    重复认领客户数: number;
    坏记录数: number;
  };
}

export interface CLIOptions {
  来访表路径: string;
  渠道表路径: string;
  输出目录: string;
  渠道优先级?: string[];
  电话列名?: string;
  顾问列名?: string;
  渠道列名?: string;
  状态列名?: string;
  静默?: boolean;
}

export interface Config {
  渠道优先级: string[];
  列名映射: {
    电话: string[];
    客户姓名: string[];
    置业顾问: string[];
    渠道名称: string[];
    认领状态: string[];
    来访日期: string[];
  };
  认领状态优先级: string[];
}
