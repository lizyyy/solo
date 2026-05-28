const moment = require('moment');
const { PENSION_RULES, RETIREMENT_AGE } = require('./data-structure');

class PensionCalculator {
  constructor() {
    this.rules = PENSION_RULES;
  }

  归集缴费年限(参保记录列表, 补缴单列表) {
    const 缴费月数Map = new Map();
    const 边界提示 = [];
    const 参保记录ID到参保地的映射 = new Map();
    
    for (const 记录 of 参保记录列表) {
      参保记录ID到参保地的映射.set(记录.id, 记录.参保地);
    }
    
    for (const 记录 of 参保记录列表) {
      const 起始 = moment(记录.起始年月, 'YYYY-MM');
      const 终止 = moment(记录.终止年月, 'YYYY-MM');
      let 当前 = 起始.clone();
      const 总月数 = 终止.diff(起始, 'month') + 1;
      const 每月个人账户储存额 = 记录.个人账户储存额 / 总月数;
      
      while (当前.isSameOrBefore(终止)) {
        const key = `${记录.参保地}_${当前.format('YYYY-MM')}`;
        if (缴费月数Map.has(key)) {
          const 现有记录 = 缴费月数Map.get(key);
          边界提示.push({
            type: '重复缴费',
            severity: 'warning',
            message: `${记录.参保地} ${当前.format('YYYY-MM')} 存在重复缴费记录`,
            detail: { 
              月份: 当前.format('YYYY-MM'), 
              参保地: 记录.参保地,
              原有缴费基数: 现有记录.缴费基数,
              新缴费基数: 记录.缴费基数
            }
          });
        }
        缴费月数Map.set(key, {
          参保地: 记录.参保地,
          缴费基数: 记录.缴费基数,
          缴费类型: 记录.缴费类型,
          个人账户储存额: 每月个人账户储存额,
          参保记录ID: 记录.id
        });
        当前.add(1, 'month');
      }
    }
    
    for (const 补缴 of 补缴单列表) {
      const 起始 = moment(补缴.补缴起始年月, 'YYYY-MM');
      const 终止 = moment(补缴.补缴终止年月, 'YYYY-MM');
      let 当前 = 起始.clone();
      const 补缴月数 = 终止.diff(起始, 'month') + 1;
      const 每月补缴个人账户 = (补缴.补缴基数 * 0.08);
      const 参保地 = 参保记录ID到参保地的映射.get(补缴.参保记录ID) || '未知';
      
      while (当前.isSameOrBefore(终止)) {
        const key = `${参保地}_${当前.format('YYYY-MM')}`;
        if (缴费月数Map.has(key)) {
          const 现有记录 = 缴费月数Map.get(key);
          边界提示.push({
            type: '补缴重复',
            severity: 'error',
            message: `${参保地} ${当前.format('YYYY-MM')} 月份已存在${现有记录.缴费类型}记录，补缴将覆盖`,
            detail: { 
              月份: 当前.format('YYYY-MM'), 
              参保地,
              补缴单ID: 补缴.id,
              原有缴费基数: 现有记录.缴费基数,
              补缴基数: 补缴.补缴基数,
              原有缴费类型: 现有记录.缴费类型
            }
          });
        }
        缴费月数Map.set(key, {
          参保地,
          缴费基数: 补缴.补缴基数,
          缴费类型: '补缴',
          个人账户储存额: 每月补缴个人账户,
          参保记录ID: 补缴.参保记录ID,
          补缴单ID: 补缴.id
        });
        当前.add(1, 'month');
      }
    }
    
    const 实际缴费月数 = 缴费月数Map.size;
    const 实际缴费年限 = Math.floor(实际缴费月数 / 12);
    const 剩余月数 = 实际缴费月数 % 12;
    
    return {
      缴费月数Map,
      实际缴费月数,
      实际缴费年限,
      剩余月数,
      边界提示
    };
  }

  计算平均缴费指数(缴费月数Map, 领取地计发基数) {
    let 指数总和 = 0;
    let 有效月数 = 0;
    
    for (const [key, 记录] of 缴费月数Map) {
      const 缴费指数 = Math.min(
        Math.max(记录.缴费基数 / 领取地计发基数, this.rules.最低缴费基数比例),
        this.rules.最高缴费基数比例
      );
      指数总和 += 缴费指数;
      有效月数++;
    }
    
    return 有效月数 > 0 ? 指数总和 / 有效月数 : 0;
  }

  确定领取地(参保记录列表, 户籍地) {
    const 参保地统计 = new Map();
    const 边界提示 = [];
    
    for (const 记录 of 参保记录列表) {
      const 起始 = moment(记录.起始年月, 'YYYY-MM');
      const 终止 = moment(记录.终止年月, 'YYYY-MM');
      const 月数 = 终止.diff(起始, 'month') + 1;
      
      if (!参保地统计.has(记录.参保地)) {
        参保地统计.set(记录.参保地, { 月数: 0, 最后缴费时间: null });
      }
      const 统计 = 参保地统计.get(记录.参保地);
      统计.月数 += 月数;
      统计.最后缴费时间 = 终止;
    }
    
    let 最终领取地 = 户籍地;
    let 领取依据 = '户籍地领取';
    
    const 满10年地点 = [];
    for (const [地点, 统计] of 参保地统计) {
      if (统计.月数 >= 120) {
        满10年地点.push({ 地点, ...统计 });
      }
    }
    
    if (满10年地点.length > 0) {
      满10年地点.sort((a, b) => b.最后缴费时间 - a.最后缴费时间);
      最终领取地 = 满10年地点[0].地点;
      领取依据 = '最后满10年参保地领取';
      
      if (满10年地点.length > 1) {
        边界提示.push({
          type: '多地满10年',
          severity: 'info',
          message: `多个参保地满10年，按最后缴费地确定：${最终领取地}`,
          detail: { 满10年地点: 满10年地点.map(p => p.地点) }
        });
      }
    } else if (参保地统计.size > 1) {
      边界提示.push({
        type: '多地均不满10年',
        severity: 'warning',
        message: '所有参保地均不满10年，需回户籍地领取',
        detail: { 户籍地 }
      });
    }
    
    return {
      领取地: 最终领取地,
      领取依据,
      边界提示
    };
  }

  校验年龄边界(出生日期, 退休年月, 性别, 工种) {
    const 边界提示 = [];
    const 出生 = moment(出生日期, 'YYYY-MM-DD');
    const 退休 = moment(退休年月, 'YYYY-MM');
    
    const 退休标准年龄 = RETIREMENT_AGE[性别][工种] || RETIREMENT_AGE[性别].普通;
    const 应退休年月 = 出生.clone().add(退休标准年龄, 'year').startOf('month');
    
    const 实际退休年龄 = 退休.diff(出生, 'year', true);
    
    if (退休.isBefore(应退休年月)) {
      边界提示.push({
        type: '提前退休',
        severity: 'warning',
        message: `申请退休时间早于法定退休年龄${退休标准年龄}岁`,
        detail: {
          法定退休年月: 应退休年月.format('YYYY-MM'),
          申请退休年月: 退休.format('YYYY-MM'),
          提前月数: 应退休年月.diff(退休, 'month')
        }
      });
    }
    
    if (退休.isAfter(应退休年月.add(5, 'year'))) {
      边界提示.push({
        type: '延迟退休超限',
        severity: 'error',
        message: '退休时间超过法定退休年龄5年以上',
        detail: {
          法定退休年月: 应退休年月.format('YYYY-MM'),
          申请退休年月: 退休.format('YYYY-MM')
        }
      });
    }
    
    return {
      法定退休年龄: 退休标准年龄,
      实际退休年龄: 实际退休年龄.toFixed(1),
      边界提示
    };
  }

  计算养老金(参保人信息, 参保记录, 补缴单, 领取地信息, 年龄信息) {
    const 所有边界提示 = [];
    
    const 年限结果 = this.归集缴费年限(参保记录, 补缴单);
    所有边界提示.push(...年限结果.边界提示);
    
    const 年龄校验 = this.校验年龄边界(
      年龄信息.出生日期,
      年龄信息.退休年月,
      年龄信息.性别,
      年龄信息.工种
    );
    所有边界提示.push(...年龄校验.边界提示);
    
    const 领取地结果 = this.确定领取地(参保记录, 领取地信息.城市);
    所有边界提示.push(...领取地结果.边界提示);
    
    const 累计缴费年限 = 年限结果.实际缴费年限 + 年龄信息.视同缴费年限;
    const 平均缴费指数 = this.计算平均缴费指数(年限结果.缴费月数Map, 领取地信息.计发基数);
    
    let 个人账户储存额 = 0;
    for (const [key, 记录] of 年限结果.缴费月数Map) {
      个人账户储存额 += 记录.个人账户储存额 || 记录.缴费基数 * 0.08;
    }
    
    const 计发月数 = this.获取计发月数(parseFloat(年龄校验.实际退休年龄));
    
    const 基础养老金 = (领取地信息.计发基数 + 领取地信息.计发基数 * 平均缴费指数) / 2 
      * 累计缴费年限 * 0.01;
    
    const 个人账户养老金 = 个人账户储存额 / 计发月数;
    
    const 过渡性养老金 = 领取地信息.计发基数 * 平均缴费指数 
      * 年龄信息.视同缴费年限 * 0.013;
    
    const 过渡性调节金 = 年龄信息.视同缴费年限 > 0 ? 120 : 0;
    
    const 每月领取总额 = 基础养老金 + 个人账户养老金 + 过渡性养老金 + 过渡性调节金;
    
    if (累计缴费年限 < this.rules.最低缴费年限) {
      所有边界提示.push({
        type: '缴费年限不足',
        severity: 'error',
        message: `累计缴费年限${累计缴费年限}年，不足最低15年要求`,
        detail: { 累计缴费年限, 最低年限: this.rules.最低缴费年限 }
      });
    }
    
    return {
      参保人信息,
      缴费明细: {
        累计缴费年限,
        实际缴费年限: 年限结果.实际缴费年限,
        视同缴费年限: 年龄信息.视同缴费年限,
        实际缴费月数: 年限结果.实际缴费月数,
        平均缴费指数: 平均缴费指数.toFixed(4)
      },
      账户信息: {
        个人账户储存额: 个人账户储存额.toFixed(2),
        计发月数
      },
      养老金构成: {
        基础养老金: 基础养老金.toFixed(2),
        个人账户养老金: 个人账户养老金.toFixed(2),
        过渡性养老金: 过渡性养老金.toFixed(2),
        过渡性调节金: 过渡性调节金.toFixed(2),
        每月领取总额: 每月领取总额.toFixed(2)
      },
      领取地信息: {
        最终领取地: 领取地结果.领取地,
        领取依据: 领取地结果.领取依据,
        计发基数: 领取地信息.计发基数
      },
      年龄校验,
      边界提示: 所有边界提示,
      计算时间: new Date().toISOString()
    };
  }

  对比方案(方案列表) {
    const 对比结果 = [];
    
    for (const 方案 of 方案列表) {
      const 结果 = this.计算养老金(
        方案.参保人信息,
        方案.参保记录,
        方案.补缴单,
        方案.领取地信息,
        方案.年龄信息
      );
      对比结果.push({
        方案名称: 方案.名称,
        每月领取总额: 结果.养老金构成.每月领取总额,
        累计缴费年限: 结果.缴费明细.累计缴费年限,
        平均缴费指数: 结果.缴费明细.平均缴费指数,
        个人账户储存额: 结果.账户信息.个人账户储存额,
        边界提示数量: 结果.边界提示.length
      });
    }
    
    return 对比结果;
  }

  获取计发月数(退休年龄) {
    const 计发月数表 = {
      40: 233, 41: 230, 42: 226, 43: 223, 44: 220,
      45: 216, 46: 212, 47: 208, 48: 204, 49: 199,
      50: 195, 51: 190, 52: 185, 53: 180, 54: 175,
      55: 170, 56: 164, 57: 158, 58: 152, 59: 145,
      60: 139, 61: 132, 62: 125, 63: 117, 64: 109,
      65: 101, 66: 93, 67: 84, 68: 75, 69: 65, 70: 56
    };
    
    const 年龄整数 = Math.min(Math.max(Math.floor(退休年龄), 40), 70);
    return 计发月数表[年龄整数] || 139;
  }
}

module.exports = PensionCalculator;
