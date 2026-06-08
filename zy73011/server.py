#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""宠物寄养异常提醒系统 - Python版后端（零第三方依赖）。
使用 Python 内置的 http.server + sqlite3 + json 模块。
"""
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).parent.resolve()
DATA_DIR = ROOT / "data"
EXPORT_DIR = ROOT / "exports"
PUBLIC_DIR = ROOT / "public"
DB_PATH = DATA_DIR / "pet_foster.db"
for d in (DATA_DIR, EXPORT_DIR):
    d.mkdir(parents=True, exist_ok=True)

STATIC_EXTS = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
               ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
               ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
               ".ico": "image/x-icon", ".md": "text/markdown; charset=utf-8"}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def row_to_dict(row):
    return {k: row[k] for k in row.keys()} if row else None


def rows_to_list(rows):
    return [row_to_dict(r) for r in rows]


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS foster_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_name TEXT NOT NULL, pet_type TEXT, owner_name TEXT NOT NULL,
      owner_wechat TEXT, checkin_date TEXT NOT NULL, checkout_date TEXT,
      room_no TEXT, status TEXT DEFAULT '寄养中',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, foster_id INTEGER NOT NULL,
      alert_type TEXT NOT NULL, alert_level TEXT DEFAULT '一般',
      description TEXT, trigger_rule TEXT, trigger_value TEXT, threshold TEXT,
      is_resolved INTEGER DEFAULT 0, resolved_note TEXT,
      resolved_at TEXT, resolved_by TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS wechat_remarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, foster_id INTEGER NOT NULL,
      alert_id INTEGER, remark_type TEXT DEFAULT '常规', content TEXT NOT NULL,
      operator TEXT NOT NULL, is_monthend_extra INTEGER DEFAULT 0,
      impact_judgments TEXT, created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS followup_conclusions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, foster_id INTEGER NOT NULL,
      alert_id INTEGER, wechat_remark_id INTEGER,
      conclusion TEXT NOT NULL, conclusion_type TEXT, operator TEXT NOT NULL,
      next_action TEXT, created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS medication_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT, foster_id INTEGER NOT NULL,
      alert_id INTEGER, drug_name TEXT NOT NULL, dosage TEXT NOT NULL,
      frequency TEXT, operator TEXT NOT NULL, change_reason TEXT,
      version INTEGER DEFAULT 1, is_latest INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS confirmation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, alert_id INTEGER NOT NULL,
      action_type TEXT NOT NULL, before_state TEXT, after_state TEXT,
      operator TEXT NOT NULL, remark TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    """)
    cnt = c.execute("SELECT COUNT(*) FROM foster_records").fetchone()[0]
    if cnt == 0:
        seed_data(c)
    conn.commit()
    conn.close()


def seed_data(c):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    fosters = [
        ("豆豆", "金毛", "李女士", "Li_13800138000", "2026-06-01", None, "A101", "寄养中"),
        ("咪咪", "英短", "王先生", "Wang_wx_888", "2026-06-03", None, "B202", "寄养中"),
        ("饭团", "柯基", "张小姐", "Zhang_vip", "2026-06-05", None, "A103", "寄养中"),
        ("雪球", "布偶", "陈总", "Chen_boss_666", "2026-06-07", None, "B205", "寄养中"),
    ]
    foster_ids = []
    for f in fosters:
        c.execute("""INSERT INTO foster_records
            (pet_name, pet_type, owner_name, owner_wechat, checkin_date, checkout_date, room_no, status, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""", (*f, now, now))
        foster_ids.append(c.lastrowid)

    alerts = [
        (foster_ids[0], "体温异常", "紧急", "豆豆连续2次体温超过39.2℃", "连续2次>39.2", "39.5", "39.2"),
        (foster_ids[0], "食欲下降", "一般", "昨日进食量低于标准60%", "进食<60%", "55%", "60%"),
        (foster_ids[1], "精神萎靡", "警告", "咪咪活动量骤减，躲藏时间>12h", "躲藏>12h", "14h", "12h"),
        (foster_ids[2], "用药剂量待确认", "一般", "新处方剂量与兽医建议不一致", "剂量偏差>20%", "25%", "20%"),
        (foster_ids[3], "呕吐", "警告", "24h内呕吐3次", "24h≥3次", "3次", "3次"),
    ]
    alert_ids = []
    for a in alerts:
        c.execute("""INSERT INTO alerts
            (foster_id, alert_type, alert_level, description, trigger_rule, trigger_value, threshold, created_at)
            VALUES (?,?,?,?,?,?,?,?)""", (*a, now))
        alert_ids.append(c.lastrowid)

    c.execute("""INSERT INTO wechat_remarks
        (foster_id, alert_id, remark_type, content, operator, is_monthend_extra, impact_judgments, created_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (foster_ids[0], alert_ids[0], "常规", "李女士微信说豆豆之前得过胰腺炎，体温高要警惕", "阿宁", 0, None, now))
    r2 = c.execute("""INSERT INTO wechat_remarks
        (foster_id, alert_id, remark_type, content, operator, is_monthend_extra, impact_judgments, created_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (foster_ids[1], alert_ids[2], "月底补录",
         "月底封账补充：王先生微信5日晚留言咪咪换环境易应激，已提前告知", "阿宁", 1,
         "影响：1) 异常等级由'警告'下调评估；2) 回访结论由'建议复诊'改为'在家观察+视频随访", now))
    r2_id = c.lastrowid
    c.execute("""INSERT INTO wechat_remarks
        (foster_id, alert_id, remark_type, content, operator, is_monthend_extra, impact_judgments, created_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (foster_ids[2], alert_ids[3], "常规", "张小姐微信确认同意按新剂量执行", "阿宁", 0, None, now))
    r1_id = c.execute("SELECT id FROM wechat_remarks WHERE foster_id=? AND alert_id=?",
                      (foster_ids[0], alert_ids[0])).fetchone()[0]
    r3_id = c.execute("SELECT id FROM wechat_remarks WHERE foster_id=? AND alert_id=?",
                      (foster_ids[2], alert_ids[3])).fetchone()[0]

    c.execute("""INSERT INTO followup_conclusions
        (foster_id, alert_id, wechat_remark_id, conclusion, conclusion_type, operator, next_action, created_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (foster_ids[0], alert_ids[0], r1_id, "胰腺炎复发征兆，已联系急诊转诊", "转诊", "阿宁", "24h后跟进复查结果", now))
    c.execute("""INSERT INTO followup_conclusions
        (foster_id, alert_id, wechat_remark_id, conclusion, conclusion_type, operator, next_action, created_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (foster_ids[1], alert_ids[2], r2_id, "应激反应，主人要求在家观察", "居家观察", "阿宁", "每日3次视频回访", now))
    c.execute("""INSERT INTO followup_conclusions
        (foster_id, alert_id, wechat_remark_id, conclusion, conclusion_type, operator, next_action, created_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (foster_ids[2], alert_ids[3], r3_id, "主人确认剂量调整，按新处方执行", "执行新处方", "阿宁", "每日记录用药效果", now))

    meds = [
        (foster_ids[2], alert_ids[3], "速诺片", "半片/次，每日2次", "BID", "阿宁", "初始处方", 1, 0),
        (foster_ids[2], alert_ids[3], "速诺片", "1片/次，每日2次", "BID", "阿宁", "体重核实9kg，原剂量按7kg计算偏低", 2, 1),
        (foster_ids[0], None, "益生菌", "1袋/次，每日1次", "QD", "阿宁", "常规调理", 1, 1),
        (foster_ids[3], alert_ids[4], "止吐宁", "0.5ml/次，每日1次", "QD", "阿宁", "初始剂量", 1, 0),
        (foster_ids[3], alert_ids[4], "止吐宁", "1.0ml/次，每日1次", "QD", "阿宁", "体重5kg，呕吐未止，兽医建议加量", 2, 1),
    ]
    for m in meds:
        c.execute("""INSERT INTO medication_records
            (foster_id, alert_id, drug_name, dosage, frequency, operator, change_reason, version, is_latest, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""", (*m, now))

    hists = [
        (alert_ids[0], "确认异常", "未处理", "处理中", "阿宁", "体温39.5，鼻干，需紧急处理"),
        (alert_ids[0], "记录微信备注", "{无备注}", "{备注:胰腺炎史}", "阿宁", "关联主人微信胰腺炎史"),
        (alert_ids[0], "确认结论", "处理中", "已转诊", "阿宁", "已完成急诊转诊登记"),
        (alert_ids[2], "月底补录备注", "{无备注}", "{补录:应激史}", "阿宁", "月底封账临时补录微信备注"),
    ]
    for h in hists:
        c.execute("""INSERT INTO confirmation_history
            (alert_id, action_type, before_state, after_state, operator, remark, created_at)
            VALUES (?,?,?,?,?,?,?)""", (*h, now))


def compute_drivers(a):
    d = []
    if a.get("alert_level") == "紧急":
        d.append({"factor": "异常等级-紧急", "impact": 30, "desc": "紧急异常自动拉高汇总预警指数"})
    if a.get("alert_level") == "警告":
        d.append({"factor": "异常等级-警告", "impact": 20, "desc": "警告级异常贡献中等预警分"})
    if not a.get("is_resolved"):
        d.append({"factor": "未解决状态", "impact": 25, "desc": "未解决异常持续计入未处理指标"})
    remarks = a.get("remarks") or []
    extra = sum(1 for r in remarks if r.get("is_monthend_extra"))
    if extra > 0:
        d.append({"factor": f"月底临时备注×{extra}", "impact": 10,
                  "desc": "月底补录的微信备注影响了判断过程"})
    med_changes = a.get("medChanges") or []
    if len(med_changes) > 0:
        d.append({"factor": f"用药调整×{len(med_changes)}", "impact": 15,
                  "desc": "多次剂量调整反映异常处置复杂度"})
    conclusions = a.get("conclusions") or []
    if len(conclusions) > 0:
        d.append({"factor": f"回访结论×{len(conclusions)}", "impact": 5, "desc": "已形成处理闭环"})
    else:
        d.append({"factor": "未形成回访结论", "impact": -5, "desc": "需跟进回访结论"})
    s = sum(max(0, x["impact"]) for x in d) or 1
    for x in d:
        x["impactPct"] = round(max(0, x["impact"]) / s * 100)
    return sorted(d, key=lambda x: -x["impact"])


def q(sql, params=()):
    conn = get_db()
    try:
        return rows_to_list(conn.execute(sql, params).fetchall())
    finally:
        conn.close()


def q_one(sql, params=()):
    conn = get_db()
    try:
        return row_to_dict(conn.execute(sql, params).fetchone())
    finally:
        conn.close()


def do_exec(sql, params=()):
    conn = get_db()
    try:
        cur = conn.execute(sql, params)
        conn.commit()
        return {"lastInsertRowid": cur.lastrowid, "changes": cur.rowcount}
    finally:
        conn.close()


# ------------------- API handlers -------------------

def api_fosters(_params):
    rows = q("SELECT * FROM foster_records ORDER BY created_at DESC")
    for r in rows:
        r["alerts"] = q("SELECT * FROM alerts WHERE foster_id=? ORDER BY created_at", (r["id"],))
        r["unresolvedCount"] = sum(1 for a in r["alerts"] if not a["is_resolved"])
    return rows


def api_foster_detail(params, fid):
    f = q_one("SELECT * FROM foster_records WHERE id=?", (fid,))
    if not f:
        return {"_error": 404, "error": "not found"}
    f["alerts"] = q("SELECT * FROM alerts WHERE foster_id=? ORDER BY created_at DESC", (f["id"],))
    f["remarks"] = q("SELECT * FROM wechat_remarks WHERE foster_id=? ORDER BY created_at DESC", (f["id"],))
    f["conclusions"] = q("SELECT * FROM followup_conclusions WHERE foster_id=? ORDER BY created_at DESC", (f["id"],))
    f["medications"] = q("SELECT * FROM medication_records WHERE foster_id=? ORDER BY created_at DESC, version DESC", (f["id"],))
    return f


def api_alerts(params):
    level = params.get("level", ["全部"])[0]
    resolved = params.get("resolved", ["全部"])[0]
    atype = params.get("type", ["全部"])[0]
    sql = """SELECT a.*, f.pet_name, f.owner_name, f.owner_wechat, f.room_no, f.status as foster_status
             FROM alerts a JOIN foster_records f ON a.foster_id=f.id WHERE 1=1"""
    args = []
    if level and level != "全部":
        sql += " AND a.alert_level=?"
        args.append(level)
    if resolved and resolved != "全部":
        sql += " AND a.is_resolved=?"
        args.append(1 if resolved == "已解决" else 0)
    if atype and atype != "全部":
        sql += " AND a.alert_type=?"
        args.append(atype)
    sql += " ORDER BY a.created_at DESC"
    rows = q(sql, tuple(args))
    for r in rows:
        r["remarks"] = q("SELECT * FROM wechat_remarks WHERE alert_id=?", (r["id"],))
        r["monthendExtra"] = any(rr.get("is_monthend_extra") for rr in r["remarks"])
        mc = q_one("SELECT COUNT(*) c FROM medication_records WHERE alert_id=? AND version>1", (r["id"],))
        r["hasMedChange"] = (mc or {"c": 0})["c"] > 0
    return rows


def api_alerts_summary(_params):
    def cnt(sql, args=()):
        return q_one(sql, args)["c"]
    return {
        "total": cnt("SELECT COUNT(*) c FROM alerts"),
        "resolved": cnt("SELECT COUNT(*) c FROM alerts WHERE is_resolved=1"),
        "urgent": cnt("SELECT COUNT(*) c FROM alerts WHERE alert_level='紧急' AND is_resolved=0"),
        "warning": cnt("SELECT COUNT(*) c FROM alerts WHERE alert_level='警告' AND is_resolved=0"),
        "general": cnt("SELECT COUNT(*) c FROM alerts WHERE alert_level='一般' AND is_resolved=0"),
        "unresolved": cnt("SELECT COUNT(*) c FROM alerts WHERE is_resolved=0"),
        "byType": q("""SELECT alert_type, COUNT(*) c,
            SUM(CASE WHEN is_resolved=0 THEN 1 ELSE 0 END) unresolved
            FROM alerts GROUP BY alert_type ORDER BY c DESC"""),
        "byRoom": q("""SELECT f.room_no, COUNT(*) c,
            SUM(CASE WHEN a.is_resolved=0 THEN 1 ELSE 0 END) unresolved
            FROM alerts a JOIN foster_records f ON a.foster_id=f.id
            GROUP BY f.room_no ORDER BY unresolved DESC"""),
    }


def api_alert_detail(_params, aid):
    a = q_one("""SELECT a.*, f.pet_name, f.pet_type, f.owner_name, f.owner_wechat,
                 f.room_no, f.checkin_date FROM alerts a
                 JOIN foster_records f ON a.foster_id=f.id WHERE a.id=?""", (aid,))
    if not a:
        return {"_error": 404, "error": "not found"}
    a["remarks"] = q("SELECT * FROM wechat_remarks WHERE alert_id=? ORDER BY created_at", (aid,))
    a["conclusions"] = q("""SELECT fc.*, wr.content as linked_remark_content, wr.is_monthend_extra
        FROM followup_conclusions fc LEFT JOIN wechat_remarks wr ON fc.wechat_remark_id=wr.id
        WHERE fc.alert_id=? ORDER BY fc.created_at DESC""", (aid,))
    a["medications"] = q("SELECT * FROM medication_records WHERE alert_id=? ORDER BY version, created_at", (aid,))
    a["medChanges"] = []
    drugs = {}
    for m in a["medications"]:
        drugs.setdefault(m["drug_name"], []).append(m)
    for dn, vs in drugs.items():
        vs = sorted(vs, key=lambda x: x["version"])
        for i in range(1, len(vs)):
            a["medChanges"].append({
                "drug": dn,
                "from": {"dosage": vs[i - 1]["dosage"], "frequency": vs[i - 1].get("frequency"),
                         "version": vs[i - 1]["version"], "by": vs[i - 1]["operator"], "at": vs[i - 1]["created_at"]},
                "to": {"dosage": vs[i]["dosage"], "frequency": vs[i].get("frequency"),
                       "version": vs[i]["version"], "by": vs[i]["operator"], "at": vs[i]["created_at"]},
                "reason": vs[i].get("change_reason") or "未说明",
            })
    a["history"] = q("SELECT * FROM confirmation_history WHERE alert_id=? ORDER BY created_at", (aid,))
    a["drivers"] = compute_drivers(a)
    return a


def api_resolve_alert(body, aid):
    note = body.get("note", "") or ""
    operator = body.get("operator", "操作人")
    before = q_one("SELECT is_resolved, resolved_note FROM alerts WHERE id=?", (aid,))
    do_exec("""UPDATE alerts SET is_resolved=1, resolved_note=?,
        resolved_at=datetime('now','localtime'), resolved_by=? WHERE id=?""",
            (note, operator, aid))
    do_exec("""INSERT INTO confirmation_history (alert_id, action_type, before_state, after_state, operator, remark)
        VALUES (?,?,?,?,?,?)""",
            (aid, "解决异常",
             json.dumps({"resolved": before["is_resolved"], "note": before.get("resolved_note") or ""}, ensure_ascii=False),
             json.dumps({"resolved": 1, "note": note}, ensure_ascii=False),
             operator, note))
    return {"ok": True}


def api_change_level(body, aid):
    level = body.get("level")
    operator = body.get("operator", "操作人")
    before = q_one("SELECT alert_level FROM alerts WHERE id=?", (aid,))
    do_exec("UPDATE alerts SET alert_level=? WHERE id=?", (level, aid))
    do_exec("""INSERT INTO confirmation_history (alert_id, action_type, before_state, after_state, operator, remark)
        VALUES (?,?,?,?,?,?)""",
            (aid, "调整等级", f"等级:{before['alert_level']}", f"等级:{level}", operator, "人工确认调整"))
    return {"ok": True}


def api_add_remark(body):
    info = do_exec("""INSERT INTO wechat_remarks
        (foster_id, alert_id, remark_type, content, operator, is_monthend_extra, impact_judgments)
        VALUES (?,?,?,?,?,?,?)""",
                   (body["foster_id"], body.get("alert_id"),
                    "月底补录" if body.get("is_monthend_extra") else "常规",
                    body["content"], body.get("operator") or "阿宁",
                    1 if body.get("is_monthend_extra") else 0,
                    body.get("impact_judgments") or None))
    if body.get("alert_id"):
        is_me = "月底补录备注" if body.get("is_monthend_extra") else "记录微信备注"
        content_short = body["content"][:30]
        do_exec("""INSERT INTO confirmation_history (alert_id, action_type, before_state, after_state, operator, remark)
            VALUES (?,?,?,?,?,?)""",
                (body["alert_id"], is_me, "{无新备注}",
                 "{备注:" + content_short + "}", body.get("operator") or "阿宁",
                 "月底封账临时补录" if body.get("is_monthend_extra") else "常规记录"))
    return {"id": info["lastInsertRowid"]}


def api_add_conclusion(body):
    info = do_exec("""INSERT INTO followup_conclusions
        (foster_id, alert_id, wechat_remark_id, conclusion, conclusion_type, operator, next_action)
        VALUES (?,?,?,?,?,?,?)""",
                   (body["foster_id"], body.get("alert_id"), body.get("wechat_remark_id") or None,
                    body["conclusion"], body.get("conclusion_type") or "常规",
                    body.get("operator") or "阿宁", body.get("next_action") or ""))
    return {"id": info["lastInsertRowid"]}


def api_add_medication(body):
    foster_id = body["foster_id"]
    drug_name = body["drug_name"]
    prev = q_one("SELECT MAX(version) v FROM medication_records WHERE foster_id=? AND drug_name=?",
                 (foster_id, drug_name))
    new_ver = (prev["v"] or 0) + 1
    do_exec("UPDATE medication_records SET is_latest=0 WHERE foster_id=? AND drug_name=?", (foster_id, drug_name))
    info = do_exec("""INSERT INTO medication_records
        (foster_id, alert_id, drug_name, dosage, frequency, operator, change_reason, version, is_latest)
        VALUES (?,?,?,?,?,?,?,?,1)""",
                   (foster_id, body.get("alert_id"), drug_name, body["dosage"],
                    body.get("frequency") or "", body.get("operator") or "阿宁",
                    body.get("change_reason") or "", new_ver))
    if body.get("alert_id"):
        old_med = q_one("""SELECT dosage, frequency FROM medication_records
            WHERE foster_id=? AND drug_name=? AND version=?""",
                        (foster_id, drug_name, max(1, new_ver - 1)))
        act = "调整用药剂量" if new_ver > 1 else "新增用药记录"
        bf = f"剂量:{old_med['dosage']}" if old_med else "{无}"
        af = f"剂量:{body['dosage']}"
        reason = body.get("change_reason") or ("剂量调整" if new_ver > 1 else "初始用药")
        do_exec("""INSERT INTO confirmation_history (alert_id, action_type, before_state, after_state, operator, remark)
            VALUES (?,?,?,?,?,?)""",
                (body["alert_id"], act, bf, af, body.get("operator") or "阿宁", reason))
    return {"id": info["lastInsertRowid"], "version": new_ver}


def api_types(_params):
    rows = q("SELECT DISTINCT alert_type FROM alerts")
    return {
        "levels": ["全部", "紧急", "警告", "一般"],
        "statuses": ["全部", "未解决", "已解决"],
        "types": ["全部"] + [r["alert_type"] for r in rows if r.get("alert_type")],
    }


def build_markdown_report(params):
    level = params.get("level", ["全部"])[0]
    resolved = params.get("resolved", ["全部"])[0]
    atype = params.get("type", ["全部"])[0]
    operator = params.get("operator", ["阿宁"])[0]
    sql = """SELECT a.*, f.pet_name, f.owner_name, f.owner_wechat, f.room_no, f.pet_type, f.checkin_date
             FROM alerts a JOIN foster_records f ON a.foster_id=f.id WHERE 1=1"""
    args = []
    filters = []
    if level and level != "全部":
        sql += " AND a.alert_level=?"
        args.append(level)
        filters.append(f"等级={level}")
    if resolved and resolved != "全部":
        sql += " AND a.is_resolved=?"
        args.append(1 if resolved == "已解决" else 0)
        filters.append(f"状态={resolved}")
    if atype and atype != "全部":
        sql += " AND a.alert_type=?"
        args.append(atype)
        filters.append(f"类型={atype}")
    sql += " ORDER BY a.created_at DESC"
    alerts = q(sql, tuple(args))
    total = len(alerts)
    resol = sum(1 for a in alerts if a["is_resolved"])
    urgent = sum(1 for a in alerts if a["alert_level"] == "紧急")
    warning = sum(1 for a in alerts if a["alert_level"] == "警告")
    general = sum(1 for a in alerts if a["alert_level"] == "一般")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    md = [
        "# 宠物寄养异常提醒报告\n",
        f"> 导出时间：{now}  ",
        f"> 操作人：{operator}  \n",
        "## 筛选口径\n",
        f"- 数据范围：{total} 条记录",
        f"- 筛选条件：{'、'.join(filters) if filters else '无筛选（全部）'}",
        "- 口径说明：数据与页面列表完全一致，未做任何二次聚合或折算\n",
        "## 汇总数据\n",
        "| 指标 | 数量 | 占比 |",
        "|---|---|---|",
        f"| 异常总数 | {total} | 100% |",
        f"| 紧急 | {urgent} | {round(urgent / total * 100) if total else 0}% |",
        f"| 警告 | {warning} | {round(warning / total * 100) if total else 0}% |",
        f"| 一般 | {general} | {round(general / total * 100) if total else 0}% |",
        f"| 已解决 | {resol} | {round(resol / total * 100) if total else 0}% |",
        f"| 未解决 | {total - resol} | {round((total - resol) / total * 100) if total else 0}% |\n",
        "## 异常明细\n",
    ]
    if not alerts:
        md.append("（无异常记录）\n")
    else:
        md.extend([
            "| # | 宠物 | 主人/微信 | 房间 | 异常类型 | 等级 | 触发值/阈值 | 状态 | 月底补录备注 | 用药变更 |",
            "|---|---|---|---|---|---|---|---|---|---|",
        ])
        for i, a in enumerate(alerts, 1):
            rms = q("SELECT is_monthend_extra FROM wechat_remarks WHERE alert_id=?", (a["id"],))
            mc = q_one("SELECT COUNT(*) c FROM medication_records WHERE alert_id=? AND version>1", (a["id"],))
            me_flag = "有" if any(r.get("is_monthend_extra") for r in rms) else "无"
            med_flag = f"{mc['c']}次" if mc and mc["c"] > 0 else "无"
            pet = f"{a['pet_name']}({a.get('pet_type') or ''})"
            md.append(f"| {i} | {pet} | {a['owner_name']}/{a.get('owner_wechat') or '-'} | "
                      f"{a['room_no']} | {a['alert_type']} | {a['alert_level']} | "
                      f"{a.get('trigger_value') or '-'}/{a.get('threshold') or '-'} | "
                      f"{'已解决' if a['is_resolved'] else '未解决'} | {me_flag} | {med_flag} |")
        md.append("\n\n---\n\n## 每条异常的详细展开\n")
        for i, a in enumerate(alerts, 1):
            md.append(f"### {i}. 【{a['alert_level']}】{a['pet_name']} - {a['alert_type']}\n")
            md.append(f"- **基本信息**：房间 {a['room_no']}，入住 {a.get('checkin_date')}，"
                      f"主人 {a['owner_name']}（{a.get('owner_wechat') or '无微信'}）")
            md.append(f"- **触发规则**：{a.get('trigger_rule') or '未记录'}"
                      f"（当前值 {a.get('trigger_value') or '-'} / 阈值 {a.get('threshold') or '-'}）")
            rs_str = (f"已解决（{a.get('resolved_at')}，{a.get('resolved_by') or ''}）"
                      f"备注：{a.get('resolved_note') or ''}"
                      if a["is_resolved"] else "未解决")
            md.append(f"- **状态**：{rs_str}\n")

            remarks = q("SELECT * FROM wechat_remarks WHERE alert_id=? ORDER BY created_at", (a["id"],))
            if remarks:
                md.append("#### 主人微信备注 ↔ 回访结论关联\n")
                for r in remarks:
                    concls = q("SELECT * FROM followup_conclusions WHERE wechat_remark_id=?", (r["id"],))
                    me_tag = " `【月底临时补录】`" if r.get("is_monthend_extra") else ""
                    md.append(f"- **[{r['remark_type']}] {r['operator']}** @ {r['created_at']}{me_tag}")
                    md.append(f"  > 备注：{r['content']}")
                    if r.get("impact_judgments"):
                        md.append(f"  > **判断影响说明**：{r['impact_judgments']}")
                    if concls:
                        for c in concls:
                            nx = f"（下一步：{c.get('next_action') or '无'}，{c['operator']}）"
                            md.append(f"  > ↳ 回访结论【{c.get('conclusion_type')}】：{c['conclusion']} {nx}")
                    else:
                        md.append("  > ↳ *（尚无关联回访结论，请阿宁补充）*")
                md.append("")

            meds = q("SELECT * FROM medication_records WHERE alert_id=? ORDER BY drug_name, version", (a["id"],))
            if meds:
                md.append("#### 用药记录（含剂量变更全量留痕）\n")
                md.append("| 药品 | 版本 | 剂量 | 频次 | 操作人 | 时间 | 变更原因 |")
                md.append("|---|---|---|---|---|---|---|")
                for m in meds:
                    latest = " ✅最新" if m.get("is_latest") else ""
                    md.append(f"| {m['drug_name']} | v{m['version']}{latest} | {m['dosage']} | "
                              f"{m.get('frequency') or '-'} | {m['operator']} | {m['created_at']} | "
                              f"{m.get('change_reason') or '-'} |")
                drugs = {}
                for m in meds:
                    drugs.setdefault(m["drug_name"], []).append(m)
                changes = []
                for dn, vs in drugs.items():
                    vs = sorted(vs, key=lambda x: x["version"])
                    for i2 in range(1, len(vs)):
                        changes.append(
                            f"- **{dn}** v{vs[i2 - 1]['version']}→v{vs[i2]['version']}："
                            f"{vs[i2 - 1]['dosage']} ➜ {vs[i2]['dosage']}，原因："
                            f"{vs[i2].get('change_reason') or '未说明'}")
                if changes:
                    md.append(f"\n**变更轨迹**：\n" + "\n".join(changes))
                md.append("")

            hist = q("SELECT * FROM confirmation_history WHERE alert_id=? ORDER BY created_at", (a["id"],))
            if hist:
                md.append("#### 人工确认前后变化（月底汇报用）\n")
                for h in hist:
                    md.append(f"- **{h['action_type']}** @ {h['created_at']}（{h['operator']}）")
                    md.append(f"  - 变化前：{h.get('before_state') or '—'}")
                    md.append(f"  - 变化后：{h.get('after_state') or '—'}")
                    if h.get("remark"):
                        md.append(f"  - 备注：{h['remark']}")
                md.append("")

            drivers = compute_drivers({
                **a,
                "remarks": remarks,
                "medications": meds,
                "conclusions": q("SELECT * FROM followup_conclusions WHERE alert_id=?", (a["id"],)),
                "medChanges": [],
            })
            md.append("#### 汇总拉动因素（运营主管下钻查看）\n")
            md.append("| 拉动因素 | 影响分 | 贡献占比 | 说明 |")
            md.append("|---|---|---|---|")
            for dr in drivers:
                sign = "+" if dr["impact"] > 0 else ""
                md.append(f"| {dr['factor']} | {sign}{dr['impact']} | {dr.get('impactPct') or 0}% | {dr['desc']} |")
            md.append("\n---\n")

    md.append("## 新人引导：快速上手路径\n")
    md.append("### 🟢 材料入口（数据从哪来）")
    md.append("1. **寄养登记** → 录入宠物信息、主人微信、房间号（系统：寄养记录模块）")
    md.append("2. **日常巡检** → 兽医助理阿宁记录体温、食欲、精神等数据（自动触发异常规则）")
    md.append("3. **主人微信沟通** → 阿宁在「微信备注」中粘贴/录入主人反馈（关键！关联回访结论用）")
    md.append("4. **兽医处方** → 用药及剂量录入「用药记录」（每次调整自动留痕）\n")
    md.append("### 🔴 异常出口（异常怎么消）")
    md.append("1. **看到异常** → 列表中点击异常行，进入详情页")
    md.append("2. **确认信息** → 查看是否有主人微信备注，必要时手动补充（月底补录需标注并写清影响）")
    md.append("3. **处理异常** → 调整等级/解决异常，并填写回访结论（必须关联对应微信备注）")
    md.append("4. **用药调整** → 如改剂量必须在「用药记录」中新增一条并写明原因，系统自动记录前后变化")
    md.append("5. **导出报告** → 月底点击「导出Markdown」，所有筛选口径和明细自动写入报告\n")

    fname = f"异常提醒_{int(time.time() * 1000)}.md"
    fpath = EXPORT_DIR / fname
    fpath.write_text("\n".join(md), encoding="utf-8")
    return {"url": f"/exports/{fname}", "filename": fname, "size": fpath.stat().st_size}


# ------------------- HTTP handler -------------------

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silence request logs

    def _send(self, status, content, ctype="application/json; charset=utf-8"):
        if isinstance(content, (dict, list)):
            content = json.dumps(content, ensure_ascii=False).encode("utf-8")
        elif isinstance(content, str):
            content = content.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if not length:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        try:
            return json.loads(raw) if raw else {}
        except Exception:
            return {}

    def _parse_query(self):
        return urllib.parse.parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}

    def do_GET(self):
        raw = self.path.split("?", 1)[0]

        if raw == "/" or raw == "/index.html":
            p = PUBLIC_DIR / "index.html"
            return self._send_file(p)

        if raw.startswith("/api/"):
            params = self._parse_query()
            try:
                data = self._route_get(raw, params)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return self._send(500, {"error": str(e)})
            if isinstance(data, dict) and data.get("_error"):
                return self._send(data["_error"], {"error": data.get("error")})
            return self._send(200, data)

        if raw.startswith("/exports/"):
            name = raw[len("/exports/"):]
            p = EXPORT_DIR / Path(name).name
            return self._send_file(p)

        p = PUBLIC_DIR / raw.lstrip("/")
        if p.is_file():
            return self._send_file(p)
        self._send(404, {"error": "not found"})

    def _send_file(self, path: Path):
        if not path.is_file():
            return self._send(404, {"error": "not found"})
        ext = path.suffix.lower()
        ctype = STATIC_EXTS.get(ext, "application/octet-stream")
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _route_get(self, raw, params):
        if raw == "/api/fosters":
            return api_fosters(params)
        if raw.startswith("/api/fosters/"):
            fid = int(raw.rstrip("/").split("/")[-1])
            return api_foster_detail(params, fid)
        if raw == "/api/alerts":
            return api_alerts(params)
        if raw == "/api/alerts/summary":
            return api_alerts_summary(params)
        if raw.startswith("/api/alerts/") and raw != "/api/alerts/summary":
            aid = int(raw.rstrip("/").split("/")[-1])
            return api_alert_detail(params, aid)
        if raw == "/api/types":
            return api_types(params)
        if raw == "/api/export/markdown":
            return build_markdown_report(params)
        return {"_error": 404, "error": "unknown endpoint"}

    def do_POST(self):
        raw = self.path.split("?", 1)[0]
        body = self._read_json()
        try:
            data = self._route_post(raw, body)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return self._send(500, {"error": str(e)})
        if isinstance(data, dict) and data.get("_error"):
            return self._send(data["_error"], {"error": data.get("error")})
        return self._send(200, data)

    def _route_post(self, raw, body):
        m = re.match(r"^/api/alerts/(\d+)/resolve$", raw)
        if m:
            return api_resolve_alert(body, int(m.group(1)))
        m = re.match(r"^/api/alerts/(\d+)/level$", raw)
        if m:
            return api_change_level(body, int(m.group(1)))
        if raw == "/api/remarks":
            return api_add_remark(body)
        if raw == "/api/conclusions":
            return api_add_conclusion(body)
        if raw == "/api/medications":
            return api_add_medication(body)
        return {"_error": 404, "error": "unknown endpoint"}


def main():
    init_db()
    port = 3000
    print("\n🐾 宠物寄养异常提醒系统已启动: http://localhost:%d\n" % port)
    print("   预置示例数据：4个寄养记录、5条异常、若干备注/用药/结论")
    print("   默认操作人：阿宁（可在页面右上角修改）")
    print("   主要功能：")
    print("   ✅  微信备注 ↔ 回访结论 关联追踪")
    print("   ✅  用药剂量变更 详情+文件 双重留痕")
    print("   ✅  月底临时备注 自动记录判断影响说明")
    print("   ✅  汇总下钻：点明细看拉动因素拆解")
    print("   ✅  人工确认前后变化 时间轴展示")
    print("   ✅  导出Markdown：筛选口径 + 数字 + 明细 完全同步")
    print("   ✅  新人引导：材料入口 / 异常出口 一目了然\n")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n服务已停止")
