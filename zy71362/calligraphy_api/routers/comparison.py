from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Homework, ScoreReport, LayoutMeasurement
from schemas import ClassComparisonResponse

router = APIRouter(prefix="/api/class-comparison", tags=["comparison"])


@router.get("", response_model=list[ClassComparisonResponse])
def class_comparison(
    class_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(
            Homework.class_name,
            func.count(Homework.id).label("student_count"),
            func.avg(ScoreReport.char_spacing_score).label("avg_char_spacing_score"),
            func.avg(ScoreReport.line_spacing_score).label("avg_line_spacing_score"),
            func.avg(ScoreReport.signature_position_score).label("avg_signature_position_score"),
            func.avg(ScoreReport.total_score).label("avg_total_score"),
        )
        .join(ScoreReport, Homework.id == ScoreReport.homework_id)
        .filter(Homework.class_name.isnot(None))
    )

    if class_name:
        query = query.filter(Homework.class_name == class_name)

    results = query.group_by(Homework.class_name).all()

    response = []
    for row in results:
        hw_ids = (
            db.query(Homework.id)
            .join(ScoreReport, Homework.id == ScoreReport.homework_id)
            .filter(Homework.class_name == row.class_name)
            .order_by(ScoreReport.total_score.desc())
            .all()
        )
        id_list = [h[0] for h in hw_ids]

        top = []
        for hid in id_list[:3]:
            hw = db.query(Homework).filter(Homework.id == hid).first()
            sr = db.query(ScoreReport).filter(ScoreReport.homework_id == hid).first()
            if hw and sr:
                top.append({
                    "homework_id": hw.id,
                    "student_name": hw.student_name,
                    "total_score": sr.total_score,
                })

        bottom = []
        for hid in reversed(id_list[-3:]):
            hw = db.query(Homework).filter(Homework.id == hid).first()
            sr = db.query(ScoreReport).filter(ScoreReport.homework_id == hid).first()
            if hw and sr:
                bottom.append({
                    "homework_id": hw.id,
                    "student_name": hw.student_name,
                    "total_score": sr.total_score,
                })

        response.append(
            ClassComparisonResponse(
                class_name=row.class_name or "",
                student_count=row.student_count,
                avg_char_spacing_score=round(row.avg_char_spacing_score or 0, 2),
                avg_line_spacing_score=round(row.avg_line_spacing_score or 0, 2),
                avg_signature_position_score=round(row.avg_signature_position_score or 0, 2),
                avg_total_score=round(row.avg_total_score or 0, 2),
                top_students=top,
                bottom_students=bottom,
            )
        )

    return response


@router.get("/student-rank")
def student_rank(
    class_name: str = Query(...),
    db: Session = Depends(get_db),
):
    results = (
        db.query(Homework, ScoreReport)
        .join(ScoreReport, Homework.id == ScoreReport.homework_id)
        .filter(Homework.class_name == class_name)
        .order_by(ScoreReport.total_score.desc())
        .all()
    )

    ranked = []
    for rank, (hw, sr) in enumerate(results, 1):
        ranked.append({
            "rank": rank,
            "homework_id": hw.id,
            "student_name": hw.student_name,
            "total_score": sr.total_score,
            "char_spacing_score": sr.char_spacing_score,
            "line_spacing_score": sr.line_spacing_score,
            "signature_position_score": sr.signature_position_score,
        })

    return {"class_name": class_name, "rankings": ranked}
