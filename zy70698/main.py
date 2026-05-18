from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from datetime import datetime
import models
import schemas
import crud
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="材料包备料管理系统 API", version="1.0.0")


@app.exception_handler(crud.BusinessException)
async def business_exception_handler(request: Request, exc: crud.BusinessException):
    return JSONResponse(
        status_code=400,
        content={
            "error_code": exc.error_code,
            "error_type": exc.error_type,
            "message": exc.message,
            "details": exc.details
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    field_names = []
    for error in errors:
        loc = error.get("loc", [])
        if len(loc) > 1:
            field_names.append(loc[-1])
    
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "VALIDATION_ERROR",
            "error_type": "validation_error",
            "message": f"字段验证失败: {', '.join(field_names)}",
            "details": {"fields": field_names, "errors": errors}
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": f"HTTP_{exc.status_code}",
            "error_type": "http_error",
            "message": exc.detail,
            "details": {}
        },
    )


@app.post("/courses/", response_model=schemas.Course, tags=["课程管理"])
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):
    return crud.create_course(db=db, course=course)


@app.get("/courses/", response_model=list[schemas.Course], tags=["课程管理"])
def get_courses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    courses = db.query(models.Course).offset(skip).limit(limit).all()
    return courses


@app.post("/students/", response_model=schemas.Student, tags=["学员管理"])
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    return crud.create_student(db=db, student=student)


@app.get("/students/", response_model=list[schemas.Student], tags=["学员管理"])
def get_students(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    students = db.query(models.Student).offset(skip).limit(limit).all()
    return students


@app.post("/material-kits/", response_model=schemas.MaterialKit, tags=["材料包管理"])
def create_material_kit(material_kit: schemas.MaterialKitCreate, db: Session = Depends(get_db)):
    return crud.create_material_kit(db=db, material_kit=material_kit)


@app.put("/material-kits/{material_id}", response_model=schemas.MaterialKit, tags=["材料包管理"])
def update_material_kit(material_id: int, material_update: schemas.MaterialKitUpdate, db: Session = Depends(get_db)):
    return crud.update_material_kit(db=db, material_id=material_id, material_update=material_update)


@app.get("/material-kits/", response_model=list[schemas.MaterialKit], tags=["材料包管理"])
def get_material_kits(has_warning: bool = None, db: Session = Depends(get_db)):
    return crud.get_material_kits(db=db, has_warning=has_warning)


@app.post("/course-material-kits/", response_model=schemas.CourseMaterialKit, tags=["课程材料配置"])
def create_course_material_kit(cmk: schemas.CourseMaterialKitCreate, db: Session = Depends(get_db)):
    return crud.create_course_material_kit(db=db, cmk=cmk)


@app.post("/registrations/", tags=["报名管理"])
def create_registration(registration: schemas.RegistrationCreate, db: Session = Depends(get_db)):
    result = crud.create_registration(db=db, registration=registration)
    return {
        "success": True,
        "data": {
            "registration": schemas.Registration.model_validate(result["registration"]).model_dump(),
            "warnings": result["warnings"],
            "needs_review": result["needs_review"]
        },
        "message": "报名成功" if not result["needs_review"] else "报名成功但需要人工复核"
    }


@app.get("/courses/{course_id}/registrations/", response_model=list[schemas.Registration], tags=["报名管理"])
def get_course_registrations(course_id: int, status: str = None, db: Session = Depends(get_db)):
    return crud.get_course_registrations(db=db, course_id=course_id, status=status)


@app.post("/drop-course/", tags=["退课管理"])
def drop_course(drop_data: schemas.DropRecordCreate, db: Session = Depends(get_db)):
    result = crud.drop_course(db=db, drop_data=drop_data)
    return {
        "success": True,
        "data": {
            "registration": schemas.Registration.model_validate(result["registration"]).model_dump(),
            "drop_record": schemas.DropRecord.model_validate(result["drop_record"]).model_dump()
        },
        "message": "退课成功"
    }


@app.post("/transfer-course/", tags=["退课管理"])
def transfer_course(transfer_data: schemas.TransferCourseRequest, db: Session = Depends(get_db)):
    result = crud.transfer_course(db=db, transfer_data=transfer_data)
    return {
        "success": True,
        "data": {
            "old_registration": schemas.Registration.model_validate(result["old_registration"]).model_dump(),
            "new_registration": schemas.Registration.model_validate(result["new_registration"]).model_dump(),
            "drop_record": schemas.DropRecord.model_validate(result["drop_record"]).model_dump(),
            "warnings": result["warnings"],
            "needs_review": result["needs_review"]
        },
        "message": "换课成功" if not result["needs_review"] else "换课成功但需要人工复核"
    }


@app.get("/drop-records/", response_model=list[schemas.DropRecord], tags=["退课管理"])
def get_drop_records(needs_review: bool = None, course_id: int = None, db: Session = Depends(get_db)):
    return crud.get_drop_records(db=db, needs_review=needs_review, course_id=course_id)


@app.post("/drop-records/{drop_id}/review/", response_model=schemas.DropRecord, tags=["退课管理"])
def review_drop_record(drop_id: int, reviewed_by: str, db: Session = Depends(get_db)):
    return crud.review_drop_record(db=db, drop_id=drop_id, reviewed_by=reviewed_by)


@app.post("/preparation-reports/", tags=["备料报告"])
def generate_preparation_report(report_data: schemas.PreparationReportCreate, db: Session = Depends(get_db)):
    result = crud.generate_preparation_report(db=db, report_data=report_data)
    return {
        "success": True,
        "data": {
            "report": schemas.PreparationReport.model_validate(result["report"]).model_dump(),
            "materials_summary": result["materials_summary"],
            "material_warnings": result["material_warnings"]
        },
        "message": "报告生成成功"
    }


@app.get("/preparation-reports/", response_model=list[schemas.PreparationReport], tags=["备料报告"])
def get_preparation_reports(course_id: int = None, has_warnings: bool = None, db: Session = Depends(get_db)):
    return crud.get_preparation_reports(db=db, course_id=course_id, has_warnings=has_warnings)


@app.get("/preparation-reports/{report_id}/export/", tags=["备料报告"])
def export_preparation_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(models.PreparationReport).filter(models.PreparationReport.id == report_id).first()
    if not report:
        raise crud.BusinessException("REPORT_NOT_FOUND", "validation_error", "报告不存在")
    
    import json
    materials_summary = json.loads(report.materials_summary)
    warning_details = json.loads(report.warning_details) if report.warning_details else []
    
    export_data = {
        "report_id": report.id,
        "course_id": report.course_id,
        "generated_at": report.created_at.isoformat(),
        "generated_by": report.generated_by,
        "summary": {
            "total_registered": report.total_registered,
            "total_dropped": report.total_dropped,
            "net_registered": report.net_registered
        },
        "materials": materials_summary,
        "warnings": warning_details,
        "has_warnings": report.has_warnings
    }
    
    return {
        "success": True,
        "data": export_data,
        "message": "导出成功"
    }


@app.get("/stock-records/", tags=["库存管理"])
def get_stock_records(material_kit_id: int = None, change_type: str = None, db: Session = Depends(get_db)):
    query = db.query(models.StockRecord)
    if material_kit_id:
        query = query.filter(models.StockRecord.material_kit_id == material_kit_id)
    if change_type:
        query = query.filter(models.StockRecord.change_type == change_type)
    records = query.order_by(models.StockRecord.created_at.desc()).all()
    return [schemas.StockRecord.model_validate(r).model_dump() for r in records]


@app.get("/", tags=["系统"])
def root():
    return {"message": "材料包备料管理系统 API", "version": "1.0.0", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
