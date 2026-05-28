export interface 参保人信息 {
  姓名: string;
  身份证号: string;
  联系电话?: string;
}

export interface 参保记录 {
  id: string;
  姓名: string;
  身份证号: string;
  参保地: string;
  起始年月: string;
  终止年月: string;
  缴费类型: '正常缴费' | '补缴' | '视同缴费';
  缴费基数: number;
  个人账户储存额: number;
  缴费月数: number;
}

export interface 补缴单 {
  id: string;
  参保记录ID: string;
  补缴起始年月: string;
  补缴终止年月: string;
  补缴基数: number;
  补缴金额: number;
  补缴类型: '单位补缴' | '个人补缴';
  滞纳金: number;
  状态: '待审核' | '已确认' | '已入账';
}

export interface 领取地信息 {
  id: string;
  城市: string;
  省份: string;
  变更日期?: string;
  户籍性质: '城镇' | '农村';
  社会平均工资: number;
  计发基数: number;
  最低缴费基数: number;
  最高缴费基数: number;
}

export interface 年龄信息 {
  出生日期: string;
  退休年龄?: number;
  退休年月: string;
  性别: '男' | '女';
  工种: '普通' | '特殊工种';
  视同缴费年限: number;
}

export interface 边界提示 {
  type: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  detail?: any;
}

export interface 养老金构成 {
  基础养老金: string;
  个人账户养老金: string;
  过渡性养老金: string;
  过渡性调节金: string;
  每月领取总额: string;
}

export interface 试算结果 {
  参保人信息: 参保人信息;
  缴费明细: {
    累计缴费年限: number;
    实际缴费年限: number;
    视同缴费年限: number;
    实际缴费月数: number;
    平均缴费指数: string;
  };
  账户信息: {
    个人账户储存额: string;
    计发月数: number;
  };
  养老金构成: 养老金构成;
  领取地信息: {
    最终领取地: string;
    领取依据: string;
    计发基数: number;
  };
  年龄校验: {
    法定退休年龄: number;
    实际退休年龄: string;
    边界提示: 边界提示[];
  };
  边界提示: 边界提示[];
  计算时间: string;
}

export interface 试算方案 {
  name: string;
  参保人信息: 参保人信息;
  参保记录: 参保记录[];
  补缴单: 补缴单[];
  领取地信息: 领取地信息;
  年龄信息: 年龄信息;
}

export interface 方案对比结果 {
  方案名称: string;
  每月领取总额: string;
  累计缴费年限: number;
  平均缴费指数: string;
  个人账户储存额: string;
  边界提示数量: number;
}
