const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'pet_foster.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS foster_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_name TEXT NOT NULL,
      pet_type TEXT,
      owner_name TEXT NOT NULL,
      owner_wechat TEXT,
      checkin_date TEXT NOT NULL,
      checkout_date TEXT,
      room_no TEXT,
      status TEXT DEFAULT '寄养中',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      foster_id INTEGER NOT NULL,
      alert_type TEXT NOT NULL,
      alert_level TEXT DEFAULT '一般',
      description TEXT,
      trigger_rule TEXT,
      trigger_value TEXT,
      threshold TEXT,
      is_resolved INTEGER DEFAULT 0,
      resolved_note TEXT,
      resolved_at TEXT,
      resolved_by TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (foster_id) REFERENCES foster_records(id)
    );

    CREATE TABLE IF NOT EXISTS wechat_remarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      foster_id INTEGER NOT NULL,
      alert_id INTEGER,
      remark_type TEXT DEFAULT '常规',
      content TEXT NOT NULL,
      operator TEXT NOT NULL,
      is_monthend_extra INTEGER DEFAULT 0,
      impact_judgments TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (foster_id) REFERENCES foster_records(id),
      FOREIGN KEY (alert_id) REFERENCES alerts(id)
    );

    CREATE TABLE IF NOT EXISTS followup_conclusions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      foster_id INTEGER NOT NULL,
      alert_id INTEGER,
      wechat_remark_id INTEGER,
      conclusion TEXT NOT NULL,
      conclusion_type TEXT,
      operator TEXT NOT NULL,
      next_action TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (foster_id) REFERENCES foster_records(id),
      FOREIGN KEY (alert_id) REFERENCES alerts(id),
      FOREIGN KEY (wechat_remark_id) REFERENCES wechat_remarks(id)
    );

    CREATE TABLE IF NOT EXISTS medication_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      foster_id INTEGER NOT NULL,
      alert_id INTEGER,
      drug_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT,
      operator TEXT NOT NULL,
      change_reason TEXT,
      version INTEGER DEFAULT 1,
      is_latest INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (foster_id) REFERENCES foster_records(id),
      FOREIGN KEY (alert_id) REFERENCES alerts(id)
    );

    CREATE TABLE IF NOT EXISTS confirmation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      before_state TEXT,
      after_state TEXT,
      operator TEXT NOT NULL,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (alert_id) REFERENCES alerts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_foster ON alerts(foster_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(is_resolved);
    CREATE INDEX IF NOT EXISTS idx_remarks_foster ON wechat_remarks(foster_id);
    CREATE INDEX IF NOT EXISTS idx_conclusions_remark ON followup_conclusions(wechat_remark_id);
    CREATE INDEX IF NOT EXISTS idx_medication_foster ON medication_records(foster_id);
    CREATE INDEX IF NOT EXISTS idx_history_alert ON confirmation_history(alert_id);
  `);

  const count = db.prepare('SELECT COUNT(*) AS c FROM foster_records').get().c;
  if (count === 0) seedData();
}

function seedData() {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const insertFoster = db.prepare(`INSERT INTO foster_records
    (pet_name, pet_type, owner_name, owner_wechat, checkin_date, checkout_date, room_no, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insertAlert = db.prepare(`INSERT INTO alerts
    (foster_id, alert_type, alert_level, description, trigger_rule, trigger_value, threshold, created_at)
    VALUES (?,?,?,?,?,?,?,?)`);
  const insertRemark = db.prepare(`INSERT INTO wechat_remarks
    (foster_id, alert_id, remark_type, content, operator, is_monthend_extra, impact_judgments, created_at)
    VALUES (?,?,?,?,?,?,?,?)`);
  const insertConclusion = db.prepare(`INSERT INTO followup_conclusions
    (foster_id, alert_id, wechat_remark_id, conclusion, conclusion_type, operator, next_action, created_at)
    VALUES (?,?,?,?,?,?,?,?)`);
  const insertMed = db.prepare(`INSERT INTO medication_records
    (foster_id, alert_id, drug_name, dosage, frequency, operator, change_reason, version, is_latest, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);

  const fosters = [
    { id: 1, pet: '豆豆', type: '金毛', owner: '李女士', wechat: 'Li_13800138000', checkin: '2026-06-01', room: 'A101' },
    { id: 2, pet: '咪咪', type: '英短', owner: '王先生', wechat: 'Wang_wx_888', checkin: '2026-06-03', room: 'B202' },
    { id: 3, pet: '饭团', type: '柯基', owner: '张小姐', wechat: 'Zhang_vip', checkin: '2026-06-05', room: 'A103' },
    { id: 4, pet: '雪球', type: '布偶', owner: '陈总', wechat: 'Chen_boss_666', checkin: '2026-06-07', room: 'B205' },
  ];

  fosters.forEach(f => {
    insertFoster.run(f.pet, f.type, f.owner, f.wechat, f.checkin, null, f.room, '寄养中', now, now);
  });

  const alerts = [
    [1, '体温异常', '紧急', '豆豆连续2次体温超过39.2℃', '连续2次>39.2', '39.5', '39.2', now],
    [1, '食欲下降', '一般', '昨日进食量低于标准60%', '进食<60%', '55%', '60%', now],
    [2, '精神萎靡', '警告', '咪咪活动量骤减，躲藏时间>12h', '躲藏>12h', '14h', '12h', now],
    [3, '用药剂量待确认', '一般', '新处方剂量与兽医建议不一致', '剂量偏差>20%', '25%', '20%', now],
    [4, '呕吐', '警告', '24h内呕吐3次', '24h≥3次', '3次', '3次', now],
  ];
  const alertIds = alerts.map(a => insertAlert.run(...a).lastInsertRowid);

  insertRemark.run(1, alertIds[0], '常规', '李女士微信说豆豆之前得过胰腺炎，体温高要警惕', '阿宁', 0, null, now);
  const mr1 = insertRemark.run(2, alertIds[2], '月底补录', '月底封账补充：王先生微信5日晚留言咪咪换环境易应激，已提前告知', '阿宁', 1,
    '影响：1) 异常等级由"警告"下调评估；2) 回访结论由"建议复诊"改为"在家观察+视频随访"', now);
  insertRemark.run(3, alertIds[3], '常规', '张小姐微信确认同意按新剂量执行', '阿宁', 0, null, now);

  insertConclusion.run(1, alertIds[0], 1, '胰腺炎复发征兆，已联系急诊转诊', '转诊', '阿宁', '24h后跟进复查结果', now);
  insertConclusion.run(2, alertIds[2], 2, '应激反应，主人要求在家观察', '居家观察', '阿宁', '每日3次视频回访', now);
  insertConclusion.run(3, alertIds[3], 3, '主人确认剂量调整，按新处方执行', '执行新处方', '阿宁', '每日记录用药效果', now);

  insertMed.run(3, alertIds[3], '速诺片', '半片/次，每日2次', 'BID', '阿宁', '初始处方', 1, 0, now);
  insertMed.run(3, alertIds[3], '速诺片', '1片/次，每日2次', 'BID', '阿宁', '体重核实9kg，原剂量按7kg计算偏低', 2, 1, now);
  insertMed.run(1, null, '益生菌', '1袋/次，每日1次', 'QD', '阿宁', '常规调理', 1, 1, now);
  insertMed.run(4, alertIds[4], '止吐宁', '0.5ml/次，每日1次', 'QD', '阿宁', '初始剂量', 1, 0, now);
  insertMed.run(4, alertIds[4], '止吐宁', '1.0ml/次，每日1次', 'QD', '阿宁', '体重5kg，呕吐未止，兽医建议加量', 2, 1, now);

  const insertHist = db.prepare(`INSERT INTO confirmation_history
    (alert_id, action_type, before_state, after_state, operator, remark, created_at)
    VALUES (?,?,?,?,?,?,?)`);
  insertHist.run(alertIds[0], '确认异常', '未处理', '处理中', '阿宁', '体温39.5，鼻干，需紧急处理', now);
  insertHist.run(alertIds[0], '记录微信备注', '{无备注}', '{备注:胰腺炎史}', '阿宁', '关联主人微信胰腺炎史', now);
  insertHist.run(alertIds[0], '确认结论', '处理中', '已转诊', '阿宁', '已完成急诊转诊登记', now);
  insertHist.run(alertIds[2], '月底补录备注', '{无备注}', '{补录:应激史}', '阿宁', '月底封账临时补录微信备注', now);
}

module.exports = { db, initDB };
