from __future__ import annotations

import hashlib
import json
import sqlite3
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "app" / "data" / "tower_maintenance.db"


STATUS_LABEL = {
    "confirmed": "已确认",
    "pending": "待补件",
    "returned": "退回",
}


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def fingerprint_for(workorder: dict[str, Any]) -> str:
    parts = sorted(str(part.get("id", "")) for part in workorder.get("parts", []))
    window = workorder.get("downtimeWindow") or {}
    raw = "|".join(
        [
            str(workorder.get("craneId", "")),
            str(workorder.get("type", "")),
            str(window.get("start", "")),
            ",".join(parts),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:14].upper()


def normalize_versions(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered = sorted(items, key=lambda item: int(item.get("version") or 0), reverse=True)
    for index, item in enumerate(ordered):
        item["isLatest"] = index == 0
    return ordered


SEED_WORKORDERS: list[dict[str, Any]] = [
    {
        "id": "WO-2026-0601-017",
        "craneId": "TC-ZZ-03-A",
        "craneName": "3号塔机 · A区",
        "title": "主卷扬齿轮箱月度维保",
        "type": "月度维保",
        "status": "pending",
        "scheduler": "宋建国（小宋）",
        "maintainer": "李师傅班组",
        "downtimeWindow": {"start": "2026-06-08 08:00", "end": "2026-06-08 14:00"},
        "createdAt": "2026-06-05 09:20",
        "hasAbnormalSampling": True,
        "hasLateParts": True,
        "parts": [
            {
                "id": "P-001",
                "name": "工业齿轮油 L-CKD 320",
                "spec": "20L/桶 · ISO VG 320",
                "qty": 2,
                "unit": "桶",
                "plannedArrival": "2026-06-07 16:00",
                "actualArrival": "2026-06-08 09:30",
                "isLate": True,
                "remarkVersions": [
                    {
                        "version": 3,
                        "isLatest": True,
                        "content": "供应商物流更新：6月8日早晨到达中转站，预计9:30送达现场。小宋确认延迟会占用约1.5小时停机窗口。",
                        "author": "宋建国",
                        "role": "现场调度",
                        "createdAt": "2026-06-08 07:45",
                    },
                    {
                        "version": 2,
                        "isLatest": False,
                        "content": "补录：该批次油品因暴雨延误，预计到货时间推迟到6月8日上午。",
                        "author": "王雪",
                        "role": "仓管",
                        "createdAt": "2026-06-07 20:10",
                    },
                    {
                        "version": 1,
                        "isLatest": False,
                        "content": "首次提交：常规齿轮油更换，需2桶。",
                        "author": "李师傅",
                        "role": "维保班长",
                        "createdAt": "2026-06-05 09:35",
                    },
                ],
                "screenshotVersions": [
                    {
                        "version": 3,
                        "isLatest": True,
                        "name": "物流实时位置截图",
                        "author": "宋建国",
                        "role": "现场调度",
                        "createdAt": "2026-06-08 07:45",
                        "preview": "🚚",
                    },
                    {
                        "version": 2,
                        "isLatest": False,
                        "name": "物流延误通知",
                        "author": "王雪",
                        "role": "仓管",
                        "createdAt": "2026-06-07 20:10",
                        "preview": "📦",
                    },
                ],
            },
            {
                "id": "P-002",
                "name": "齿轮箱密封垫组件",
                "spec": "型号 GX-MJ-180 · NBR橡胶",
                "qty": 1,
                "unit": "套",
                "plannedArrival": "2026-06-07 16:00",
                "actualArrival": "2026-06-07 15:10",
                "isLate": False,
                "remarkVersions": [
                    {
                        "version": 1,
                        "isLatest": True,
                        "content": "仓库验收合格，配套螺栓已配齐。",
                        "author": "王雪",
                        "role": "仓管",
                        "createdAt": "2026-06-07 15:40",
                    }
                ],
                "screenshotVersions": [
                    {
                        "version": 1,
                        "isLatest": True,
                        "name": "实物入库照片",
                        "author": "王雪",
                        "role": "仓管",
                        "createdAt": "2026-06-07 15:40",
                        "preview": "📦",
                    }
                ],
            },
        ],
        "sampling": [
            {"time": "08:30", "value": 62.3, "pct": 62, "status": "normal", "reason": "油温正常"},
            {"time": "09:00", "value": 65.1, "pct": 65, "status": "normal", "reason": "油温正常"},
            {"time": "09:30", "value": 0, "pct": 0, "status": "abnormal", "reason": "数据断档 · 传感器离线"},
            {"time": "10:00", "value": 0, "pct": 0, "status": "abnormal", "reason": "数据断档 · 传感器离线"},
            {"time": "10:30", "value": 71.5, "pct": 72, "status": "normal", "reason": "恢复采样 · 油温稍高"},
        ],
        "timeline": [
            {
                "id": "TL-1",
                "type": "created",
                "title": "工单创建",
                "desc": "系统根据月度维保计划自动生成工单。",
                "time": "2026-06-05 09:20",
                "operator": "系统自动",
                "operatorRole": "系统",
                "statusFrom": None,
                "statusTo": "待处理",
                "statusClass": "",
                "isOverride": False,
                "dotClass": "",
            },
            {
                "id": "TL-2",
                "type": "parts_late",
                "title": "备件到货延迟预警",
                "desc": "工业齿轮油实际到货时间晚于停机窗口开始，触发预警。",
                "time": "2026-06-07 20:30",
                "operator": "系统自动",
                "operatorRole": "预警引擎",
                "statusFrom": "已分配",
                "statusTo": "待补件",
                "statusClass": "st-amber",
                "isOverride": False,
                "dotClass": "dot-amber",
            },
            {
                "id": "TL-3",
                "type": "override",
                "title": "人工改判：不调整停机窗口",
                "desc": "负责人批示：后续工序可并行开展，待补件后立即开工。",
                "time": "2026-06-07 21:00",
                "operator": "张总监",
                "operatorRole": "运维负责人",
                "statusFrom": None,
                "statusTo": None,
                "statusClass": "",
                "isOverride": True,
                "dotClass": "dot-violet",
                "overrideReason": "窗口时间已协调项目组，不宜再改",
            },
            {
                "id": "TL-4",
                "type": "sampling_abnormal",
                "title": "采样断档告警",
                "desc": "9:30-10:00 两次采样断档已单独标记，不计入正常统计。",
                "time": "2026-06-08 10:05",
                "operator": "系统自动",
                "operatorRole": "数据监控",
                "statusFrom": None,
                "statusTo": None,
                "statusClass": "",
                "isOverride": False,
                "dotClass": "dot-rose",
            },
        ],
    },
    {
        "id": "WO-2026-0602-024",
        "craneId": "TC-ZZ-05-B",
        "craneName": "5号塔机 · B区",
        "title": "回转制动器复核",
        "type": "故障复核",
        "status": "returned",
        "scheduler": "宋建国（小宋）",
        "maintainer": "陈工班组",
        "downtimeWindow": {"start": "2026-06-05 13:00", "end": "2026-06-05 17:00"},
        "createdAt": "2026-06-02 11:30",
        "hasAbnormalSampling": False,
        "hasLateParts": False,
        "parts": [
            {
                "id": "P-201",
                "name": "制动摩擦片",
                "spec": "TC-ZZ-BK-22",
                "qty": 4,
                "unit": "片",
                "plannedArrival": "2026-06-04 18:00",
                "actualArrival": "2026-06-04 16:40",
                "isLate": False,
                "remarkVersions": [
                    {
                        "version": 1,
                        "isLatest": True,
                        "content": "旧版本照片显示批次号不一致，退回重新核对。",
                        "author": "陈工",
                        "role": "维保工程师",
                        "createdAt": "2026-06-05 15:20",
                    }
                ],
                "screenshotVersions": [
                    {
                        "version": 1,
                        "isLatest": True,
                        "name": "批次号照片",
                        "author": "陈工",
                        "role": "维保工程师",
                        "createdAt": "2026-06-05 15:20",
                        "preview": "📷",
                    }
                ],
            }
        ],
        "sampling": [
            {"time": "13:30", "value": 78.1, "pct": 78, "status": "normal", "reason": "制动力正常"},
            {"time": "14:00", "value": 80.4, "pct": 80, "status": "normal", "reason": "制动力正常"},
        ],
        "timeline": [
            {
                "id": "TL-1",
                "type": "returned",
                "title": "材料退回",
                "desc": "批次号与旧版本截图不一致，退回重新补件。",
                "time": "2026-06-05 15:30",
                "operator": "宋建国",
                "operatorRole": "现场调度",
                "statusFrom": "处理中",
                "statusTo": "退回",
                "statusClass": "st-rose",
                "isOverride": False,
                "dotClass": "dot-rose",
            }
        ],
    },
    {
        "id": "WO-2026-0606-041",
        "craneId": "TC-ZZ-02-B",
        "craneName": "2号塔机 · B区",
        "title": "电气柜防尘滤网更换",
        "type": "月度维保",
        "status": "confirmed",
        "scheduler": "宋建国（小宋）",
        "maintainer": "赵工班组",
        "downtimeWindow": {"start": "2026-06-06 10:00", "end": "2026-06-06 11:00"},
        "createdAt": "2026-06-04 14:00",
        "hasAbnormalSampling": False,
        "hasLateParts": False,
        "parts": [
            {
                "id": "P-401",
                "name": "电气柜防尘滤网",
                "spec": "320×240×20mm · G4级初效",
                "qty": 2,
                "unit": "片",
                "plannedArrival": "2026-06-05 18:00",
                "actualArrival": "2026-06-05 16:30",
                "isLate": False,
                "remarkVersions": [
                    {
                        "version": 1,
                        "isLatest": True,
                        "content": "常备件，仓库备货充足。",
                        "author": "赵工",
                        "role": "维保工程师",
                        "createdAt": "2026-06-04 14:10",
                    }
                ],
                "screenshotVersions": [
                    {
                        "version": 1,
                        "isLatest": True,
                        "name": "新旧滤网对比图",
                        "author": "赵工",
                        "role": "维保工程师",
                        "createdAt": "2026-06-06 10:40",
                        "preview": "🌬️",
                    }
                ],
            }
        ],
        "sampling": [
            {"time": "10:15", "value": 88.2, "pct": 88, "status": "normal", "reason": "散热正常"},
            {"time": "10:30", "value": 89.5, "pct": 90, "status": "normal", "reason": "散热良好"},
        ],
        "timeline": [
            {
                "id": "TL-1",
                "type": "confirmed",
                "title": "快速完成 · 已确认",
                "desc": "仅1小时停机窗口，更换完成并采样全部正常，直接确认。",
                "time": "2026-06-06 11:10",
                "operator": "赵工",
                "operatorRole": "维保工程师",
                "statusFrom": "处理中",
                "statusTo": "已确认",
                "statusClass": "st-green",
                "isOverride": False,
                "dotClass": "dot-green",
            }
        ],
    },
]


class RemarkIn(BaseModel):
    content: str = Field(min_length=1)
    author: str = "宋建国"
    role: str = "现场调度"


class ScreenshotIn(BaseModel):
    name: str = Field(min_length=1)
    preview: str = "📷"
    author: str = "宋建国"
    role: str = "现场调度"


class SubmitIn(BaseModel):
    workorder: dict[str, Any]


app = FastAPI(title="塔吊维保工单回放 API")
app.mount("/css", StaticFiles(directory=ROOT / "css"), name="css")
app.mount("/js", StaticFiles(directory=ROOT / "js"), name="js")


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS workorders (
              id TEXT PRIMARY KEY,
              fingerprint TEXT NOT NULL UNIQUE,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS submissions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              fingerprint TEXT NOT NULL,
              workorder_id TEXT NOT NULL,
              duplicate_of TEXT,
              payload TEXT NOT NULL,
              created_at TEXT NOT NULL
            )
            """
        )
        count = conn.execute("SELECT COUNT(*) AS c FROM workorders").fetchone()["c"]
        if count == 0:
            for workorder in SEED_WORKORDERS:
                payload = deepcopy(workorder)
                fingerprint = fingerprint_for(payload)
                stamp = now_text()
                conn.execute(
                    "INSERT INTO workorders (id, fingerprint, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (payload["id"], fingerprint, json.dumps(payload, ensure_ascii=False), stamp, stamp),
                )


@app.on_event("startup")
def startup() -> None:
    init_db()


def all_workorders() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT payload FROM workorders ORDER BY created_at, id").fetchall()
    return [json.loads(row["payload"]) for row in rows]


def get_workorder(workorder_id: str) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT payload FROM workorders WHERE id = ?", (workorder_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="workorder not found")
    return json.loads(row["payload"])


def save_workorder(workorder: dict[str, Any]) -> None:
    workorder["hasLateParts"] = any(part.get("isLate") for part in workorder.get("parts", []))
    workorder["hasAbnormalSampling"] = any(item.get("status") == "abnormal" for item in workorder.get("sampling", []))
    with connect() as conn:
        conn.execute(
            "UPDATE workorders SET payload = ?, updated_at = ? WHERE id = ?",
            (json.dumps(workorder, ensure_ascii=False), now_text(), workorder["id"]),
        )


def filter_workorders(
    workorders: list[dict[str, Any]],
    status_filter: str,
    keyword: str,
) -> list[dict[str, Any]]:
    if status_filter == "confirmed":
        workorders = [item for item in workorders if item.get("status") == "confirmed"]
    elif status_filter == "pending":
        workorders = [item for item in workorders if item.get("status") == "pending"]
    elif status_filter == "returned":
        workorders = [item for item in workorders if item.get("status") == "returned"]
    elif status_filter == "abnormal":
        workorders = [item for item in workorders if item.get("hasAbnormalSampling")]

    kw = keyword.strip().lower()
    if kw:
        workorders = [
            item
            for item in workorders
            if kw
            in " ".join(
                [
                    str(item.get("id", "")),
                    str(item.get("craneId", "")),
                    str(item.get("craneName", "")),
                    str(item.get("title", "")),
                ]
            ).lower()
        ]
    return workorders


def counts_for(workorders: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "all": len(workorders),
        "confirmed": sum(item.get("status") == "confirmed" for item in workorders),
        "pending": sum(item.get("status") == "pending" for item in workorders),
        "returned": sum(item.get("status") == "returned" for item in workorders),
        "abnormal": sum(bool(item.get("hasAbnormalSampling")) for item in workorders),
    }


@app.get("/")
def index() -> FileResponse:
    return FileResponse(ROOT / "index.html")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "database": str(DB_PATH)}


@app.get("/api/workorders")
def list_workorders(
    status: str = Query("all", pattern="^(all|confirmed|pending|returned|abnormal)$"),
    keyword: str = "",
) -> dict[str, Any]:
    workorders = all_workorders()
    return {
        "source": "sqlite",
        "counts": counts_for(workorders),
        "workorders": filter_workorders(workorders, status, keyword),
    }


@app.get("/api/workorders/{workorder_id}")
def read_workorder(workorder_id: str) -> dict[str, Any]:
    return {"workorder": get_workorder(workorder_id)}


@app.post("/api/workorders/submit")
def submit_workorder(payload: SubmitIn) -> dict[str, Any]:
    incoming = deepcopy(payload.workorder)
    fingerprint = fingerprint_for(incoming)
    stamp = now_text()
    with connect() as conn:
        row = conn.execute(
            "SELECT id, payload FROM workorders WHERE fingerprint = ?",
            (fingerprint,),
        ).fetchone()
        if row:
            existing = json.loads(row["payload"])
            conn.execute(
                "INSERT INTO submissions (fingerprint, workorder_id, duplicate_of, payload, created_at) VALUES (?, ?, ?, ?, ?)",
                (fingerprint, existing["id"], existing["id"], json.dumps(incoming, ensure_ascii=False), stamp),
            )
            return {
                "duplicate": True,
                "hash": f"H{fingerprint}",
                "existingWorkorder": existing,
                "message": "duplicate submission ignored",
            }

        workorder_id = str(incoming.get("id") or f"WO-{stamp.replace(' ', '-').replace(':', '')}")
        incoming["id"] = workorder_id
        conn.execute(
            "INSERT INTO workorders (id, fingerprint, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (workorder_id, fingerprint, json.dumps(incoming, ensure_ascii=False), stamp, stamp),
        )
        conn.execute(
            "INSERT INTO submissions (fingerprint, workorder_id, duplicate_of, payload, created_at) VALUES (?, ?, ?, ?, ?)",
            (fingerprint, workorder_id, None, json.dumps(incoming, ensure_ascii=False), stamp),
        )
    return {"duplicate": False, "hash": f"H{fingerprint}", "workorder": incoming}


@app.post("/api/workorders/{workorder_id}/parts/{part_id}/remarks")
def add_remark(workorder_id: str, part_id: str, payload: RemarkIn) -> dict[str, Any]:
    workorder = get_workorder(workorder_id)
    part = next((item for item in workorder.get("parts", []) if item.get("id") == part_id), None)
    if part is None:
        raise HTTPException(status_code=404, detail="part not found")
    versions = part.setdefault("remarkVersions", [])
    next_version = max([int(item.get("version") or 0) for item in versions] or [0]) + 1
    versions.append(
        {
            "version": next_version,
            "isLatest": True,
            "content": payload.content,
            "author": payload.author,
            "role": payload.role,
            "createdAt": now_text(),
        }
    )
    part["remarkVersions"] = normalize_versions(versions)
    workorder.setdefault("timeline", []).append(
        {
            "id": f"TL-REMARK-{next_version}-{part_id}",
            "type": "override",
            "title": f"补录备注 v{next_version}",
            "desc": f"{part.get('name')} 追加现场备注，历史版本继续保留。",
            "time": now_text(),
            "operator": payload.author,
            "operatorRole": payload.role,
            "statusFrom": None,
            "statusTo": None,
            "statusClass": "",
            "isOverride": True,
            "dotClass": "dot-violet",
            "overrideReason": "人工补录材料说明",
        }
    )
    save_workorder(workorder)
    return {"version": part["remarkVersions"][0], "workorder": workorder}


@app.post("/api/workorders/{workorder_id}/parts/{part_id}/screenshots")
def add_screenshot(workorder_id: str, part_id: str, payload: ScreenshotIn) -> dict[str, Any]:
    workorder = get_workorder(workorder_id)
    part = next((item for item in workorder.get("parts", []) if item.get("id") == part_id), None)
    if part is None:
        raise HTTPException(status_code=404, detail="part not found")
    versions = part.setdefault("screenshotVersions", [])
    next_version = max([int(item.get("version") or 0) for item in versions] or [0]) + 1
    versions.append(
        {
            "version": next_version,
            "isLatest": True,
            "name": payload.name,
            "preview": payload.preview,
            "author": payload.author,
            "role": payload.role,
            "createdAt": now_text(),
        }
    )
    part["screenshotVersions"] = normalize_versions(versions)
    save_workorder(workorder)
    return {"version": part["screenshotVersions"][0], "workorder": workorder}


@app.get("/api/workorders/{workorder_id}/history")
def read_history(workorder_id: str) -> dict[str, Any]:
    workorder = get_workorder(workorder_id)
    parts_history = []
    for part in workorder.get("parts", []):
        parts_history.append(
            {
                "partId": part.get("id"),
                "partName": part.get("name"),
                "remarkVersions": normalize_versions(part.get("remarkVersions", [])),
                "screenshotVersions": normalize_versions(part.get("screenshotVersions", [])),
            }
        )
    return {"timeline": workorder.get("timeline", []), "partsHistory": parts_history}


@app.get("/api/export")
def export_view(
    status: str = Query("all", pattern="^(all|confirmed|pending|returned|abnormal)$"),
    keyword: str = "",
    current_id: str = "",
) -> dict[str, Any]:
    workorders = all_workorders()
    filtered = filter_workorders(workorders, status, keyword)
    selected = next((item for item in workorders if item.get("id") == current_id), None)
    return {
        "exportMeta": {
            "exportedAt": now_text(),
            "filter": status,
            "keyword": keyword,
            "totalCount": len(filtered),
            "currentWorkorder": current_id or None,
            "source": "FastAPI + SQLite",
        },
        "summary": counts_for(workorders),
        "workorders": [
            {
                "id": item.get("id"),
                "craneId": item.get("craneId"),
                "craneName": item.get("craneName"),
                "title": item.get("title"),
                "status": item.get("status"),
                "statusLabel": STATUS_LABEL.get(item.get("status"), item.get("status")),
                "partsCount": len(item.get("parts", [])),
                "latePartsCount": sum(bool(part.get("isLate")) for part in item.get("parts", [])),
                "abnormalSamplingCount": sum(s.get("status") == "abnormal" for s in item.get("sampling", [])),
            }
            for item in filtered
        ],
        "detail": selected,
    }
