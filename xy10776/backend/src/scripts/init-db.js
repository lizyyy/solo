const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const initSampleData = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const metrics = [];
      const chartCodes = ['user_growth', 'order_conversion', 'revenue_trend', 'active_users'];
      const metricNames = ['新增用户', '转化率', '收入', '活跃用户数', '订单量'];
      
      for (let i = 0; i < 30; i++) {
        const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
        chartCodes.forEach(chartCode => {
          metricNames.forEach(metricName => {
            metrics.push({
              id: uuidv4(),
              chart_code: chartCode,
              metric_name: metricName,
              metric_value: Math.random() * 1000 + 100,
              metric_date: date,
              dimension: Math.random() > 0.5 ? 'ios' : 'android'
            });
          });
        });
      }

      const stmt = db.prepare(`
        INSERT OR IGNORE INTO chart_metrics (id, chart_code, metric_name, metric_value, metric_date, dimension)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      metrics.forEach(m => {
        stmt.run(m.id, m.chart_code, m.metric_name, m.metric_value, m.metric_date, m.dimension);
      });

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('示例指标数据初始化完成');
          resolve();
        }
      });
    });
  });
};

initSampleData().then(() => {
  console.log('数据库初始化完成');
  process.exit(0);
}).catch((err) => {
  console.error('初始化失败:', err);
  process.exit(1);
});
