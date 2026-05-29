from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os

from . import models, schemas, services, reports
from .database import engine, get_db
from .exceptions import (
    PaintStudioException,
    paint_studio_exception_handler,
    general_exception_handler,
    PaintNotFoundException,
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="画材库存替代推荐 API",
    description="画室颜料库存管理、颜色匹配替代推荐、采购清单、预算控制、报告导出",
    version="1.0.0"
)

app.add_exception_handler(PaintStudioException, paint_studio_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)


@app.get("/", tags=["系统"])
def root():
    return {
        "name": "画材库存替代推荐系统",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "颜料库存": "/api/paints",
            "学生管理": "/api/students",
            "替代推荐": "/api/substitutes",
            "采购管理": "/api/purchases",
            "库存扣减": "/api/stock/deduct",
            "数据问题": "/api/data-issues",
            "报告导出": "/api/reports"
        }
    }


@app.get("/api/paints", response_model=List[schemas.PaintResponse], tags=["颜料库存"])
def get_paints(
    skip: int = 0,
    limit: int = 100,
    in_stock_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(models.PaintInventory)
    if in_stock_only:
        query = query.filter(models.PaintInventory.stock > 0)
    return query.offset(skip).limit(limit).all()


@app.get("/api/paints/{paint_id}", response_model=schemas.PaintResponse, tags=["颜料库存"])
def get_paint(paint_id: int, db: Session = Depends(get_db)):
    paint = db.query(models.PaintInventory).filter(
        models.PaintInventory.id == paint_id
    ).first()
    if not paint:
        raise PaintNotFoundException(paint_id)
    return paint


@app.post("/api/paints", response_model=schemas.PaintResponse, tags=["颜料库存"])
def create_paint(paint: schemas.PaintCreate, db: Session = Depends(get_db)):
    db_paint = models.PaintInventory(**paint.model_dump())
    db.add(db_paint)
    db.commit()
    db.refresh(db_paint)
    return db_paint


@app.put("/api/paints/{paint_id}", response_model=schemas.PaintResponse, tags=["颜料库存"])
def update_paint(paint_id: int, paint_update: schemas.PaintUpdate, db: Session = Depends(get_db)):
    paint = db.query(models.PaintInventory).filter(
        models.PaintInventory.id == paint_id
    ).first()
    if not paint:
        raise PaintNotFoundException(paint_id)

    update_data = paint_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(paint, key, value)

    db.commit()
    db.refresh(paint)
    return paint


@app.delete("/api/paints/{paint_id}", tags=["颜料库存"])
def delete_paint(paint_id: int, db: Session = Depends(get_db)):
    paint = db.query(models.PaintInventory).filter(
        models.PaintInventory.id == paint_id
    ).first()
    if not paint:
        raise PaintNotFoundException(paint_id)

    paint.is_discontinued = True
    db.commit()
    return {"message": f"颜料 {paint.name} 已标记为停产"}


@app.get("/api/students", response_model=List[schemas.StudentResponse], tags=["学生管理"])
def get_students(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Student).offset(skip).limit(limit).all()


@app.get("/api/students/{student_id}", response_model=schemas.StudentResponse, tags=["学生管理"])
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(
        models.Student.id == student_id
    ).first()
    if not student:
        raise services.StudentNotFoundException(student_id)
    return student


@app.post("/api/students", response_model=schemas.StudentResponse, tags=["学生管理"])
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    db_student = models.Student(
        **student.model_dump(),
        remaining_budget=student.budget
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student


@app.put("/api/students/{student_id}", response_model=schemas.StudentResponse, tags=["学生管理"])
def update_student(student_id: int, student_update: schemas.StudentUpdate, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(
        models.Student.id == student_id
    ).first()
    if not student:
        raise services.StudentNotFoundException(student_id)

    update_data = student_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(student, key, value)

    db.commit()
    db.refresh(student)
    return student


@app.post("/api/substitutes", response_model=schemas.SubstituteResponse, tags=["替代推荐"])
def find_substitutes(
    request: schemas.SubstituteRequest,
    db: Session = Depends(get_db)
):
    original, substitutes, data_issues = services.find_substitutes(
        db,
        paint_id=request.paint_id,
        max_color_difference=request.max_color_difference,
        min_stock=request.min_stock
    )

    warning = None
    if not substitutes:
        warning = (
            f"未找到色差在 {request.max_color_difference} 以内的替代品。"
            f"建议放宽色差限制或联系供应商补货。"
        )
    elif substitutes[0]["color_difference"] > 3:
        warning = (
            f"最佳匹配 [{substitutes[0]['paint_name']}] 色差为 {substitutes[0]['color_difference']:.2f}，"
            f"略大于理想值 3，建议美术老师确认后使用。"
        )

    return schemas.SubstituteResponse(
        original_paint=original,
        substitutes=[schemas.SubstituteItem(**s) for s in substitutes],
        warning=warning,
        data_issues=data_issues
    )


@app.get("/api/substitutes/{paint_id}", response_model=schemas.SubstituteResponse, tags=["替代推荐"])
def get_substitutes_for_paint(
    paint_id: int,
    max_color_difference: float = 5.0,
    min_stock: int = 1,
    db: Session = Depends(get_db)
):
    original, substitutes, data_issues = services.find_substitutes(
        db,
        paint_id=paint_id,
        max_color_difference=max_color_difference,
        min_stock=min_stock
    )

    warning = None
    if not substitutes:
        warning = (
            f"未找到色差在 {max_color_difference} 以内的替代品。"
            f"建议放宽色差限制或联系供应商补货。"
        )
    elif substitutes[0]["color_difference"] > 3:
        warning = (
            f"最佳匹配 [{substitutes[0]['paint_name']}] 色差为 {substitutes[0]['color_difference']:.2f}，"
            f"略大于理想值 3，建议美术老师确认后使用。"
        )

    return schemas.SubstituteResponse(
        original_paint=original,
        substitutes=[schemas.SubstituteItem(**s) for s in substitutes],
        warning=warning,
        data_issues=data_issues
    )


@app.post("/api/stock/deduct", response_model=schemas.StockDeductResponse, tags=["库存管理"])
def deduct_stock(
    request: schemas.StockDeductRequest,
    db: Session = Depends(get_db)
):
    return services.deduct_stock(
        db,
        paint_id=request.paint_id,
        quantity=request.quantity,
        student_id=request.student_id
    )


@app.get("/api/purchases", response_model=List[schemas.PurchaseResponse], tags=["采购管理"])
def get_purchases(
    student_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Purchase)
    if student_id:
        query = query.filter(models.Purchase.student_id == student_id)
    purchases = query.order_by(models.Purchase.created_at.desc()).offset(skip).limit(limit).all()

    responses = []
    for purchase in purchases:
        student = db.query(models.Student).filter(
            models.Student.id == purchase.student_id
        ).first()
        items = []
        for item in purchase.items:
            paint = db.query(models.PaintInventory).filter(
                models.PaintInventory.id == item.paint_id
            ).first()
            items.append(schemas.PurchaseItemResponse(
                id=item.id,
                paint_id=item.paint_id,
                paint_name=paint.name if paint else "未知",
                brand=paint.brand if paint else "未知",
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.unit_price * item.quantity,
                is_substitute=item.is_substitute,
                original_paint_id=item.original_paint_id,
                color_difference=item.color_difference,
                substitute_reason=item.substitute_reason
            ))

        responses.append(schemas.PurchaseResponse(
            id=purchase.id,
            student_id=purchase.student_id,
            student_name=student.name if student else "未知",
            status=purchase.status,
            total_amount=purchase.total_amount,
            budget_warning=purchase.budget_warning,
            items=items,
            notes=purchase.notes,
            created_at=purchase.created_at
        ))
    return responses


@app.post("/api/purchases", response_model=schemas.PurchaseResponse, tags=["采购管理"])
def create_purchase(purchase: schemas.PurchaseCreate, db: Session = Depends(get_db)):
    return services.create_purchase(db, purchase)


@app.get("/api/data-issues", response_model=List[schemas.DataIssueResponse], tags=["数据质量"])
def get_data_issues(
    resolved: bool = False,
    severity: str = None,
    db: Session = Depends(get_db)
):
    services.check_data_issues(db)
    query = db.query(models.DataIssue).filter(models.DataIssue.is_resolved == resolved)
    if severity:
        query = query.filter(models.DataIssue.severity == severity)
    return query.order_by(models.DataIssue.created_at.desc()).all()


@app.post("/api/data-issues/scan", response_model=List[schemas.DataIssueResponse], tags=["数据质量"])
def scan_data_issues(db: Session = Depends(get_db)):
    return services.check_data_issues(db)


@app.put("/api/data-issues/{issue_id}/resolve", response_model=schemas.DataIssueResponse, tags=["数据质量"])
def resolve_data_issue(issue_id: int, db: Session = Depends(get_db)):
    from datetime import datetime
    issue = db.query(models.DataIssue).filter(models.DataIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail=f"数据问题 ID={issue_id} 不存在")
    issue.is_resolved = True
    issue.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(issue)
    return issue


@app.post("/api/reports/generate", response_model=schemas.ReportResponse, tags=["报告导出"])
def generate_report(
    request: schemas.ReportGenerateRequest,
    db: Session = Depends(get_db)
):
    report_generators = {
        "substitution": reports.generate_substitution_report,
        "purchase": reports.generate_purchase_report,
        "inventory": reports.generate_inventory_report,
        "budget": reports.generate_budget_report
    }

    if request.report_type not in report_generators:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的报告类型: {request.report_type}。"
                   f"支持的类型: {', '.join(report_generators.keys())}"
        )

    generator = report_generators[request.report_type]
    params = {"db": db}
    if request.student_id:
        params["student_id"] = request.student_id
    if request.start_date:
        params["start_date"] = request.start_date
    if request.end_date:
        params["end_date"] = request.end_date

    return generator(**params)


@app.get("/api/reports/download/{report_id}", tags=["报告导出"])
def download_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail=f"报告 ID={report_id} 不存在")

    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail=f"报告文件已被删除或移动")

    filename = os.path.basename(report.file_path)
    return FileResponse(
        path=report.file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.get("/api/reports", tags=["报告导出"])
def list_reports(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    reports_list = db.query(models.Report).order_by(
        models.Report.created_at.desc()
    ).offset(skip).limit(limit).all()

    return [
        {
            "id": r.id,
            "report_type": r.report_type,
            "file_path": r.file_path,
            "download_url": f"/api/reports/download/{r.id}",
            "file_exists": os.path.exists(r.file_path),
            "created_at": r.created_at
        }
        for r in reports_list
    ]


@app.get("/api/stats", tags=["统计概览"])
def get_statistics(db: Session = Depends(get_db)):
    total_paints = db.query(models.PaintInventory).count()
    out_of_stock = db.query(models.PaintInventory).filter(
        models.PaintInventory.stock == 0
    ).count()
    total_students = db.query(models.Student).count()
    total_purchases = db.query(models.Purchase).count()
    total_substitutions = db.query(models.SubstitutionRecord).count()
    unresolved_issues = db.query(models.DataIssue).filter(
        models.DataIssue.is_resolved == False
    ).count()

    total_budget = db.query(models.Student).with_entities(
        models.Student.budget
    ).all()
    total_budget_amount = sum(b[0] for b in total_budget) if total_budget else 0

    total_remaining = db.query(models.Student).with_entities(
        models.Student.remaining_budget
    ).all()
    total_remaining_amount = sum(b[0] for b in total_remaining) if total_remaining else 0

    return {
        "paints": {
            "total": total_paints,
            "out_of_stock": out_of_stock,
            "in_stock": total_paints - out_of_stock
        },
        "students": {
            "total": total_students,
            "total_budget": round(total_budget_amount, 2),
            "total_remaining": round(total_remaining_amount, 2),
            "total_used": round(total_budget_amount - total_remaining_amount, 2)
        },
        "purchases": {
            "total": total_purchases
        },
        "substitutions": {
            "total": total_substitutions
        },
        "data_quality": {
            "unresolved_issues": unresolved_issues
        }
    }
