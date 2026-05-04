const sequelize = require('../config/database');
const { 
  TradingDay, 
  CashAccount, 
  Quote, 
  TradePlan, 
  Order, 
  Position, 
  RiskAlert, 
  ReviewNote, 
  Watchlist 
} = require('../models');

async function seed() {
  console.log('开始同步数据库...');
  await sequelize.sync({ force: true });
  console.log('数据库同步完成');

  console.log('\n开始创建种子数据...');

  console.log('1. 创建现金账户...');
  const cashAccount = await CashAccount.create({
    initial_balance: 1000000.00,
    available_balance: 1000000.00,
    frozen_balance: 0.00,
    total_withdrawable: 1000000.00,
    total_pnl: 0.00,
    total_commission: 0.00,
    total_stamp_tax: 0.00,
    status: 'active'
  });
  console.log('   现金账户创建成功，初始资金: ¥1,000,000.00');

  console.log('2. 创建交易日...');
  const tradingDays = await TradingDay.bulkCreate([
    {
      date: '2024-01-15',
      status: 'reviewed',
      initial_cash: 1000000.00,
      final_cash: 995000.00,
      total_market_value: 85000.00,
      total_asset: 1080000.00,
      daily_pnl: 80000.00,
      daily_pnl_percent: 0.08,
      max_drawdown: -0.02,
      buy_count: 5,
      sell_count: 2,
      win_rate: 0.6,
      position_ratio: 0.0787
    },
    {
      date: '2024-01-16',
      status: 'closed',
      initial_cash: 995000.00,
      final_cash: 920000.00,
      total_market_value: 195000.00,
      total_asset: 1115000.00,
      daily_pnl: 35000.00,
      daily_pnl_percent: 0.0324,
      max_drawdown: -0.015,
      buy_count: 3,
      sell_count: 1,
      win_rate: 0.6667,
      position_ratio: 0.1749
    },
    {
      date: '2024-01-17',
      status: 'active',
      initial_cash: 920000.00,
      final_cash: 850000.00,
      total_market_value: 280000.00,
      total_asset: 1130000.00,
      daily_pnl: 15000.00,
      daily_pnl_percent: 0.0135,
      max_drawdown: -0.01,
      buy_count: 4,
      sell_count: 0,
      win_rate: null,
      position_ratio: 0.2478
    },
    {
      date: '2024-01-18',
      status: 'pending',
      initial_cash: 1000000.00,
      final_cash: 1000000.00,
      total_market_value: 0.00,
      total_asset: 1000000.00,
      daily_pnl: 0.00,
      daily_pnl_percent: 0.00,
      max_drawdown: 0.00,
      buy_count: 0,
      sell_count: 0,
      win_rate: null,
      position_ratio: 0.00
    }
  ]);
  console.log('   创建了', tradingDays.length, '个交易日');

  console.log('3. 创建行情数据...');
  const quotes = await Quote.bulkCreate([
    { trading_day_id: tradingDays[2].id, symbol: '000001', name: '平安银行', open: 11.25, high: 11.50, low: 11.20, close: 11.42, volume: 8560000, change_percent: 1.51 },
    { trading_day_id: tradingDays[2].id, symbol: '000002', name: '万科A', open: 8.50, high: 8.65, low: 8.42, close: 8.58, volume: 12300000, change_percent: 0.94 },
    { trading_day_id: tradingDays[2].id, symbol: '000063', name: '中兴通讯', open: 25.80, high: 26.50, low: 25.50, close: 26.20, volume: 9800000, change_percent: 1.55 },
    { trading_day_id: tradingDays[2].id, symbol: '000651', name: '格力电器', open: 38.50, high: 39.20, low: 38.20, close: 38.90, volume: 5600000, change_percent: 1.04 },
    { trading_day_id: tradingDays[2].id, symbol: '000858', name: '五粮液', open: 145.00, high: 148.50, low: 144.50, close: 147.20, volume: 3200000, change_percent: 1.52 },
    { trading_day_id: tradingDays[2].id, symbol: '002415', name: '海康威视', open: 32.50, high: 33.80, low: 32.20, close: 33.50, volume: 7800000, change_percent: 3.08 },
    { trading_day_id: tradingDays[2].id, symbol: '002594', name: '比亚迪', open: 245.00, high: 252.00, low: 243.50, close: 250.80, volume: 4500000, change_percent: 2.37 },
    { trading_day_id: tradingDays[2].id, symbol: '600036', name: '招商银行', open: 32.80, high: 33.20, low: 32.50, close: 33.00, volume: 6800000, change_percent: 0.61 },
    { trading_day_id: tradingDays[2].id, symbol: '600519', name: '贵州茅台', open: 1680.00, high: 1705.00, low: 1675.00, close: 1698.00, volume: 1200000, change_percent: 1.07 },
    { trading_day_id: tradingDays[2].id, symbol: '601318', name: '中国平安', open: 42.50, high: 43.20, low: 42.30, close: 42.90, volume: 8500000, change_percent: 0.94 },
    { trading_day_id: tradingDays[2].id, symbol: '601899', name: '紫金矿业', open: 15.20, high: 15.80, low: 15.10, close: 15.65, volume: 15000000, change_percent: 2.96 },
    { trading_day_id: tradingDays[2].id, symbol: '603288', name: '海天味业', open: 35.80, high: 36.50, low: 35.50, close: 36.20, volume: 2800000, change_percent: 1.12 }
  ]);
  console.log('   创建了', quotes.length, '条行情数据');

  console.log('4. 创建交易计划...');
  const tradePlans = await TradePlan.bulkCreate([
    {
      trading_day_id: tradingDays[2].id,
      symbol: '002594',
      name: '比亚迪',
      plan_type: 'long',
      direction: 'buy',
      entry_price_min: 245.00,
      entry_price_max: 250.00,
      stop_loss_price: 235.00,
      target_price: 280.00,
      planned_quantity: 100,
      planned_amount: 25000.00,
      status: 'executed',
      reason: '新能源板块反弹，比亚迪技术形态走好，成交量放大',
      risk_reward_ratio: 3.50
    },
    {
      trading_day_id: tradingDays[2].id,
      symbol: '002415',
      name: '海康威视',
      plan_type: 'long',
      direction: 'buy',
      entry_price_min: 32.00,
      entry_price_max: 33.50,
      stop_loss_price: 30.50,
      target_price: 38.00,
      planned_quantity: 300,
      planned_amount: 10050.00,
      status: 'executed',
      reason: 'AI概念持续发酵，安防龙头受益，底部放量突破',
      risk_reward_ratio: 3.00
    },
    {
      trading_day_id: tradingDays[2].id,
      symbol: '600519',
      name: '贵州茅台',
      plan_type: 'long',
      direction: 'buy',
      entry_price_min: 1670.00,
      entry_price_max: 1695.00,
      stop_loss_price: 1620.00,
      target_price: 1850.00,
      planned_quantity: 10,
      planned_amount: 16950.00,
      status: 'executed',
      reason: '白酒消费旺季到来，茅台批价稳定回升，估值修复',
      risk_reward_ratio: 3.10
    },
    {
      trading_day_id: tradingDays[2].id,
      symbol: '000063',
      name: '中兴通讯',
      plan_type: 'long',
      direction: 'buy',
      entry_price_min: 25.50,
      entry_price_max: 26.50,
      stop_loss_price: 24.00,
      target_price: 32.00,
      planned_quantity: 400,
      planned_amount: 10600.00,
      status: 'pending',
      reason: '5G基站建设加速，中兴通讯海外订单增长',
      risk_reward_ratio: 3.67
    },
    {
      trading_day_id: tradingDays[2].id,
      symbol: '601899',
      name: '紫金矿业',
      plan_type: 'long',
      direction: 'buy',
      entry_price_min: 15.00,
      entry_price_max: 15.80,
      stop_loss_price: 14.20,
      target_price: 18.00,
      planned_quantity: 600,
      planned_amount: 9480.00,
      status: 'executed',
      reason: '金价持续上涨，铜价反弹，矿业龙头受益',
      risk_reward_ratio: 2.75
    }
  ]);
  console.log('   创建了', tradePlans.length, '个交易计划');

  console.log('5. 创建订单数据（正常交易样例）...');
  const orders = await Order.bulkCreate([
    {
      trading_day_id: tradingDays[2].id,
      order_no: 'ORD202401170001',
      symbol: '002594',
      name: '比亚迪',
      order_type: 'limit',
      direction: 'buy',
      price: 248.00,
      quantity: 100,
      filled_quantity: 100,
      status: 'filled',
      avg_fill_price: 248.00,
      trade_plan_id: tradePlans[0].id,
      remark: '按计划执行买入'
    },
    {
      trading_day_id: tradingDays[2].id,
      order_no: 'ORD202401170002',
      symbol: '002415',
      name: '海康威视',
      order_type: 'limit',
      direction: 'buy',
      price: 33.00,
      quantity: 300,
      filled_quantity: 300,
      status: 'filled',
      avg_fill_price: 33.00,
      trade_plan_id: tradePlans[1].id,
      remark: '按计划执行买入'
    },
    {
      trading_day_id: tradingDays[2].id,
      order_no: 'ORD202401170003',
      symbol: '600519',
      name: '贵州茅台',
      order_type: 'limit',
      direction: 'buy',
      price: 1690.00,
      quantity: 10,
      filled_quantity: 10,
      status: 'filled',
      avg_fill_price: 1690.00,
      trade_plan_id: tradePlans[2].id,
      remark: '按计划执行买入'
    },
    {
      trading_day_id: tradingDays[2].id,
      order_no: 'ORD202401170004',
      symbol: '601899',
      name: '紫金矿业',
      order_type: 'limit',
      direction: 'buy',
      price: 15.50,
      quantity: 600,
      filled_quantity: 600,
      status: 'filled',
      avg_fill_price: 15.50,
      trade_plan_id: tradePlans[4].id,
      remark: '按计划执行买入'
    },
    {
      trading_day_id: tradingDays[1].id,
      order_no: 'ORD202401160001',
      symbol: '000001',
      name: '平安银行',
      order_type: 'limit',
      direction: 'buy',
      price: 11.20,
      quantity: 1000,
      filled_quantity: 1000,
      status: 'filled',
      avg_fill_price: 11.20,
      remark: '短线试探性买入'
    }
  ]);
  console.log('   创建了', orders.length, '个订单');

  console.log('6. 创建持仓数据...');
  const positions = await Position.bulkCreate([
    {
      trading_day_id: tradingDays[2].id,
      symbol: '002594',
      name: '比亚迪',
      direction: 'long',
      quantity: 100,
      available_quantity: 100,
      frozen_quantity: 0,
      avg_cost_price: 248.00,
      total_cost_amount: 24800.00,
      current_price: 250.80,
      market_value: 25080.00,
      floating_pnl: 280.00,
      floating_pnl_percent: 0.0113,
      realized_pnl: 0.00,
      position_ratio: 0.0222,
      max_drawdown: -0.005
    },
    {
      trading_day_id: tradingDays[2].id,
      symbol: '002415',
      name: '海康威视',
      direction: 'long',
      quantity: 300,
      available_quantity: 300,
      frozen_quantity: 0,
      avg_cost_price: 33.00,
      total_cost_amount: 9900.00,
      current_price: 33.50,
      market_value: 10050.00,
      floating_pnl: 150.00,
      floating_pnl_percent: 0.0152,
      realized_pnl: 0.00,
      position_ratio: 0.0089,
      max_drawdown: -0.003
    },
    {
      trading_day_id: tradingDays[2].id,
      symbol: '600519',
      name: '贵州茅台',
      direction: 'long',
      quantity: 10,
      available_quantity: 10,
      frozen_quantity: 0,
      avg_cost_price: 1690.00,
      total_cost_amount: 16900.00,
      current_price: 1698.00,
      market_value: 16980.00,
      floating_pnl: 80.00,
      floating_pnl_percent: 0.0047,
      realized_pnl: 0.00,
      position_ratio: 0.0150,
      max_drawdown: -0.002
    },
    {
      trading_day_id: tradingDays[2].id,
      symbol: '601899',
      name: '紫金矿业',
      direction: 'long',
      quantity: 600,
      available_quantity: 600,
      frozen_quantity: 0,
      avg_cost_price: 15.50,
      total_cost_amount: 9300.00,
      current_price: 15.65,
      market_value: 9390.00,
      floating_pnl: 90.00,
      floating_pnl_percent: 0.0097,
      realized_pnl: 0.00,
      position_ratio: 0.0083,
      max_drawdown: -0.002
    },
    {
      trading_day_id: tradingDays[2].id,
      symbol: '000001',
      name: '平安银行',
      direction: 'long',
      quantity: 1000,
      available_quantity: 1000,
      frozen_quantity: 0,
      avg_cost_price: 11.20,
      total_cost_amount: 11200.00,
      current_price: 11.42,
      market_value: 11420.00,
      floating_pnl: 220.00,
      floating_pnl_percent: 0.0196,
      realized_pnl: 0.00,
      position_ratio: 0.0101,
      max_drawdown: -0.005
    }
  ]);
  console.log('   创建了', positions.length, '条持仓数据');

  console.log('7. 创建风险预警数据（异常样例）...');
  const riskAlerts = await RiskAlert.bulkCreate([
    {
      trading_day_id: tradingDays[2].id,
      alert_type: 'single_stock_over_weight',
      severity: 'warning',
      status: 'active',
      symbol: '002594',
      title: '单票仓位过高',
      message: '比亚迪持仓市值占比达到 2.22%，接近配置上限',
      trigger_value: 0.0222,
      threshold_value: 0.03,
      unit: '%',
      data_snapshot: JSON.stringify({
        symbol: '002594',
        name: '比亚迪',
        market_value: 25080,
        position_ratio: 0.0222
      })
    },
    {
      trading_day_id: tradingDays[1].id,
      alert_type: 'continuous_loss',
      severity: 'danger',
      status: 'resolved',
      title: '连续亏损',
      message: '连续2个交易日出现亏损，累计亏损 25000 元',
      trigger_value: 2,
      threshold_value: 3,
      unit: '天',
      acknowledged_by: '模拟交易者',
      acknowledged_at: new Date(),
      resolution_note: '已调整仓位，降低风险敞口'
    },
    {
      trading_day_id: tradingDays[0].id,
      alert_type: 'chase_high_buy',
      severity: 'warning',
      status: 'acknowledged',
      symbol: '000001',
      title: '追高买入',
      message: '平安银行当日涨幅达 3.2% 时买入，属于追高行为',
      trigger_value: 0.032,
      threshold_value: 0.05,
      unit: '%',
      acknowledged_by: '模拟交易者',
      data_snapshot: JSON.stringify({
        symbol: '000001',
        name: '平安银行',
        change_percent: 3.2,
        buy_price: 11.20
      })
    },
    {
      trading_day_id: tradingDays[0].id,
      alert_type: 'stop_loss_not_executed',
      severity: 'critical',
      status: 'resolved',
      symbol: '000063',
      title: '止损未执行',
      message: '中兴通讯已跌破止损价 24.00 元，但未执行止损操作',
      trigger_value: 23.50,
      threshold_value: 24.00,
      unit: '元',
      acknowledged_by: '模拟交易者',
      acknowledged_at: new Date(),
      resolution_note: '已执行止损，亏损 200 元'
    },
    {
      trading_day_id: tradingDays[0].id,
      alert_type: 'max_drawdown_exceed',
      severity: 'warning',
      status: 'acknowledged',
      title: '最大回撤超限',
      message: '账户最大回撤达到 8.5%，超过预设阈值 5%',
      trigger_value: -0.085,
      threshold_value: -0.05,
      unit: '%',
      acknowledged_by: '模拟交易者'
    },
    {
      trading_day_id: tradingDays[0].id,
      alert_type: 'over_position',
      severity: 'danger',
      status: 'resolved',
      title: '仓位超限',
      message: '总仓位比例达到 92%，超过预警阈值 80%',
      trigger_value: 0.92,
      threshold_value: 0.80,
      unit: '%',
      acknowledged_by: '模拟交易者',
      acknowledged_at: new Date(),
      resolution_note: '已减仓至 65%'
    }
  ]);
  console.log('   创建了', riskAlerts.length, '条风险预警');

  console.log('8. 创建复盘笔记...');
  const reviewNotes = await ReviewNote.bulkCreate([
    {
      trading_day_id: tradingDays[0].id,
      title: '2024-01-15 交易复盘',
      category: 'trade_review',
      mood_rating: 3,
      execution_quality: 3,
      trade_summary: '今日共执行 5 笔买入，2 笔卖出。总体盈利 80,000 元，收益率 8%。比亚迪和贵州茅台表现较好，平安银行追高买入后被套。',
      lessons_learned: '1. 追高买入风险大，平安银行在涨幅 3% 时买入，当日即被套。\n2. 仓位控制不当，总仓位一度达到 92%，超过风险预警线。\n3. 止损执行不及时，中兴通讯跌破止损价后未及时止损。',
      improvement_plan: '1. 严格执行买入条件，涨幅超过 2% 的股票暂停买入。\n2. 单票仓位控制在 3% 以内，总仓位控制在 70% 以内。\n3. 设置止损提醒，跌破止损价 30 分钟内必须执行止损。',
      content: '今日整体交易情绪偏乐观，但存在明显的纪律问题。追高买入是最大的错误，需要深刻反思。仓位管理也需要加强，不能因为行情好就盲目加杠杆。止损执行不到位，需要设置更严格的提醒机制。',
      tags: ['追高', '仓位控制', '止损']
    },
    {
      trading_day_id: tradingDays[1].id,
      title: '2024-01-16 策略调整复盘',
      category: 'strategy_review',
      mood_rating: 4,
      execution_quality: 4,
      trade_summary: '今日调整策略，降低仓位至 65%。卖出部分平安银行，买入海康威视和紫金矿业。当日盈利 35,000 元，收益率 3.24%。',
      lessons_learned: '1. 减仓后心态更稳，交易决策更理性。\n2. 分散投资降低了单一标的风险。\n3. 按计划执行交易效果更好。',
      improvement_plan: '1. 继续保持当前仓位水平，不盲目加仓。\n2. 严格按照交易计划执行，不临时改变策略。\n3. 每日收盘后复盘当日交易。',
      tags: ['策略调整', '仓位管理', '分散投资']
    },
    {
      trading_day_id: tradingDays[0].id,
      title: '情绪管理反思',
      category: 'emotion_management',
      mood_rating: 2,
      execution_quality: 2,
      trade_summary: '今日看到平安银行快速上涨，产生了 FOMO 情绪，在高位追涨买入，结果当日被套。这是典型的情绪驱动交易。',
      lessons_learned: '1. FOMO 情绪是交易的大敌，必须克服。\n2. 交易决策必须基于计划，不能基于情绪。\n3. 当情绪激动时，应该暂停交易，冷静后再做决定。',
      improvement_plan: '1. 设置交易冷静期，下单前等待 5 分钟。\n2. 每次交易前默念：是否符合交易计划？\n3. 记录每笔交易的情绪状态，分析情绪对交易的影响。',
      tags: ['情绪管理', 'FOMO', '纪律']
    }
  ]);
  console.log('   创建了', reviewNotes.length, '篇复盘笔记');

  console.log('9. 创建自选股...');
  const watchlists = await Watchlist.bulkCreate([
    { trading_day_id: tradingDays[2].id, symbol: '002594', name: '比亚迪', sort_order: 1 },
    { trading_day_id: tradingDays[2].id, symbol: '002415', name: '海康威视', sort_order: 2 },
    { trading_day_id: tradingDays[2].id, symbol: '600519', name: '贵州茅台', sort_order: 3 },
    { trading_day_id: tradingDays[2].id, symbol: '000063', name: '中兴通讯', sort_order: 4 },
    { trading_day_id: tradingDays[2].id, symbol: '601899', name: '紫金矿业', sort_order: 5 },
    { trading_day_id: tradingDays[2].id, symbol: '000001', name: '平安银行', sort_order: 6 }
  ]);
  console.log('   创建了', watchlists.length, '只自选股');

  console.log('\n========================================');
  console.log('种子数据创建完成！');
  console.log('========================================');
  console.log('\n数据概览：');
  console.log('  - 交易日:', tradingDays.length, '个');
  console.log('  - 行情数据:', quotes.length, '条');
  console.log('  - 交易计划:', tradePlans.length, '个');
  console.log('  - 订单:', orders.length, '个');
  console.log('  - 持仓:', positions.length, '条');
  console.log('  - 风险预警:', riskAlerts.length, '条');
  console.log('  - 复盘笔记:', reviewNotes.length, '篇');
  console.log('  - 自选股:', watchlists.length, '只');
  console.log('\n========================================');
  console.log('样例数据说明：');
  console.log('========================================');
  console.log('\n【正常交易样例】:');
  console.log('  - 比亚迪: 按计划在 248 元买入 100 股');
  console.log('  - 海康威视: 按计划在 33 元买入 300 股');
  console.log('  - 贵州茅台: 按计划在 1690 元买入 10 股');
  console.log('  - 紫金矿业: 按计划在 15.5 元买入 600 股');
  console.log('\n【异常交易样例（用于风控测试）】:');
  console.log('  - 追高买入: 平安银行涨幅 3% 时买入');
  console.log('  - 仓位超限: 总仓位一度达到 92%');
  console.log('  - 连续亏损: 连续 2 个交易日亏损');
  console.log('  - 止损未执行: 中兴通讯跌破止损价未执行');
  console.log('  - 最大回撤: 账户回撤达到 8.5%');
  console.log('  - 单票超配: 比亚迪仓位接近上限');
  console.log('\n========================================');
  console.log('数据库已初始化，包含种子数据。');
  console.log('========================================');

  process.exit(0);
}

seed().catch(err => {
  console.error('种子数据创建失败:', err);
  process.exit(1);
});
