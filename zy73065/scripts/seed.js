const fs = require('fs');
const path = require('path');
const { buildLegacyRows } = require('./sample-data');
const { DB_PATH, ready, resetDB, initDB, getDB } = require('../backend/db');
const core = require('../backend/replay-core');

(async () => {
  await ready();
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  await ready();
  resetDB();
  initDB();
  console.log('[seed] 数据库已重置');

  const rows = buildLegacyRows();
  const result = core.importLegacyData({
    fileName: 'legacy_workorders_2026H1.json',
    operator: '项目助理-小林',
    rows
  });
  console.log(`[seed] 已导入 ${rows.length} 条历史工单, 回放步骤 #${result.step.seq_no}`);

  const d = getDB();
  const counts = {
    workorders: d.prepare('SELECT COUNT(*) c FROM workorders').get().c,
    sensor_logs: d.prepare('SELECT COUNT(*) c FROM sensor_logs').get().c,
    spare_parts: d.prepare('SELECT COUNT(*) c FROM spare_parts').get().c,
    boundaries: d.prepare('SELECT COUNT(*) c FROM sensor_logs WHERE is_boundary=1').get().c,
    anomalies_impact: d.prepare(`SELECT COUNT(DISTINCT workorder_id) c FROM sensor_logs
      WHERE vibration>8.5 OR vibration<0.3 OR pitch>32 OR pitch<-2 OR temp>78 OR temp<-15`).get().c
  };
  console.log('[seed] 统计:', counts);
  console.log('[seed] ✅ 样例数据已写入。执行 `npm start` 启动服务，然后 `npm run graytest` 跑灰度流程');
})().catch(e => { console.error('[seed] 失败:', e); process.exit(1); });
