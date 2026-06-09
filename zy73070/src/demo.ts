import fs from 'fs';
import path from 'path';
import { seedDemoData } from './seed';
import app from './app';
import { forceFlush } from './repositories';

const dbFile = path.join(__dirname, '..', 'data', 'switchgear.json');
if (fs.existsSync(dbFile)) {
  fs.unlinkSync(dbFile);
  console.log('（demo模式：清理旧数据库，重新完整注入不整洁的演示场景。');
}

seedDemoData();
forceFlush();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│   🎬 演示数据已注入，后端服务已启动，可供演示                   │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log(`│   健康检查:   curl http://localhost:${PORT}/health                │`);
  console.log(`│   工单列表:   curl http://localhost:${PORT}/api/v1/work-orders    │`);
  console.log(`│   重复告警:   curl http://localhost:${PORT}/api/v1/duplicate-alerts│`);
  console.log(`│   审计日志:   curl http://localhost:${PORT}/api/v1/audit-logs     │`);
  console.log('│                                                                 │');
  console.log('│   演示亮点（全部可直接验证）：                                    │');
  console.log('│   1. WZ-2026-0601-001  多次改判，展示来源链                      │');
  console.log('│   2. WZ-2026-0601-002  脏数据未清洗（null/NaN/短内容）           │');
  console.log('│   3. WZ-2026-0601-003+004  同设备号PDG-C-012重复，挂起未自动合并 │');
  console.log('│   4. WZ-2026-0602-005  补录红外测温+改判留痕（旧材料快照）        │');
  console.log('│   5. WZ-2026-0602-006  撤回记录完整保留（撤回人+原因）            │');
  console.log('│   6. WZ-2026-0602-007  传感器故障：先误判normal→改判sensor_fault │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');
});
