from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from . import models, schemas, services
from .config import engine, get_db
from .services import (
    BusinessException, MaterialService, InventoryService,
    CoursePlanService, UsageService, ReportService, CompensationService
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="实验课耗材领用API",
    description="面向实验室的实验耗材领用管理系统，支持按班级领用、退料、损耗登记、教师确认等完整业务流程",
    version="1.0.0"
)


@app.exception_handler(BusinessException)
async def business_exception_handler(request: Request, exc: BusinessException):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": exc.message,
            "code": exc.code,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": f"系统异常: {str(exc)}",
            "code": "SYSTEM_ERROR",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    )


@app.get("/")
def root():
    return {
        "message": "实验课耗材领用API系统已启动",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "基础数据": "/materials, /teachers, /classes, /inventory",
            "业务流程": "/course-plans, /usage, /return, /loss, /confirm",
            "补偿机制": "/compensations",
            "报表": "/reports/inventory"
        }
    }


@app.post("/materials", response_model=schemas.BusinessResponse)
def create_material(data: schemas.MaterialCreate, db: Session = Depends(get_db)):
    material = MaterialService.create_material(db, data)
    return schemas.BusinessResponse(
        success=True,
        message=f"耗材「{material.name}」创建成功",
        code="SUCCESS",
        data={"material_id": material.id}
    )


@app.get("/materials", response_model=List[schemas.MaterialResponse])
def list_materials(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return MaterialService.get_materials(db, skip=skip, limit=limit)


@app.get("/inventory", response_model=List[schemas.InventoryResponse])
def list_inventory(db: Session = Depends(get_db)):
    inventories = InventoryService.get_inventory_list(db)
    result = []
    for inv in inventories:
        result.append(schemas.InventoryResponse(
            material_id=inv.material_id,
            material_name=inv.material.name if inv.material else None,
            total_qty=inv.total_qty,
            available_qty=inv.available_qty,
            reserved_qty=inv.reserved_qty,
            min_stock=inv.min_stock,
            location=inv.location,
            is_low_stock=inv.available_qty <= inv.min_stock
        ))
    return result


@app.post("/teachers", response_model=schemas.BusinessResponse)
def create_teacher(data: schemas.TeacherBase, db: Session = Depends(get_db)):
    teacher = models.Teacher(**data.model_dump())
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return schemas.BusinessResponse(
        success=True,
        message=f"教师「{teacher.name}」创建成功",
        code="SUCCESS",
        data={"teacher_id": teacher.id}
    )


@app.post("/classes", response_model=schemas.BusinessResponse)
def create_class(data: schemas.ClassBase, db: Session = Depends(get_db)):
    class_info = models.ClassInfo(**data.model_dump())
    db.add(class_info)
    db.commit()
    db.refresh(class_info)
    return schemas.BusinessResponse(
        success=True,
        message=f"班级「{class_info.name}」创建成功",
        code="SUCCESS",
        data={"class_id": class_info.id}
    )


@app.post("/inventory/stock-in", response_model=schemas.BusinessResponse)
def stock_in(material_id: int, qty: float, operator_name: str, location: Optional[str] = None, db: Session = Depends(get_db)):
    material = MaterialService.get_material_by_id(db, material_id)
    if not material:
        raise BusinessException(f"耗材ID {material_id} 不存在")
    InventoryService.add_stock(db, material_id, qty, operator_name, location)
    db.commit()
    return schemas.BusinessResponse(
        success=True,
        message=f"耗材「{material.name}」入库成功，新增 {qty} {material.unit}",
        code="SUCCESS"
    )


@app.post("/course-plans", response_model=schemas.BusinessResponse)
def create_course_plan(data: schemas.CoursePlanCreate, db: Session = Depends(get_db)):
    plan = CoursePlanService.create_plan(db, data)
    db.commit()
    return schemas.BusinessResponse(
        success=True,
        message=f"课程计划创建成功，计划编号：{plan.plan_no}",
        code="SUCCESS",
        data={
            "plan_id": plan.id,
            "plan_no": plan.plan_no,
            "experiment_name": plan.experiment_name
        }
    )


@app.get("/course-plans/{plan_no}", response_model=schemas.CoursePlanResponse)
def get_course_plan(plan_no: str, db: Session = Depends(get_db)):
    plan = CoursePlanService.get_plan_by_no(db, plan_no)
    if not plan:
        raise BusinessException(f"计划编号 {plan_no} 不存在")
    
    items = []
    for item in plan.planned_items:
        items.append(schemas.CoursePlanItemResponse(
            id=item.id,
            material_id=item.material_id,
            material_name=item.material.name if item.material else None,
            material_unit=item.material.unit if item.material else None,
            qty_per_group=item.qty_per_group,
            total_qty=item.total_qty,
            notes=item.notes
        ))
    
    return schemas.CoursePlanResponse(
        id=plan.id,
        plan_no=plan.plan_no,
        teacher_id=plan.teacher_id,
        teacher_name=plan.teacher.name if plan.teacher else None,
        class_id=plan.class_id,
        class_name=plan.class_info.name if plan.class_info else None,
        course_name=plan.course_name,
        experiment_name=plan.experiment_name,
        experiment_date=plan.experiment_date,
        status=plan.status.value,
        total_groups=plan.total_groups,
        remarks=plan.remarks,
        items=items
    )


@app.post("/usage", response_model=schemas.BusinessResponse)
def create_usage(data: schemas.UsageRecordCreate, db: Session = Depends(get_db)):
    result = UsageService.create_usage_record(db, data)
    return schemas.BusinessResponse(
        success=result.get("success", False),
        message=result.get("message", ""),
        code=result.get("code"),
        data=result.get("data")
    )


@app.post("/return", response_model=schemas.BusinessResponse)
def process_return(data: schemas.ReturnProcessRequest, db: Session = Depends(get_db)):
    result = UsageService.process_return(db, data)
    return schemas.BusinessResponse(
        success=result.get("success", False),
        message=result.get("message", ""),
        code=result.get("code"),
        data=result.get("data")
    )


@app.post("/loss", response_model=schemas.BusinessResponse)
def register_loss(data: schemas.LossRegisterRequest, db: Session = Depends(get_db)):
    result = UsageService.register_loss(db, data)
    return schemas.BusinessResponse(
        success=result.get("success", False),
        message=result.get("message", ""),
        code=result.get("code"),
        data=result.get("data")
    )


@app.post("/confirm", response_model=schemas.BusinessResponse)
def teacher_confirm(data: schemas.TeacherConfirmRequest, db: Session = Depends(get_db)):
    result = UsageService.teacher_confirm(db, data)
    return schemas.BusinessResponse(
        success=result.get("success", False),
        message=result.get("message", ""),
        code=result.get("code"),
        data=result.get("data")
    )


@app.get("/usage/{record_no}", response_model=schemas.UsageRecordDetailResponse)
def get_usage_detail(record_no: str, db: Session = Depends(get_db)):
    record = UsageService.get_usage_detail(db, record_no)
    if not record:
        raise BusinessException(f"领用单号 {record_no} 不存在")
    
    usage_items = [
        schemas.UsageItemResponse(
            id=item.id,
            material_id=item.material_id,
            material_name=item.material.name if item.material else None,
            material_unit=item.material.unit if item.material else None,
            plan_qty=item.plan_qty,
            actual_qty=item.actual_qty,
            returnable_qty=item.returnable_qty,
            status=item.status.value
        ) for item in record.usage_items
    ]
    
    return_items = [
        schemas.ReturnItemResponse(
            id=item.id,
            material_id=item.material_id,
            material_name=item.material.name if item.material else None,
            material_unit=item.material.unit if item.material else None,
            returned_qty=item.returned_qty,
            condition=item.condition,
            notes=item.notes,
            status=item.status.value
        ) for item in record.return_items
    ]
    
    loss_items = [
        schemas.LossItemResponse(
            id=item.id,
            material_id=item.material_id,
            material_name=item.material.name if item.material else None,
            material_unit=item.material.unit if item.material else None,
            loss_qty=item.loss_qty,
            loss_reason=item.loss_reason,
            notes=item.notes,
            status=item.status.value
        ) for item in record.loss_items
    ]
    
    return schemas.UsageRecordDetailResponse(
        id=record.id,
        record_no=record.record_no,
        plan_id=record.plan_id,
        plan_no=record.plan.plan_no if record.plan else None,
        class_name=record.class_info.name if record.class_info else None,
        teacher_name=record.teacher.name if record.teacher else None,
        experiment_name=record.plan.experiment_name if record.plan else None,
        operator_name=record.operator_name,
        status=record.status.value,
        total_used_qty=record.total_used_qty,
        total_returned_qty=record.total_returned_qty,
        total_loss_qty=record.total_loss_qty,
        pickup_time=record.pickup_time,
        return_time=record.return_time,
        teacher_confirmed=record.teacher_confirmed,
        confirmed_at=record.confirmed_at,
        usage_items=usage_items,
        return_items=return_items,
        loss_items=loss_items,
        remarks=record.remarks
    )


@app.get("/compensations/pending", response_model=List[schemas.CompensationRecordResponse])
def list_pending_compensations(db: Session = Depends(get_db)):
    comps = CompensationService.get_pending_compensations(db)
    result = []
    for c in comps:
        result.append(schemas.CompensationRecordResponse(
            id=c.id,
            usage_record_id=c.usage_record_id,
            record_no=c.usage_record.record_no if c.usage_record else None,
            operation_type=c.operation_type,
            step_name=c.step_name,
            error_message=c.error_message,
            status=c.status.value,
            retry_count=c.retry_count,
            last_attempt_at=c.last_attempt_at,
            created_at=c.created_at
        ))
    return result


@app.post("/compensations/retry", response_model=schemas.BusinessResponse)
def retry_compensation(data: schemas.CompensationRetryRequest, db: Session = Depends(get_db)):
    result = CompensationService.retry_compensation(db, data.compensation_id, data.operator_name)
    return schemas.BusinessResponse(
        success=result.get("success", False),
        message=result.get("message", ""),
        code="SUCCESS" if result.get("success") else "FAILED",
        data={"compensation_id": data.compensation_id}
    )


@app.post("/reports/inventory", response_model=schemas.InventoryReportResponse)
def generate_inventory_report(request: schemas.InventoryReportRequest, db: Session = Depends(get_db)):
    return ReportService.generate_inventory_report(db, request)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
