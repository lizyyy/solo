import json
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from .config import AppConfig
from .ledger import Ledger
from .models import BatchInfo, CabinetInventory, OrderReplayState, QuarantinedEvent
from .quarantine import QuarantineStore
from .reports import ReportExporter


class APIResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
    message: Optional[str] = None


class AppState:
    def __init__(
        self,
        config: AppConfig,
        ledger: Ledger,
        quarantine: QuarantineStore,
        exporter: ReportExporter,
    ):
        self.config = config
        self.ledger = ledger
        self.quarantine = quarantine
        self.exporter = exporter


_app_state: Optional[AppState] = None


def get_app_state() -> AppState:
    global _app_state
    if _app_state is None:
        raise RuntimeError("应用状态未初始化")
    return _app_state


def set_app_state(state: AppState):
    global _app_state
    _app_state = state


def create_api_app(
    config: AppConfig,
    ledger: Ledger,
    quarantine: QuarantineStore,
    exporter: ReportExporter,
) -> FastAPI:
    state = AppState(config, ledger, quarantine, exporter)
    set_app_state(state)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield

    app = FastAPI(
        title="离线补账包回放器 API",
        description="智能售货柜离线补账包回放、校验和对账工具",
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.get("/", response_model=APIResponse)
    async def root():
        return APIResponse(
            success=True,
            data={
                "name": "离线补账包回放器",
                "version": "0.1.0",
                "status": "running",
            },
        )

    @app.get("/health", response_model=APIResponse)
    async def health():
        return APIResponse(success=True, data={"status": "healthy"})

    @app.get("/api/inventory", response_model=APIResponse)
    async def get_inventory(
        cabinet_id: Optional[str] = Query(None, description="柜机ID，不指定则返回所有柜机"),
    ):
        state = get_app_state()
        if cabinet_id:
            inv = state.ledger.get_inventory(cabinet_id)
            if not inv:
                raise HTTPException(status_code=404, detail=f"柜机 {cabinet_id} 不存在")
            return APIResponse(
                success=True,
                data={
                    "cabinet_id": inv.cabinet_id,
                    "last_updated": inv.last_updated.isoformat(),
                    "channels": inv.channels,
                    "version": inv.version,
                },
            )
        else:
            invs = state.ledger.get_all_inventories()
            return APIResponse(
                success=True,
                data={
                    "count": len(invs),
                    "inventories": [
                        {
                            "cabinet_id": inv.cabinet_id,
                            "last_updated": inv.last_updated.isoformat(),
                            "channels": inv.channels,
                            "version": inv.version,
                        }
                        for inv in invs
                    ],
                },
            )

    @app.get("/api/batches", response_model=APIResponse)
    async def get_batches():
        state = get_app_state()
        batches = state.ledger.get_all_batches()
        return APIResponse(
            success=True,
            data={
                "count": len(batches),
                "batches": [
                    {
                        "batch_id": b.batch_id,
                        "import_time": b.import_time.isoformat(),
                        "source_files": b.source_files,
                        "event_count": b.event_count,
                        "valid_event_count": b.valid_event_count,
                        "quarantined_count": b.quarantined_count,
                        "applied": b.applied,
                        "applied_at": b.applied_at.isoformat() if b.applied_at else None,
                    }
                    for b in batches
                ],
            },
        )

    @app.get("/api/batches/{batch_id}", response_model=APIResponse)
    async def get_batch(batch_id: str):
        state = get_app_state()
        batch = state.ledger.get_batch(batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")
        return APIResponse(
            success=True,
            data={
                "batch_id": batch.batch_id,
                "import_time": batch.import_time.isoformat(),
                "source_files": batch.source_files,
                "event_count": batch.event_count,
                "valid_event_count": batch.valid_event_count,
                "quarantined_count": batch.quarantined_count,
                "applied": batch.applied,
                "applied_at": batch.applied_at.isoformat() if batch.applied_at else None,
            },
        )

    @app.get("/api/quarantine", response_model=APIResponse)
    async def get_quarantine(
        batch_id: Optional[str] = Query(None, description="按批次过滤"),
    ):
        state = get_app_state()
        if batch_id:
            events = state.quarantine.get_events_by_batch(batch_id)
        else:
            events = state.quarantine.get_all_events()
        return APIResponse(
            success=True,
            data={
                "count": len(events),
                "events": [
                    {
                        "event_id": qe.event.event_id,
                        "event_type": qe.event.event_type.value,
                        "cabinet_id": qe.event.cabinet_id,
                        "order_id": qe.event.order_id,
                        "timestamp": qe.event.timestamp.isoformat(),
                        "quarantine_time": qe.quarantine_time.isoformat(),
                        "reason": qe.reason,
                        "batch_id": qe.batch_id,
                    }
                    for qe in events
                ],
            },
        )

    @app.get("/api/audit", response_model=APIResponse)
    async def get_audit_log():
        state = get_app_state()
        log = state.ledger.get_audit_log()
        return APIResponse(
            success=True,
            data={
                "count": len(log),
                "entries": [
                    {
                        "timestamp": entry.timestamp.isoformat(),
                        "action": entry.action,
                        "batch_id": entry.batch_id,
                        "user": entry.user,
                        "details": entry.details,
                    }
                    for entry in log
                ],
            },
        )

    @app.post("/api/export/markdown", response_model=APIResponse)
    async def export_markdown():
        state = get_app_state()
        try:
            batches = state.ledger.get_all_batches()
            inventories = state.ledger.get_all_inventories()
            quarantine_events = state.quarantine.get_all_events()
            audit_log = state.ledger.get_audit_log()

            filepath = state.exporter.export_markdown_reconciliation(
                batches=batches,
                inventories=inventories,
                orders=[],
                quarantined_events=quarantine_events,
                audit_log=audit_log,
            )
            return APIResponse(
                success=True,
                data={"filepath": str(filepath)},
                message=f"对账报告已导出到: {filepath}",
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"导出失败: {e}")

    @app.post("/api/export/csv", response_model=APIResponse)
    async def export_csv():
        state = get_app_state()
        try:
            inventories = state.ledger.get_all_inventories()
            filepath = state.exporter.export_csv_inventory_diff(inventories=inventories)
            return APIResponse(
                success=True,
                data={"filepath": str(filepath)},
                message=f"CSV库存表已导出到: {filepath}",
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"导出失败: {e}")

    @app.post("/api/export/json", response_model=APIResponse)
    async def export_json():
        state = get_app_state()
        try:
            batches = state.ledger.get_all_batches()
            inventories = state.ledger.get_all_inventories()
            audit_log = state.ledger.get_audit_log()

            filepath = state.exporter.export_json_audit_evidence(
                batches=batches,
                orders=[],
                inventories=inventories,
                audit_log=audit_log,
            )
            return APIResponse(
                success=True,
                data={"filepath": str(filepath)},
                message=f"JSON审计证据已导出到: {filepath}",
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"导出失败: {e}")

    @app.get("/api/config", response_model=APIResponse)
    async def get_config():
        state = get_app_state()
        return APIResponse(
            success=True,
            data={
                "cabinets": [
                    {
                        "cabinet_id": c.cabinet_id,
                        "name": c.name,
                        "location": c.location,
                    }
                    for c in state.config.cabinets
                ],
                "skus": [
                    {
                        "sku_id": s.sku_id,
                        "name": s.name,
                        "price": s.price,
                        "weight_per_unit": s.weight_per_unit,
                    }
                    for s in state.config.skus
                ],
                "channels": [
                    {
                        "channel_id": ch.channel_id,
                        "sku_id": ch.sku_id,
                        "capacity": ch.capacity,
                        "initial_quantity": ch.initial_quantity,
                    }
                    for ch in state.config.channels
                ],
                "settings": {
                    "deduplication_window_seconds": state.config.deduplication_window_seconds,
                    "max_clock_drift_seconds": state.config.max_clock_drift_seconds,
                    "abnormal_weight_threshold_percent": state.config.abnormal_weight_threshold_percent,
                },
            },
        )

    return app
