from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Response
from pydantic import BaseModel, Field

from .database import connect, init_db
from .service import (
    MedicalRecordInput,
    add_medical_record,
    bind_alias,
    confirm_schedule,
    export_detail_csv,
    get_schedule_detail,
    import_schedules,
    list_anomalies,
    list_logs,
    list_schedules,
    seed_demo,
    summary,
    withdraw_schedule,
)


DB_PATH = Path(os.environ.get("RECONCILE_DB", "data/reconcile.sqlite3"))


def get_conn():
    conn = connect(DB_PATH)
    init_db(conn)
    try:
        yield conn
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    with connect(DB_PATH) as conn:
        init_db(conn)
    yield


app = FastAPI(title="宠物训练课排程对账", version="2.0.0", lifespan=lifespan)


class CsvImportRequest(BaseModel):
    csv_text: str = Field(..., min_length=1)
    label: str = "training-schedules.csv"


class MedicalRecordRequest(BaseModel):
    pet_name: str
    visit_date: str
    diagnosis: str
    treatment: str
    veterinarian: str
    linked_schedule_id: Optional[int] = None
    source_row: str = "manual-1"


class ActionRequest(BaseModel):
    operator: str = "小乔"
    remark: str = ""


class AliasBindRequest(BaseModel):
    alias_name: str
    canonical_name: str
    operator: str = "小乔"


@app.post("/seed")
def seed(conn=Depends(get_conn)):
    result = seed_demo(conn)
    conn.commit()
    return result


@app.get("/summary")
def get_summary(conn=Depends(get_conn)):
    return summary(conn)


@app.post("/imports/schedules")
def post_schedules(request: CsvImportRequest, conn=Depends(get_conn)):
    try:
        result = import_schedules(conn, request.csv_text, request.label)
        conn.commit()
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/medical-records")
def post_medical_record(request: MedicalRecordRequest, conn=Depends(get_conn)):
    result = add_medical_record(conn, MedicalRecordInput(**request.model_dump()))
    conn.commit()
    return result


@app.get("/schedules")
def get_schedules(include_anomalies: bool = True, conn=Depends(get_conn)):
    return {"items": list_schedules(conn, include_anomalies=include_anomalies)}


@app.get("/schedules/{schedule_id}")
def get_schedule(schedule_id: int, conn=Depends(get_conn)):
    detail = get_schedule_detail(conn, schedule_id)
    if not detail.get("schedule"):
        raise HTTPException(status_code=404, detail=f"排程 {schedule_id} 不存在")
    return detail


@app.post("/schedules/{schedule_id}/confirm")
def post_confirm(schedule_id: int, request: ActionRequest, conn=Depends(get_conn)):
    try:
        result = confirm_schedule(conn, schedule_id, request.operator, request.remark)
        conn.commit()
        return result
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/schedules/{schedule_id}/withdraw")
def post_withdraw(schedule_id: int, request: ActionRequest, conn=Depends(get_conn)):
    try:
        result = withdraw_schedule(conn, schedule_id, request.operator, request.remark)
        conn.commit()
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/aliases/bind")
def post_bind_alias(request: AliasBindRequest, conn=Depends(get_conn)):
    result = bind_alias(conn, request.alias_name, request.canonical_name, request.operator)
    conn.commit()
    return result


@app.get("/anomalies")
def get_anomalies(conn=Depends(get_conn)):
    return {"items": list_anomalies(conn)}


@app.get("/logs")
def get_logs(conn=Depends(get_conn)):
    return {"items": list_logs(conn)}


@app.get("/exports/schedules.csv")
def get_export(conn=Depends(get_conn)):
    return Response(
        content=export_detail_csv(conn),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="schedule-details.csv"'},
    )
