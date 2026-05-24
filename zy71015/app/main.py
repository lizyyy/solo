from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
import hashlib
import json
import os
from typing import List
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

from .database import get_db, engine
from .models import Base, Performance, FireworkPoint, FireApproval, TestRecord, PropItem, ApprovalReport, ApprovalHistory
from .schemas import (
    PerformanceCreate, PerformanceResponse,
    FireworkPointCreate, FireworkPointResponse,
    FireApprovalCreate, FireApprovalResponse,
    TestRecordCreate, TestRecordResponse,
    PropItemCreate, PropItemResponse,
    ApprovalResponse, ReportGenerateRequest, ReportResponse,
    DuplicateCheckResponse
)
from .rules import (
    ApprovalStatus, can_transition, validate_firework_points,
    check_fire_approval, check_test_records, full_approval_check
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="剧场烟火审批 API", version="1.0.0")

os.makedirs("reports", exist_ok=True)

def calculate_hash(data: dict) -> str:
    data_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(data_str.encode()).hexdigest()

def record_status_history(db: Session, performance_id: int, old_status: str, new_status: str, changed_by: str, reason: str):
    history = ApprovalHistory(
        performance_id=performance_id,
        previous_status=old_status,
        new_status=new_status,
        changed_by=changed_by,
        change_reason=reason
    )
    db.add(history)
    db.commit()

@app.post("/performances", response_model=PerformanceResponse, tags=["演出场次"])
def create_performance(performance: PerformanceCreate, db: Session = Depends(get_db)):
    db_performance = Performance(**performance.model_dump())
    db.add(db_performance)
    db.commit()
    db.refresh(db_performance)
    return db_performance

@app.get("/performances", response_model=List[PerformanceResponse], tags=["演出场次"])
def list_performances(db: Session = Depends(get_db)):
    return db.query(Performance).all()

@app.get("/performances/{performance_id}", response_model=PerformanceResponse, tags=["演出场次"])
def get_performance(performance_id: int, db: Session = Depends(get_db)):
    performance = db.query(Performance).filter(Performance.id == performance_id).first()
    if not performance:
        raise HTTPException(status_code=404, detail="演出场次不存在")
    return performance

@app.post("/performances/{performance_id}/points", response_model=DuplicateCheckResponse, tags=["烟火点位"])
def add_firework_points(performance_id: int, points: List[FireworkPointCreate], db: Session = Depends(get_db)):
    performance = db.query(Performance).filter(Performance.id == performance_id).first()
    if not performance:
        raise HTTPException(status_code=404, detail="演出场次不存在")
    
    point_dicts = [p.model_dump() for p in points]
    material_hash = calculate_hash({"performance_id": performance_id, "points": point_dicts})
    
    existing = db.query(FireworkPoint).filter(
        FireworkPoint.performance_id == performance_id,
        FireworkPoint.material_hash == material_hash
    ).first()
    
    if existing:
        return DuplicateCheckResponse(
            is_duplicate=True,
            existing_record_id=existing.id,
            message=f"检测到重复提交的点位数据，已存在记录 ID: {existing.id}"
        )
    
    points_valid, violations, warnings = validate_firework_points(
        [FireworkPoint(**p.model_dump()) for p in points]
    )
    
    for point_data in points:
        point_dict = point_data.model_dump()
        point_dict["material_hash"] = material_hash
        point_dict["safety_verified"] = points_valid
        point_dict["verification_note"] = "; ".join(violations + warnings) if violations or warnings else None
        db_point = FireworkPoint(performance_id=performance_id, **point_dict)
        db.add(db_point)
    
    if points_valid and can_transition(performance.status, ApprovalStatus.POINTS_VERIFIED):
        old_status = performance.status
        performance.status = ApprovalStatus.POINTS_VERIFIED
        record_status_history(db, performance_id, old_status, ApprovalStatus.POINTS_VERIFIED, "system", "点位安全距离校验通过")
    elif can_transition(performance.status, ApprovalStatus.POINTS_SUBMITTED):
        old_status = performance.status
        performance.status = ApprovalStatus.POINTS_SUBMITTED
        record_status_history(db, performance_id, old_status, ApprovalStatus.POINTS_SUBMITTED, "system", "点位已提交，待校验")
    
    db.commit()
    
    return DuplicateCheckResponse(
        is_duplicate=False,
        existing_record_id=None,
        message=f"点位提交成功，{'校验通过' if points_valid else '校验失败: ' + '; '.join(violations)}"
    )

@app.get("/performances/{performance_id}/points", response_model=List[FireworkPointResponse], tags=["烟火点位"])
def get_firework_points(performance_id: int, db: Session = Depends(get_db)):
    return db.query(FireworkPoint).filter(FireworkPoint.performance_id == performance_id).all()

@app.post("/performances/{performance_id}/approvals", response_model=DuplicateCheckResponse, tags=["消防审批"])
def add_fire_approval(performance_id: int, approval: FireApprovalCreate, db: Session = Depends(get_db)):
    performance = db.query(Performance).filter(Performance.id == performance_id).first()
    if not performance:
        raise HTTPException(status_code=404, detail="演出场次不存在")
    
    approval_dict = approval.model_dump()
    material_hash = calculate_hash({"performance_id": performance_id, **approval_dict})
    
    existing = db.query(FireApproval).filter(
        FireApproval.performance_id == performance_id,
        FireApproval.material_hash == material_hash
    ).first()
    
    if existing:
        return DuplicateCheckResponse(
            is_duplicate=True,
            existing_record_id=existing.id,
            message=f"检测到重复提交的审批数据，已存在记录 ID: {existing.id}"
        )
    
    db_approval = FireApproval(
        performance_id=performance_id,
        material_hash=material_hash,
        status="approved",
        approval_time=datetime.utcnow(),
        **approval_dict
    )
    db.add(db_approval)
    
    approvals = db.query(FireApproval).filter(FireApproval.performance_id == performance_id).all()
    approvals.append(db_approval)
    fire_valid, _ = check_fire_approval(approvals)
    
    if fire_valid and can_transition(performance.status, ApprovalStatus.FIRE_APPROVED):
        old_status = performance.status
        performance.status = ApprovalStatus.FIRE_APPROVED
        record_status_history(db, performance_id, old_status, ApprovalStatus.FIRE_APPROVED, approval.approver_name, "消防部门审批通过")
    
    db.commit()
    
    return DuplicateCheckResponse(
        is_duplicate=False,
        existing_record_id=None,
        message="消防审批提交成功"
    )

@app.get("/performances/{performance_id}/approvals", response_model=List[FireApprovalResponse], tags=["消防审批"])
def get_fire_approvals(performance_id: int, db: Session = Depends(get_db)):
    return db.query(FireApproval).filter(FireApproval.performance_id == performance_id).all()

@app.post("/performances/{performance_id}/test-records", response_model=DuplicateCheckResponse, tags=["试放记录"])
def add_test_record(performance_id: int, test_record: TestRecordCreate, db: Session = Depends(get_db)):
    performance = db.query(Performance).filter(Performance.id == performance_id).first()
    if not performance:
        raise HTTPException(status_code=404, detail="演出场次不存在")
    
    test_dict = test_record.model_dump()
    material_hash = calculate_hash({"performance_id": performance_id, **test_dict})
    
    existing = db.query(TestRecord).filter(
        TestRecord.performance_id == performance_id,
        TestRecord.material_hash == material_hash
    ).first()
    
    if existing:
        return DuplicateCheckResponse(
            is_duplicate=True,
            existing_record_id=existing.id,
            message=f"检测到重复提交的试放记录，已存在记录 ID: {existing.id}"
        )
    
    db_test = TestRecord(
        performance_id=performance_id,
        material_hash=material_hash,
        test_result="passed",
        **test_dict
    )
    db.add(db_test)
    
    test_records = db.query(TestRecord).filter(TestRecord.performance_id == performance_id).all()
    test_records.append(db_test)
    test_valid, _ = check_test_records(test_records)
    
    if test_valid and can_transition(performance.status, ApprovalStatus.TEST_COMPLETED):
        old_status = performance.status
        performance.status = ApprovalStatus.TEST_COMPLETED
        record_status_history(db, performance_id, old_status, ApprovalStatus.TEST_COMPLETED, test_record.tester_name, "试放记录完整，视频证据已留存")
    
    db.commit()
    
    return DuplicateCheckResponse(
        is_duplicate=False,
        existing_record_id=None,
        message="试放记录提交成功，已留痕"
    )

@app.get("/performances/{performance_id}/test-records", response_model=List[TestRecordResponse], tags=["试放记录"])
def get_test_records(performance_id: int, db: Session = Depends(get_db)):
    return db.query(TestRecord).filter(TestRecord.performance_id == performance_id).all()

@app.post("/performances/{performance_id}/props", response_model=DuplicateCheckResponse, tags=["道具清单"])
def add_props(performance_id: int, props: List[PropItemCreate], db: Session = Depends(get_db)):
    performance = db.query(Performance).filter(Performance.id == performance_id).first()
    if not performance:
        raise HTTPException(status_code=404, detail="演出场次不存在")
    
    prop_dicts = [p.model_dump() for p in props]
    material_hash = calculate_hash({"performance_id": performance_id, "props": prop_dicts})
    
    existing = db.query(PropItem).filter(
        PropItem.performance_id == performance_id,
        PropItem.material_hash == material_hash
    ).first()
    
    if existing:
        return DuplicateCheckResponse(
            is_duplicate=True,
            existing_record_id=existing.id,
            message=f"检测到重复提交的道具清单，已存在记录 ID: {existing.id}"
        )
    
    for prop_data in props:
        db_prop = PropItem(
            performance_id=performance_id,
            material_hash=material_hash,
            **prop_data.model_dump()
        )
        db.add(db_prop)
    
    if can_transition(performance.status, ApprovalStatus.PROPS_CONFIRMED):
        old_status = performance.status
        performance.status = ApprovalStatus.PROPS_CONFIRMED
        record_status_history(db, performance_id, old_status, ApprovalStatus.PROPS_CONFIRMED, "道具组", "道具清单已确认")
    
    db.commit()
    
    return DuplicateCheckResponse(
        is_duplicate=False,
        existing_record_id=None,
        message="道具清单提交成功"
    )

@app.get("/performances/{performance_id}/props", response_model=List[PropItemResponse], tags=["道具清单"])
def get_props(performance_id: int, db: Session = Depends(get_db)):
    return db.query(PropItem).filter(PropItem.performance_id == performance_id).all()

@app.get("/performances/{performance_id}/check", response_model=ApprovalResponse, tags=["规则判定"])
def check_approval(performance_id: int, db: Session = Depends(get_db)):
    performance = db.query(Performance).filter(Performance.id == performance_id).first()
    if not performance:
        raise HTTPException(status_code=404, detail="演出场次不存在")
    
    points = db.query(FireworkPoint).filter(FireworkPoint.performance_id == performance_id).all()
    approvals = db.query(FireApproval).filter(FireApproval.performance_id == performance_id).all()
    test_records = db.query(TestRecord).filter(TestRecord.performance_id == performance_id).all()
    
    is_approved, violations, warnings = full_approval_check(performance, points, approvals, test_records)
    
    if is_approved and can_transition(performance.status, ApprovalStatus.FINAL_APPROVED):
        old_status = performance.status
        performance.status = ApprovalStatus.FINAL_APPROVED
        record_status_history(db, performance_id, old_status, ApprovalStatus.FINAL_APPROVED, "system", "全部审批规则校验通过")
        db.commit()
    
    message = "审批通过，所有规则校验完成" if is_approved else "审批未通过，存在违规项"
    
    return ApprovalResponse(
        approved=is_approved,
        message=message,
        performance_id=performance_id,
        current_status=performance.status,
        violations=violations,
        warnings=warnings
    )

@app.post("/performances/{performance_id}/confirm", tags=["责任确认"])
def confirm_responsibility(performance_id: int, request: ReportGenerateRequest, db: Session = Depends(get_db)):
    performance = db.query(Performance).filter(Performance.id == performance_id).first()
    if not performance:
        raise HTTPException(status_code=404, detail="演出场次不存在")
    
    if performance.is_temporary and performance.status != ApprovalStatus.FINAL_APPROVED:
        raise HTTPException(
            status_code=403,
            detail="临时加场未完成全部复核，禁止确认责任"
        )
    
    return {
        "performance_id": performance_id,
        "stage_manager_confirmed": True,
        "stage_manager": request.stage_manager_name,
        "fire_department_confirmed": True,
        "fire_department": request.fire_department_name,
        "prop_team_confirmed": True,
        "prop_team": request.prop_team_name,
        "confirmed_at": datetime.utcnow(),
        "message": "三方责任已确认"
    }

@app.post("/performances/{performance_id}/report", response_model=ReportResponse, tags=["报告导出"])
def generate_report(performance_id: int, request: ReportGenerateRequest, db: Session = Depends(get_db)):
    performance = db.query(Performance).filter(Performance.id == performance_id).first()
    if not performance:
        raise HTTPException(status_code=404, detail="演出场次不存在")
    
    points = db.query(FireworkPoint).filter(FireworkPoint.performance_id == performance_id).all()
    approvals = db.query(FireApproval).filter(FireApproval.performance_id == performance_id).all()
    test_records = db.query(TestRecord).filter(TestRecord.performance_id == performance_id).all()
    props = db.query(PropItem).filter(PropItem.performance_id == performance_id).all()
    
    is_approved, violations, warnings = full_approval_check(performance, points, approvals, test_records)
    
    report_number = f"FR-{datetime.now().strftime('%Y%m%d')}-{performance_id:04d}"
    pdf_path = f"reports/{report_number}.pdf"
    
    c = canvas.Canvas(pdf_path, pagesize=letter)
    width, height = letter
    
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 50, "剧场烟火效果审批报告")
    
    c.setFont("Helvetica", 10)
    c.drawString(50, height - 80, f"报告编号: {report_number}")
    c.drawString(50, height - 95, f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    c.drawString(50, height - 110, f"演出名称: {performance.name}")
    c.drawString(50, height - 125, f"演出时间: {performance.date.strftime('%Y-%m-%d %H:%M')}")
    c.drawString(50, height - 140, f"演出地点: {performance.venue}")
    c.drawString(50, height - 155, f"审批状态: {'通过' if is_approved else '未通过'}")
    
    y = height - 180
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "一、烟火点位信息")
    y -= 20
    c.setFont("Helvetica", 10)
    for i, point in enumerate(points, 1):
        c.drawString(60, y, f"{i}. {point.location_code} - {point.firework_type} x{point.quantity}")
        c.drawString(200, y, f"距离观众: {point.distance_to_audience}m")
        c.drawString(350, y, f"校验: {'通过' if point.safety_verified else '未通过'}")
        y -= 15
    
    y -= 10
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "二、消防审批信息")
    y -= 20
    c.setFont("Helvetica", 10)
    for i, approval in enumerate(approvals, 1):
        c.drawString(60, y, f"{i}. {approval.department} - {approval.approver_name}")
        c.drawString(250, y, f"证书: {approval.certificate_number or 'N/A'}")
        y -= 15
    
    y -= 10
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "三、试放记录")
    y -= 20
    c.setFont("Helvetica", 10)
    for i, test in enumerate(test_records, 1):
        c.drawString(60, y, f"{i}. {test.test_time.strftime('%Y-%m-%d %H:%M')}")
        c.drawString(200, y, f"测试员: {test.tester_name}")
        c.drawString(350, y, f"结果: {test.test_result}")
        y -= 15
    
    y -= 10
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "四、责任确认")
    y -= 20
    c.setFont("Helvetica", 10)
    c.drawString(60, y, f"舞监确认: {request.stage_manager_name}")
    c.drawString(60, y - 15, f"消防确认: {request.fire_department_name}")
    c.drawString(60, y - 30, f"道具组确认: {request.prop_team_name}")
    
    y -= 50
    if violations:
        c.setFillColor(colors.red)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(50, y, "违规项:")
        c.setFont("Helvetica", 10)
        for v in violations:
            y -= 15
            c.drawString(60, y, f"- {v}")
    else:
        c.setFillColor(colors.green)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(50, y, "结论: 全部审批规则已通过，烟火效果可执行")
    
    c.save()
    
    report = ApprovalReport(
        performance_id=performance_id,
        report_number=report_number,
        overall_status="approved" if is_approved else "rejected",
        stage_manager_confirmed=True,
        fire_department_confirmed=True,
        prop_team_confirmed=True,
        pdf_path=pdf_path,
        conclusion="全部审批规则已通过" if is_approved else "; ".join(violations)
    )
    db.add(report)
    db.commit()
    
    return ReportResponse(
        report_number=report_number,
        overall_status="approved" if is_approved else "rejected",
        generated_at=datetime.utcnow(),
        download_url=f"/reports/{report_number}"
    )

@app.get("/reports/{report_number}", tags=["报告导出"])
def download_report(report_number: str, db: Session = Depends(get_db)):
    report = db.query(ApprovalReport).filter(ApprovalReport.report_number == report_number).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    if not os.path.exists(report.pdf_path):
        raise HTTPException(status_code=404, detail="PDF文件不存在")
    
    return FileResponse(
        report.pdf_path,
        media_type="application/pdf",
        filename=f"{report_number}.pdf"
    )

@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}
