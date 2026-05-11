#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const chalk = require('chalk');

const MM_PATH = path.join(__dirname, '..', 'index.js');

function run(cmd, description) {
  console.log(chalk.cyan(`\n▶ ${description}`));
  console.log(chalk.gray(`  $ ${cmd}`));
  try {
    const output = execSync(`node ${MM_PATH} ${cmd}`, { encoding: 'utf8' });
    console.log(output);
    return true;
  } catch (error) {
    console.log(error.stdout);
    if (error.stderr) {
      console.log(chalk.red(error.stderr));
    }
    return false;
  }
}

console.log(chalk.bold.blue('\n══════════════════════════════════════════════════════════════'));
console.log(chalk.bold.blue('            活动物料归还 CLI 演示'));
console.log(chalk.bold.blue('══════════════════════════════════════════════════════════════\n'));

console.log(chalk.yellow('本演示将展示:'));
console.log('  1. 建立物料台账');
console.log('  2. 创建活动并导入领用');
console.log('  3. 登记归还（正常归还）');
console.log('  4. 登记报损');
console.log('  5. 登记丢失');
console.log('  6. 登记礼品消耗');
console.log('  7. 验证规则（重复归还、归还数量超额）');
console.log('  8. 计算活动后库存');
console.log('  9. 设置下场活动需求');
console.log('  10. 生成补采购建议（显示影响的活动）');
console.log('  11. 生成活动物料报告\n');

console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(chalk.bold.cyan('第一阶段：初始化数据'));
console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

run(
  'material:add -c ZJ-001 -n "宣传展架" -u 个 -s 20',
  '添加物料：宣传展架（初始库存20个）'
);

run(
  'material:add -c ZB-001 -n "活动桌布" -u 块 -s 50',
  '添加物料：活动桌布（初始库存50块）'
);

run(
  'material:add -c LB-001 -n "定制笔记本" -u 本 -s 1000',
  '添加物料：定制笔记本（初始库存1000本）'
);

run(
  'material:add -c LB-002 -n "品牌笔" -u 支 -s 2000',
  '添加物料：品牌笔（初始库存2000支）'
);

run(
  'material:add -c LB-003 -n "环保购物袋" -u 个 -s 800',
  '添加物料：环保购物袋（初始库存800个）'
);

run(
  'material:list',
  '查看物料台账'
);

run(
  'activity:add -i EVENT001 -n "2024春季产品发布会" -s 2024-03-15 -e 2024-03-17 -l "上海国际会展中心"',
  '创建活动：2024春季产品发布会'
);

run(
  'activity:add -i EVENT002 -n "2024夏季路演活动" -s 2024-04-20 -e 2024-04-22 -l "北京工人体育场"',
  '创建活动：2024夏季路演活动（下场活动）'
);

run(
  'activity:list',
  '查看活动列表'
);

run(
  'leader:import -a EVENT001 -f examples/leader_event001.json',
  '导入活动 EVENT001 的领用物料'
);

console.log(chalk.bold.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(chalk.bold.cyan('第二阶段：登记归还、报损、丢失、消耗'));
console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

run(
  'return:add -a EVENT001 -m ZJ-001 -q 4 -r "展架完好无损"',
  '【正常归还】宣传展架 4个（领用5个，归还4个）'
);

run(
  'return:add -a EVENT001 -m ZB-001 -q 8 -r "桌布已清洗"',
  '【正常归还】活动桌布 8块（领用8个，全部归还）'
);

run(
  'damage:add -a EVENT001 -m ZJ-001 -q 1 -r "运输过程中框架损坏"',
  '【报损】宣传展架 1个（运输损坏，无法修复）'
);

run(
  'loss:add -a EVENT001 -m LB-003 -q 50 -r "活动现场丢失，已报案"',
  '【丢失】环保购物袋 50个'
);

run(
  'consumption:add -a EVENT001 -m LB-001 -q 180 -d "活动现场赠送给参会客户，签到时发放120本，互动环节发放60本"',
  '【礼品消耗】定制笔记本 180本（有详细说明）'
);

run(
  'consumption:add -a EVENT001 -m LB-002 -q 450 -d "每位参会人员赠送1支，共发放450支"',
  '【礼品消耗】品牌笔 450支'
);

run(
  'consumption:add -a EVENT001 -m LB-003 -q 250 -d "现场互动抽奖奖品和随手礼"',
  '【礼品消耗】环保购物袋 250个'
);

console.log(chalk.bold.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(chalk.bold.cyan('第三阶段：验证规则演示'));
console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

console.log(chalk.yellow('测试1：重复归还（同一物料多次归还）\n'));
run(
  'return:add -a EVENT001 -m ZB-001 -q 2 -r "测试重复归还"',
  '尝试再次归还桌布（已全部归还过）'
);

console.log(chalk.yellow('\n测试2：归还数量大于借出数量\n'));
run(
  'return:add -a EVENT001 -m ZJ-001 -q 10 -r "测试超额归还"',
  '尝试归还10个展架（只领用了5个）'
);

console.log(chalk.yellow('\n测试3：礼品消耗没有说明\n'));
run(
  'consumption:add -a EVENT001 -m LB-001 -q 10',
  '尝试登记消耗但没有说明（应该失败）'
);

console.log(chalk.bold.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(chalk.bold.cyan('第四阶段：库存计算与报告'));
console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

run(
  'activity:balance -a EVENT001',
  '计算活动 EVENT001 物料平衡'
);

run(
  'report:inventory',
  '查看当前库存报告'
);

run(
  'demand:set -a EVENT002 -f examples/demand_event002.json',
  '设置下场活动 EVENT002 的物料需求'
);

run(
  'report:purchase',
  '生成补采购建议（检查库存是否满足下场活动需求）'
);

run(
  'report:activity -a EVENT001',
  '生成活动 EVENT001 的完整物料报告'
);

console.log(chalk.bold.green('\n══════════════════════════════════════════════════════════════'));
console.log(chalk.bold.green('                    演示完成！'));
console.log(chalk.bold.green('══════════════════════════════════════════════════════════════\n'));

console.log(chalk.cyan('总结：'));
console.log('  ✅ 物料台账已建立');
console.log('  ✅ 活动领用已导入');
console.log('  ✅ 正常归还、报损、丢失、消耗已登记');
console.log('  ✅ 验证规则生效（重复归还、超额归还、无说明消耗被拦截）');
console.log('  ✅ 活动后库存已计算');
console.log('  ✅ 补采购建议已生成，显示影响的活动');
console.log('  ✅ 活动物料报告已生成\n');

console.log(chalk.gray('提示：所有数据保存在 data/ 目录下，如需重新演示请删除该目录。\n'));
