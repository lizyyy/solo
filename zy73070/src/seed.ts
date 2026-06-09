import db from './database';
import { workOrderService } from './services';
import fs from 'fs';
import path from 'path';

function sleep(ms: number) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // busy wait for deterministic timestamps
  }
}

export function seedDemoData() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  正在注入【配电柜温升工单回放】演示数据（刻意保留不整洁场景）');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // ── 1. 正常工单，先录入后改判 ──
  console.log('【场景1】正常工单 + 多次改判（展示改判来源链）');
  const wo1 = workOrderService.createWorkOrder({
    work_order_no: 'WZ-2026-0601-001',
    device_code: 'PDG-A-001',
    device_name: '1号高压进线柜',
    temperature_value: 82.5,
    temperature_threshold: 75.0,
    raw_sensor_log: `2026-06-01 08:15:22 传感器ID:S001 设备:PDG-A-001 上触头温度:82.5°C 环境温度:31°C 湿度:56%`,
    initial_conclusion: 'normal',
    created_by: 'engineer_zhang',
    created_by_name: '张工',
    sensor_sources: [
      {
        raw_content: `[PUSH] gateway_id:GW03 2026-06-01T08:15:22.333Z msg_id:MSG-20260601-081522`,
        source_type: 'api_push',
        source_identifier: 'GW03-MSG-20260601-081522',
        is_dirty: false,
      },
    ],
  });
  console.log('  ✓ 创建工单：', wo1.work_order.work_order_no, '→ 初始结论', wo1.work_order.initial_conclusion);

  sleep(20);
  const cv1 = workOrderService.changeVerdict({
    work_order_id: wo1.work_order.id,
    new_conclusion: 'overheat_warning',
    change_reason: '现场老师复核发现82.5°C超过75°C阈值，初始结论录入错误。',
    operator_id: 'supervisor_min',
    operator_name: '维保主管阿敏',
    remark: '阿敏月底被异常平均值盖住，复核时发现。',
  });
  console.log('  ✓ 改判1次：', cv1.verdict_history.old_conclusion, '→', cv1.verdict_history.new_conclusion, '（来源：', cv1.verdict_history.operator_name, '）');

  sleep(20);
  const cv2 = workOrderService.changeVerdict({
    work_order_id: wo1.work_order.id,
    new_conclusion: 'overheat_alarm',
    change_reason: '再次查看连续3天趋势：05-30 78°C / 05-31 80°C / 06-01 82.5°C，趋势确认告警级。',
    operator_id: 'engineer_li',
    operator_name: '李工程师',
    supplementary_material: '已附连续3天趋势图截图，以及传感器S001校准记录。',
    remark: '建议立即安排停电检修。',
  });
  console.log('  ✓ 改判2次：', cv2.verdict_history.old_conclusion, '→', cv2.verdict_history.new_conclusion, '（来源：', cv2.verdict_history.operator_name, '）');
  console.log('');

  // ── 2. 脏数据工单：传感器日志不齐整 ──
  console.log('【场景2】脏数据工单（传感器日志缺时间戳、null、短内容，刻意不清洗原样保留）');
  const wo2 = workOrderService.createWorkOrder({
    work_order_no: 'WZ-2026-0601-002',
    device_code: 'PDG-B-007',
    device_name: '7号电容补偿柜',
    temperature_value: null as any,
    temperature_threshold: 75.0,
    raw_sensor_log: `null 温度异常 null sensor:NaN 数据不完整`,
    initial_conclusion: 'data_incomplete',
    created_by: 'intern_wang',
    created_by_name: '实习生小王',
    sensor_sources: [
      {
        raw_content: '短',
        source_type: 'file_upload',
        source_identifier: '上传的残缺CSV片段',
        is_dirty: true,
        dirty_notes: 'CSV文件行数不足，缺少采集时间戳',
      },
      {
        raw_content: `2026-06-01 现场拍照手抄：PDG-B-007 柜体温感热，但未带测温仪`,
        source_type: 'manual_import',
        source_identifier: '手抄记录-007',
        is_dirty: true,
      },
    ],
  });
  console.log('  ✓ 创建脏数据工单：', wo2.work_order.work_order_no, '脏日志数：', wo2.raw_logs.filter(l => l.is_dirty).length, '条（未被清洗，原样保留）');
  console.log('');

  // ── 3. 设备编号重复：第一条（正常的先录入） ──
  console.log('【场景3】设备编号重复（触发挂起，等现场老师确认，不给假稳定结论）');
  const wo3 = workOrderService.createWorkOrder({
    work_order_no: 'WZ-2026-0601-003',
    device_code: 'PDG-C-012',
    device_name: '12号低压出线柜',
    temperature_value: 68.0,
    temperature_threshold: 75.0,
    raw_sensor_log: `2026-06-01 09:30:00 传感器ID:S012 设备:PDG-C-012 温度:68.0°C`,
    initial_conclusion: 'normal',
    created_by: 'engineer_chen',
    created_by_name: '陈工',
  });
  console.log('  ✓ 先录入正常工单：', wo3.work_order.work_order_no, '设备号', wo3.work_order.device_code);
  sleep(20);

  // 同设备号的第二条：触发重复检测 → 挂起
  const wo4 = workOrderService.createWorkOrder({
    work_order_no: 'WZ-2026-0601-004',
    device_code: 'PDG-C-012',
    device_name: '12号低压出线柜（现场重新录入）',
    temperature_value: 92.3,
    temperature_threshold: 75.0,
    raw_sensor_log: `2026-06-01 10:05:11 传感器ID:S012 设备:PDG-C-012 温度:92.3°C 疑似重复录入`,
    initial_conclusion: 'overheat_alarm',
    created_by: 'engineer_zhao',
    created_by_name: '赵工',
  });
  console.log(
    '  ✓ 同设备号再录入：',
    wo4.work_order.work_order_no,
    '→ 自动挂起？',
    wo4.work_order.is_suspended === 1 ? '是 ✔' : '否'
  );
  console.log('  挂起原因：', wo4.work_order.suspend_reason);
  console.log('  冲突工单数：', wo4.duplicate_alert ? 1 : 0, '条，等待现场老师确认，绝不自动合并出假结论');
  console.log('');

  // ── 4. 补录后结论变化（旧材料+新备注+改判原因） ──
  console.log('【场景4】补录后结论变化（历史里看旧材料、新材料、改判原因全留痕）');
  const wo5 = workOrderService.createWorkOrder({
    work_order_no: 'WZ-2026-0602-005',
    device_code: 'PDG-D-020',
    device_name: '20号联络柜',
    temperature_value: 76.2,
    temperature_threshold: 75.0,
    raw_sensor_log: `2026-06-02 08:00:00 S020 温度:76.2°C`,
    initial_conclusion: 'overheat_warning',
    created_by: 'engineer_zhao',
    created_by_name: '赵工',
  });
  console.log('  ✓ 创建初始工单：', wo5.work_order.work_order_no, '→ 结论', wo5.work_order.initial_conclusion);
  sleep(20);
  const sm = workOrderService.supplementMaterial({
    work_order_id: wo5.work_order.id,
    supplementary_material: `2026-06-02 14:22:18 现场红外测温复核：母线排连接点最高温度94.7°C，热像图编号THERMAL-20260602-0123，环境温度34°C，A相连接螺栓松动。`,
    new_conclusion: 'overheat_alarm',
    change_reason: '补录了下午14点红外测温记录，实际温度远超阈值，且发现螺栓松动，由预警升为告警级。',
    operator_id: 'supervisor_min',
    operator_name: '维保主管阿敏',
    remark: '红外图像已存档至档案系统编号：ARCH-2026-0602-0123',
  });
  console.log(
    '  ✓ 补录+改判：',
    sm.verdict_history?.old_conclusion,
    '→',
    sm.verdict_history?.new_conclusion,
    '（旧材料快照：',
    sm.verdict_history?.previous_material_snapshot ? '已保存快照' : '未保存',
    '）'
  );
  console.log('  改判原因：', sm.verdict_history?.change_reason);
  console.log('');

  // ── 5. 撤回记录（有撤回人+撤回原因） ──
  console.log('【场景5】撤回工单（保留撤回记录不删除历史全留痕）');
  const wo6 = workOrderService.createWorkOrder({
    work_order_no: 'WZ-2026-0602-006',
    device_code: 'PDG-E-031',
    device_name: '31号备用柜',
    temperature_value: 45.0,
    temperature_threshold: 75.0,
    raw_sensor_log: `2026-06-02 11:00:00 S031 45.0°C`,
    initial_conclusion: 'normal',
    created_by: 'intern_wang',
    created_by_name: '实习生小王',
  });
  console.log('  ✓ 创建工单：', wo6.work_order.work_order_no);
  sleep(20);
  const rescinded = workOrderService.rescindWorkOrder({
    work_order_id: wo6.work_order.id,
    rescind_reason: '发现设备号PDG-E-031实际对应是消防配电柜，不在本月温升监测范围，录入错误，撤回处理。',
    rescinded_by: 'supervisor_min',
    rescinded_by_name: '维保主管阿敏',
  });
  console.log(
    '  ✓ 撤回：is_rescinded=',
    rescinded.is_rescinded === 1 ? '是 ✔' : '否',
    '撤回人：',
    rescinded.rescinded_by,
    '，撤回原因：',
    rescinded.rescind_reason
  );
  console.log('');

  // ── 6. 传感器故障判定（先正常录入，后根据跳变记录改判为故障） ──
  console.log('【场景6】传感器故障（先误判正常，后根据跳变记录+补录改判为sensor_fault）');
  const wo7 = workOrderService.createWorkOrder({
    work_order_no: 'WZ-2026-0602-007',
    device_code: 'PDG-F-044',
    device_name: '44号计量柜',
    temperature_value: 68.0,
    temperature_threshold: 75.0,
    raw_sensor_log: `2026-06-02 10:00:00 S044 温度:68°C`,
    initial_conclusion: 'normal',
    created_by: 'engineer_zhang',
    created_by_name: '张工',
  });
  console.log('  ✓ 创建工单：', wo7.work_order.work_order_no, '结论：', wo7.work_order.current_conclusion);
  sleep(20);
  workOrderService.supplementMaterial({
    work_order_id: wo7.work_order.id,
    supplementary_material: `调阅传感器S044近24小时历史：08:00 72°C / 09:00 3.2°C / 09:30 73°C / 10:00 68°C / 10:30 3.2°C，数据间歇性跳变，疑似传感器接触不良断线`,
    operator_id: 'engineer_zhang',
    operator_name: '张工',
    remark: '调阅完整传感器曲线后发现跳变',
  });
  const cv3 = workOrderService.changeVerdict({
    work_order_id: wo7.work_order.id,
    new_conclusion: 'sensor_fault',
    change_reason: '补录的24小时历史曲线显示温度值在3°C~73°C间间歇性跳变，断线特征明显，判定为S044传感器故障，实际配电柜温度正常。',
    operator_id: 'engineer_li',
    operator_name: '李工程师',
    supplementary_material: '24小时趋势图（附件号：TREND-20260602-S044）',
    remark: '已派单更换传感器S044',
  });
  console.log('  ✓ 补录24h跳变记录 + 改判为传感器故障：', cv3.verdict_history.old_conclusion, '→', cv3.verdict_history.new_conclusion);
  console.log('');

  // ── 汇总 ──
  const unresolvedDup = workOrderService.listUnresolvedDuplicates();
  const allOrders = workOrderService.listWorkOrders({});
  const auditCount = workOrderService.listAuditLogs(1000).length;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  演示数据注入完成，现在系统状态：');
  console.log('    • 总工单数量：', allOrders.length, '条');
  console.log('    • 已挂起工单：', allOrders.filter(o => o.is_suspended).length, '条（设备编号重复，等现场确认）');
  console.log('    • 已撤回工单：', allOrders.filter(o => o.is_rescinded).length, '条（撤回记录完整保留）');
  console.log('    • 未解决重复告警：', unresolvedDup.length, '条');
  console.log('    • 审计日志总数：', auditCount, '条');
  console.log('    • 脏日志条数：故意未清洗，在 raw_sensor_logs.is_dirty');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  运行 npm run dev     启动服务');
  console.log('  运行 npm run demo    完整演示流程 + 启动服务');
  console.log('');

  return { wo1, wo2, wo3, wo4, wo5, wo6, wo7 };
}

if (require.main === module) {
  const dbFile = path.join(__dirname, '..', 'data', 'switchgear.json');
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
    console.log('已清理旧数据库，重建干净库重新注入演示数据。');
  }
  seedDemoData();
}
