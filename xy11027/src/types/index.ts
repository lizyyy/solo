export interface 校区 {
  校区编号: string;
  校区名称: string;
  校区地址?: string;
  联系电话?: string;
  负责人姓名?: string;
  创建时间?: string;
}

export interface 培训项目 {
  项目编号: string;
  项目名称: string;
  项目类型?: string;
  培训时长?: string;
  发证机构?: string;
  证书有效期?: string;
  创建时间?: string;
}

export interface 学员 {
  学员编号: string;
  姓名: string;
  证件类型: string;
  证件号码: string;
  性别?: string;
  出生日期?: string;
  联系电话?: string;
  电子邮箱?: string;
  通讯地址?: string;
  创建时间?: string;
}

export interface 原始证书 {
  证书编号: string;
  学员编号: string;
  项目编号: string;
  校区编号: string;
  培训开始日期?: string;
  培训结束日期?: string;
  发证日期: string;
  成绩?: string;
  证书状态: string;
  首次发证: boolean;
  备注?: string;
  创建时间?: string;
}

export type 补办原因 = '遗失' | '损毁' | '信息变更' | '其他';

export type 申请状态 = '待审核' | '待处理' | '已通过' | '已驳回' | '已撤销';

export interface 补办申请 {
  申请编号: string;
  学员编号: string;
  原始证书编号: string;
  申请校区编号: string;
  申请日期: string;
  补办原因: 补办原因;
  补办原因说明?: string;
  遗失地点?: string;
  登报声明编号?: string;
  申请人联系电话?: string;
  申请人通讯地址?: string;
  收件方式?: string;
  申请状态: 申请状态;
  审核人?: string;
  审核日期?: string;
  审核意见?: string;
  驳回原因?: string;
  新证书编号?: string;
  创建时间?: string;
}

export interface 创建补办申请请求 {
  学员编号?: string;
  证件类型?: string;
  证件号码?: string;
  原始证书编号: string;
  申请校区编号: string;
  补办原因: 补办原因;
  补办原因说明?: string;
  遗失地点?: string;
  登报声明编号?: string;
  申请人联系电话?: string;
  申请人通讯地址?: string;
  收件方式?: string;
}

export interface 审核申请请求 {
  申请编号: string;
  审核结果: '通过' | '驳回' | '待处理';
  审核人: string;
  审核意见?: string;
  驳回原因?: string;
}

export interface 业务异常 {
  错误代码: string;
  错误消息: string;
  错误详情?: string;
  建议操作?: string;
  相关数据?: any;
}

export interface ApiResponse<T = any> {
  成功: boolean;
  数据?: T;
  错误?: 业务异常;
  消息?: string;
}
