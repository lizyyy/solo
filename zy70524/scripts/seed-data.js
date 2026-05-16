const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data', 'risk.db');
const db = new sqlite3.Database(dbPath);

const now = Date.now();

const accounts = [
  {
    id: uuidv4(),
    account_no: 'CS001',
    username: '张三',
    department: '客服一部',
    role: '高级客服',
    status: 'active',
    created_at: now,
    updated_at: now
  },
  {
    id: uuidv4(),
    account_no: 'CS002',
    username: '李四',
    department: '客服二部',
    role: '客服主管',
    status: 'active',
    created_at: now,
    updated_at: now
  },
  {
    id: uuidv4(),
    account_no: 'CS003',
    username: '王五',
    department: '客服一部',
    role: '初级客服',
    status: 'active',
    created_at: now,
    updated_at: now
  }
];

const deviceFingerprints = [
  {
    id: uuidv4(),
    account_id: accounts[0].id,
    fingerprint_hash: 'abc123def456ghi789',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    screen_resolution: '1920x1080',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    platform: 'Win32',
    canvas_fingerprint: 'canvas_001',
    webgl_fingerprint: 'webgl_001',
    fonts: 'Arial,Helvetica,sans-serif',
    plugins: 'Chrome PDF Plugin',
    ip_address: '192.168.1.100',
    is_trusted: 1,
    first_seen: now,
    last_seen: now
  },
  {
    id: uuidv4(),
    account_id: accounts[1].id,
    fingerprint_hash: 'xyz789uvw456rst123',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    screen_resolution: '2560x1440',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    platform: 'MacIntel',
    canvas_fingerprint: 'canvas_002',
    webgl_fingerprint: 'webgl_002',
    fonts: 'Arial,Helvetica,sans-serif',
    plugins: 'Chrome PDF Plugin',
    ip_address: '192.168.1.101',
    is_trusted: 1,
    first_seen: now,
    last_seen: now
  }
];

const loginLocations = [
  {
    id: uuidv4(),
    account_id: accounts[0].id,
    ip_address: '192.168.1.100',
    country: '中国',
    province: '广东省',
    city: '深圳市',
    district: '南山区',
    latitude: 22.5431,
    longitude: 114.0579,
    isp: '中国电信',
    is_common_location: 1,
    first_seen: now,
    last_seen: now
  },
  {
    id: uuidv4(),
    account_id: accounts[1].id,
    ip_address: '192.168.1.101',
    country: '中国',
    province: '广东省',
    city: '广州市',
    district: '天河区',
    latitude: 23.1291,
    longitude: 113.2644,
    isp: '中国移动',
    is_common_location: 1,
    first_seen: now,
    last_seen: now
  }
];

const riskEvents = [
  {
    id: uuidv4(),
    account_id: accounts[0].id,
    event_type: 'abnormal_location',
    risk_score: 75,
    risk_level: 'high',
    status: 'pending_disposition',
    source_ip: '203.0.113.50',
    source_location_id: null,
    device_fingerprint_id: null,
    raw_input: JSON.stringify({
      account_no: 'CS001',
      ip_address: '203.0.113.50',
      location: { country: '中国', province: '北京市', city: '北京市' },
      device_fingerprint: { fingerprint_hash: 'unknown_001' }
    }),
    processing_rules: JSON.stringify([
      { rule: 'UNKNOWN_LOCATION', weight: 25, reason: '未知登录地点' },
      { rule: 'CROSS_REGION_LOGIN', weight: 35, reason: '跨区域登录' }
    ]),
    failure_reason: null,
    final_conclusion: null,
    detected_at: now - 3600000,
    created_at: now - 3600000,
    updated_at: now
  },
  {
    id: uuidv4(),
    account_id: accounts[1].id,
    event_type: 'unknown_device',
    risk_score: 30,
    risk_level: 'low',
    status: 'detected',
    source_ip: '198.51.100.25',
    source_location_id: loginLocations[1].id,
    device_fingerprint_id: null,
    raw_input: JSON.stringify({
      account_no: 'CS002',
      ip_address: '198.51.100.25',
      location: { country: '中国', province: '广东省', city: '广州市' },
      device_fingerprint: { fingerprint_hash: 'new_device_001' }
    }),
    processing_rules: JSON.stringify([
      { rule: 'UNKNOWN_DEVICE', weight: 30, reason: '未知设备登录' }
    ]),
    failure_reason: null,
    final_conclusion: null,
    detected_at: now - 1800000,
    created_at: now - 1800000,
    updated_at: now
  },
  {
    id: uuidv4(),
    account_id: accounts[2].id,
    event_type: 'suspicious_login',
    risk_score: 90,
    risk_level: 'critical',
    status: 'review_required',
    source_ip: '198.51.100.100',
    source_location_id: null,
    device_fingerprint_id: null,
    raw_input: JSON.stringify({
      account_no: 'CS003',
      ip_address: '198.51.100.100',
      ip_blacklisted: true,
      location: { country: '美国', province: 'California', city: 'Los Angeles' },
      device_fingerprint: { fingerprint_hash: 'malicious_001' }
    }),
    processing_rules: JSON.stringify([
      { rule: 'UNKNOWN_LOCATION', weight: 25, reason: '未知登录地点' },
      { rule: 'CROSS_REGION_LOGIN', weight: 35, reason: '跨区域登录' },
      { rule: 'IP_BLACKLIST', weight: 50, reason: 'IP在黑名单中' }
    ]),
    failure_reason: 'IP地址在黑名单中，需要人工复核',
    final_conclusion: null,
    detected_at: now - 600000,
    created_at: now - 600000,
    updated_at: now
  }
];

const dispositions = [
  {
    id: uuidv4(),
    risk_event_id: riskEvents[0].id,
    action_type: 'alert_only',
    action_result: 'success',
    operator: 'system',
    operator_type: 'system',
    reason: '自动告警通知',
    executed_at: now - 3000000,
    created_at: now - 3000000
  }
];

const histories = [
  {
    id: uuidv4(),
    risk_event_id: riskEvents[0].id,
    field_name: 'status',
    old_value: 'detected',
    new_value: 'analyzing',
    operator: 'system',
    operator_type: 'system',
    change_reason: '自动分析',
    changed_at: now - 3300000
  },
  {
    id: uuidv4(),
    risk_event_id: riskEvents[0].id,
    field_name: 'status',
    old_value: 'analyzing',
    new_value: 'pending_disposition',
    operator: 'system',
    operator_type: 'system',
    change_reason: '分析完成，等待处置',
    changed_at: now - 3100000
  }
];

db.serialize(() => {
  const stmtAccount = db.prepare(`
    INSERT INTO accounts (id, account_no, username, department, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  accounts.forEach(acc => {
    stmtAccount.run(acc.id, acc.account_no, acc.username, acc.department, acc.role, acc.status, acc.created_at, acc.updated_at);
  });
  stmtAccount.finalize();

  const stmtDevice = db.prepare(`
    INSERT INTO device_fingerprints 
    (id, account_id, fingerprint_hash, user_agent, screen_resolution, timezone, language, platform, 
     canvas_fingerprint, webgl_fingerprint, fonts, plugins, ip_address, is_trusted, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  deviceFingerprints.forEach(df => {
    stmtDevice.run(df.id, df.account_id, df.fingerprint_hash, df.user_agent, df.screen_resolution, 
                    df.timezone, df.language, df.platform, df.canvas_fingerprint, df.webgl_fingerprint, 
                    df.fonts, df.plugins, df.ip_address, df.is_trusted, df.first_seen, df.last_seen);
  });
  stmtDevice.finalize();

  const stmtLocation = db.prepare(`
    INSERT INTO login_locations 
    (id, account_id, ip_address, country, province, city, district, latitude, longitude, isp, is_common_location, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  loginLocations.forEach(ll => {
    stmtLocation.run(ll.id, ll.account_id, ll.ip_address, ll.country, ll.province, ll.city, ll.district,
                      ll.latitude, ll.longitude, ll.isp, ll.is_common_location, ll.first_seen, ll.last_seen);
  });
  stmtLocation.finalize();

  const stmtEvent = db.prepare(`
    INSERT INTO risk_events 
    (id, account_id, event_type, risk_score, risk_level, status, source_ip, source_location_id, 
     device_fingerprint_id, raw_input, processing_rules, failure_reason, final_conclusion, detected_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  riskEvents.forEach(re => {
    stmtEvent.run(re.id, re.account_id, re.event_type, re.risk_score, re.risk_level, re.status, re.source_ip,
                   re.source_location_id, re.device_fingerprint_id, re.raw_input, re.processing_rules, 
                   re.failure_reason, re.final_conclusion, re.detected_at, re.created_at, re.updated_at);
  });
  stmtEvent.finalize();

  const stmtDisposition = db.prepare(`
    INSERT INTO disposition_actions 
    (id, risk_event_id, action_type, action_result, operator, operator_type, reason, executed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  dispositions.forEach(d => {
    stmtDisposition.run(d.id, d.risk_event_id, d.action_type, d.action_result, d.operator, d.operator_type,
                         d.reason, d.executed_at, d.created_at);
  });
  stmtDisposition.finalize();

  const stmtHistory = db.prepare(`
    INSERT INTO event_history 
    (id, risk_event_id, field_name, old_value, new_value, operator, operator_type, change_reason, changed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  histories.forEach(h => {
    stmtHistory.run(h.id, h.risk_event_id, h.field_name, h.old_value, h.new_value, h.operator, 
                     h.operator_type, h.change_reason, h.changed_at);
  });
  stmtHistory.finalize();

  console.log('样例数据插入完成:');
  console.log(`  - ${accounts.length} 个账号`);
  console.log(`  - ${deviceFingerprints.length} 个设备指纹`);
  console.log(`  - ${loginLocations.length} 个登录地点`);
  console.log(`  - ${riskEvents.length} 个风险事件`);
  console.log(`  - ${dispositions.length} 个处置动作`);
  console.log(`  - ${histories.length} 条历史记录`);
});

db.close();
