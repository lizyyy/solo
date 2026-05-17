from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

import models
import schemas
from database import SessionLocal, engine, get_db
from services import MaterialReviewService, init_material_types
from exporter import ReportExporter

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="助学金材料审核API", version="1.0.0")


@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        init_material_types(db)
    finally:
        db.close()


@app.exception_handler(ValueError)
def value_error_handler(request, exc):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"error_code": "MISSING_FIELD", "error_type": "缺字段", "message": str(exc)}
    )


@app.get("/")
def root():
    return {"message": "助学金材料有效期与家庭成员一致性审核系统"}


@app.post("/students/", response_model=schemas.Student, status_code=status.HTTP_201_CREATED)
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    existing_student = db.query(models.Student).filter(models.Student.student_id == student.student_id).first()
    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_code": "ALREADY_PROCESSED", "error_type": "已处理", "message": f"学号 {student.student_id} 已存在"}
        )

    db_student = models.Student(
        student_id=student.student_id,
        name=student.name,
        gender=student.gender,
        grade=student.grade,
        major=student.major,
        phone=student.phone,
        id_card=student.id_card,
        address=student.address
    )
    db.add(db_student)
    db.flush()

    for member in student.family_members:
        db_member = models.FamilyMember(
            student_id=db_student.id,
            name=member.name,
            relation=member.relation,
            age=member.age,
            id_card=member.id_card,
            workplace=member.workplace,
            annual_income=member.annual_income,
            health_status=member.health_status,
            is_source_of_income=member.is_source_of_income
        )
        db.add(db_member)

    db.commit()
    db.refresh(db_student)
    return db_student


@app.get("/students/", response_model=List[schemas.Student])
def get_students(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    students = db.query(models.Student).offset(skip).limit(limit).all()
    return students


@app.get("/students/{student_id}", response_model=schemas.Student)
def get_student(student_id: str, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "error_type": "不存在", "message": f"学号 {student_id} 不存在"}
        )
    return student


@app.post("/students/{student_id}/materials/", response_model=schemas.StudentMaterial, status_code=status.HTTP_201_CREATED)
def add_student_material(student_id: str, material: schemas.StudentMaterialBase, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "error_type": "不存在", "message": f"学号 {student_id} 不存在"}
        )

    material_type = db.query(models.MaterialType).filter(models.MaterialType.id == material.material_type_id).first()
    if not material_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "MISSING_FIELD", "error_type": "缺字段", "message": f"材料类型ID {material.material_type_id} 不存在"}
        )

    existing_material = db.query(models.StudentMaterial).filter(
        models.StudentMaterial.student_id == student.id,
        models.StudentMaterial.material_type_id == material.material_type_id
    ).first()
    if existing_material:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_code": "ALREADY_PROCESSED", "error_type": "已处理", "message": f"该材料类型已存在，请使用更新接口"}
        )

    db_material = models.StudentMaterial(
        student_id=student.id,
        material_type_id=material.material_type_id,
        file_name=material.file_name,
        upload_date=material.upload_date,
        issue_date=material.issue_date,
        expiry_date=material.expiry_date,
        has_stamp=material.has_stamp,
        remarks=material.remarks
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


@app.get("/material-types/", response_model=List[schemas.MaterialType])
def get_material_types(db: Session = Depends(get_db)):
    return db.query(models.MaterialType).order_by(models.MaterialType.sort_order).all()


@app.post("/material-types/", response_model=schemas.MaterialType, status_code=status.HTTP_201_CREATED)
def create_material_type(mat_type: schemas.MaterialTypeBase, db: Session = Depends(get_db)):
    existing = db.query(models.MaterialType).filter(models.MaterialType.code == mat_type.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_code": "ALREADY_PROCESSED", "error_type": "已处理", "message": f"材料类型编码 {mat_type.code} 已存在"}
        )

    db_mat = models.MaterialType(**mat_type.dict())
    db.add(db_mat)
    db.commit()
    db.refresh(db_mat)
    return db_mat


@app.get("/review/{student_id}", response_model=schemas.ReviewResult)
def review_student(student_id: str, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "error_type": "不存在", "message": f"学号 {student_id} 不存在"}
        )

    service = MaterialReviewService(db)
    try:
        result = service.review_student_materials(student.id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "NEED_MANUAL_REVIEW", "error_type": "需要人工复核", "message": str(e)}
        )


@app.get("/review/issues/")
def get_students_with_issues(issue_type: Optional[str] = None, db: Session = Depends(get_db)):
    valid_types = ["missing", "expired", "no_stamp", "family", None]
    if issue_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "MISSING_FIELD", "error_type": "缺字段", "message": f"无效的问题类型，有效值为: {valid_types}"}
        )

    service = MaterialReviewService(db)
    return service.get_students_with_issues(issue_type)


@app.post("/review/batch/")
def batch_review(db: Session = Depends(get_db)):
    service = MaterialReviewService(db)
    results = service.batch_review_all()
    return {
        "total_students": len(results),
        "students_with_issues": len([r for r in results if r.issue_summary["total_issues"] > 0]),
        "results": results
    }


@app.post("/reports/{student_id}", response_model=schemas.ReviewReport)
def create_report(student_id: str, reviewer: Optional[str] = None, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "error_type": "不存在", "message": f"学号 {student_id} 不存在"}
        )

    service = MaterialReviewService(db)
    report = service.generate_report(student.id, reviewer)
    return report


@app.get("/reports/")
def get_reports(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    reports = db.query(models.ReviewReport).order_by(models.ReviewReport.created_at.desc()).offset(skip).limit(limit).all()
    return reports


@app.get("/export/student/{student_id}")
def export_student_report(student_id: str, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "error_type": "不存在", "message": f"学号 {student_id} 不存在"}
        )

    exporter = ReportExporter(db)
    try:
        file_path = exporter.export_student_review_to_excel(student.id)
        return FileResponse(file_path, filename=file_path.split("/")[-1])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "EXPORT_ERROR", "error_type": "导出错误", "message": str(e)}
        )


@app.get("/export/batch/")
def export_batch_report(db: Session = Depends(get_db)):
    exporter = ReportExporter(db)
    try:
        file_path = exporter.export_batch_review_to_excel()
        return FileResponse(file_path, filename=file_path.split("/")[-1])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "EXPORT_ERROR", "error_type": "导出错误", "message": str(e)}
        )


@app.get("/export/csv/")
def export_csv_report(db: Session = Depends(get_db)):
    exporter = ReportExporter(db)
    try:
        file_path = exporter.generate_review_report_csv()
        return FileResponse(file_path, filename=file_path.split("/")[-1])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "EXPORT_ERROR", "error_type": "导出错误", "message": str(e)}
        )


@app.put("/materials/{material_id}/status/")
def update_material_status(material_id: int, material_status: schemas.MaterialStatus, db: Session = Depends(get_db)):
    material = db.query(models.StudentMaterial).filter(models.StudentMaterial.id == material_id).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NOT_FOUND", "error_type": "不存在", "message": f"材料ID {material_id} 不存在"}
        )

    if material.status == schemas.MaterialStatus.PROCESSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "STATUS_NOT_ALLOWED", "error_type": "状态不允许", "message": "该材料已处理，无法再次修改状态"}
        )

    material.status = material_status
    db.commit()
    return {"success": True, "message": f"材料状态已更新为 {material_status.value}"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
