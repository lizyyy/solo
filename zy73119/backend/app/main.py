from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from typing import List, Optional
from datetime import datetime, timedelta
import csv
import io
import uuid

from .database import engine, get_db, Base
from . import models, schemas

Base.metadata.create_all(bind=engine)

STANDARD_VERSION = "v2.4-202606"
STANDARD_DESC = "旧楼测绘交底清单口径：空间位置精度±50mm，异常等级按偏移量分级，材料送审表保留所有版本历史"

app = FastAPI(
    title="旧楼测绘交底清单系统",
    description="旧楼测绘BIM模型交底管理，含异常追溯、材料送审历史、坐标偏移处理",
    version=STANDARD_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- 交底清单 CRUD ----------

@app.get("/api/checklist", response_model=List[schemas.SurveyChecklist])
def list_checklist(
    skip: int = 0,
    limit: int = 100,
    anomaly_only: bool = False,
    keyword: str = "",
    status: str = "",
    db: Session = Depends(get_db),
):
    q = db.query(models.SurveyChecklist)
    if anomaly_only:
        q = q.filter(models.SurveyChecklist.has_anomaly == True)
    if status:
        q = q.filter(models.SurveyChecklist.status == status)
    if keyword:
        q = q.filter(or_(
            models.SurveyChecklist.item_no.contains(keyword),
            models.SurveyChecklist.location.contains(keyword),
            models.SurveyChecklist.description.contains(keyword),
        ))
    return q.order_by(desc(models.SurveyChecklist.created_at)).offset(skip).limit(limit).all()


@app.get("/api/checklist/{item_id}", response_model=schemas.SurveyChecklist)
def get_checklist(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.SurveyChecklist).filter(models.SurveyChecklist.id == item_id).first()
    if not item:
        raise HTTPException(404, "清单项不存在")
    return item


@app.post("/api/checklist", response_model=schemas.SurveyChecklist)
def create_checklist(data: schemas.SurveyChecklistCreate, db: Session = Depends(get_db)):
    exists = db.query(models.SurveyChecklist).filter(models.SurveyChecklist.item_no == data.item_no).first()
    if exists:
        raise HTTPException(400, f"编号 {data.item_no} 已存在")
    item = models.SurveyChecklist(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.put("/api/checklist/{item_id}", response_model=schemas.SurveyChecklist)
def update_checklist(item_id: int, data: schemas.SurveyChecklistUpdate, db: Session = Depends(get_db)):
    item = db.query(models.SurveyChecklist).filter(models.SurveyChecklist.id == item_id).first()
    if not item:
        raise HTTPException(404, "清单项不存在")

    update_data = data.model_dump(exclude_unset=True, exclude={"changed_by"})
    changed_by = data.changed_by or "system"

    for field, new_val in update_data.items():
        old_val = getattr(item, field)
        if old_val != new_val:
            history = models.ChangeHistory(
                checklist_id=item.id,
                field_name=field,
                old_value=str(old_val) if old_val is not None else "",
                new_value=str(new_val) if new_val is not None else "",
                changed_by=changed_by,
                remark=f"字段 {field} 变更",
            )
            db.add(history)
            setattr(item, field, new_val)

    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/checklist/{item_id}")
def delete_checklist(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.SurveyChecklist).filter(models.SurveyChecklist.id == item_id).first()
    if not item:
        raise HTTPException(404, "清单项不存在")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ---------- 异常记录 ----------

@app.get("/api/anomalies", response_model=List[schemas.AnomalyRecord])
def list_anomalies(resolved: Optional[bool] = None, db: Session = Depends(get_db)):
    q = db.query(models.AnomalyRecord)
    if resolved is not None:
        q = q.filter(models.AnomalyRecord.resolved == resolved)
    return q.order_by(desc(models.AnomalyRecord.created_at)).all()


@app.post("/api/anomalies", response_model=schemas.AnomalyRecord)
def create_anomaly(data: schemas.AnomalyRecordCreate, db: Session = Depends(get_db)):
    anomaly = models.AnomalyRecord(**data.model_dump())
    db.add(anomaly)

    item = db.query(models.SurveyChecklist).filter(models.SurveyChecklist.id == data.checklist_id).first()
    if item and not item.has_anomaly:
        item.has_anomaly = True
        if not item.anomaly_level:
            item.anomaly_level = "中"
        db.add(models.ChangeHistory(
            checklist_id=item.id,
            field_name="has_anomaly",
            old_value="False",
            new_value="True",
            changed_by=data.operator or "system",
            remark=f"新增异常：{data.anomaly_type}",
        ))

    db.commit()
    db.refresh(anomaly)
    return anomaly


@app.post("/api/anomalies/{anomaly_id}/trace", response_model=schemas.AnomalyTrace)
def add_anomaly_trace(anomaly_id: int, data: schemas.AnomalyTraceBase, db: Session = Depends(get_db)):
    anomaly = db.query(models.AnomalyRecord).filter(models.AnomalyRecord.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(404, "异常记录不存在")
    trace = models.AnomalyTrace(anomaly_id=anomaly_id, **data.model_dump())
    db.add(trace)
    db.commit()
    db.refresh(trace)
    return trace


@app.post("/api/anomalies/{anomaly_id}/resolve", response_model=schemas.AnomalyRecord)
def resolve_anomaly(anomaly_id: int, resolved_by: str = "", db: Session = Depends(get_db)):
    anomaly = db.query(models.AnomalyRecord).filter(models.AnomalyRecord.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(404, "异常记录不存在")
    anomaly.resolved = True
    anomaly.resolved_by = resolved_by
    anomaly.resolved_at = datetime.now()

    all_resolved = not db.query(models.AnomalyRecord).filter(
        models.AnomalyRecord.checklist_id == anomaly.checklist_id,
        models.AnomalyRecord.resolved == False,
    ).first()
    if all_resolved:
        item = db.query(models.SurveyChecklist).filter(models.SurveyChecklist.id == anomaly.checklist_id).first()
        if item:
            item.has_anomaly = False

    db.commit()
    db.refresh(anomaly)
    return anomaly


# ---------- 材料送审表（保留历史版本） ----------

@app.get("/api/checklist/{item_id}/materials", response_model=List[schemas.MaterialSubmission])
def list_materials(item_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.MaterialSubmission)
        .filter(models.MaterialSubmission.checklist_id == item_id)
        .order_by(models.MaterialSubmission.material_name, desc(models.MaterialSubmission.version))
        .all()
    )


@app.post("/api/materials", response_model=schemas.MaterialSubmission)
def submit_material(data: schemas.MaterialSubmissionCreate, db: Session = Depends(get_db)):
    item = db.query(models.SurveyChecklist).filter(models.SurveyChecklist.id == data.checklist_id).first()
    if not item:
        raise HTTPException(404, "清单项不存在")

    last = (
        db.query(models.MaterialSubmission)
        .filter(
            models.MaterialSubmission.checklist_id == data.checklist_id,
            models.MaterialSubmission.material_name == data.material_name,
        )
        .order_by(desc(models.MaterialSubmission.version))
        .first()
    )

    if last and last.is_current and last.current_value == data.current_value and last.remark == data.remark:
        return last

    if last:
        last.is_current = False

    new_version = (last.version + 1) if last else 1
    submission = models.MaterialSubmission(
        **data.model_dump(),
        version=new_version,
        is_current=True,
    )
    db.add(submission)

    db.add(models.ChangeHistory(
        checklist_id=data.checklist_id,
        field_name=f"material:{data.material_name}",
        old_value=f"v{new_version - 1}" if last else "",
        new_value=f"v{new_version}",
        remark=f"材料送审更新，备注：{data.remark}",
        screenshot_ref=data.screenshot_path,
        changed_by=data.submitted_by or "system",
    ))

    db.commit()
    db.refresh(submission)
    return submission


# ---------- 坐标偏移 ----------

@app.post("/api/offsets", response_model=schemas.CoordinateOffset)
def create_offset(data: schemas.CoordinateOffsetCreate, db: Session = Depends(get_db)):
    offset_dist = (data.offset_x ** 2 + data.offset_y ** 2 + data.offset_z ** 2) ** 0.5
    exceeds = offset_dist > data.threshold

    offset = models.CoordinateOffset(
        **data.model_dump(),
        exceeds=exceeds,
    )
    db.add(offset)

    if exceeds and not data.action_item:
        offset.action_item = (
            f"模型坐标偏移超限(Δ={offset_dist:.1f}mm)，"
            f"请BIM协调员复核现场控制点并回写模型，"
            f"处理完成后通知算法值班人重新跑批"
        )

    db.add(models.ChangeHistory(
        checklist_id=data.checklist_id,
        field_name="coordinate_offset",
        old_value="0.0",
        new_value=f"{offset_dist:.2f}mm",
        remark=f"X:{data.offset_x:.1f} Y:{data.offset_y:.1f} Z:{data.offset_z:.1f}，超限：{'是' if exceeds else '否'}",
        changed_by=data.action_owner or "system",
    ))

    db.commit()
    db.refresh(offset)
    return offset


@app.get("/api/offsets", response_model=List[schemas.CoordinateOffset])
def list_offsets(exceeds_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(models.CoordinateOffset)
    if exceeds_only:
        q = q.filter(models.CoordinateOffset.exceeds == True)
    return q.order_by(desc(models.CoordinateOffset.detected_at)).all()


@app.put("/api/offsets/{offset_id}", response_model=schemas.CoordinateOffset)
def update_offset(offset_id: int, action_owner: str = "", action_item: str = "", action_status: str = "", db: Session = Depends(get_db)):
    offset = db.query(models.CoordinateOffset).filter(models.CoordinateOffset.id == offset_id).first()
    if not offset:
        raise HTTPException(404, "偏移记录不存在")
    if action_owner:
        offset.action_owner = action_owner
    if action_item:
        offset.action_item = action_item
    if action_status:
        offset.action_status = action_status
    db.commit()
    db.refresh(offset)
    return offset


# ---------- 变更历史 ----------

@app.get("/api/checklist/{item_id}/history", response_model=List[schemas.ChangeHistory])
def list_history(item_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.ChangeHistory)
        .filter(models.ChangeHistory.checklist_id == item_id)
        .order_by(desc(models.ChangeHistory.changed_at))
        .all()
    )


# ---------- 一键跑批 ----------

@app.post("/api/batch-run", response_model=schemas.BatchRunResult)
def run_batch(run_by: str = "算法值班人", db: Session = Depends(get_db)):
    batch_id = f"BATCH-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}"

    all_items = db.query(models.SurveyChecklist).all()
    anomaly_items = [i for i in all_items if i.has_anomaly]
    offset_items = []

    for item in all_items:
        item.batch_id = batch_id
        exceeds = db.query(models.CoordinateOffset).filter(
            models.CoordinateOffset.checklist_id == item.id,
            models.CoordinateOffset.exceeds == True,
        ).first()
        if exceeds:
            offset_items.append(item)

    batch = models.BatchRun(
        batch_id=batch_id,
        run_by=run_by,
        standard_version=STANDARD_VERSION,
        standard_desc=STANDARD_DESC,
        total_items=len(all_items),
        anomaly_count=len(anomaly_items),
        offset_count=len(offset_items),
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    return schemas.BatchRunResult(
        batch=batch,
        anomaly_items=anomaly_items,
        offset_items=offset_items,
        standard_version=STANDARD_VERSION,
        standard_desc=STANDARD_DESC,
    )


@app.get("/api/batch-runs", response_model=List[schemas.BatchRun])
def list_batch_runs(db: Session = Depends(get_db)):
    return db.query(models.BatchRun).order_by(desc(models.BatchRun.created_at)).limit(50).all()


# ---------- CSV 导出（带口径元数据） ----------

@app.get("/api/export/csv")
def export_csv(batch_id: str = "", operator: str = "算法值班人", db: Session = Depends(get_db)):
    q = db.query(models.SurveyChecklist)
    if batch_id:
        q = q.filter(models.SurveyChecklist.batch_id == batch_id)
    items = q.all()

    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow([f"# 旧楼测绘交底清单 CSV 明细导出"])
    writer.writerow([f"# 口径版本: {STANDARD_VERSION}"])
    writer.writerow([f"# 口径说明: {STANDARD_DESC}"])
    writer.writerow([f"# 跑批ID: {batch_id or '未指定'}"])
    writer.writerow([f"# 导出人: {operator}"])
    writer.writerow([f"# 导出时间: {datetime.now().isoformat()}"])
    writer.writerow([f"# 记录总数: {len(items)}"])
    writer.writerow([])

    writer.writerow([
        "编号", "空间位置", "描述", "模型坐标",
        "是否异常", "异常等级", "异常说明", "状态",
        "BIM协调员", "算法值班人", "跑批ID", "创建时间", "更新时间",
        "口径版本",
    ])
    for it in items:
        writer.writerow([
            it.item_no, it.location, it.description, it.model_ref,
            "是" if it.has_anomaly else "否", it.anomaly_level, it.anomaly_note, it.status,
            it.coordinator, it.operator, it.batch_id,
            it.created_at.isoformat() if it.created_at else "",
            it.updated_at.isoformat() if it.updated_at else "",
            STANDARD_VERSION,
        ])

    buf.seek(0)
    from urllib.parse import quote
    safe_desc = quote(STANDARD_DESC)
    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''survey_checklist_{datetime.now().strftime('%Y%m%d')}.csv",
        "X-Standard-Version": STANDARD_VERSION,
        "X-Standard-Desc": safe_desc,
        "X-Batch-Id": batch_id,
    }
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers=headers,
    )


# ---------- 统计汇总 ----------

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(models.SurveyChecklist).count()
    anomaly = db.query(models.SurveyChecklist).filter(models.SurveyChecklist.has_anomaly == True).count()
    pending = db.query(models.SurveyChecklist).filter(models.SurveyChecklist.status == "待处理").count()
    processing = db.query(models.SurveyChecklist).filter(models.SurveyChecklist.status == "处理中").count()
    closed = db.query(models.SurveyChecklist).filter(models.SurveyChecklist.status == "已闭环").count()
    offsets_exceed = db.query(models.CoordinateOffset).filter(models.CoordinateOffset.exceeds == True).count()
    unresolved_anomalies = db.query(models.AnomalyRecord).filter(models.AnomalyRecord.resolved == False).count()

    return {
        "total": total,
        "anomaly": anomaly,
        "anomaly_rate": f"{anomaly / total * 100:.1f}%" if total else "0%",
        "pending": pending,
        "processing": processing,
        "closed": closed,
        "offsets_exceed": offsets_exceed,
        "unresolved_anomalies": unresolved_anomalies,
        "standard_version": STANDARD_VERSION,
        "standard_desc": STANDARD_DESC,
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "standard_version": STANDARD_VERSION}
