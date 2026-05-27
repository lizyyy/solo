from __future__ import annotations

import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .engine import classify
from .parsers import parse_packages_csv, parse_rules_json, parse_sms_json
from .schemas import (
    AnalysisReport,
    BatchIngestRequest,
    BatchMeta,
    ItemTrace,
    ReturnRule,
)
from .storage import store

router = APIRouter(prefix="/api", tags=["station"])


@router.post("/batches", response_model=BatchMeta)
async def create_batch(
    batch_id: str = Form(...),
    packages_file: UploadFile = File(...),
    sms_file: Optional[UploadFile] = File(default=None),
    rules_file: Optional[UploadFile] = File(default=None),
):
    if store.exists(batch_id):
        existing = BatchMeta(
            **json.loads(
                (store.meta_dir / f"{batch_id}.json").read_text(encoding="utf-8")
            )
        )
        return existing

    pkgs = parse_packages_csv(await packages_file.read())
    sms_records = parse_sms_json(await sms_file.read()) if sms_file else []
    rules = parse_rules_json(await rules_file.read()) if rules_file else default_rules()

    req = BatchIngestRequest(
        batch_id=batch_id, packages=pkgs, sms_records=sms_records, rules=rules
    )
    report, traces = classify(req)
    meta = store.save_ingest(req)
    ref = store.save_report(report)
    store.save_traces(batch_id, traces)
    meta.report_ref = ref
    return meta


@router.post("/batches/raw", response_model=BatchMeta)
async def create_batch_raw(req: BatchIngestRequest):
    if store.exists(req.batch_id):
        existing = BatchMeta(
            **json.loads(
                (store.meta_dir / f"{req.batch_id}.json").read_text(encoding="utf-8")
            )
        )
        return existing
    report, traces = classify(req)
    meta = store.save_ingest(req)
    ref = store.save_report(report)
    store.save_traces(req.batch_id, traces)
    meta.report_ref = ref
    return meta


@router.get("/batches", response_model=List[BatchMeta])
async def list_batches():
    return store.list_batches()


@router.get("/batches/{batch_id}/report", response_model=AnalysisReport)
async def get_report(batch_id: str):
    report = store.load_report(batch_id)
    if not report:
        raise HTTPException(status_code=404, detail="batch not found")
    return report


@router.get("/batches/{batch_id}/traces", response_model=List[ItemTrace])
async def list_traces(batch_id: str):
    if not store.exists(batch_id):
        raise HTTPException(status_code=404, detail="batch not found")
    return store.load_traces(batch_id)


@router.get("/batches/{batch_id}/traces/{tracking_no}", response_model=ItemTrace)
async def get_item_trace(batch_id: str, tracking_no: str):
    t = store.find_trace(batch_id, tracking_no)
    if not t:
        raise HTTPException(status_code=404, detail="trace not found")
    return t


def default_rules() -> List[ReturnRule]:
    return [
        ReturnRule(
            rule_id="default-overdue",
            rule_name="超期退回",
            rule_type="overdue_return",
            overstay_days=7,
            enabled=True,
        ),
        ReturnRule(
            rule_id="default-repeat",
            rule_name="重复催取",
            rule_type="repeat_remind",
            overstay_days=7,
            enabled=True,
            params={"threshold": 3},
        ),
        ReturnRule(
            rule_id="default-privacy",
            rule_name="隐私遮蔽",
            rule_type="privacy_mask",
            overstay_days=7,
            enabled=True,
            params={"mask_phone": True, "mask_name": True},
        ),
    ]
