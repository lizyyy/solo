const { initDatabase, runQuery, getQuery } = require('../database/db');

const SAMPLE_CINEMAS = [
  {
    cinema_id: 'CIN001',
    cinema_name: '万达影城(朝阳店)',
    address: '北京市朝阳区建国路88号',
    city: '北京'
  },
  {
    cinema_id: 'CIN002',
    cinema_name: 'CGV影城(七宝店)',
    address: '上海市闵行区漕宝路3366号',
    city: '上海'
  },
  {
    cinema_id: 'CIN003',
    cinema_name: '金逸影城(天河店)',
    address: '广州市天河区天河路188号',
    city: '广州'
  }
];

const SAMPLE_MEMBERS = [
  {
    member_id: 'MEM001',
    member_name: '张三',
    phone: '13800138001',
    member_level: '钻石会员',
    total_points: 2580
  },
  {
    member_id: 'MEM002',
    member_name: '李四',
    phone: '13800138002',
    member_level: '黄金会员',
    total_points: 1260
  },
  {
    member_id: 'MEM003',
    member_name: '王五',
    phone: '13800138003',
    member_level: '普通会员',
    total_points: 320
  },
  {
    member_id: 'MEM004',
    member_name: '赵六',
    phone: '13800138004',
    member_level: '白金会员',
    total_points: 3890
  }
];

const SAMPLE_RECORDS = [
  {
    record_id: 'REC_001_normal',
    ticket_no: 'WD20240115001',
    member_id: 'MEM001',
    cinema_id: 'CIN001',
    movie_name: '流浪地球3',
    show_time: '2024-01-15 19:30:00',
    seat_no: '8排12座',
    ticket_amount: 58.00,
    points_earned: 58,
    status: 'normal',
    submit_source: '微信小程序',
    submit_time: '2024-01-15 20:15:00',
    operator: '前台小丽',
    reject_reason: null,
    supplement_note: null,
    audit_time: null,
    auditor: null
  },
  {
    record_id: 'REC_002_rejected',
    ticket_no: 'WD20240116002',
    member_id: 'MEM002',
    cinema_id: 'CIN001',
    movie_name: '热辣滚烫',
    show_time: '2024-01-16 14:00:00',
    seat_no: '5排8座',
    ticket_amount: 45.00,
    points_earned: 45,
    status: 'rejected',
    submit_source: '现场补录',
    submit_time: '2024-01-16 16:30:00',
    operator: '前台小王',
    reject_reason: '票根照片模糊，无法验证',
    supplement_note: null,
    audit_time: null,
    auditor: null
  },
  {
    record_id: 'REC_003_supplemented',
    ticket_no: 'CGV20240117003',
    member_id: 'MEM003',
    cinema_id: 'CIN002',
    movie_name: '飞驰人生2',
    show_time: '2024-01-17 20:00:00',
    seat_no: '10排5座',
    ticket_amount: 52.00,
    points_earned: 52,
    status: 'supplemented',
    submit_source: '客服热线',
    submit_time: '2024-01-17 22:10:00',
    operator: '客服小张',
    reject_reason: '系统未查询到购票记录',
    supplement_note: '已补充纸质票根照片和支付凭证',
    audit_time: null,
    auditor: null
  },
  {
    record_id: 'REC_004_completed',
    ticket_no: 'JY20240118004',
    member_id: 'MEM004',
    cinema_id: 'CIN003',
    movie_name: '第二十条',
    show_time: '2024-01-18 15:30:00',
    seat_no: '6排15座',
    ticket_amount: 68.00,
    points_earned: 68,
    status: 'completed',
    submit_source: 'APP端申请',
    submit_time: '2024-01-18 18:00:00',
    operator: '会员部小李',
    reject_reason: null,
    supplement_note: null,
    audit_time: '2024-01-18 19:30:00',
    auditor: '审核员老王'
  },
  {
    record_id: 'REC_005_completed_flow',
    ticket_no: 'WD20240119005',
    member_id: 'MEM001',
    cinema_id: 'CIN001',
    movie_name: '熊出没·逆转时空',
    show_time: '2024-01-19 10:30:00',
    seat_no: '3排7座',
    ticket_amount: 35.00,
    points_earned: 35,
    status: 'completed',
    submit_source: '微信小程序',
    submit_time: '2024-01-19 12:45:00',
    operator: '前台小丽',
    reject_reason: null,
    supplement_note: null,
    audit_time: '2024-01-19 14:00:00',
    auditor: '审核员老王'
  },
  {
    record_id: 'REC_006_normal_complex',
    ticket_no: 'CGV20240120006',
    member_id: 'MEM002',
    cinema_id: 'CIN002',
    movie_name: '红毯先生',
    show_time: '2024-01-20 21:00:00',
    seat_no: 'IMAX厅 2排10座',
    ticket_amount: 128.00,
    points_earned: 128,
    status: 'normal',
    submit_source: '现场补录',
    submit_time: '2024-01-20 23:30:00',
    operator: '前台小陈',
    reject_reason: null,
    supplement_note: null,
    audit_time: null,
    auditor: null
  }
];

const SAMPLE_FLOWS = [
  {
    flow_id: 'FLOW_001',
    record_id: 'REC_004_completed',
    member_id: 'MEM004',
    points_change: 68,
    flow_type: 'EARN',
    flow_time: '2024-01-18 19:30:00',
    operator: '审核员老王',
    remark: '观影积分补录: 第二十条'
  },
  {
    flow_id: 'FLOW_002',
    record_id: 'REC_005_completed_flow',
    member_id: 'MEM001',
    points_change: 35,
    flow_type: 'EARN',
    flow_time: '2024-01-19 14:00:00',
    operator: '审核员老王',
    remark: '观影积分补录: 熊出没·逆转时空'
  }
];

const SAMPLE_LOGS = [
  {
    log_id: 'LOG_001',
    record_id: 'REC_001_normal',
    operator: '前台小丽',
    operation: 'CREATE',
    old_status: null,
    new_status: 'normal',
    operation_time: '2024-01-15 20:15:00',
    remark: '创建积分补录记录'
  },
  {
    log_id: 'LOG_002',
    record_id: 'REC_002_rejected',
    operator: '前台小王',
    operation: 'CREATE',
    old_status: null,
    new_status: 'normal',
    operation_time: '2024-01-16 16:30:00',
    remark: '创建积分补录记录'
  },
  {
    log_id: 'LOG_003',
    record_id: 'REC_002_rejected',
    operator: '审核员老王',
    operation: 'STATUS_CHANGE',
    old_status: 'normal',
    new_status: 'rejected',
    operation_time: '2024-01-16 17:00:00',
    remark: '票根照片模糊，无法验证'
  },
  {
    log_id: 'LOG_004',
    record_id: 'REC_003_supplemented',
    operator: '客服小张',
    operation: 'CREATE',
    old_status: null,
    new_status: 'normal',
    operation_time: '2024-01-17 22:10:00',
    remark: '创建积分补录记录'
  },
  {
    log_id: 'LOG_005',
    record_id: 'REC_003_supplemented',
    operator: '审核员老王',
    operation: 'STATUS_CHANGE',
    old_status: 'normal',
    new_status: 'rejected',
    operation_time: '2024-01-17 23:00:00',
    remark: '系统未查询到购票记录'
  },
  {
    log_id: 'LOG_006',
    record_id: 'REC_003_supplemented',
    operator: '客服小张',
    operation: 'STATUS_CHANGE',
    old_status: 'rejected',
    new_status: 'supplemented',
    operation_time: '2024-01-18 09:30:00',
    remark: '已补充纸质票根照片和支付凭证'
  },
  {
    log_id: 'LOG_007',
    record_id: 'REC_004_completed',
    operator: '会员部小李',
    operation: 'CREATE',
    old_status: null,
    new_status: 'normal',
    operation_time: '2024-01-18 18:00:00',
    remark: '创建积分补录记录'
  },
  {
    log_id: 'LOG_008',
    record_id: 'REC_004_completed',
    operator: '审核员老王',
    operation: 'STATUS_CHANGE',
    old_status: 'normal',
    new_status: 'completed',
    operation_time: '2024-01-18 19:30:00',
    remark: '状态从 normal 变更为 completed'
  },
  {
    log_id: 'LOG_009',
    record_id: 'REC_005_completed_flow',
    operator: '前台小丽',
    operation: 'CREATE',
    old_status: null,
    new_status: 'normal',
    operation_time: '2024-01-19 12:45:00',
    remark: '创建积分补录记录'
  },
  {
    log_id: 'LOG_010',
    record_id: 'REC_005_completed_flow',
    operator: '审核员老王',
    operation: 'STATUS_CHANGE',
    old_status: 'normal',
    new_status: 'completed',
    operation_time: '2024-01-19 14:00:00',
    remark: '状态从 normal 变更为 completed'
  },
  {
    log_id: 'LOG_011',
    record_id: 'REC_006_normal_complex',
    operator: '前台小陈',
    operation: 'CREATE',
    old_status: null,
    new_status: 'normal',
    operation_time: '2024-01-20 23:30:00',
    remark: '创建积分补录记录'
  }
];

async function initSampleData() {
  console.log('开始初始化样例数据...\n');

  await initDatabase();

  console.log('1. 插入影院数据...');
  for (const cinema of SAMPLE_CINEMAS) {
    await runQuery(`
      INSERT OR REPLACE INTO cinemas (cinema_id, cinema_name, address, city)
      VALUES (?, ?, ?, ?)
    `, [cinema.cinema_id, cinema.cinema_name, cinema.address, cinema.city]);
  }
  console.log(`   已插入 ${SAMPLE_CINEMAS.length} 家影院\n`);

  console.log('2. 插入会员数据...');
  for (const member of SAMPLE_MEMBERS) {
    await runQuery(`
      INSERT OR REPLACE INTO members (member_id, member_name, phone, member_level, total_points)
      VALUES (?, ?, ?, ?, ?)
    `, [member.member_id, member.member_name, member.phone, member.member_level, member.total_points]);
  }
  console.log(`   已插入 ${SAMPLE_MEMBERS.length} 名会员\n`);

  console.log('3. 插入积分补录记录...');
  console.log('   包含以下状态:');
  console.log('   - normal (正常待审核): 3条');
  console.log('   - rejected (已驳回): 1条');
  console.log('   - supplemented (已补录): 1条');
  console.log('   - completed (已完成): 2条');
  for (const record of SAMPLE_RECORDS) {
    await runQuery(`
      INSERT OR REPLACE INTO point_records (
        record_id, ticket_no, member_id, cinema_id, movie_name, show_time,
        seat_no, ticket_amount, points_earned, status, submit_source,
        submit_time, operator, reject_reason, supplement_note, audit_time, auditor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.record_id, record.ticket_no, record.member_id, record.cinema_id,
      record.movie_name, record.show_time, record.seat_no, record.ticket_amount,
      record.points_earned, record.status, record.submit_source, record.submit_time,
      record.operator, record.reject_reason, record.supplement_note,
      record.audit_time, record.auditor
    ]);
  }
  console.log(`   已插入 ${SAMPLE_RECORDS.length} 条积分补录记录\n`);

  console.log('4. 插入积分流水数据...');
  for (const flow of SAMPLE_FLOWS) {
    await runQuery(`
      INSERT OR REPLACE INTO point_flows (
        flow_id, record_id, member_id, points_change, flow_type,
        flow_time, operator, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      flow.flow_id, flow.record_id, flow.member_id, flow.points_change,
      flow.flow_type, flow.flow_time, flow.operator, flow.remark
    ]);
  }
  console.log(`   已插入 ${SAMPLE_FLOWS.length} 条积分流水\n`);

  console.log('5. 插入操作日志数据...');
  for (const log of SAMPLE_LOGS) {
    await runQuery(`
      INSERT OR REPLACE INTO operation_logs (
        log_id, record_id, operator, operation, old_status,
        new_status, operation_time, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      log.log_id, log.record_id, log.operator, log.operation,
      log.old_status, log.new_status, log.operation_time, log.remark
    ]);
  }
  console.log(`   已插入 ${SAMPLE_LOGS.length} 条操作日志\n`);

  console.log('========================================');
  console.log('样例数据初始化完成!');
  console.log('========================================');
  console.log('数据概览:');
  console.log('  - 影院: 3家 (北京万达、上海CGV、广州金逸)');
  console.log('  - 会员: 4名 (钻石、黄金、普通、白金)');
  console.log('  - 积分补录记录: 6条');
  console.log('    * 正常待审核: 3条');
  console.log('    * 已驳回: 1条');
  console.log('    * 已补录: 1条');
  console.log('    * 已完成: 2条 (含积分流水)');
  console.log('  - 积分流水: 2条');
  console.log('  - 操作日志: 11条');
  console.log('========================================\n');
}

initSampleData().catch(console.error);