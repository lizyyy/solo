from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import pandas as pd
from io import BytesIO

from database import (
    get_db, init_db, RoofArea, InspectionPoint, RawMaterial, WorkOrder,
    Handler, LeakLevelEnum, WorkOrderStatusEnum, AuditLog
)
import schemas
import services

app = FastAPI(
    title="屋顶热成像漏水API",
    description="屋顶热成像巡检漏水管理系统 - 点位归并、维修状态机、复测留痕、等级审计",
    version="1.0.0"
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "thermal"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "visible"), exist_ok=True)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/roof-areas/", response_model=schemas.RoofArea, tags=["基础数据"])
def create_roof_area(area: schemas.RoofAreaCreate, db: Session = Depends(get_db)):
    existing = db.query(RoofArea).filter(RoofArea.name == area.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="屋顶区域已存在")
    db_area = RoofArea(**area.model_dump())
    db.add(db_area)
    db.commit()
    db.refresh(db_area)
    return db_area


@app.get("/roof-areas/", response_model=List[schemas.RoofArea], tags=["基础数据"])
def list_roof_areas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(RoofArea).offset(skip).limit(limit).all()


@app.post("/raw-materials/", response_model=schemas.RawMaterial, tags=["原始材料"])
def upload_raw_material(material: schemas.RawMaterialCreate, db: Session = Depends(get_db)):
    point, is_new = services.create_or_get_inspection_point(
        db,
        lat=material.latitude,
        lng=material.longitude,
        position_desc=material.position_desc,
        roof_area_id=material.roof_area_id,
        point_code=material.point_code
    )
    
    db_material = RawMaterial(
        material_code=services.generate_code("M"),
        inspection_point_id=point.id,
        thermal_image_path=material.thermal_image_path,
        visible_image_path=material.visible_image_path,
        leak_level=material.leak_level,
        temperature=material.temperature,
        humidity=material.humidity,
        inspector=material.inspector,
        inspection_time=material.inspection_time,
        equipment_info=material.equipment_info,
        weather=material.weather,
        notes=material.notes,
        source_batch=material.source_batch
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


@app.post("/raw-materials/upload-image", tags=["原始材料"])
async def upload_image(
    material_id: int,
    image_type: str = Query(..., description="thermal或visible"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    material = db.query(RawMaterial).filter(RawMaterial.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="材料不存在")
    
    ext = os.path.splitext(file.filename)[1]
    filename = f"{material.material_code}_{image_type}{ext}"
    subdir = "thermal" if image_type == "thermal" else "visible"
    file_path = os.path.join(UPLOAD_DIR, subdir, filename)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    if image_type == "thermal":
        material.thermal_image_path = file_path
    else:
        material.visible_image_path = file_path
    
    db.commit()
    return {"success": True, "file_path": file_path}


@app.get("/raw-materials/", response_model=List[schemas.RawMaterial], tags=["原始材料"])
def list_raw_materials(
    roof_area_id: Optional[int] = None,
    source_batch: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(RawMaterial)
    if roof_area_id:
        query = query.join(InspectionPoint).filter(InspectionPoint.roof_area_id == roof_area_id)
    if source_batch:
        query = query.filter(RawMaterial.source_batch == source_batch)
    return query.order_by(RawMaterial.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/inspection-points/", response_model=List[schemas.InspectionPoint], tags=["巡检点位"])
def list_inspection_points(
    roof_area_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(InspectionPoint)
    if roof_area_id:
        query = query.filter(InspectionPoint.roof_area_id == roof_area_id)
    return query.order_by(InspectionPoint.created_at.desc()).offset(skip).limit(limit).all()


@app.post("/inspection-points/merge", response_model=schemas.PointMergeResult, tags=["巡检点位"])
def merge_inspection_points(
    merge_request: schemas.PointMergeRequest,
    db: Session = Depends(get_db)
):
    result = services.merge_points(
        db,
        source_point_ids=merge_request.source_point_ids,
        target_point_id=merge_request.target_point_id,
        operator=merge_request.operator,
        reason=merge_request.reason
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/work-orders/", response_model=schemas.WorkOrder, tags=["维修工单"])
def create_work_order(work_order: schemas.WorkOrderCreate, db: Session = Depends(get_db)):
    try:
        return services.create_work_order(db, work_order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/work-orders/", response_model=List[schemas.WorkOrder], tags=["维修工单"])
def list_work_orders(
    status: Optional[WorkOrderStatusEnum] = None,
    roof_area_id: Optional[int] = None,
    current_level: Optional[LeakLevelEnum] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(WorkOrder)
    if status:
        query = query.filter(WorkOrder.status == status)
    if roof_area_id:
        query = query.join(InspectionPoint).filter(InspectionPoint.roof_area_id == roof_area_id)
    if current_level:
        query = query.filter(WorkOrder.current_level == current_level)
    return query.order_by(WorkOrder.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/work-orders/{work_order_id}", tags=["维修工单"])
def get_work_order_detail(work_order_id: int, db: Session = Depends(get_db)):
    detail = services.get_work_order_full_detail(db, work_order_id)
    if not detail:
        raise HTTPException(status_code=404, detail="工单不存在")
    return detail


@app.post("/work-orders/judgment", response_model=schemas.JudgmentRecord, tags=["判定管理"])
def add_judgment(judgment: schemas.WorkOrderJudgmentRequest, db: Session = Depends(get_db)):
    judgment_data = schemas.JudgmentRecordCreate(
        work_order_id=judgment.work_order_id,
        judgment_type=judgment.judgment_type,
        judged_level=judgment.judged_level,
        judge=judgment.judge,
        reason=judgment.reason,
        evidence=judgment.evidence
    )
    try:
        return services.add_judgment(db, judgment_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/work-orders/status", response_model=schemas.WorkOrder, tags=["状态管理"])
def update_work_order_status(
    status_update: schemas.WorkOrderStatusUpdateRequest,
    db: Session = Depends(get_db)
):
    try:
        work_order = services.update_work_order_status(
            db,
            work_order_id=status_update.work_order_id,
            new_status=status_update.new_status,
            operator=status_update.operator,
            reason=status_update.reason
        )
        if not work_order:
            raise HTTPException(status_code=404, detail="工单不存在")
        return work_order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/work-orders/supplement", tags=["材料补证"])
def supplement_material(
    supplement: schemas.MaterialSupplementRequest,
    db: Session = Depends(get_db)
):
    success = services.supplement_material(
        db,
        work_order_id=supplement.work_order_id,
        material_id=supplement.material_id,
        operator=supplement.operator,
        is_primary=supplement.is_primary
    )
    if not success:
        raise HTTPException(status_code=400, detail="补证失败，材料或工单不存在，或材料已关联")
    return {"success": True, "message": "补证成功"}


@app.post("/work-orders/retest", response_model=schemas.RetestRecord, tags=["复测管理"])
def add_retest(retest: schemas.RetestRecordCreate, db: Session = Depends(get_db)):
    try:
        return services.add_retest(db, retest)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/handlers/", response_model=schemas.Handler, tags=["人员管理"])
def create_handler(handler: schemas.HandlerCreate, db: Session = Depends(get_db)):
    existing = db.query(Handler).filter(Handler.username == handler.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    db_handler = Handler(**handler.model_dump())
    db.add(db_handler)
    db.commit()
    db.refresh(db_handler)
    return db_handler


@app.get("/handlers/", response_model=List[schemas.Handler], tags=["人员管理"])
def list_handlers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Handler).offset(skip).limit(limit).all()


@app.get("/audit-logs/", response_model=List[schemas.AuditLog], tags=["审计追踪"])
def list_audit_logs(
    work_order_id: Optional[int] = None,
    inspection_point_id: Optional[int] = None,
    action_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if work_order_id:
        query = query.filter(AuditLog.work_order_id == work_order_id)
    if inspection_point_id:
        query = query.filter(AuditLog.inspection_point_id == inspection_point_id)
    if action_type:
        query = query.filter(AuditLog.action_type == action_type)
    return query.order_by(AuditLog.operation_time.desc()).offset(skip).limit(limit).all()


@app.post("/reports/export", tags=["报告导出"])
def export_report(
    query: schemas.ReportQueryRequest,
    db: Session = Depends(get_db)
):
    work_orders = db.query(WorkOrder)
    
    if query.start_date:
        work_orders = work_orders.filter(WorkOrder.created_at >= query.start_date)
    if query.end_date:
        work_orders = work_orders.filter(WorkOrder.created_at <= query.end_date)
    if query.roof_area_id:
        work_orders = work_orders.join(InspectionPoint).filter(
            InspectionPoint.roof_area_id == query.roof_area_id
        )
    if query.status:
        work_orders = work_orders.filter(WorkOrder.status == query.status)
    if query.leak_level:
        work_orders = work_orders.filter(WorkOrder.current_level == query.leak_level)
    
    work_orders = work_orders.all()
    
    report_data = []
    for wo in work_orders:
        detail = services.get_work_order_full_detail(db, wo.id)
        if not detail:
            continue
        
        point = detail["inspection_point"]
        roof_area = db.query(RoofArea).filter(RoofArea.id == point.roof_area_id).first()
        
        source_materials = "; ".join([
            f"{m['material'].material_code}({m['material'].inspector or '未知'})"
            for m in detail["materials"]
        ])
        
        process_history = " → ".join([
            f"{t.from_status.value if t.from_status else '创建'}→{t.to_status.value}({t.operator})"
            for t in detail["status_transitions"]
        ])
        
        level_changes = "; ".join([
            f"{j.previous_level.value if j.previous_level else '初始'}→{j.judged_level.value}({j.judge})"
            for j in detail["judgments"]
        ])
        
        retest_results = "; ".join([
            f"第{i+1}次:{'通过' if r.is_passed else '未通过'}({r.retester})"
            for i, r in enumerate(detail["retests"])
        ])
        
        report_data.append({
            "工单号": wo.order_no,
            "屋顶区域": roof_area.name if roof_area else "未知",
            "点位编号": point.point_code,
            "位置描述": point.position_desc or "",
            "经纬度": f"{point.latitude}, {point.longitude}" if point.latitude and point.longitude else "",
            "当前等级": wo.current_level.value,
            "工单状态": wo.status.value,
            "创建时间": wo.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "来源材料": source_materials,
            "处理过程": process_history,
            "等级变更历史": level_changes,
            "复测记录": retest_results or "无",
            "最终结论": wo.final_conclusion or "",
            "指派人": wo.assigned_to or "",
            "优先级": wo.priority
        })
    
    df = pd.DataFrame(report_data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='巡检报告')
    
    output_path = os.path.join(UPLOAD_DIR, f"report_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx")
    with open(output_path, "wb") as f:
        f.write(output.getvalue())
    
    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"屋顶漏水巡检报告_{datetime.now().strftime('%Y%m%d')}.xlsx"
    )


@app.get("/statistics/summary", tags=["统计分析"])
def get_statistics(db: Session = Depends(get_db)):
    total_points = db.query(InspectionPoint).count()
    total_materials = db.query(RawMaterial).count()
    total_work_orders = db.query(WorkOrder).count()
    
    status_stats = {}
    for status in WorkOrderStatusEnum:
        count = db.query(WorkOrder).filter(WorkOrder.status == status).count()
        status_stats[status.value] = count
    
    level_stats = {}
    for level in LeakLevelEnum:
        count = db.query(WorkOrder).filter(WorkOrder.current_level == level).count()
        level_stats[level.value] = count
    
    pending_retest = db.query(WorkOrder).filter(
        WorkOrder.status == WorkOrderStatusEnum.PENDING_RETEST
    ).count()
    
    return {
        "total_points": total_points,
        "total_materials": total_materials,
        "total_work_orders": total_work_orders,
        "status_distribution": status_stats,
        "level_distribution": level_stats,
        "pending_retest_count": pending_retest,
        "merged_points": db.query(InspectionPoint).filter(InspectionPoint.merge_count > 1).count()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
