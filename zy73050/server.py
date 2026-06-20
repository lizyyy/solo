import sqlite3
import os
import json
import hashlib
import uuid
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "workorders.db")

app = FastAPI(title="塔吊维保工单回放 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def dedup_hash(wo_data: dict) -> str:
    parts_names = sorted([p["name"] for p in wo_data.get("parts", [])])
    raw = "|".join([
        wo_data.get("craneId", ""),
        wo_data.get("type", ""),
        (wo_data.get("downtimeWindow") or {}).get("start", ""),
        ",".join(parts_names),
    ])
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:8].upper()


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS workorders (
        id TEXT PRIMARY KEY,
        crane_id TEXT,
        crane_name TEXT,
        title TEXT,
        type TEXT,
        status TEXT,
        scheduler TEXT,
        maintainer TEXT,
        downtime_start TEXT,
        downtime_end TEXT,
        created_at TEXT,
        has_abnormal_sampling INTEGER DEFAULT 0,
        has_late_parts INTEGER DEFAULT 0,
        dedup_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS parts (
        id TEXT PRIMARY KEY,
        workorder_id TEXT,
        name TEXT,
        spec TEXT,
        qty REAL,
        unit TEXT,
        planned_arrival TEXT,
        actual_arrival TEXT,
        is_late INTEGER DEFAULT 0,
        late_days REAL DEFAULT 0,
        FOREIGN KEY (workorder_id) REFERENCES workorders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS remark_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_id TEXT,
        version INTEGER,
        is_latest INTEGER,
        content TEXT,
        author TEXT,
        role TEXT,
        created_at TEXT,
        FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS screenshot_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_id TEXT,
        version INTEGER,
        is_latest INTEGER,
        name TEXT,
        author TEXT,
        created_at TEXT,
        preview TEXT,
        FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS samplings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workorder_id TEXT,
        time TEXT,
        value REAL,
        pct INTEGER,
        status TEXT,
        reason TEXT,
        FOREIGN KEY (workorder_id) REFERENCES workorders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS timeline (
        id TEXT PRIMARY KEY,
        workorder_id TEXT,
        type TEXT,
        title TEXT,
        desc TEXT,
        time TEXT,
        operator TEXT,
        operator_role TEXT,
        status_from TEXT,
        status_to TEXT,
        status_class TEXT,
        is_override INTEGER DEFAULT 0,
        dot_class TEXT,
        override_reason TEXT,
        FOREIGN KEY (workorder_id) REFERENCES workorders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS submit_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workorder_id TEXT,
        submitted_at TEXT,
        operator TEXT,
        dedup_hash TEXT,
        note TEXT,
        FOREIGN KEY (workorder_id) REFERENCES workorders(id) ON DELETE CASCADE
    );
    """)
    conn.commit()

    c.execute("SELECT COUNT(*) FROM workorders")
    if c.fetchone()[0] == 0:
        seed_initial_data(conn)
    conn.close()


def seed_initial_data(conn):
    seed_path = os.path.join(os.path.dirname(__file__), "data", "seed.json")
    workorders = []
    if os.path.exists(seed_path):
        with open(seed_path, "r", encoding="utf-8") as f:
            workorders = json.load(f)

    c = conn.cursor()
    for wo in workorders:
        dh = dedup_hash(wo)
        c.execute("""INSERT INTO workorders (id, crane_id, crane_name, title, type, status, scheduler,
            maintainer, downtime_start, downtime_end, created_at, has_abnormal_sampling, has_late_parts, dedup_hash)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (wo["id"], wo.get("craneId"), wo.get("craneName"), wo["title"], wo["type"], wo["status"],
                   wo.get("scheduler"), wo.get("maintainer"), wo["downtimeWindow"]["start"],
                   wo["downtimeWindow"]["end"], wo.get("createdAt"),
                   1 if wo.get("hasAbnormalSampling") else 0,
                   1 if wo.get("hasLateParts") else 0, dh))
        for p in wo.get("parts", []):
            c.execute("""INSERT INTO parts (id, workorder_id, name, spec, qty, unit, planned_arrival,
                actual_arrival, is_late, late_days) VALUES (?,?,?,?,?,?,?,?,?,?)""",
                      (p["id"], wo["id"], p["name"], p.get("spec", ""), p.get("qty", 1), p.get("unit", ""),
                       p.get("plannedArrival"), p.get("actualArrival"),
                       1 if p.get("isLate") else 0, p.get("lateDays", 0)))
            for rv in p.get("remarkVersions", []):
                c.execute("""INSERT INTO remark_versions (part_id, version, is_latest, content, author, role, created_at)
                    VALUES (?,?,?,?,?,?,?)""",
                          (p["id"], rv["version"], 1 if rv.get("isLatest") else 0, rv["content"],
                           rv.get("author", ""), rv.get("role", ""), rv.get("createdAt")))
            for sv in p.get("screenshotVersions", []):
                c.execute("""INSERT INTO screenshot_versions (part_id, version, is_latest, name, author, created_at, preview)
                    VALUES (?,?,?,?,?,?,?)""",
                          (p["id"], sv["version"], 1 if sv.get("isLatest") else 0, sv["name"],
                           sv.get("author", ""), sv.get("createdAt"), sv.get("preview", "🖼️")))
        for s in wo.get("sampling", []):
            c.execute("""INSERT INTO samplings (workorder_id, time, value, pct, status, reason)
                VALUES (?,?,?,?,?,?)""",
                      (wo["id"], s["time"], s.get("value", 0), s.get("pct", 0), s["status"], s.get("reason", "")))
        for tl in wo.get("timeline", []):
            c.execute("""INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator, operator_role,
                status_from, status_to, status_class, is_override, dot_class, override_reason)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                      (tl["id"] + "-" + wo["id"], wo["id"], tl["type"], tl["title"], tl.get("desc", ""),
                       tl["time"], tl.get("operator", ""), tl.get("operatorRole", ""),
                       tl.get("statusFrom"), tl.get("statusTo"), tl.get("statusClass", ""),
                       1 if tl.get("isOverride") else 0, tl.get("dotClass", ""), tl.get("overrideReason")))
        c.execute("""INSERT INTO submit_history (workorder_id, submitted_at, operator, dedup_hash, note)
            VALUES (?,?,?,?,?)""",
                  (wo["id"], wo.get("createdAt", now_str()), wo.get("scheduler", "系统"), dh, "初始提交"))
    conn.commit()


def assemble_workorder(row: sqlite3.Row, conn: sqlite3.Connection) -> dict:
    c = conn.cursor()
    wo = {
        "id": row["id"],
        "craneId": row["crane_id"],
        "craneName": row["crane_name"],
        "title": row["title"],
        "type": row["type"],
        "status": row["status"],
        "scheduler": row["scheduler"],
        "maintainer": row["maintainer"],
        "downtimeWindow": {"start": row["downtime_start"], "end": row["downtime_end"]},
        "createdAt": row["created_at"],
        "hasAbnormalSampling": bool(row["has_abnormal_sampling"]),
        "hasLateParts": bool(row["has_late_parts"]),
        "dedupHash": row["dedup_hash"],
        "parts": [],
        "sampling": [],
        "timeline": [],
    }
    for p in c.execute("SELECT * FROM parts WHERE workorder_id=? ORDER BY id", (row["id"],)).fetchall():
        part = {
            "id": p["id"], "name": p["name"], "spec": p["spec"], "qty": p["qty"], "unit": p["unit"],
            "plannedArrival": p["planned_arrival"], "actualArrival": p["actual_arrival"],
            "isLate": bool(p["is_late"]), "lateDays": p["late_days"] or 0,
            "remarkVersions": [], "screenshotVersions": [],
        }
        for rv in c.execute("SELECT * FROM remark_versions WHERE part_id=? ORDER BY version DESC", (p["id"],)).fetchall():
            part["remarkVersions"].append({
                "version": rv["version"], "isLatest": bool(rv["is_latest"]),
                "content": rv["content"], "author": rv["author"], "role": rv["role"], "createdAt": rv["created_at"],
            })
        for sv in c.execute("SELECT * FROM screenshot_versions WHERE part_id=? ORDER BY version DESC", (p["id"],)).fetchall():
            part["screenshotVersions"].append({
                "version": sv["version"], "isLatest": bool(sv["is_latest"]),
                "name": sv["name"], "author": sv["author"], "createdAt": sv["created_at"],
                "preview": sv["preview"] or "🖼️",
            })
        wo["parts"].append(part)
    for s in c.execute("SELECT * FROM samplings WHERE workorder_id=? ORDER BY time", (row["id"],)).fetchall():
        wo["sampling"].append({
            "time": s["time"], "value": s["value"], "pct": s["pct"],
            "status": s["status"], "reason": s["reason"],
        })
    for tl in c.execute("SELECT * FROM timeline WHERE workorder_id=? ORDER BY time", (row["id"],)).fetchall():
        wo["timeline"].append({
            "id": tl["id"], "type": tl["type"], "title": tl["title"], "desc": tl["desc"],
            "time": tl["time"], "operator": tl["operator"], "operatorRole": tl["operator_role"],
            "statusFrom": tl["status_from"], "statusTo": tl["status_to"], "statusClass": tl["status_class"],
            "isOverride": bool(tl["is_override"]), "dotClass": tl["dot_class"],
            "overrideReason": tl["override_reason"],
        })
    return wo


# =============== Pydantic Models ===============

class RemarkIn(BaseModel):
    partId: str
    content: str
    author: str = "现场调度"
    role: str = "现场调度"

class ScreenshotIn(BaseModel):
    partId: str
    name: str
    preview: str = "🖼️"
    author: str = "现场调度"

class SamplingIn(BaseModel):
    time: str
    value: float = 0
    pct: int = 0
    status: str = "normal"
    reason: str = ""

class PartIn(BaseModel):
    id: Optional[str] = None
    name: str
    spec: str = ""
    qty: float = 1
    unit: str = ""
    plannedArrival: str
    actualArrival: str = ""
    remark: str = ""
    screenshotName: str = ""
    author: str = "提交人"

class WorkorderIn(BaseModel):
    id: Optional[str] = None
    craneId: str
    craneName: str = ""
    title: str
    type: str = "月度维保"
    status: str = "pending"
    scheduler: str = "宋建国"
    maintainer: str = ""
    downtimeWindow: Dict[str, str]
    createdAt: Optional[str] = None
    parts: List[PartIn]
    sampling: List[SamplingIn] = []
    operator: str = "现场调度"
    operatorRole: str = "现场调度"

class StatusUpdate(BaseModel):
    status: str
    operator: str = "现场调度"
    operatorRole: str = "现场调度"
    note: str = ""

class OverrideIn(BaseModel):
    title: str
    desc: str
    reason: str
    operator: str = "运维负责人"

# =============== Routes ===============

@app.get("/api/health")
def health():
    return {"ok": True, "db": DB_PATH, "time": now_str()}


@app.get("/api/workorders")
def list_workorders():
    conn = get_db()
    rows = conn.execute("SELECT * FROM workorders ORDER BY created_at DESC").fetchall()
    result = [assemble_workorder(r, conn) for r in rows]
    conn.close()
    return {"data": result}


@app.get("/api/workorders/{wo_id}")
def get_workorder(wo_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM workorders WHERE id=?", (wo_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "工单不存在")
    wo = assemble_workorder(row, conn)
    c = conn.cursor()
    wo["submitHistory"] = [
        {"id": sh["id"], "submittedAt": sh["submitted_at"], "operator": sh["operator"],
         "dedupHash": sh["dedup_hash"], "note": sh["note"]}
        for sh in c.execute("SELECT * FROM submit_history WHERE workorder_id=? ORDER BY id", (wo_id,)).fetchall()
    ]
    conn.close()
    return {"data": wo}


@app.post("/api/workorders")
def create_workorder(wo_in: WorkorderIn):
    dh = dedup_hash(wo_in.dict())
    conn = get_db()
    c = conn.cursor()
    existing = c.execute("SELECT * FROM workorders WHERE dedup_hash=?", (dh,)).fetchone()

    if existing:
        wo_id = existing["id"]
        c.execute("""INSERT INTO submit_history (workorder_id, submitted_at, operator, dedup_hash, note)
            VALUES (?,?,?,?,?)""", (wo_id, now_str(), wo_in.operator, dh, "重复提交·已合并到已有工单"))
        c.execute("""INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator, operator_role,
            status_from, status_to, status_class, is_override, dot_class, override_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (f"TL-DUP-{uuid.uuid4().hex[:6]}", wo_id, "duplicate",
                   f"重复提交合并（哈希 {dh}）",
                   f"与已有工单 #{wo_id} 匹配：相同塔吊+相同维保类型+相同停机窗口+相同备件清单。统计数量不翻倍，仅追加提交历史。",
                   now_str(), wo_in.operator, wo_in.operatorRole, None, None, "", 0, "dot-amber", None))
        conn.commit()
        wo = assemble_workorder(existing, conn)
        conn.close()
        return {"data": wo, "duplicated": True, "dedupHash": dh, "message": "重复提交·已合并，统计数量未翻倍"}

    wo_id = wo_in.id or f"WO-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:3].upper()}"
    created = wo_in.createdAt or now_str()
    c.execute("""INSERT INTO workorders (id, crane_id, crane_name, title, type, status, scheduler,
        maintainer, downtime_start, downtime_end, created_at, has_abnormal_sampling, has_late_parts, dedup_hash)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (wo_id, wo_in.craneId, wo_in.craneName or wo_in.craneId, wo_in.title, wo_in.type, wo_in.status,
               wo_in.scheduler, wo_in.maintainer,
               wo_in.downtimeWindow["start"], wo_in.downtimeWindow["end"], created,
               1 if any(s.status == "abnormal" for s in wo_in.sampling) else 0,
               1 if any(p.actualArrival > wo_in.downtimeWindow["start"] and p.actualArrival for p in wo_in.parts) else 0,
               dh))

    for p in wo_in.parts:
        pid = p.id or f"P-{uuid.uuid4().hex[:5].upper()}"
        is_late = p.actualArrival and p.actualArrival > wo_in.downtimeWindow["start"]
        c.execute("""INSERT INTO parts (id, workorder_id, name, spec, qty, unit, planned_arrival,
            actual_arrival, is_late, late_days) VALUES (?,?,?,?,?,?,?,?,?,?)""",
                  (pid, wo_id, p.name, p.spec, p.qty, p.unit, p.plannedArrival, p.actualArrival or p.plannedArrival,
                   1 if is_late else 0, 0))
        if p.remark:
            c.execute("""INSERT INTO remark_versions (part_id, version, is_latest, content, author, role, created_at)
                VALUES (?,?,?,?,?,?,?)""", (pid, 1, 1, p.remark, p.author, "提交人", created))
        if p.screenshotName:
            c.execute("""INSERT INTO screenshot_versions (part_id, version, is_latest, name, author, created_at, preview)
                VALUES (?,?,?,?,?,?,?)""", (pid, 1, 1, p.screenshotName, p.author, created, "🖼️"))

    for s in wo_in.sampling:
        c.execute("""INSERT INTO samplings (workorder_id, time, value, pct, status, reason)
            VALUES (?,?,?,?,?,?)""", (wo_id, s.time, s.value, s.pct, s.status, s.reason))

    timelines = [
        ("TL-C-" + wo_id, "created", "工单创建",
         f"{wo_in.operator}提交复核材料：{wo_in.title}", created, wo_in.operator, wo_in.operatorRole,
         None, "待处理", "", 0, ""),
        ("TL-A-" + wo_id, "assigned", "材料已登记",
         "复核材料已入库，等待进一步处理。", created, wo_in.operator, wo_in.operatorRole,
         "待处理", "待补件" if wo_in.status == "pending" else "已分配",
         "st-amber" if wo_in.status == "pending" else "", 0, "dot-sky"),
    ]
    if any(s.status == "abnormal" for s in wo_in.sampling):
        timelines.append((f"TL-SA-{uuid.uuid4().hex[:6]}", "sampling_abnormal",
                          "采样断档·已单独拎出",
                          "检测到采样断档记录，已放入异常区，不计入正常统计。",
                          created, "系统自动", "数据监控", None, None, "", 0, "dot-rose"))
    for tid, ttype, title, desc, time, op, opr, sf, st, sc, io, dc in timelines:
        c.execute("""INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator, operator_role,
            status_from, status_to, status_class, is_override, dot_class, override_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (tid, wo_id, ttype, title, desc, time, op, opr, sf, st, sc, io, dc, None))

    c.execute("""INSERT INTO submit_history (workorder_id, submitted_at, operator, dedup_hash, note)
        VALUES (?,?,?,?,?)""", (wo_id, created, wo_in.operator, dh, "首次提交"))
    conn.commit()

    row = c.execute("SELECT * FROM workorders WHERE id=?", (wo_id,)).fetchone()
    wo = assemble_workorder(row, conn)
    conn.close()
    return {"data": wo, "duplicated": False, "dedupHash": dh, "message": "新工单创建成功"}


@app.post("/api/workorders/{wo_id}/remarks")
def add_remark(wo_id: str, body: RemarkIn):
    conn = get_db()
    c = conn.cursor()
    row = c.execute("SELECT * FROM workorders WHERE id=?", (wo_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "工单不存在")
    max_v = c.execute("SELECT COALESCE(MAX(version),0) FROM remark_versions WHERE part_id=?", (body.partId,)).fetchone()[0]
    c.execute("UPDATE remark_versions SET is_latest=0 WHERE part_id=?", (body.partId,))
    c.execute("""INSERT INTO remark_versions (part_id, version, is_latest, content, author, role, created_at)
        VALUES (?,?,?,?,?,?,?)""", (body.partId, max_v + 1, 1, body.content, body.author, body.role, now_str()))
    c.execute("""INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator, operator_role,
        status_from, status_to, status_class, is_override, dot_class, override_reason)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (f"TL-R-{uuid.uuid4().hex[:6]}", wo_id, "remark_added",
               f"补录备注 v{max_v + 1}", body.content[:80], now_str(), body.author, body.role,
               None, None, "", 0, "dot-sky", None))
    conn.commit()
    wo = assemble_workorder(row, conn)
    conn.close()
    return {"data": wo}


@app.post("/api/workorders/{wo_id}/screenshots")
def add_screenshot(wo_id: str, body: ScreenshotIn):
    conn = get_db()
    c = conn.cursor()
    row = c.execute("SELECT * FROM workorders WHERE id=?", (wo_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "工单不存在")
    max_v = c.execute("SELECT COALESCE(MAX(version),0) FROM screenshot_versions WHERE part_id=?", (body.partId,)).fetchone()[0]
    c.execute("UPDATE screenshot_versions SET is_latest=0 WHERE part_id=?", (body.partId,))
    c.execute("""INSERT INTO screenshot_versions (part_id, version, is_latest, name, author, created_at, preview)
        VALUES (?,?,?,?,?,?,?)""",
              (body.partId, max_v + 1, 1, body.name, body.author, now_str(), body.preview or "🖼️"))
    c.execute("""INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator, operator_role,
        status_from, status_to, status_class, is_override, dot_class, override_reason)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (f"TL-SC-{uuid.uuid4().hex[:6]}", wo_id, "screenshot_added",
               f"上传截图 v{max_v + 1} · {body.name}", "", now_str(), body.author, "提交人",
               None, None, "", 0, "dot-green", None))
    conn.commit()
    wo = assemble_workorder(row, conn)
    conn.close()
    return {"data": wo}


@app.post("/api/workorders/{wo_id}/samplings")
def add_sampling(wo_id: str, body: SamplingIn):
    conn = get_db()
    c = conn.cursor()
    row = c.execute("SELECT * FROM workorders WHERE id=?", (wo_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "工单不存在")
    c.execute("""INSERT INTO samplings (workorder_id, time, value, pct, status, reason)
        VALUES (?,?,?,?,?,?)""", (wo_id, body.time, body.value, body.pct, body.status, body.reason))
    if body.status == "abnormal":
        c.execute("UPDATE workorders SET has_abnormal_sampling=1 WHERE id=?", (wo_id,))
        c.execute("""INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator, operator_role,
            status_from, status_to, status_class, is_override, dot_class, override_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (f"TL-SA-{uuid.uuid4().hex[:6]}", wo_id, "sampling_abnormal",
                   "采样断档·新增异常", body.reason or f"{body.time} 采样失败",
                   now_str(), "系统自动", "数据监控", None, None, "", 0, "dot-rose", None))
    conn.commit()
    wo = assemble_workorder(row, conn)
    conn.close()
    return {"data": wo}


@app.patch("/api/workorders/{wo_id}/status")
def update_status(wo_id: str, body: StatusUpdate):
    status_label = {"confirmed": "已确认", "pending": "待补件", "returned": "退回"}
    conn = get_db()
    c = conn.cursor()
    row = c.execute("SELECT * FROM workorders WHERE id=?", (wo_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "工单不存在")
    old_status = row["status"]
    c.execute("UPDATE workorders SET status=? WHERE id=?", (body.status, wo_id))
    status_class = {"confirmed": "st-green", "pending": "st-amber", "returned": "st-rose"}.get(body.status, "")
    c.execute("""INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator, operator_role,
        status_from, status_to, status_class, is_override, dot_class, override_reason)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (f"TL-ST-{uuid.uuid4().hex[:6]}", wo_id, "status_changed",
               f"状态变更：{status_label.get(body.status, body.status)}",
               body.note or f"由 {status_label.get(old_status, old_status)} 变更为 {status_label.get(body.status, body.status)}",
               now_str(), body.operator, body.operatorRole,
               status_label.get(old_status, old_status), status_label.get(body.status, body.status),
               status_class, 0, status_class.replace("st-", "dot-"), None))
    conn.commit()
    row = c.execute("SELECT * FROM workorders WHERE id=?", (wo_id,)).fetchone()
    wo = assemble_workorder(row, conn)
    conn.close()
    return {"data": wo}


@app.post("/api/workorders/{wo_id}/override")
def add_override(wo_id: str, body: OverrideIn):
    conn = get_db()
    c = conn.cursor()
    row = c.execute("SELECT * FROM workorders WHERE id=?", (wo_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "工单不存在")
    c.execute("""INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator, operator_role,
        status_from, status_to, status_class, is_override, dot_class, override_reason)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (f"TL-OV-{uuid.uuid4().hex[:6]}", wo_id, "override", body.title, body.desc,
               now_str(), body.operator, "运维负责人", None, None, "", 1, "dot-violet", body.reason))
    conn.commit()
    wo = assemble_workorder(row, conn)
    conn.close()
    return {"data": wo}


@app.get("/api/summary")
def get_summary():
    conn = get_db()
    c = conn.cursor()
    rows = c.execute("SELECT status, COUNT(*) as cnt FROM workorders GROUP BY status").fetchall()
    result = {"confirmed": 0, "pending": 0, "returned": 0, "abnormal": 0, "total": 0}
    for r in rows:
        result[r["status"]] = r["cnt"]
        result["total"] += r["cnt"]
    result["abnormal"] = c.execute(
        "SELECT COUNT(DISTINCT workorder_id) FROM samplings WHERE status='abnormal'"
    ).fetchone()[0]
    dup_rows = c.execute("""
        SELECT w.id, w.title, w.dedup_hash, COUNT(sh.id) as submit_cnt
        FROM workorders w JOIN submit_history sh ON w.id = sh.workorder_id
        GROUP BY w.id HAVING submit_cnt > 1 ORDER BY submit_cnt DESC
    """).fetchall()
    result["duplicated"] = [{"id": r["id"], "title": r["title"], "dedupHash": r["dedup_hash"],
                             "submitCount": r["submit_cnt"]} for r in dup_rows]
    conn.close()
    return {"data": result}


@app.get("/api/abnormal")
def get_abnormal():
    conn = get_db()
    c = conn.cursor()
    rows = c.execute("""
        SELECT s.*, w.title as wo_title, w.crane_name, w.downtime_start, w.downtime_end
        FROM samplings s JOIN workorders w ON s.workorder_id = w.id
        WHERE s.status='abnormal' ORDER BY w.created_at DESC, s.time
    """).fetchall()
    result = []
    for r in rows:
        result.append({
            "workorderId": r["workorder_id"],
            "workorderTitle": r["wo_title"],
            "craneName": r["crane_name"],
            "downtimeWindow": {"start": r["downtime_start"], "end": r["downtime_end"]},
            "time": r["time"], "value": r["value"], "pct": r["pct"],
            "status": r["status"], "reason": r["reason"],
        })
    conn.close()
    return {"data": result}


@app.get("/api/export")
def export_all(filter: str = "all", keyword: str = ""):
    conn = get_db()
    c = conn.cursor()
    rows = c.execute("SELECT * FROM workorders ORDER BY created_at DESC").fetchall()
    workorders = [assemble_workorder(r, conn) for r in rows]

    summary = {"confirmed": 0, "pending": 0, "returned": 0, "abnormal": 0, "total": len(workorders)}
    for wo in workorders:
        summary[wo["status"]] = summary.get(wo["status"], 0) + 1
        if any(s["status"] == "abnormal" for s in wo["sampling"]):
            summary["abnormal"] += 1

    abnormals = []
    for wo in workorders:
        for s in wo["sampling"]:
            if s["status"] == "abnormal":
                abnormals.append({
                    "workorderId": wo["id"], "workorderTitle": wo["title"],
                    "craneName": wo["craneName"], "time": s["time"], "reason": s["reason"],
                })

    duplicates_merged = []
    for wo in workorders:
        sh = c.execute("SELECT * FROM submit_history WHERE workorder_id=? ORDER BY id", (wo["id"],)).fetchall()
        if len(sh) > 1:
            duplicates_merged.append({
                "workorderId": wo["id"], "dedupHash": wo.get("dedupHash"),
                "title": wo["title"], "submitCount": len(sh),
                "submitHistory": [{"submittedAt": x["submitted_at"], "operator": x["operator"], "note": x["note"]} for x in sh],
                "note": "该工单合并了多次提交，统计时只按1份计算",
            })

    timeline_full = []
    for wo in workorders:
        for tl in wo["timeline"]:
            tl2 = dict(tl)
            tl2["workorderId"] = wo["id"]
            tl2["workorderTitle"] = wo["title"]
            timeline_full.append(tl2)
    timeline_full.sort(key=lambda x: x["time"])

    conn.close()

    output = {
        "exportedAt": now_str(),
        "filter": filter, "keyword": keyword,
        "summary": {
            "已确认": summary["confirmed"],
            "待补件": summary["pending"],
            "退回": summary["returned"],
            "采样断档工单": summary["abnormal"],
            "总计工单": summary["total"],
            "说明": "已确认/待补件/退回为主状态互斥分类；采样断档单独统计，可能与主状态重叠",
        },
        "workorders": workorders,
        "abnormalRecords": abnormals,
        "duplicatesMerged": duplicates_merged,
        "timelineFull": timeline_full,
    }
    fname = f"塔吊维保工单回放-导出-{datetime.now().strftime('%Y%m%d-%H%M')}.json"
    fpath = os.path.join(os.path.dirname(__file__), "data", fname)
    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    return FileResponse(fpath, filename=fname, media_type="application/json")


# Serve static frontend
app.mount("/", StaticFiles(directory=os.path.join(os.path.dirname(__file__)), html=True), name="static")

if __name__ == "__main__":
    init_db()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
else:
    init_db()
