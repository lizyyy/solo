import os
from datetime import date
from typing import Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import FileResponse

from .models import (
    ReconcileStatus, AbnormalType, ReconcileItem, AbnormalQueueItem,
    BoardingRegister, VaccineSchedule
)
from .sample_data import build_sample_registers, build_sample_schedules
from .reconcile import run_reconcile
from .exporter import export_reconcile_csv, export_abnormal_queue_csv

app = FastAPI(title="犬只疫苗排程对账", version="0.1.0")

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(_DATA_DIR, exist_ok=True)

_REGISTERS: list[BoardingRegister] = []
_SCHEDULES: list[VaccineSchedule] = []
_RECONCILE_ITEMS: list[ReconcileItem] = []
_ABNORMAL_QUEUE: list[AbnormalQueueItem] = []
_CURRENT_MONTH: str = ""
_EXPORTED_RECONCILE_PATHS: dict[str, str] = {}
_EXPORTED_QUEUE_PATH: str = ""


def _ensure_loaded():
    global _REGISTERS, _SCHEDULES, _RECONCILE_ITEMS, _ABNORMAL_QUEUE, _CURRENT_MONTH
    if not _REGISTERS:
        _REGISTERS = build_sample_registers()
        _SCHEDULES = build_sample_schedules(_REGISTERS)
        _CURRENT_MONTH = date.today().strftime("%Y-%m")
        _RECONCILE_ITEMS, _ABNORMAL_QUEUE = run_reconcile(
            _REGISTERS, _SCHEDULES, _CURRENT_MONTH
        )


@app.on_event("startup")
def _startup():
    _ensure_loaded()


@app.get("/", tags=["入口"])
def index():
    return {
        "service": "犬只疫苗排程对账",
        "试用入口": {
            "寄养登记表列表": "/api/registers",
            "对账明细（按状态过滤）": "/api/reconcile?status=待处理",
            "异常队列": "/api/abnormal-queue",
            "试跑对账并导出CSV": "/api/reconcile/rerun",
            "下载已导出的异常队列": "/api/download/abnormal-queue",
            "下载对账明细（按分类）": "/api/download/reconcile?bucket=全部",
            "月底复核统计": "/api/stats"
        }
    }


@app.get("/api/registers", tags=["寄养登记表"], response_model=list[BoardingRegister])
def list_registers():
    _ensure_loaded()
    return _REGISTERS


@app.get("/api/reconcile", tags=["对账明细"], response_model=list[ReconcileItem])
def list_reconcile(
    status: Optional[ReconcileStatus] = Query(None, description="按状态过滤"),
    abnormal: Optional[AbnormalType] = Query(None, description="按异常类型过滤"),
    reg_id: Optional[str] = Query(None, description="按登记表ID过滤"),
    month: Optional[str] = Query(None, description="对账月份 YYYY-MM")
):
    _ensure_loaded()
    items = _RECONCILE_ITEMS
    if month and month != _CURRENT_MONTH:
        items, _ = run_reconcile(_REGISTERS, _SCHEDULES, month)
    if status:
        items = [i for i in items if i.status == status]
    if abnormal:
        items = [i for i in items if abnormal in i.abnormal_types]
    if reg_id:
        items = [i for i in items if i.reg_id == reg_id]
    return items


@app.get("/api/reconcile/{reconcile_id}", tags=["对账明细"], response_model=ReconcileItem)
def get_reconcile_detail(reconcile_id: str):
    _ensure_loaded()
    for i in _RECONCILE_ITEMS:
        if i.reconcile_id == reconcile_id:
            return i
    raise HTTPException(status_code=404, detail="对账记录不存在")


@app.get("/api/abnormal-queue", tags=["异常队列"], response_model=list[AbnormalQueueItem])
def list_abnormal_queue(
    status: Optional[ReconcileStatus] = Query(None, description="按状态过滤，保证与对账明细状态一致")
):
    _ensure_loaded()
    qs = _ABNORMAL_QUEUE
    if status:
        qs = [q for q in qs if q.status == status]
    return qs


@app.get("/api/stats", tags=["月底复核统计"])
def stats():
    _ensure_loaded()
    total = len(_RECONCILE_ITEMS)
    counts: dict[str, int] = {}
    for s in ReconcileStatus:
        counts[s.value] = 0
    for it in _RECONCILE_ITEMS:
        counts[it.status.value] += 1
    abnormal_counts = {}
    for t in AbnormalType:
        abnormal_counts[t.value] = 0
    for it in _RECONCILE_ITEMS:
        for t in it.abnormal_types:
            abnormal_counts[t.value] += 1
    return {
        "对账月份": _CURRENT_MONTH,
        "总记录数": total,
        "按状态分布": counts,
        "按异常类型分布": abnormal_counts,
        "说明": "月底复核时，按「已确认 / 待补件 / 退回」三类分别出CSV，状态与异常队列完全一致"
    }


@app.post("/api/reconcile/rerun", tags=["对账操作"])
def rerun_reconcile(
    month: Optional[str] = Query(None, description="指定对账月份，默认当月 YYYY-MM")
):
    global _RECONCILE_ITEMS, _ABNORMAL_QUEUE, _CURRENT_MONTH
    global _EXPORTED_RECONCILE_PATHS, _EXPORTED_QUEUE_PATH
    _ensure_loaded()
    if not month:
        month = date.today().strftime("%Y-%m")
    _CURRENT_MONTH = month
    _RECONCILE_ITEMS, _ABNORMAL_QUEUE = run_reconcile(
        _REGISTERS, _SCHEDULES, month
    )
    _EXPORTED_RECONCILE_PATHS = export_reconcile_csv(
        _RECONCILE_ITEMS, _DATA_DIR, month
    )
    _EXPORTED_QUEUE_PATH = export_abnormal_queue_csv(
        _ABNORMAL_QUEUE, _DATA_DIR, month
    )
    return {
        "对账月份": month,
        "对账明细总数": len(_RECONCILE_ITEMS),
        "异常队列条数": len(_ABNORMAL_QUEUE),
        "已导出文件": {
            "对账明细分类CSV": _EXPORTED_RECONCILE_PATHS,
            "异常队列CSV": _EXPORTED_QUEUE_PATH
        },
        "状态一致性校验": _validate_consistency()
    }


@app.get("/api/download/reconcile", tags=["下载"])
def download_reconcile(
    bucket: str = Query("全部", description="分类：全部 / 已确认 / 待补件 / 退回 / 待处理")
):
    _ensure_loaded()
    if not _EXPORTED_RECONCILE_PATHS:
        _EXPORTED_RECONCILE_PATHS = export_reconcile_csv(
            _RECONCILE_ITEMS, _DATA_DIR, _CURRENT_MONTH
        )
    if bucket not in _EXPORTED_RECONCILE_PATHS:
        raise HTTPException(status_code=404, detail=f"找不到该分类文件，可选：{list(_EXPORTED_RECONCILE_PATHS.keys())}")
    path = _EXPORTED_RECONCILE_PATHS[bucket]
    return FileResponse(path, filename=os.path.basename(path), media_type="text/csv")


@app.get("/api/download/abnormal-queue", tags=["下载"])
def download_abnormal_queue():
    _ensure_loaded()
    global _EXPORTED_QUEUE_PATH
    if not _EXPORTED_QUEUE_PATH or not os.path.exists(_EXPORTED_QUEUE_PATH):
        _EXPORTED_QUEUE_PATH = export_abnormal_queue_csv(
            _ABNORMAL_QUEUE, _DATA_DIR, _CURRENT_MONTH
        )
    return FileResponse(_EXPORTED_QUEUE_PATH, filename=os.path.basename(_EXPORTED_QUEUE_PATH), media_type="text/csv")


def _validate_consistency() -> dict:
    mismatches: list[dict] = []
    rec_map = {r.reconcile_id: r for r in _RECONCILE_ITEMS}
    for q in _ABNORMAL_QUEUE:
        r = rec_map.get(q.reconcile_id)
        if not r:
            mismatches.append({"queue_id": q.queue_id, "reason": "异常队列找不到对应对账明细"})
            continue
        if r.status != q.status:
            mismatches.append({
                "reconcile_id": r.reconcile_id,
                "detail_status": r.status.value,
                "queue_status": q.status.value,
                "reason": "状态不一致"
            })
    return {
        "一致": len(mismatches) == 0,
        "不一致条数": len(mismatches),
        "详情": mismatches
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
