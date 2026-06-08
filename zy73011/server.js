const express = require('express');
const path = require('path');
const fs = require('fs');
const { db, initDB } = require('./database');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/exports', express.static(path.join(__dirname, 'exports')));

const dataDir = path.join(__dirname, 'data');
const exportDir = path.join(__dirname, 'exports');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

initDB();

function q(sql, params = []) {
  return db.prepare(sql).all(...params);
}
function qOne(sql, params = []) {
  return db.prepare(sql).get(...params);
}
function exec(sql, params = []) {
  const info = db.prepare(sql).run(...params);
  return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
}

app.get('/api/fosters', (req, res) => {
  const rows = q(`SELECT * FROM foster_records ORDER BY created_at DESC`);
  rows.forEach(r => {
    r.alerts = q(`SELECT * FROM alerts WHERE foster_id=? ORDER BY created_at`, [r.id]);
    r.unresolvedCount = r.alerts.filter(a => !a.is_resolved).length;
  });
  res.json(rows);
});

app.get('/api/fosters/:id', (req, res) => {
  const f = qOne(`SELECT * FROM foster_records WHERE id=?`, [req.params.id]);
  if (!f) return res.status(404).json({ error: 'not found' });
  f.alerts = q(`SELECT * FROM alerts WHERE foster_id=? ORDER BY created_at DESC`, [f.id]);
  f.remarks = q(`SELECT * FROM wechat_remarks WHERE foster_id=? ORDER BY created_at DESC`, [f.id]);
  f.conclusions = q(`SELECT * FROM followup_conclusions WHERE foster_id=? ORDER BY created_at DESC`, [f.id]);
  f.medications = q(`SELECT * FROM medication_records WHERE foster_id=? ORDER BY created_at DESC, version DESC`, [f.id]);
  res.json(f);
});

app.get('/api/alerts', (req, res) => {
  const { level, resolved, type } = req.query;
  let sql = `SELECT a.*, f.pet_name, f.owner_name, f.owner_wechat, f.room_no, f.status as foster_status
             FROM alerts a JOIN foster_records f ON a.foster_id=f.id WHERE 1=1`;
  const params = [];
  if (level && level !== '全部') { sql += ` AND a.alert_level=?`; params.push(level); }
  if (resolved !== undefined && resolved !== '全部') { sql += ` AND a.is_resolved=?`; params.push(resolved === '已解决' ? 1 : 0); }
  if (type && type !== '全部') { sql += ` AND a.alert_type=?`; params.push(type); }
  sql += ` ORDER BY a.created_at DESC`;
  const rows = q(sql, params);
  rows.forEach(r => {
    r.remarks = q(`SELECT * FROM wechat_remarks WHERE alert_id=? ORDER BY created_at`, [r.id]);
    r.monthendExtra = r.remarks.some(rr => rr.is_monthend_extra);
    r.hasMedChange = q(`SELECT COUNT(*) c FROM medication_records WHERE alert_id=? AND version>1`, [r.id])[0].c > 0;
  });
  res.json(rows);
});

app.get('/api/alerts/summary', (req, res) => {
  const total = qOne(`SELECT COUNT(*) c FROM alerts`).c;
  const resolved = qOne(`SELECT COUNT(*) c FROM alerts WHERE is_resolved=1`).c;
  const urgent = qOne(`SELECT COUNT(*) c FROM alerts WHERE alert_level='紧急' AND is_resolved=0`).c;
  const warning = qOne(`SELECT COUNT(*) c FROM alerts WHERE alert_level='警告' AND is_resolved=0`).c;
  const general = qOne(`SELECT COUNT(*) c FROM alerts WHERE alert_level='一般' AND is_resolved=0`).c;
  const byType = q(`SELECT alert_type, COUNT(*) c, SUM(CASE WHEN is_resolved=0 THEN 1 ELSE 0 END) unresolved
                    FROM alerts GROUP BY alert_type ORDER BY c DESC`);
  const byRoom = q(`SELECT f.room_no, COUNT(*) c, SUM(CASE WHEN a.is_resolved=0 THEN 1 ELSE 0 END) unresolved
                    FROM alerts a JOIN foster_records f ON a.foster_id=f.id
                    GROUP BY f.room_no ORDER BY unresolved DESC`);
  res.json({ total, resolved, urgent, warning, general, unresolved: total - resolved, byType, byRoom });
});

app.get('/api/alerts/:id', (req, res) => {
  const a = qOne(`SELECT a.*, f.pet_name, f.pet_type, f.owner_name, f.owner_wechat, f.room_no, f.checkin_date
                  FROM alerts a JOIN foster_records f ON a.foster_id=f.id WHERE a.id=?`, [req.params.id]);
  if (!a) return res.status(404).json({ error: 'not found' });
  a.remarks = q(`SELECT * FROM wechat_remarks WHERE alert_id=? ORDER BY created_at`, [a.id]);
  a.conclusions = q(`SELECT fc.*, wr.content as linked_remark_content, wr.is_monthend_extra
                     FROM followup_conclusions fc
                     LEFT JOIN wechat_remarks wr ON fc.wechat_remark_id=wr.id
                     WHERE fc.alert_id=? ORDER BY fc.created_at DESC`, [a.id]);
  a.medications = q(`SELECT * FROM medication_records WHERE alert_id=? ORDER BY version, created_at`, [a.id]);
  a.medChanges = [];
  if (a.medications.length > 1) {
    const drugs = {};
    a.medications.forEach(m => {
      if (!drugs[m.drug_name]) drugs[m.drug_name] = [];
      drugs[m.drug_name].push(m);
    });
    Object.keys(drugs).forEach(dn => {
      const vs = drugs[dn].sort((x, y) => x.version - y.version);
      for (let i = 1; i < vs.length; i++) {
        a.medChanges.push({
          drug: dn,
          from: { dosage: vs[i - 1].dosage, frequency: vs[i - 1].frequency, version: vs[i - 1].version, by: vs[i - 1].operator, at: vs[i - 1].created_at },
          to: { dosage: vs[i].dosage, frequency: vs[i].frequency, version: vs[i].version, by: vs[i].operator, at: vs[i].created_at },
          reason: vs[i].change_reason || '未说明'
        });
      }
    });
  }
  a.history = q(`SELECT * FROM confirmation_history WHERE alert_id=? ORDER BY created_at`, [a.id]);
  a.drivers = computeDrivers(a);
  res.json(a);
});

function computeDrivers(a) {
  const d = [];
  if (a.alert_level === '紧急') d.push({ factor: '异常等级-紧急', impact: 30, desc: '紧急异常自动拉高汇总预警指数' });
  if (a.alert_level === '警告') d.push({ factor: '异常等级-警告', impact: 20, desc: '警告级异常贡献中等预警分' });
  if (!a.is_resolved) d.push({ factor: '未解决状态', impact: 25, desc: '未解决异常持续计入未处理指标' });
  if (a.remarks && a.remarks.length > 0) {
    const extra = a.remarks.filter(r => r.is_monthend_extra).length;
    if (extra > 0) d.push({ factor: `月底临时备注×${extra}`, impact: 10, desc: '月底补录的微信备注影响了判断过程' });
  }
  if (a.medChanges && a.medChanges.length > 0) {
    d.push({ factor: `用药调整×${a.medChanges.length}`, impact: 15, desc: '多次剂量调整反映异常处置复杂度' });
  }
  if (a.conclusions && a.conclusions.length > 0) {
    d.push({ factor: `回访结论×${a.conclusions.length}`, impact: 5, desc: '已形成处理闭环' });
  } else {
    d.push({ factor: '未形成回访结论', impact: -5, desc: '需跟进回访结论' });
  }
  const sum = d.reduce((s, x) => s + Math.max(0, x.impact), 0) || 1;
  d.forEach(x => { x.impactPct = Math.round(Math.max(0, x.impact) / sum * 100); });
  return d.sort((x, y) => y.impact - x.impact);
}

app.post('/api/alerts/:id/resolve', (req, res) => {
  const { note, operator } = req.body;
  const before = qOne(`SELECT is_resolved, resolved_note FROM alerts WHERE id=?`, [req.params.id]);
  exec(`UPDATE alerts SET is_resolved=1, resolved_note=?, resolved_at=datetime('now','localtime'), resolved_by=?
        WHERE id=?`, [note, operator || '操作人', req.params.id]);
  exec(`INSERT INTO confirmation_history (alert_id, action_type, before_state, after_state, operator, remark)
        VALUES (?,?,?,?,?,?)`, [req.params.id, '解决异常',
    JSON.stringify({ resolved: before.is_resolved, note: before.resolved_note || '' }),
    JSON.stringify({ resolved: 1, note: note || '' }),
    operator || '操作人', note || '']);
  res.json({ ok: true });
});

app.post('/api/alerts/:id/level', (req, res) => {
  const { level, operator } = req.body;
  const before = qOne(`SELECT alert_level FROM alerts WHERE id=?`, [req.params.id]);
  exec(`UPDATE alerts SET alert_level=? WHERE id=?`, [level, req.params.id]);
  exec(`INSERT INTO confirmation_history (alert_id, action_type, before_state, after_state, operator, remark)
        VALUES (?,?,?,?,?,?)`, [req.params.id, '调整等级',
    `等级:${before.alert_level}`, `等级:${level}`, operator || '操作人', '人工确认调整']);
  res.json({ ok: true });
});

app.post('/api/remarks', (req, res) => {
  const { foster_id, alert_id, content, operator, is_monthend_extra, impact_judgments } = req.body;
  const info = exec(`INSERT INTO wechat_remarks
    (foster_id, alert_id, remark_type, content, operator, is_monthend_extra, impact_judgments)
    VALUES (?,?,?,?,?,?,?)`,
    [foster_id, alert_id || null, is_monthend_extra ? '月底补录' : '常规',
      content, operator || '阿宁', is_monthend_extra ? 1 : 0, impact_judgments || null]);
  if (alert_id) {
    exec(`INSERT INTO confirmation_history (alert_id, action_type, before_state, after_state, operator, remark)
          VALUES (?,?,?,?,?,?)`, [alert_id, is_monthend_extra ? '月底补录备注' : '记录微信备注',
      '{无新备注}', `{备注:${content.slice(0, 30)}}`, operator || '阿宁',
      is_monthend_extra ? '月底封账临时补录' : '常规记录']);
  }
  res.json({ id: info.lastInsertRowid });
});

app.post('/api/conclusions', (req, res) => {
  const { foster_id, alert_id, wechat_remark_id, conclusion, conclusion_type, operator, next_action } = req.body;
  const info = exec(`INSERT INTO followup_conclusions
    (foster_id, alert_id, wechat_remark_id, conclusion, conclusion_type, operator, next_action)
    VALUES (?,?,?,?,?,?,?)`,
    [foster_id, alert_id || null, wechat_remark_id || null, conclusion,
      conclusion_type || '常规', operator || '阿宁', next_action || '']);
  res.json({ id: info.lastInsertRowid });
});

app.post('/api/medications', (req, res) => {
  const { foster_id, alert_id, drug_name, dosage, frequency, operator, change_reason } = req.body;
  const prev = qOne(`SELECT MAX(version) v FROM medication_records WHERE foster_id=? AND drug_name=?`,
    [foster_id, drug_name]);
  const newVer = (prev?.v || 0) + 1;
  exec(`UPDATE medication_records SET is_latest=0 WHERE foster_id=? AND drug_name=?`, [foster_id, drug_name]);
  const info = exec(`INSERT INTO medication_records
    (foster_id, alert_id, drug_name, dosage, frequency, operator, change_reason, version, is_latest)
    VALUES (?,?,?,?,?,?,?,?,1)`,
    [foster_id, alert_id || null, drug_name, dosage, frequency || '',
      operator || '阿宁', change_reason || '', newVer]);
  if (alert_id) {
    const oldMed = qOne(`SELECT dosage, frequency FROM medication_records
                         WHERE foster_id=? AND drug_name=? AND version=?`,
      [foster_id, drug_name, Math.max(1, newVer - 1)]);
    exec(`INSERT INTO confirmation_history (alert_id, action_type, before_state, after_state, operator, remark)
          VALUES (?,?,?,?,?,?)`, [alert_id, newVer > 1 ? '调整用药剂量' : '新增用药记录',
      oldMed ? `剂量:${oldMed.dosage}` : '{无}',
      `剂量:${dosage}`, operator || '阿宁',
      change_reason || (newVer > 1 ? '剂量调整' : '初始用药')]);
  }
  res.json({ id: info.lastInsertRowid, version: newVer });
});

app.get('/api/export/markdown', (req, res) => {
  const { level, resolved, type, operator } = req.query;
  let sql = `SELECT a.*, f.pet_name, f.owner_name, f.owner_wechat, f.room_no, f.pet_type, f.checkin_date
             FROM alerts a JOIN foster_records f ON a.foster_id=f.id WHERE 1=1`;
  const params = [];
  const filters = [];
  if (level && level !== '全部') { sql += ` AND a.alert_level=?`; params.push(level); filters.push(`等级=${level}`); }
  if (resolved !== undefined && resolved !== '全部') {
    sql += ` AND a.is_resolved=?`; params.push(resolved === '已解决' ? 1 : 0);
    filters.push(`状态=${resolved}`);
  }
  if (type && type !== '全部') { sql += ` AND a.alert_type=?`; params.push(type); filters.push(`类型=${type}`); }
  sql += ` ORDER BY a.created_at DESC`;
  const alerts = q(sql, params);

  const total = alerts.length;
  const resolvedCnt = alerts.filter(a => a.is_resolved).length;
  const urgent = alerts.filter(a => a.alert_level === '紧急').length;
  const warning = alerts.filter(a => a.alert_level === '警告').length;
  const general = alerts.filter(a => a.alert_level === '一般').length;

  const now = new Date().toLocaleString('zh-CN');
  let md = `# 宠物寄养异常提醒报告\n\n`;
  md += `> 导出时间：${now}  \n`;
  md += `> 操作人：${operator || '阿宁'}  \n\n`;
  md += `## 筛选口径\n\n`;
  md += `- 数据范围：${alerts.length > 0 ? '异常提醒全量' : '空'}条记录\n`;
  md += `- 筛选条件：${filters.length ? filters.join('、') : '无筛选（全部）'}\n`;
  md += `- 口径说明：数据与页面列表完全一致，未做任何二次聚合或折算\n\n`;
  md += `## 汇总数据\n\n`;
  md += `| 指标 | 数量 | 占比 |\n|---|---|---|\n`;
  md += `| 异常总数 | ${total} | 100% |\n`;
  md += `| 紧急 | ${urgent} | ${total ? Math.round(urgent / total * 100) : 0}% |\n`;
  md += `| 警告 | ${warning} | ${total ? Math.round(warning / total * 100) : 0}% |\n`;
  md += `| 一般 | ${general} | ${total ? Math.round(general / total * 100) : 0}% |\n`;
  md += `| 已解决 | ${resolvedCnt} | ${total ? Math.round(resolvedCnt / total * 100) : 0}% |\n`;
  md += `| 未解决 | ${total - resolvedCnt} | ${total ? Math.round((total - resolvedCnt) / total * 100) : 0}% |\n\n`;

  md += `## 异常明细\n\n`;
  if (alerts.length === 0) {
    md += `（无异常记录）\n`;
  } else {
    md += `| # | 宠物 | 主人/微信 | 房间 | 异常类型 | 等级 | 触发值/阈值 | 状态 | 月底补录备注 | 用药变更 |\n`;
    md += `|---|---|---|---|---|---|---|---|---|---|\n`;
    alerts.forEach((a, i) => {
      const remarks = q(`SELECT is_monthend_extra FROM wechat_remarks WHERE alert_id=?`, [a.id]);
      const medChg = q(`SELECT COUNT(*) c FROM medication_records WHERE alert_id=? AND version>1`, [a.id])[0].c;
      md += `| ${i + 1} | ${a.pet_name}(${a.pet_type || ''}) | ${a.owner_name}/${a.owner_wechat || '-'} | ${a.room_no} | ${a.alert_type} | ${a.alert_level} | ${a.trigger_value || '-'}/${a.threshold || '-'} | ${a.is_resolved ? '已解决' : '未解决'} | ${remarks.some(r => r.is_monthend_extra) ? '有' : '无'} | ${medChg > 0 ? medChg + '次' : '无'} |\n`;
    });
    md += `\n\n`;

    md += `---\n\n`;
    md += `## 每条异常的详细展开\n\n`;
    alerts.forEach((a, i) => {
      md += `### ${i + 1}. 【${a.alert_level}】${a.pet_name} - ${a.alert_type}\n\n`;
      md += `- **基本信息**：房间 ${a.room_no}，入住 ${a.checkin_date}，主人 ${a.owner_name}（${a.owner_wechat || '无微信'}）\n`;
      md += `- **触发规则**：${a.trigger_rule || '未记录'}（当前值 ${a.trigger_value || '-'} / 阈值 ${a.threshold || '-'}）\n`;
      md += `- **状态**：${a.is_resolved ? `已解决（${a.resolved_at}，${a.resolved_by || ''}）备注：${a.resolved_note || ''}` : '未解决'}\n\n`;

      const remarks = q(`SELECT * FROM wechat_remarks WHERE alert_id=? ORDER BY created_at`, [a.id]);
      if (remarks.length) {
        md += `#### 主人微信备注 ↔ 回访结论关联\n\n`;
        remarks.forEach(r => {
          const concls = q(`SELECT * FROM followup_conclusions WHERE wechat_remark_id=?`, [r.id]);
          md += `- **[${r.remark_type}] ${r.operator}** @ ${r.created_at}${r.is_monthend_extra ? ' `【月底临时补录】`' : ''}\n`;
          md += `  > 备注：${r.content}\n`;
          if (r.impact_judgments) md += `  > **判断影响说明**：${r.impact_judgments}\n`;
          if (concls.length) {
            concls.forEach(c => {
              md += `  > ↳ 回访结论【${c.conclusion_type}】：${c.conclusion} （下一步：${c.next_action || '无'}，${c.operator}）\n`;
            });
          } else {
            md += `  > ↳ *（尚无关联回访结论，请阿宁补充）*\n`;
          }
        });
        md += `\n`;
      }

      const meds = q(`SELECT * FROM medication_records WHERE alert_id=? ORDER BY drug_name, version`, [a.id]);
      if (meds.length) {
        md += `#### 用药记录（含剂量变更全量留痕）\n\n`;
        md += `| 药品 | 版本 | 剂量 | 频次 | 操作人 | 时间 | 变更原因 |\n|---|---|---|---|---|---|---|\n`;
        meds.forEach(m => {
          md += `| ${m.drug_name} | v${m.version}${m.is_latest ? ' ✅最新' : ''} | ${m.dosage} | ${m.frequency || '-'} | ${m.operator} | ${m.created_at} | ${m.change_reason || '-'} |\n`;
        });
        const drugs = {};
        meds.forEach(m => { if (!drugs[m.drug_name]) drugs[m.drug_name] = []; drugs[m.drug_name].push(m); });
        const changes = [];
        Object.keys(drugs).forEach(dn => {
          const vs = drugs[dn].sort((x, y) => x.version - y.version);
          for (let i = 1; i < vs.length; i++) {
            changes.push(`- **${dn}** v${vs[i - 1].version}→v${vs[i].version}：${vs[i - 1].dosage} ➜ ${vs[i].dosage}，原因：${vs[i].change_reason || '未说明'}`);
          }
        });
        if (changes.length) {
          md += `\n**变更轨迹**：\n${changes.join('\n')}\n`;
        }
        md += `\n`;
      }

      const hist = q(`SELECT * FROM confirmation_history WHERE alert_id=? ORDER BY created_at`, [a.id]);
      if (hist.length) {
        md += `#### 人工确认前后变化（月底汇报用）\n\n`;
        hist.forEach(h => {
          md += `- **${h.action_type}** @ ${h.created_at}（${h.operator}）\n`;
          md += `  - 变化前：${h.before_state}\n`;
          md += `  - 变化后：${h.after_state}\n`;
          if (h.remark) md += `  - 备注：${h.remark}\n`;
        });
        md += `\n`;
      }

      const drivers = computeDrivers({ ...a, remarks, medications: meds, conclusions: q(`SELECT * FROM followup_conclusions WHERE alert_id=?`, [a.id]), medChanges: [] });
      md += `#### 汇总拉动因素（运营主管下钻查看）\n\n`;
      md += `| 拉动因素 | 影响分 | 贡献占比 | 说明 |\n|---|---|---|---|\n`;
      drivers.forEach(d => {
        md += `| ${d.factor} | ${d.impact > 0 ? '+' : ''}${d.impact} | ${d.impactPct || 0}% | ${d.desc} |\n`;
      });
      md += `\n---\n\n`;
    });
  }

  md += `## 新人引导：快速上手路径\n\n`;
  md += `### 🟢 材料入口（数据从哪来）\n`;
  md += `1. **寄养登记** → 录入宠物信息、主人微信、房间号（系统：寄养记录模块）\n`;
  md += `2. **日常巡检** → 兽医助理阿宁记录体温、食欲、精神等数据（自动触发异常规则）\n`;
  md += `3. **主人微信沟通** → 阿宁在「微信备注」中粘贴/录入主人反馈（关键！关联回访结论用）\n`;
  md += `4. **兽医处方** → 用药及剂量录入「用药记录」（每次调整自动留痕）\n\n`;
  md += `### 🔴 异常出口（异常怎么消）\n`;
  md += `1. **看到异常** → 列表中点击异常行，进入详情页\n`;
  md += `2. **确认信息** → 查看是否有主人微信备注，必要时手动补充（月底补录需标注并写清影响）\n`;
  md += `3. **处理异常** → 调整等级/解决异常，并填写回访结论（必须关联对应微信备注）\n`;
  md += `4. **用药调整** → 如改剂量必须在「用药记录」中新增一条并写明原因，系统自动记录前后变化\n`;
  md += `5. **导出报告** → 月底点击「导出Markdown」，所有筛选口径和明细自动写入报告\n\n`;

  const fname = `异常提醒_${Date.now()}.md`;
  const fpath = path.join(exportDir, fname);
  fs.writeFileSync(fpath, md, 'utf8');
  res.json({ url: `/exports/${fname}`, filename: fname, size: md.length });
});

app.get('/api/types', (_req, res) => {
  const types = q(`SELECT DISTINCT alert_type FROM alerts`).map(r => r.alert_type);
  res.json({ levels: ['全部', '紧急', '警告', '一般'], statuses: ['全部', '未解决', '已解决'], types: ['全部', ...types] });
});

app.listen(PORT, () => {
  console.log(`\n🐾 宠物寄养异常提醒系统已启动: http://localhost:${PORT}\n`);
  console.log(`   预置示例数据：4个寄养记录、5条异常、若干备注/用药/结论`);
  console.log(`   测试账号：阿宁（默认操作人）\n`);
});
