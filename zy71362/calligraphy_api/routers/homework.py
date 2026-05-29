import os
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Homework, ScoreReport, LayoutMeasurement, IssueRecord
from schemas import (
    HomeworkCreate,
    HomeworkResponse,
    ScoreReportCorrect,
    ScoreReportResponse,
    LayoutMeasurementResponse,
    LayoutMeasurementAdjust,
    AdvanceStatusRequest,
    IssueRecordResponse,
    IssueResolve,
    ImageCorrectRequest,
    VALID_STATUSES,
    VALID_FONT_TYPES,
    VALID_ISSUE_TYPES,
)
from image_processor import (
    save_upload_image,
    load_image,
    resize_if_needed,
    detect_tilt_angle,
    correct_tilt,
    detect_text_regions,
    detect_chars_in_row,
    detect_signature_region,
    generate_annotated_image,
)
from layout_analyzer import measure_layout, check_spacing_issues
from scorer import calculate_scores, recalculate_scores_from_adjustment
from config import UPLOAD_DIR, TILT_THRESHOLD_DEGREES

router = APIRouter(prefix="/api/homework", tags=["homework"])

STATUS_TRANSITIONS = {
    "uploaded": ["image_corrected"],
    "image_corrected": ["layout_measured"],
    "layout_measured": ["scored"],
    "scored": ["completed"],
}


@router.post("", response_model=HomeworkResponse, status_code=201)
async def create_homework(
    student_name: str = Form(...),
    font_type: str = Form(...),
    class_name: Optional[str] = Form(None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if font_type not in VALID_FONT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid font_type. Must be one of: {VALID_FONT_TYPES}",
        )

    ext = os.path.splitext(image.filename or "upload.jpg")[1] or ".jpg"
    file_id = uuid.uuid4().hex[:12]
    filename = f"{file_id}_original{ext}"
    file_bytes = await image.read()
    original_path = save_upload_image(file_bytes, filename)

    try:
        img = load_image(original_path)
        img = resize_if_needed(img)
        img.save(original_path)
    except Exception:
        pass

    working_filename = f"{file_id}{ext}"
    working_path = os.path.join(UPLOAD_DIR, working_filename)
    try:
        from PIL import Image as PILImage
        PILImage.open(original_path).save(working_path)
    except Exception:
        working_path = original_path

    homework = Homework(
        student_name=student_name,
        font_type=font_type,
        class_name=class_name,
        image_path=working_path,
        original_image_path=original_path,
        status="uploaded",
    )
    db.add(homework)
    db.commit()
    db.refresh(homework)
    return homework


@router.get("", response_model=list[HomeworkResponse])
def list_homework(
    student_name: Optional[str] = None,
    class_name: Optional[str] = None,
    status: Optional[str] = None,
    font_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Homework)
    if student_name:
        query = query.filter(Homework.student_name.contains(student_name))
    if class_name:
        query = query.filter(Homework.class_name == class_name)
    if status:
        query = query.filter(Homework.status == status)
    if font_type:
        query = query.filter(Homework.font_type == font_type)
    return query.order_by(Homework.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{homework_id}", response_model=HomeworkResponse)
def get_homework(homework_id: int, db: Session = Depends(get_db)):
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")
    return hw


@router.post("/{homework_id}/advance", response_model=HomeworkResponse)
def advance_status(
    homework_id: int,
    req: AdvanceStatusRequest = None,
    db: Session = Depends(get_db),
):
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    current = hw.status
    allowed = STATUS_TRANSITIONS.get(current, [])

    if not allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Status '{current}' is final, cannot advance further",
        )

    target = None
    if req and req.target_status:
        target = req.target_status
        if target not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from '{current}' to '{target}'. Allowed: {allowed}",
            )
    else:
        target = allowed[0]

    if target == "image_corrected" and not hw.tilt_corrected:
        raise HTTPException(
            status_code=400,
            detail="Image must be corrected first. Use POST /api/homework/{id}/correct-image",
        )

    if target == "layout_measured":
        existing = (
            db.query(LayoutMeasurement)
            .filter(LayoutMeasurement.homework_id == homework_id)
            .first()
        )
        if not existing:
            try:
                result = measure_layout(hw.image_path)
                measurement = LayoutMeasurement(
                    homework_id=homework_id,
                    char_distances=result["char_distances"],
                    line_distances=result["line_distances"],
                    avg_char_spacing=result["avg_char_spacing"],
                    avg_line_spacing=result["avg_line_spacing"],
                    char_spacing_variance=result["char_spacing_variance"],
                    line_spacing_variance=result["line_spacing_variance"],
                    signature_detected=result["signature_detected"],
                    signature_region=result["signature_region"],
                    row_count=result["row_count"],
                    char_count=result["char_count"],
                )
                db.add(measurement)

                issues = check_spacing_issues(result)
                for issue in issues:
                    record = IssueRecord(
                        homework_id=homework_id,
                        issue_type=issue["issue_type"],
                        severity=issue.get("severity", "medium"),
                        description=issue["description"],
                        suggested_action=issue.get("suggested_action"),
                    )
                    db.add(record)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Layout measurement failed: {str(e)}")

    if target == "scored":
        measurement = (
            db.query(LayoutMeasurement)
            .filter(LayoutMeasurement.homework_id == homework_id)
            .order_by(LayoutMeasurement.created_at.desc())
            .first()
        )
        if not measurement:
            raise HTTPException(
                status_code=400,
                detail="Layout measurement required before scoring",
            )
        meas_dict = {
            "avg_char_spacing": measurement.avg_char_spacing,
            "avg_line_spacing": measurement.avg_line_spacing,
            "char_spacing_variance": measurement.char_spacing_variance,
            "line_spacing_variance": measurement.line_spacing_variance,
            "signature_detected": measurement.signature_detected,
            "signature_region": measurement.signature_region,
        }
        scores = calculate_scores(meas_dict)
        report = ScoreReport(
            homework_id=homework_id,
            char_spacing_score=scores["char_spacing_score"],
            line_spacing_score=scores["line_spacing_score"],
            signature_position_score=scores["signature_position_score"],
            total_score=scores["total_score"],
        )
        db.add(report)

    hw.status = target
    hw.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(hw)
    return hw


@router.post("/{homework_id}/correct-image", response_model=HomeworkResponse)
def correct_image(
    homework_id: int,
    req: ImageCorrectRequest = ImageCorrectRequest(),
    db: Session = Depends(get_db),
):
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    if hw.status not in ["uploaded", "image_corrected"]:
        raise HTTPException(
            status_code=400,
            detail="Image correction only available in 'uploaded' or 'image_corrected' status",
        )

    try:
        image = load_image(hw.image_path)
        tilt_angle = detect_tilt_angle(image)
        hw.tilt_angle = tilt_angle

        issue_existing = (
            db.query(IssueRecord)
            .filter(
                IssueRecord.homework_id == homework_id,
                IssueRecord.issue_type == "image_tilt",
                IssueRecord.resolved == False,
            )
            .first()
        )

        if abs(tilt_angle) > TILT_THRESHOLD_DEGREES:
            if not issue_existing:
                tilt_issue = IssueRecord(
                    homework_id=homework_id,
                    issue_type="image_tilt",
                    severity="high" if abs(tilt_angle) > 5 else "medium",
                    description=f"检测到图片倾斜角度 {tilt_angle:.2f}°，超过阈值 {TILT_THRESHOLD_DEGREES}°",
                    suggested_action="建议进行图像倾斜校正，使用本接口自动矫正或手动旋转",
                )
                db.add(tilt_issue)

            if req.force or abs(tilt_angle) > TILT_THRESHOLD_DEGREES:
                corrected = correct_tilt(image, tilt_angle)
                file_id = uuid.uuid4().hex[:12]
                corrected_filename = f"{file_id}_corrected.jpg"
                corrected_path = os.path.join(UPLOAD_DIR, corrected_filename)
                corrected.save(corrected_path)
                hw.image_path = corrected_path
                hw.tilt_corrected = True

                if issue_existing:
                    issue_existing.resolved = True
                    issue_existing.resolution = f"已自动校正倾斜角度 {tilt_angle:.2f}°"
                    issue_existing.resolved_at = datetime.utcnow()
            else:
                hw.tilt_corrected = False
        else:
            hw.tilt_corrected = True
            if issue_existing:
                issue_existing.resolved = True
                issue_existing.resolution = f"倾斜角度 {tilt_angle:.2f}° 在可接受范围内"
                issue_existing.resolved_at = datetime.utcnow()

        hw.status = "image_corrected"
        hw.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(hw)
        return hw

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image correction failed: {str(e)}")


@router.post("/{homework_id}/measure", response_model=LayoutMeasurementResponse)
def run_measurement(homework_id: int, db: Session = Depends(get_db)):
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    if hw.status not in ["image_corrected", "layout_measured", "scored"]:
        raise HTTPException(
            status_code=400,
            detail="Image must be corrected before measurement",
        )

    try:
        result = measure_layout(hw.image_path)
        measurement = LayoutMeasurement(
            homework_id=homework_id,
            char_distances=result["char_distances"],
            line_distances=result["line_distances"],
            avg_char_spacing=result["avg_char_spacing"],
            avg_line_spacing=result["avg_line_spacing"],
            char_spacing_variance=result["char_spacing_variance"],
            line_spacing_variance=result["line_spacing_variance"],
            signature_detected=result["signature_detected"],
            signature_region=result["signature_region"],
            row_count=result["row_count"],
            char_count=result["char_count"],
        )
        db.add(measurement)

        issues = check_spacing_issues(result)
        for issue in issues:
            record = IssueRecord(
                homework_id=homework_id,
                issue_type=issue["issue_type"],
                severity=issue.get("severity", "medium"),
                description=issue["description"],
                suggested_action=issue.get("suggested_action"),
            )
            db.add(record)

        if hw.status == "image_corrected":
            hw.status = "layout_measured"
        hw.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(measurement)
        return measurement

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Measurement failed: {str(e)}")


@router.get("/{homework_id}/measurement", response_model=LayoutMeasurementResponse)
def get_measurement(homework_id: int, db: Session = Depends(get_db)):
    measurement = (
        db.query(LayoutMeasurement)
        .filter(LayoutMeasurement.homework_id == homework_id)
        .order_by(LayoutMeasurement.created_at.desc())
        .first()
    )
    if not measurement:
        raise HTTPException(status_code=404, detail="No measurement found for this homework")
    return measurement


@router.put("/{homework_id}/measurement", response_model=LayoutMeasurementResponse)
def adjust_measurement(
    homework_id: int,
    adj: LayoutMeasurementAdjust,
    db: Session = Depends(get_db),
):
    measurement = (
        db.query(LayoutMeasurement)
        .filter(LayoutMeasurement.homework_id == homework_id)
        .order_by(LayoutMeasurement.created_at.desc())
        .first()
    )
    if not measurement:
        raise HTTPException(status_code=404, detail="No measurement found for this homework")

    if adj.avg_char_spacing is not None:
        measurement.avg_char_spacing = adj.avg_char_spacing
    if adj.avg_line_spacing is not None:
        measurement.avg_line_spacing = adj.avg_line_spacing
    if adj.char_spacing_variance is not None:
        measurement.char_spacing_variance = adj.char_spacing_variance
    if adj.line_spacing_variance is not None:
        measurement.line_spacing_variance = adj.line_spacing_variance
    if adj.signature_detected is not None:
        measurement.signature_detected = adj.signature_detected
    if adj.signature_region is not None:
        measurement.signature_region = adj.signature_region
    measurement.is_manual_adjusted = True

    misjudgment_issue = (
        db.query(IssueRecord)
        .filter(
            IssueRecord.homework_id == homework_id,
            IssueRecord.issue_type == "line_spacing_misjudgment",
            IssueRecord.resolved == False,
        )
        .first()
    )
    if misjudgment_issue:
        misjudgment_issue.resolved = True
        misjudgment_issue.resolution = "已手动调整版面测量数据"
        misjudgment_issue.resolved_at = datetime.utcnow()

    sig_issue = (
        db.query(IssueRecord)
        .filter(
            IssueRecord.homework_id == homework_id,
            IssueRecord.issue_type == "signature_missed",
            IssueRecord.resolved == False,
        )
        .first()
    )
    if sig_issue and adj.signature_detected is True:
        sig_issue.resolved = True
        sig_issue.resolution = "已手动标注落款区域"
        sig_issue.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(measurement)
    return measurement


@router.get("/{homework_id}/score", response_model=ScoreReportResponse)
def get_score(homework_id: int, db: Session = Depends(get_db)):
    report = (
        db.query(ScoreReport)
        .filter(ScoreReport.homework_id == homework_id)
        .order_by(ScoreReport.created_at.desc())
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="No score report found for this homework")
    return report


@router.put("/{homework_id}/score", response_model=ScoreReportResponse)
def correct_score(
    homework_id: int,
    correction: ScoreReportCorrect,
    db: Session = Depends(get_db),
):
    report = (
        db.query(ScoreReport)
        .filter(ScoreReport.homework_id == homework_id)
        .order_by(ScoreReport.created_at.desc())
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="No score report found for this homework")

    if correction.char_spacing_score is not None:
        report.char_spacing_score = correction.char_spacing_score
    if correction.line_spacing_score is not None:
        report.line_spacing_score = correction.line_spacing_score
    if correction.signature_position_score is not None:
        report.signature_position_score = correction.signature_position_score
    if correction.override_reason:
        report.override_reason = correction.override_reason

    report.is_manual_override = True
    report.total_score = round(
        report.char_spacing_score * 0.35
        + report.line_spacing_score * 0.35
        + report.signature_position_score * 0.30,
        2,
    )

    db.commit()
    db.refresh(report)
    return report


@router.get("/{homework_id}/issues", response_model=list[IssueRecordResponse])
def list_issues(
    homework_id: int,
    resolved: Optional[bool] = None,
    issue_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(IssueRecord).filter(IssueRecord.homework_id == homework_id)
    if resolved is not None:
        query = query.filter(IssueRecord.resolved == resolved)
    if issue_type:
        if issue_type not in VALID_ISSUE_TYPES + ["char_spacing_irregular"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid issue_type. Valid types: {VALID_ISSUE_TYPES + ['char_spacing_irregular']}",
            )
        query = query.filter(IssueRecord.issue_type == issue_type)
    return query.order_by(IssueRecord.created_at.desc()).all()


@router.put("/{homework_id}/issues/{issue_id}", response_model=IssueRecordResponse)
def resolve_issue(
    homework_id: int,
    issue_id: int,
    resolve: IssueResolve,
    db: Session = Depends(get_db),
):
    issue = (
        db.query(IssueRecord)
        .filter(IssueRecord.id == issue_id, IssueRecord.homework_id == homework_id)
        .first()
    )
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue.resolved = True
    issue.resolution = resolve.resolution
    issue.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(issue)
    return issue


@router.delete("/{homework_id}", status_code=204)
def delete_homework(homework_id: int, db: Session = Depends(get_db)):
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")
    db.delete(hw)
    db.commit()
