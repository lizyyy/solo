from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import JSONResponse, HTMLResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta

from app.database import get_db, init_db, SecondReadStatus
from app import schemas, services

app = FastAPI(
    title="病理切片二读 API",
    description="病理科疑难切片二读管理系统 - 初读意见、二读结论、借片流转一体化管理",
    version="1.0.0"
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <html>
        <head>
            <title>病理切片二读 API</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                h1 { color: #2c3e50; }
                .endpoint { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; }
                code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>病理切片二读 API 服务</h1>
            <p>欢迎使用病理科疑难切片二读管理系统</p>
            <div class="endpoint">
                <p><strong>API 文档:</strong> <a href="/docs">/docs</a> (Swagger UI)</p>
                <p><strong>备用文档:</strong> <a href="/redoc">/redoc</a></p>
            </div>
            <h3>主要功能</h3>
            <ul>
                <li>二读记录导入与校验</li>
                <li>二读状态机管理</li>
                <li>借片记录追踪</li>
                <li>意见版本管理</li>
                <li>超时提醒</li>
                <li>报告导出</li>
            </ul>
        </body>
    </html>
    """


@app.post("/api/second-reads/import", response_model=dict)
async def import_second_read(
    data: schemas.SecondReadCreate,
    db: Session = Depends(get_db)
):
    result, errors = services.create_second_read(db, data)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": result["message"], "errors": errors}
        )
    return result


@app.get("/api/second-reads", response_model=List[dict])
async def list_second_reads(
    status: SecondReadStatus = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    from app.database import SecondRead as DBSecondRead, Slide
    query = db.query(DBSecondRead).join(Slide)
    if status:
        query = query.filter(DBSecondRead.status == status)
    records = query.offset(skip).limit(limit).all()
    return [
        {
            "id": sr.id,
            "slide_number": sr.slide.slide_number,
            "patient_name": sr.slide.patient_name,
            "first_read_doctor": sr.first_read_doctor,
            "second_read_doctor": sr.second_read_doctor,
            "status": sr.status,
            "deadline": sr.deadline.isoformat() if sr.deadline else None,
            "is_report_issued": sr.is_report_issued
        }
        for sr in records
    ]


@app.get("/api/second-reads/{second_read_id}", response_model=dict)
async def get_second_read(
    second_read_id: int,
    db: Session = Depends(get_db)
):
    detail = services.get_second_read_detail(db, second_read_id)
    if not detail:
        raise HTTPException(status_code=404, detail="二读记录不存在")
    return detail


@app.put("/api/second-reads/{second_read_id}/process", response_model=dict)
async def process_second_read(
    second_read_id: int,
    data: schemas.SecondReadUpdate,
    db: Session = Depends(get_db)
):
    result, errors = services.process_second_read(db, second_read_id, data)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": result["message"], "errors": errors}
        )
    return result


@app.post("/api/second-reads/{second_read_id}/cancel", response_model=dict)
async def cancel_second_read(
    second_read_id: int,
    reason: str,
    db: Session = Depends(get_db)
):
    result, errors = services.cancel_second_read(db, second_read_id, reason)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": result["message"], "errors": errors}
        )
    return result


@app.post("/api/reviews", response_model=dict)
async def review_second_read(
    data: schemas.ReviewRecordCreate,
    db: Session = Depends(get_db)
):
    result, errors = services.review_second_read(db, data)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": result["message"], "errors": errors}
        )
    return result


@app.post("/api/borrows", response_model=dict)
async def create_borrow_record(
    data: schemas.BorrowRecordCreate,
    db: Session = Depends(get_db)
):
    result, errors = services.create_borrow_record(db, data)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": result["message"], "errors": errors}
        )
    return result


@app.put("/api/borrows/{borrow_id}/return", response_model=dict)
async def return_borrow_record(
    borrow_id: int,
    data: schemas.BorrowRecordReturn,
    db: Session = Depends(get_db)
):
    result, errors = services.return_borrow_record(db, borrow_id, data)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": result["message"], "errors": errors}
        )
    return result


@app.get("/api/borrows", response_model=List[dict])
async def list_borrow_records(
    slide_number: str = None,
    status: str = None,
    db: Session = Depends(get_db)
):
    from app.database import BorrowRecord as DBBorrowRecord, Slide
    query = db.query(DBBorrowRecord).join(Slide)
    if slide_number:
        query = query.filter(Slide.slide_number == slide_number)
    if status:
        query = query.filter(DBBorrowRecord.status == status)
    records = query.all()
    return [
        {
            "id": br.id,
            "slide_number": br.slide.slide_number,
            "patient_name": br.slide.patient_name,
            "borrower": br.borrower,
            "department": br.borrower_department,
            "borrow_date": br.borrow_date.isoformat() if br.borrow_date else None,
            "due_date": br.due_date.isoformat() if br.due_date else None,
            "return_date": br.return_date.isoformat() if br.return_date else None,
            "status": br.status
        }
        for br in records
    ]


@app.get("/api/opinion-versions/{slide_number}", response_model=List[dict])
async def get_opinion_versions(
    slide_number: str,
    db: Session = Depends(get_db)
):
    from app.database import OpinionVersion, Slide
    slide = db.query(Slide).filter(Slide.slide_number == slide_number).first()
    if not slide:
        raise HTTPException(status_code=404, detail="切片不存在")
    versions = db.query(OpinionVersion).filter(
        OpinionVersion.slide_id == slide.id
    ).order_by(OpinionVersion.version_number).all()
    return [
        {
            "version_number": ov.version_number,
            "doctor": ov.doctor,
            "opinion_type": ov.opinion_type,
            "opinion": ov.opinion,
            "created_at": ov.created_at
        }
        for ov in versions
    ]


@app.get("/api/alerts/overdue", response_model=List[schemas.OverdueAlert])
async def check_overdue(db: Session = Depends(get_db)):
    return services.check_overdue_items(db)


@app.get("/api/reports/{second_read_id}", response_class=JSONResponse)
async def generate_report(
    second_read_id: int,
    db: Session = Depends(get_db)
):
    report_data = services.generate_report_data(db, second_read_id)
    if not report_data:
        raise HTTPException(status_code=404, detail="二读记录不存在")
    return JSONResponse(content={
        "report_title": "病理切片二读诊断报告",
        "report_data": report_data,
        "generated_at": datetime.now().isoformat()
    })


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "pathology-second-read-api"
    }


@app.post("/api/self-test")
async def self_test(db: Session = Depends(get_db)):
    results = []
    all_passed = True

    test_slide_number = f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    try:
        test_data = schemas.SecondReadCreate(
            slide_number=test_slide_number,
            first_read_doctor="张医生",
            first_read_opinion="测试初读意见：可疑恶性病变",
            first_read_date=datetime.now() - timedelta(days=1),
            second_read_doctor="李主任",
            deadline=datetime.now() + timedelta(days=7)
        )
        result, errors = services.create_second_read(db, test_data)
        passed = result["status"] == "success"
        results.append({"step": "1. 导入二读记录", "passed": passed, "message": result.get("message", "")})
        if not passed:
            all_passed = False
        second_read_id = result.get("id")
    except Exception as e:
        results.append({"step": "1. 导入二读记录", "passed": False, "message": str(e)})
        all_passed = False
        second_read_id = None

    if second_read_id:
        try:
            update_data = schemas.SecondReadUpdate(
                second_read_opinion="测试二读意见：确认恶性病变",
                second_read_date=datetime.now()
            )
            result, errors = services.process_second_read(db, second_read_id, update_data)
            passed = result["status"] == "success"
            results.append({"step": "2. 提交二读意见", "passed": passed, "message": result.get("message", "")})
            if not passed:
                all_passed = False
        except Exception as e:
            results.append({"step": "2. 提交二读意见", "passed": False, "message": str(e)})
            all_passed = False

        try:
            report = services.generate_report_data(db, second_read_id)
            passed = report is not None
            results.append({"step": "3. 生成报告", "passed": passed, "message": "报告生成成功" if passed else "报告生成失败"})
            if not passed:
                all_passed = False
        except Exception as e:
            results.append({"step": "3. 生成报告", "passed": False, "message": str(e)})
            all_passed = False

        try:
            result, errors = services.cancel_second_read(db, second_read_id, "测试完成清理")
            passed = result["status"] == "success"
            results.append({"step": "4. 撤销记录", "passed": passed, "message": result.get("message", "")})
            if not passed:
                all_passed = False
        except Exception as e:
            results.append({"step": "4. 撤销记录", "passed": False, "message": str(e)})
            all_passed = False

    return {
        "test_name": "病理切片二读 API 自检",
        "all_passed": all_passed,
        "total_steps": len(results),
        "passed_steps": sum(1 for r in results if r["passed"]),
        "results": results
    }
