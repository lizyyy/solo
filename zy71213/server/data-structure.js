const PensionDataStructure = {
  参保记录: {
    id: 'string',
    姓名: 'string',
    身份证号: 'string',
    参保地: 'string',
    起始年月: 'string',
    终止年月: 'string',
    缴费类型: '正常缴费|补缴|视同缴费',
    缴费基数: 'number',
    个人账户储存额: 'number',
    缴费月数: 'number'
  },
  
  补缴单: {
    id: 'string',
    参保记录ID: 'string',
    补缴起始年月: 'string',
    补缴终止年月: 'string',
    补缴基数: 'number',
    补缴金额: 'number',
    补缴类型: '单位补缴|个人补缴',
    滞纳金: 'number',
    状态: '待审核|已确认|已入账'
  },
  
  领取地信息: {
    id: 'string',
    城市: 'string',
    省份: 'string',
    变更日期: 'string',
    户籍性质: '城镇|农村',
    社会平均工资: 'number',
    计发基数: 'number',
    最低缴费基数: 'number',
    最高缴费基数: 'number'
  },
  
  年龄信息: {
    出生日期: 'string',
    退休年龄: 'number',
    退休年月: 'string',
    性别: '男|女',
    工种: '普通|特殊工种',
    视同缴费年限: 'number'
  },
  
  试算报告: {
    id: 'string',
    创建时间: 'string',
    参保人信息: '对象',
    累计缴费年限: 'number',
    实际缴费年限: 'number',
    视同缴费年限: 'number',
    平均缴费指数: 'number',
    个人账户储存额: 'number',
    基础养老金: 'number',
    个人账户养老金: 'number',
    过渡性养老金: 'number',
    过渡性调节金: 'number',
    每月领取总额: 'number',
    领取地: '对象',
    边界提示: '数组',
    方案对比: '数组'
  }
};

const RETIREMENT_AGE = {
  男: { 普通: 60, 特殊工种: 55 },
  女: { 普通: 50, 特殊工种: 45, 干部: 55 }
};

const PENSION_FORMULA = {
  基础养老金: '(退休时上年度在岗职工月平均工资 + 本人指数化月平均缴费工资) / 2 * 累计缴费年限 * 1%',
  个人账户养老金: '个人账户储存额 / 计发月数',
  过渡性养老金: '退休时上年度在岗职工月平均工资 * 本人平均缴费指数 * 视同缴费年限 * 过渡系数',
  计发月数: {
    40: 233, 45: 216, 50: 195, 55: 170, 60: 139, 65: 101
  },
  过渡系数: 0.013
};

const PENSION_RULES = {
  最低缴费年限: 15,
  最低缴费基数比例: 0.6,
  最高缴费基数比例: 3.0,
  补缴限制: {
    最多补缴月数: 36,
    补缴滞纳金比例: 0.0005
  },
  领取地确定规则: [
    { condition: '户籍地参保满10年以上', result: '在最后参保地' },
    { condition: '多地参保均不满10年', result: '回户籍地' },
    { condition: '累计缴费满15年', result: '在最后参保地满10年的地方' }
  ]
};

module.exports = {
  PensionDataStructure,
  RETIREMENT_AGE,
  PENSION_FORMULA,
  PENSION_RULES
};
