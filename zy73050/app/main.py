from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "app" / "data" / "tower_maintenance.db"
SEED_PATH = ROOT / "data" / "seed.json"
EXPORT_DIR = ROOT / "data"

STATUS_LABEL = {
    "confirmed": "已确认",
    "pending": "待补件",
    "returned": "退回",
}


# ============================================================
# 工具函数
# ============================================================
def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def dedup_hash(wo: dict[str, Any]) -> str:
    """
    去重哈希：相同工单号 + 相同停机窗口起始 + 相同备件批次（排序拼接）
    同塔吊同窗口但批次不同 -> 必须拆成不同样本
    """
    id_val = str(wo.get("id", "")).strip()
    window = wo.get("downtimeWindow") or {}
    win_start = str(window.get("start", "")).strip()
    parts = sorted(
        [str(p.get("batchNo") or p.get("batch_no") or "").strip().upper()
         for p in wo.get("parts", [])]
    )
    raw = f"{id_val}|{win_start}|{','.join(parts)}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:8].upper()


def _parts_are_late(parts: list[dict[str, Any]], win_start: str) -> bool:
    return any(
        (p.get("actualArrival") or p.get("actual_arrival") or "") > win_start
        for p in parts
    )


def _has_abnormal(sampling: list[dict[str, Any]]) -> bool:
    return any((s.get("status") == "abnormal") for s in (sampling or []))


# ============================================================
# Pydantic 请求模型
# ============================================================
class PartIn(BaseModel):
    id: Optional[str] = None
    name: str
    spec: str = ""
    qty: float = 1
    unit: str = ""
    batchNo: str = ""
    plannedArrival: str = ""
    actualArrival: str = ""
    remark: str = ""
    screenshotName: str = ""
    author: str = "提交人"


class SamplingIn(BaseModel):
    time: str
    value: float = 0
    pct: int = 0
    status: str = "normal"
    reason: str = ""


class WorkorderIn(BaseModel):
    id: Optional[str] = None
    craneId: str
    craneName: str = ""
    title: str
    type: str = "月度维保"
    status: str = "pending"
    scheduler: str = ""
    maintainer: str = ""
    downtimeWindow: dict[str, str]
    parts: List[PartIn]
    sampling: List[SamplingIn] = []
    operator: str = "提交人"
    operatorRole: str = "现场调度"


class SubmitIn(BaseModel):
    workorder: dict[str, Any]


class RemarkIn(BaseModel):
    content: str = Field(min_length=1)
    author: str = "宋建国"
    role: str = "现场调度"


class ScreenshotIn(BaseModel):
    name: str = Field(min_length=1)
    preview: str = "📷"
    author: str = "宋建国"
    role: str = "现场调度"


class StatusIn(BaseModel):
    status: str = Field(pattern="^(confirmed|pending|returned)$")
    operator: str = "宋建国"
    operatorRole: str = "现场调度"
    note: str = ""


class OverrideIn(BaseModel):
    reason: str = Field(min_length=1)
    operator: str = "张总监"
    operatorRole: str = "运维负责人"
    operatorTitle: str = "人工改判"
    targetStatus: Optional[str] = None


class SamplingAddIn(BaseModel):
    time: str
    value: float = 0
    pct: int = 0
    status: str = Field(pattern="^(normal|abnormal)$")
    reason: str = ""
    operator: str = "提交人"


# ============================================================
# FastAPI 应用
# ============================================================
app = FastAPI(title="塔吊维保工单回放 API")
app.mount("/css", StaticFiles(directory=ROOT / "css"), name="css")
app.mount("/js", StaticFiles(directory=ROOT / "js"), name="js")


# ============================================================
# 数据库连接 & 初始化
# ============================================================
def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with connect() as conn:
        c = conn.cursor()
        c.executescript("""
        CREATE TABLE IF NOT EXISTS workorders (
            id TEXT PRIMARY KEY,
            crane_id TEXT NOT NULL,
            crane_name TEXT,
            title TEXT NOT NULL,
            type TEXT,
            status TEXT NOT NULL,
            scheduler TEXT,
            maintainer TEXT,
            downtime_start TEXT NOT NULL,
            downtime_end TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            has_abnormal_sampling INTEGER DEFAULT 0,
            has_late_parts INTEGER DEFAULT 0,
            dedup_hash TEXT,
            submit_count INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS parts (
            id TEXT PRIMARY KEY,
            workorder_id TEXT NOT NULL REFERENCES workorders(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            spec TEXT,
            qty REAL,
            unit TEXT,
            batch_no TEXT,
            planned_arrival TEXT,
            actual_arrival TEXT,
            is_late INTEGER DEFAULT 0,
            late_days INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS remark_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
            version INTEGER NOT NULL,
            is_latest INTEGER DEFAULT 1,
            content TEXT NOT NULL,
            author TEXT,
            role TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS screenshot_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
            version INTEGER NOT NULL,
            is_latest INTEGER DEFAULT 1,
            name TEXT NOT NULL,
            preview TEXT,
            author TEXT,
            role TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS samplings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workorder_id TEXT NOT NULL REFERENCES workorders(id) ON DELETE CASCADE,
            time TEXT NOT NULL,
            value REAL DEFAULT 0,
            pct INTEGER DEFAULT 0,
            status TEXT NOT NULL,
            reason TEXT
        );

        CREATE TABLE IF NOT EXISTS timeline (
            id TEXT PRIMARY KEY,
            workorder_id TEXT NOT NULL REFERENCES workorders(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            desc TEXT,
            time TEXT NOT NULL,
            operator TEXT,
            operator_role TEXT,
            status_from TEXT,
            status_to TEXT,
            status_class TEXT,
            is_override INTEGER DEFAULT 0,
            dot_class TEXT,
            override_reason TEXT
        );

        CREATE TABLE IF NOT EXISTS submit_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workorder_id TEXT NOT NULL REFERENCES workorders(id) ON DELETE CASCADE,
            dedup_hash TEXT,
            payload TEXT,
            created_at TEXT NOT NULL
        );
        """)

        count = c.execute("SELECT COUNT(*) AS c FROM workorders").fetchone()["c"]
        if count == 0 and SEED_PATH.exists():
            seed_data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
            for wo in seed_data:
                seed_workorder(c, wo)
            conn.commit()


def seed_workorder(c: sqlite3.Cursor, wo: dict[str, Any]) -> None:
    wo_id = wo["id"]
    created = wo.get("createdAt", now_text())
    win = wo.get("downtimeWindow", {})
    win_start = win.get("start", created)
    win_end = win.get("end", created)
    dh = dedup_hash(wo)

    c.execute(
        """INSERT INTO workorders (id, crane_id, crane_name, title, type, status, scheduler,
            maintainer, downtime_start, downtime_end, created_at, updated_at,
            has_abnormal_sampling, has_late_parts, dedup_hash, submit_count)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (wo_id, wo.get("craneId"), wo.get("craneName"), wo.get("title"), wo.get("type"),
         wo.get("status"), wo.get("scheduler"), wo.get("maintainer"),
         win_start, win_end, created, created,
         1 if _has_abnormal(wo.get("sampling", [])) else 0,
         1 if _parts_are_late(wo.get("parts", []), win_start) else 0,
         dh, wo.get("submitCount") or 1),
    )

    for p in wo.get("parts", []):
        pid = p.get("id") or f"P-{uuid.uuid4().hex[:5].upper()}"
        is_late = (p.get("actualArrival") or "") > win_start
        c.execute(
            """INSERT INTO parts (id, workorder_id, name, spec, qty, unit, batch_no,
                planned_arrival, actual_arrival, is_late, late_days)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (pid, wo_id, p.get("name"), p.get("spec"), p.get("qty"), p.get("unit"),
             p.get("batchNo") or p.get("batch_no") or "",
             p.get("plannedArrival", created), p.get("actualArrival") or p.get("plannedArrival", created),
             1 if is_late else 0, 0),
        )
        for rv in p.get("remarkVersions", []):
            c.execute(
                """INSERT INTO remark_versions (part_id, version, is_latest, content, author, role, created_at)
                VALUES (?,?,?,?,?,?,?)""",
                (pid, rv.get("version", 1), 1 if rv.get("isLatest") else 0,
                 rv.get("content"), rv.get("author"), rv.get("role"), rv.get("createdAt", created)),
            )
        for sv in p.get("screenshotVersions", []):
            c.execute(
                """INSERT INTO screenshot_versions (part_id, version, is_latest, name, preview, author, role, created_at)
                VALUES (?,?,?,?,?,?,?,?)""",
                (pid, sv.get("version", 1), 1 if sv.get("isLatest") else 0,
                 sv.get("name"), sv.get("preview", "🖼️"), sv.get("author"), sv.get("role", ""), sv.get("createdAt", created)),
            )

    for s in wo.get("sampling", []):
        c.execute(
            """INSERT INTO samplings (workorder_id, time, value, pct, status, reason)
            VALUES (?,?,?,?,?,?)""",
            (wo_id, s.get("time"), s.get("value", 0), s.get("pct", 0),
             s.get("status", "normal"), s.get("reason", "")),
        )

    for tl in wo.get("timeline", []):
        tl_id = tl.get("id") or f"TL-{uuid.uuid4().hex[:8]}"
        clash_check = c.execute("SELECT id FROM timeline WHERE id = ?", (tl_id,)).fetchone()
        if clash_check:
            tl_id = f"{tl_id}-{uuid.uuid4().hex[:4]}"
        c.execute(
            """INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator,
                operator_role, status_from, status_to, status_class, is_override, dot_class, override_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (tl_id, wo_id, tl.get("type"),
             tl.get("title"), tl.get("desc"), tl.get("time", created), tl.get("operator"),
             tl.get("operatorRole"), tl.get("statusFrom"), tl.get("statusTo"),
             tl.get("statusClass"), 1 if tl.get("isOverride") else 0,
             tl.get("dotClass"), tl.get("overrideReason")),
        )

    c.execute(
        """INSERT INTO submit_history (workorder_id, dedup_hash, payload, created_at)
        VALUES (?,?,?,?)""",
        (wo_id, dh, json.dumps(wo, ensure_ascii=False), created),
    )


# ============================================================
# 组装聚合
# ============================================================
def _row_get(row: sqlite3.Row, key: str, default: Any = "") -> Any:
    try:
        val = row[key]
        return val if val is not None else default
    except (IndexError, KeyError):
        return default


def assemble_workorder(c: sqlite3.Cursor, row: sqlite3.Row) -> dict[str, Any]:
    wo_id = row["id"]

    parts = []
    for p in c.execute("SELECT * FROM parts WHERE workorder_id = ? ORDER BY id", (wo_id,)).fetchall():
        pid = p["id"]
        remarks = c.execute(
            "SELECT * FROM remark_versions WHERE part_id = ? ORDER BY version DESC",
            (pid,),
        ).fetchall()
        shots = c.execute(
            "SELECT * FROM screenshot_versions WHERE part_id = ? ORDER BY version DESC",
            (pid,),
        ).fetchall()

        def _is_latest_first(idx: int) -> bool:
            return idx == 0

        parts.append({
            "id": pid,
            "name": p["name"],
            "spec": p["spec"] or "",
            "qty": p["qty"],
            "unit": p["unit"] or "",
            "batchNo": p["batch_no"] or "",
            "plannedArrival": p["planned_arrival"],
            "actualArrival": p["actual_arrival"],
            "isLate": bool(p["is_late"]),
            "lateDays": p["late_days"],
            "remarkVersions": [
                {
                    "version": r["version"],
                    "isLatest": _is_latest_first(i),
                    "content": r["content"],
                    "author": r["author"],
                    "role": r["role"],
                    "createdAt": r["created_at"],
                }
                for i, r in enumerate(remarks)
            ],
            "screenshotVersions": [
                {
                    "version": s["version"],
                    "isLatest": _is_latest_first(i),
                    "name": s["name"],
                    "preview": s["preview"],
                    "author": s["author"],
                    "role": _row_get(s, "role", ""),
                    "createdAt": s["created_at"],
                }
                for i, s in enumerate(shots)
            ],
        })

    sampling = [
        {
            "time": s["time"],
            "value": s["value"],
            "pct": s["pct"],
            "status": s["status"],
            "reason": s["reason"] or "",
        }
        for s in c.execute("SELECT * FROM samplings WHERE workorder_id = ? ORDER BY time", (wo_id,)).fetchall()
    ]

    timeline = [
        {
            "id": t["id"],
            "type": t["type"],
            "title": t["title"],
            "desc": t["desc"] or "",
            "time": t["time"],
            "operator": t["operator"],
            "operatorRole": t["operator_role"] or "",
            "statusFrom": t["status_from"],
            "statusTo": t["status_to"],
            "statusClass": t["status_class"] or "",
            "isOverride": bool(t["is_override"]),
            "dotClass": t["dot_class"] or "",
            "overrideReason": t["override_reason"] or "",
        }
        for t in c.execute("SELECT * FROM timeline WHERE workorder_id = ? ORDER BY time, id", (wo_id,)).fetchall()
    ]

    submit_count = row["submit_count"] or 1
    result = {
        "id": wo_id,
        "craneId": row["crane_id"],
        "craneName": row["crane_name"] or row["crane_id"],
        "title": row["title"],
        "type": row["type"] or "",
        "status": row["status"],
        "scheduler": row["scheduler"] or "",
        "maintainer": row["maintainer"] or "",
        "downtimeWindow": {
            "start": row["downtime_start"],
            "end": row["downtime_end"] or "",
        },
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "hasAbnormalSampling": bool(row["has_abnormal_sampling"]),
        "hasLateParts": bool(row["has_late_parts"]),
        "dedupHash": row["dedup_hash"] or "",
        "submitCount": submit_count,
        "parts": parts,
        "sampling": sampling,
        "timeline": timeline,
    }
    return result


def all_workorders() -> list[dict[str, Any]]:
    with connect() as conn:
        c = conn.cursor()
        rows = c.execute("SELECT * FROM workorders ORDER BY created_at DESC, id").fetchall()
        return [assemble_workorder(c, r) for r in rows]


def get_workorder(workorder_id: str) -> dict[str, Any]:
    with connect() as conn:
        c = conn.cursor()
        row = c.execute("SELECT * FROM workorders WHERE id = ?", (workorder_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="workorder not found")
        return assemble_workorder(c, row)


# ============================================================
# 启动
# ============================================================
@app.on_event("startup")
def startup() -> None:
    init_db()


# ============================================================
# 路由：基础 & 静态资源
# ============================================================
@app.get("/")
def index() -> FileResponse:
    return FileResponse(ROOT / "index.html")


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "database": str(DB_PATH),
        "dedupRule": "相同工单号 + 相同停机窗口 + 相同备件批次 = 同一复核样本",
    }


# ============================================================
# 列表
# ============================================================
@app.get("/api/workorders")
def list_workorders(
    status: str = Query("all", pattern="^(all|confirmed|pending|returned|abnormal)$"),
    keyword: str = "",
) -> dict[str, Any]:
    wos = all_workorders()
    total = len(wos)

    counts = {
        "all": total,
        "confirmed": sum(w["status"] == "confirmed" for w in wos),
        "pending": sum(w["status"] == "pending" for w in wos),
        "returned": sum(w["status"] == "returned" for w in wos),
        "abnormal": sum(w["hasAbnormalSampling"] for w in wos),
    }

    if status == "confirmed":
        wos = [w for w in wos if w["status"] == "confirmed"]
    elif status == "pending":
        wos = [w for w in wos if w["status"] == "pending"]
    elif status == "returned":
        wos = [w for w in wos if w["status"] == "returned"]
    elif status == "abnormal":
        wos = [w for w in wos if w["hasAbnormalSampling"]]

    kw = keyword.strip().lower()
    if kw:
        def _hit(w: dict[str, Any]) -> bool:
            blob = " ".join([
                str(w.get("id", "")),
                str(w.get("craneId", "")),
                str(w.get("craneName", "")),
                str(w.get("title", "")),
            ]).lower()
            return kw in blob
        wos = [w for w in wos if _hit(w)]

    return {"source": "sqlite", "counts": counts, "data": wos}


# ============================================================
# 汇总 + duplicated
# ============================================================
@app.get("/api/summary")
def get_summary() -> dict[str, Any]:
    wos = all_workorders()
    duplicated = [
        {
            "id": w["id"],
            "title": w["title"],
            "dedupHash": w["dedupHash"],
            "submitCount": w["submitCount"],
        }
        for w in wos
        if w["submitCount"] > 1
    ]
    return {
        "data": {
            "confirmed": sum(w["status"] == "confirmed" for w in wos),
            "pending": sum(w["status"] == "pending" for w in wos),
            "returned": sum(w["status"] == "returned" for w in wos),
            "abnormal": sum(w["hasAbnormalSampling"] for w in wos),
            "total": len(wos),
            "duplicated": duplicated,
        }
    }


# ============================================================
# 异常区（断档）
# ============================================================
@app.get("/api/abnormal")
def list_abnormal() -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    with connect() as conn:
        c = conn.cursor()
        rows = c.execute(
            """SELECT s.*, w.id AS wo_id, w.title AS wo_title, w.crane_id, w.crane_name,
                      w.downtime_start, w.downtime_end
               FROM samplings s
               JOIN workorders w ON w.id = s.workorder_id
               WHERE s.status = 'abnormal'
               ORDER BY w.downtime_start DESC, s.time ASC"""
        ).fetchall()
        for r in rows:
            records.append({
                "workorderId": r["wo_id"],
                "workorderTitle": r["wo_title"],
                "craneId": r["crane_id"],
                "craneName": r["crane_name"],
                "time": r["time"],
                "pct": r["pct"],
                "status": r["status"],
                "reason": r["reason"] or "",
                "windowStart": r["downtime_start"],
            })
    return {"count": len(records), "data": records}


# ============================================================
# 提交工单（含去重）
# ============================================================
@app.post("/api/workorders/submit")
def submit_workorder(payload: SubmitIn) -> dict[str, Any]:
    incoming = deepcopy(payload.workorder)
    dh = dedup_hash(incoming)
    created = now_text()

    # 规范化 parts
    parts_in = []
    for p in incoming.get("parts", []):
        parts_in.append(PartIn(
            id=p.get("id"),
            name=p["name"],
            spec=p.get("spec") or "",
            qty=float(p.get("qty") or 1),
            unit=p.get("unit") or "",
            batchNo=p.get("batchNo") or p.get("batch_no") or "",
            plannedArrival=p.get("plannedArrival") or "",
            actualArrival=p.get("actualArrival") or p.get("plannedArrival") or "",
            remark=p.get("remark") or "",
            screenshotName=p.get("screenshotName") or "",
            author=p.get("author") or "提交人",
        ))
    sampling_in = []
    for s in incoming.get("sampling", []):
        sampling_in.append(SamplingIn(
            time=s["time"],
            value=float(s.get("value") or 0),
            pct=int(s.get("pct") or 0),
            status=s.get("status", "normal"),
            reason=s.get("reason") or "",
        ))

    win = incoming.get("downtimeWindow") or {}
    win_start = win.get("start") or created
    win_end = win.get("end") or created

    with connect() as conn:
        c = conn.cursor()
        existing = c.execute(
            "SELECT * FROM workorders WHERE dedup_hash = ?",
            (dh,),
        ).fetchone()

        if existing:
            wo_id = existing["id"]
            new_count = (existing["submit_count"] or 1) + 1
            c.execute(
                "UPDATE workorders SET submit_count = ?, updated_at = ? WHERE id = ?",
                (new_count, created, wo_id),
            )
            # 追加 submit_history
            c.execute(
                "INSERT INTO submit_history (workorder_id, dedup_hash, payload, created_at) VALUES (?,?,?,?)",
                (wo_id, dh, json.dumps(incoming, ensure_ascii=False), created),
            )
            # 追加 timeline：重复提交
            tl_id = f"TL-DUP-{uuid.uuid4().hex[:8]}"
            status_map = {"pending": "待补件", "confirmed": "已确认", "returned": "退回"}
            c.execute(
                """INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator,
                    operator_role, status_from, status_to, status_class, is_override, dot_class, override_reason)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (tl_id, wo_id, "duplicate",
                 f"重复提交合并（哈希 {dh}）",
                 f"新提交与工单 {wo_id} 去重哈希一致，仅追加提交历史，统计数量不翻倍。已累计提交 {new_count} 次。",
                 created, incoming.get("operator") or "提交人", incoming.get("operatorRole") or "提交人",
                 status_map.get(existing["status"], existing["status"]),
                 status_map.get(existing["status"], existing["status"]),
                 "st-amber", 0, "dot-amber", ""),
            )
            conn.commit()
            return {
                "duplicate": True,
                "hash": dh,
                "submitCount": new_count,
                "workorder": get_workorder(wo_id),
                "message": f"检测到相同工单号/停机窗口/备件批次，已合并至 {wo_id}",
            }

        # 新增工单
        wo_id = str(incoming.get("id") or f"WO-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:3].upper()}").strip()
        # 防止工单号冲突
        clash = c.execute("SELECT id FROM workorders WHERE id = ?", (wo_id,)).fetchone()
        if clash:
            wo_id = f"{wo_id}-{uuid.uuid4().hex[:3].upper()}"

        has_abn = any(s.status == "abnormal" for s in sampling_in)
        has_late = _parts_are_late([p.dict() for p in parts_in], win_start)
        status_val = str(incoming.get("status") or "pending")
        status_map = {"pending": "待补件", "confirmed": "已确认", "returned": "退回"}
        label_to = status_map.get(status_val, status_val)

        c.execute(
            """INSERT INTO workorders (id, crane_id, crane_name, title, type, status, scheduler,
                maintainer, downtime_start, downtime_end, created_at, updated_at,
                has_abnormal_sampling, has_late_parts, dedup_hash, submit_count)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (wo_id, incoming["craneId"], incoming.get("craneName") or incoming["craneId"],
             incoming["title"], incoming.get("type") or "月度维保", status_val,
             incoming.get("scheduler"), incoming.get("maintainer"),
             win_start, win_end, created, created,
             1 if has_abn else 0, 1 if has_late else 0, dh, 1),
        )

        for p in parts_in:
            pid = p.id or f"P-{uuid.uuid4().hex[:5].upper()}"
            is_late = (p.actualArrival > win_start) if p.actualArrival else False
            c.execute(
                """INSERT INTO parts (id, workorder_id, name, spec, qty, unit, batch_no,
                    planned_arrival, actual_arrival, is_late, late_days)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (pid, wo_id, p.name, p.spec, p.qty, p.unit, p.batchNo,
                 p.plannedArrival or win_start, p.actualArrival or p.plannedArrival or win_start,
                 1 if is_late else 0, 0),
            )
            if p.remark:
                c.execute(
                    """INSERT INTO remark_versions (part_id, version, is_latest, content, author, role, created_at)
                    VALUES (?,?,?,?,?,?,?)""",
                    (pid, 1, 1, p.remark, p.author, "提交人", created),
                )
            if p.screenshotName:
                c.execute(
                    """INSERT INTO screenshot_versions (part_id, version, is_latest, name, preview, author, role, created_at)
                    VALUES (?,?,?,?,?,?,?,?)""",
                    (pid, 1, 1, p.screenshotName, "🖼️", p.author, "提交人", created),
                )

        for s in sampling_in:
            c.execute(
                """INSERT INTO samplings (workorder_id, time, value, pct, status, reason)
                VALUES (?,?,?,?,?,?)""",
                (wo_id, s.time, s.value, s.pct, s.status, s.reason),
            )

        # timeline 基础节点
        timelines = [
            (f"TL-C-{uuid.uuid4().hex[:8]}", wo_id, "created", "工单创建",
             f"{incoming.get('operator','提交人')}提交复核材料：{incoming['title']}", created,
             incoming.get("operator") or "提交人", incoming.get("operatorRole") or "提交人",
             None, "待处理", "", 0, "dot-sky", ""),
            (f"TL-A-{uuid.uuid4().hex[:8]}", wo_id, "assigned", "材料已登记",
             "复核材料已入库，等待进一步处理。", created,
             incoming.get("operator") or "提交人", incoming.get("operatorRole") or "提交人",
             "待处理", label_to,
             "st-amber" if status_val == "pending" else "st-green" if status_val == "confirmed" else "st-rose",
             0, "dot-amber" if status_val == "pending" else "dot-green" if status_val == "confirmed" else "dot-rose",
             ""),
        ]
        if has_late:
            timelines.append((
                f"TL-L-{uuid.uuid4().hex[:8]}", wo_id, "parts_late", "备件到货延迟预警",
                "检测到实际到货晚于停机窗口，已标记预警。", created,
                "系统自动", "预警引擎",
                label_to, "待补件", "st-amber", 0, "dot-amber", "",
            ))
        if has_abn:
            timelines.append((
                f"TL-SA-{uuid.uuid4().hex[:8]}", wo_id, "sampling_abnormal",
                "采样断档·已单独拎出",
                "检测到采样断档记录，已放入异常区，不计入正常统计。", created,
                "系统自动", "数据监控",
                None, None, "", 0, "dot-rose", "",
            ))
        for t in timelines:
            c.execute(
                """INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator,
                    operator_role, status_from, status_to, status_class, is_override, dot_class, override_reason)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", t,
            )

        c.execute(
            "INSERT INTO submit_history (workorder_id, dedup_hash, payload, created_at) VALUES (?,?,?,?)",
            (wo_id, dh, json.dumps(incoming, ensure_ascii=False), created),
        )
        conn.commit()

    return {
        "duplicate": False,
        "hash": dh,
        "submitCount": 1,
        "workorder": get_workorder(wo_id),
        "message": f"工单 {wo_id} 已入库",
    }


# ============================================================
# 补录备注（追加版本）
# ============================================================
@app.post("/api/workorders/{workorder_id}/parts/{part_id}/remarks")
def add_remark(workorder_id: str, part_id: str, payload: RemarkIn) -> dict[str, Any]:
    with connect() as conn:
        c = conn.cursor()
        wo_row = c.execute("SELECT * FROM workorders WHERE id = ?", (workorder_id,)).fetchone()
        if not wo_row:
            raise HTTPException(status_code=404, detail="workorder not found")
        part_row = c.execute("SELECT * FROM parts WHERE id = ? AND workorder_id = ?", (part_id, workorder_id)).fetchone()
        if not part_row:
            raise HTTPException(status_code=404, detail="part not found")

        max_v = c.execute(
            "SELECT COALESCE(MAX(version),0) AS m FROM remark_versions WHERE part_id = ?",
            (part_id,),
        ).fetchone()["m"]
        next_v = max_v + 1
        created = now_text()

        c.execute(
            "UPDATE remark_versions SET is_latest = 0 WHERE part_id = ?",
            (part_id,),
        )
        c.execute(
            """INSERT INTO remark_versions (part_id, version, is_latest, content, author, role, created_at)
            VALUES (?,?,?,?,?,?,?)""",
            (part_id, next_v, 1, payload.content, payload.author, payload.role, created),
        )
        # timeline
        tl_id = f"TL-REM-{uuid.uuid4().hex[:8]}"
        status_map = {"pending": "待补件", "confirmed": "已确认", "returned": "退回"}
        cur_label = status_map.get(wo_row["status"], wo_row["status"])
        c.execute(
            """INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator,
                operator_role, status_from, status_to, status_class, is_override, dot_class, override_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (tl_id, workorder_id, "remark_added",
             f"补录备注 v{next_v}",
             f"零件 {part_row['name']} 追加现场备注，历史版本保留。内容：{payload.content[:40]}",
             created, payload.author, payload.role,
             cur_label, cur_label, "", 0, "dot-sky", ""),
        )
        c.execute("UPDATE workorders SET updated_at = ? WHERE id = ?", (created, workorder_id))
        conn.commit()
    return {"version": next_v, "workorder": get_workorder(workorder_id)}


# ============================================================
# 追加截图版本
# ============================================================
@app.post("/api/workorders/{workorder_id}/parts/{part_id}/screenshots")
def add_screenshot(workorder_id: str, part_id: str, payload: ScreenshotIn) -> dict[str, Any]:
    with connect() as conn:
        c = conn.cursor()
        wo_row = c.execute("SELECT * FROM workorders WHERE id = ?", (workorder_id,)).fetchone()
        if not wo_row:
            raise HTTPException(status_code=404, detail="workorder not found")
        part_row = c.execute("SELECT * FROM parts WHERE id = ? AND workorder_id = ?", (part_id, workorder_id)).fetchone()
        if not part_row:
            raise HTTPException(status_code=404, detail="part not found")

        max_v = c.execute(
            "SELECT COALESCE(MAX(version),0) AS m FROM screenshot_versions WHERE part_id = ?",
            (part_id,),
        ).fetchone()["m"]
        next_v = max_v + 1
        created = now_text()

        c.execute("UPDATE screenshot_versions SET is_latest = 0 WHERE part_id = ?", (part_id,))
        c.execute(
            """INSERT INTO screenshot_versions (part_id, version, is_latest, name, preview, author, role, created_at)
            VALUES (?,?,?,?,?,?,?,?)""",
            (part_id, next_v, 1, payload.name, payload.preview or "🖼️", payload.author, payload.role, created),
        )
        tl_id = f"TL-SC-{uuid.uuid4().hex[:8]}"
        status_map = {"pending": "待补件", "confirmed": "已确认", "returned": "退回"}
        cur_label = status_map.get(wo_row["status"], wo_row["status"])
        c.execute(
            """INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator,
                operator_role, status_from, status_to, status_class, is_override, dot_class, override_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (tl_id, workorder_id, "screenshot_added",
             f"截图版本 v{next_v}",
             f"零件 {part_row['name']} 上传截图：{payload.name}",
             created, payload.author, payload.role or "提交人",
             cur_label, cur_label, "", 0, "dot-green", ""),
        )
        c.execute("UPDATE workorders SET updated_at = ? WHERE id = ?", (created, workorder_id))
        conn.commit()
    return {"version": next_v, "workorder": get_workorder(workorder_id)}


# ============================================================
# 新增采样记录
# ============================================================
@app.post("/api/workorders/{workorder_id}/samplings")
def add_sampling(workorder_id: str, payload: SamplingAddIn) -> dict[str, Any]:
    with connect() as conn:
        c = conn.cursor()
        wo_row = c.execute("SELECT * FROM workorders WHERE id = ?", (workorder_id,)).fetchone()
        if not wo_row:
            raise HTTPException(status_code=404, detail="workorder not found")

        created = now_text()
        c.execute(
            """INSERT INTO samplings (workorder_id, time, value, pct, status, reason)
            VALUES (?,?,?,?,?,?)""",
            (workorder_id, payload.time, payload.value, payload.pct, payload.status, payload.reason),
        )

        if payload.status == "abnormal":
            c.execute("UPDATE workorders SET has_abnormal_sampling = 1 WHERE id = ?", (workorder_id,))
            tl_id = f"TL-SA-{uuid.uuid4().hex[:8]}"
            c.execute(
                """INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator,
                    operator_role, status_from, status_to, status_class, is_override, dot_class, override_reason)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (tl_id, workorder_id, "sampling_abnormal",
                 "采样断档告警",
                 f"新增断档记录 @ {payload.time}：{payload.reason or '未说明原因'}",
                 created, payload.operator, "数据监控",
                 None, None, "", 0, "dot-rose", ""),
            )
        c.execute("UPDATE workorders SET updated_at = ? WHERE id = ?", (created, workorder_id))
        conn.commit()
    return {"workorder": get_workorder(workorder_id)}


# ============================================================
# 状态变更
# ============================================================
@app.patch("/api/workorders/{workorder_id}/status")
def update_status(workorder_id: str, payload: StatusIn) -> dict[str, Any]:
    with connect() as conn:
        c = conn.cursor()
        wo_row = c.execute("SELECT * FROM workorders WHERE id = ?", (workorder_id,)).fetchone()
        if not wo_row:
            raise HTTPException(status_code=404, detail="workorder not found")
        old_status = wo_row["status"]
        if old_status == payload.status:
            return {"workorder": get_workorder(workorder_id)}

        status_map = {"pending": "待补件", "confirmed": "已确认", "returned": "退回"}
        old_label = status_map.get(old_status, old_status)
        new_label = status_map.get(payload.status, payload.status)
        class_map = {"pending": "st-amber", "confirmed": "st-green", "returned": "st-rose"}
        dot_map = {"pending": "dot-amber", "confirmed": "dot-green", "returned": "dot-rose"}

        created = now_text()
        c.execute("UPDATE workorders SET status = ?, updated_at = ? WHERE id = ?", (payload.status, created, workorder_id))
        tl_id = f"TL-ST-{uuid.uuid4().hex[:8]}"
        c.execute(
            """INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator,
                operator_role, status_from, status_to, status_class, is_override, dot_class, override_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (tl_id, workorder_id, "status_changed",
             f"状态变更：{old_label} → {new_label}",
             payload.note or f"由 {payload.operator}（{payload.operatorRole}）处理后变更状态。",
             created, payload.operator, payload.operatorRole,
             old_label, new_label,
             class_map.get(payload.status, ""), 0, dot_map.get(payload.status, ""),
             ""),
        )
        conn.commit()
    return {"workorder": get_workorder(workorder_id)}


# ============================================================
# 人工改判
# ============================================================
@app.post("/api/workorders/{workorder_id}/override")
def override_workorder(workorder_id: str, payload: OverrideIn) -> dict[str, Any]:
    with connect() as conn:
        c = conn.cursor()
        wo_row = c.execute("SELECT * FROM workorders WHERE id = ?", (workorder_id,)).fetchone()
        if not wo_row:
            raise HTTPException(status_code=404, detail="workorder not found")
        created = now_text()
        status_map = {"pending": "待补件", "confirmed": "已确认", "returned": "退回"}
        cur_status = wo_row["status"]
        new_status = payload.targetStatus or cur_status

        if new_status != cur_status:
            c.execute("UPDATE workorders SET status = ?, updated_at = ? WHERE id = ?", (new_status, created, workorder_id))

        tl_id = f"TL-OV-{uuid.uuid4().hex[:8]}"
        c.execute(
            """INSERT INTO timeline (id, workorder_id, type, title, desc, time, operator,
                operator_role, status_from, status_to, status_class, is_override, dot_class, override_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (tl_id, workorder_id, "override",
             payload.operatorTitle,
             payload.reason,
             created, payload.operator, payload.operatorRole,
             status_map.get(cur_status, cur_status),
             status_map.get(new_status, new_status),
             "", 1, "dot-violet", payload.reason),
        )
        c.execute("UPDATE workorders SET updated_at = ? WHERE id = ?", (created, workorder_id))
        conn.commit()
    return {"workorder": get_workorder(workorder_id)}


# ============================================================
# 历史明细
# ============================================================
@app.get("/api/workorders/{workorder_id}/history")
def read_history(workorder_id: str) -> dict[str, Any]:
    wo = get_workorder(workorder_id)
    parts_history = []
    for p in wo["parts"]:
        parts_history.append({
            "partId": p["id"],
            "partName": p["name"],
            "batchNo": p["batchNo"],
            "remarkVersions": p["remarkVersions"],
            "screenshotVersions": p["screenshotVersions"],
        })
    return {"timeline": wo["timeline"], "partsHistory": parts_history, "submitCount": wo["submitCount"]}


# ============================================================
# 导出（真实生成文件 + FileResponse 下载）
# ============================================================
@app.get("/api/export")
def export_view(
    status: str = Query("all", pattern="^(all|confirmed|pending|returned|abnormal)$"),
    keyword: str = "",
    current_id: str = "",
) -> FileResponse:
    wos = all_workorders()
    total_wos = wos

    if status == "confirmed":
        wos = [w for w in wos if w["status"] == "confirmed"]
    elif status == "pending":
        wos = [w for w in wos if w["status"] == "pending"]
    elif status == "returned":
        wos = [w for w in wos if w["status"] == "returned"]
    elif status == "abnormal":
        wos = [w for w in wos if w["hasAbnormalSampling"]]
    kw = keyword.strip().lower()
    if kw:
        def _hit(w):
            return kw in " ".join([w.get("id",""), w.get("craneId",""), w.get("craneName",""), w.get("title","")]).lower()
        wos = [w for w in wos if _hit(w)]

    # 异常记录
    abnormal_records = []
    for w in total_wos:
        for s in w["sampling"]:
            if s["status"] == "abnormal":
                abnormal_records.append({
                    "workorderId": w["id"],
                    "workorderTitle": w["title"],
                    "craneId": w["craneId"],
                    "craneName": w["craneName"],
                    "window": w["downtimeWindow"],
                    "time": s["time"],
                    "reason": s.get("reason", ""),
                })

    # 去重合并说明
    duplicates_merged = [
        {
            "workorderId": w["id"],
            "workorderTitle": w["title"],
            "dedupHash": w["dedupHash"],
            "submitCount": w["submitCount"],
            "note": "该工单合并了多次提交，统计时只按1份计算",
        }
        for w in total_wos
        if w["submitCount"] > 1
    ]

    # 完整 timeline（带工单信息）
    timeline_full: list[dict[str, Any]] = []
    for w in total_wos:
        for t in w["timeline"]:
            entry = dict(t)
            entry["workorderId"] = w["id"]
            entry["workorderTitle"] = w["title"]
            entry["craneId"] = w["craneId"]
            timeline_full.append(entry)
    timeline_full.sort(key=lambda x: (x["time"], x["id"]))

    # 截图版本信息
    screenshots_info: list[dict[str, Any]] = []
    for w in total_wos:
        for p in w["parts"]:
            for s in p["screenshotVersions"]:
                screenshots_info.append({
                    "workorderId": w["id"],
                    "partId": p["id"],
                    "partName": p["name"],
                    "batchNo": p["batchNo"],
                    "version": s["version"],
                    "isLatest": s["isLatest"],
                    "name": s["name"],
                    "preview": s.get("preview", ""),
                    "author": s.get("author", ""),
                    "createdAt": s.get("createdAt", ""),
                })

    payload = {
        "exportedAt": now_text(),
        "dedupRule": "相同工单号 + 相同停机窗口起始 + 相同备件批次排序拼接 → md5 前8位",
        "summary": {
            "已确认": sum(w["status"] == "confirmed" for w in total_wos),
            "待补件": sum(w["status"] == "pending" for w in total_wos),
            "退回": sum(w["status"] == "returned" for w in total_wos),
            "采样断档工单": sum(w["hasAbnormalSampling"] for w in total_wos),
            "总计工单": len(total_wos),
            "说明": "已确认/待补件/退回为主状态互斥分类；采样断档单独统计，可能与主状态重叠",
        },
        "filter": {"status": status, "keyword": keyword, "filteredCount": len(wos)},
        "workorders": wos,
        "abnormalRecords": abnormal_records,
        "duplicatesMerged": duplicates_merged,
        "screenshotVersions": screenshots_info,
        "timelineFull": timeline_full,
        "currentWorkorderId": current_id or None,
    }

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    fname = f"塔吊维保工单回放-导出-{stamp}.json"
    fpath = EXPORT_DIR / fname
    fpath.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return FileResponse(
        str(fpath),
        media_type="application/json; charset=utf-8",
        filename=fname,
    )
