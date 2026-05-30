from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, get_db, Base
from .models import AnswerRecord, GradingResult, GradingStatus, QuestionType
from .schemas import (
    GradingRequest,
    GradingResponse,
    AnswerRecordResponse,
)
from .grading.grader_factory import GraderFactory
from .exceptions import (
    MusicGradingException,
    InvalidAnswerFormatException,
    StandardAnswerValidationException,
    music_grading_exception_handler,
    general_exception_handler,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="分数乐理自动判题服务",
    description="音乐基础课自动判分后端服务，支持音程、和弦、调号题型的自动判分、分步得分计算和错因解释",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(MusicGradingException, music_grading_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)


@app.get("/")
async def root():
    return {
        "service": "分数乐理自动判题服务",
        "version": "1.0.0",
        "supported_question_types": GraderFactory.get_supported_types(),
        "endpoints": {
            "POST /grade": "提交答案进行自动判分",
            "GET /records": "查询答题记录列表",
            "GET /records/{id}": "查询单条答题记录详情",
            "GET /results": "查询判分结果列表",
        }
    }


@app.post("/grade", response_model=GradingResponse, status_code=status.HTTP_201_CREATED)
async def grade_answer(request: GradingRequest, db: Session = Depends(get_db)):
    try:
        grader = GraderFactory.get_grader(request.question_type, request.full_score)

        std_valid, std_errors = grader.validate_answer_format(request.standard_answer, is_standard=True)
        if not std_valid:
            raise StandardAnswerValidationException(
                message="标准答案格式验证失败",
                errors=std_errors
            )

        answer_record = AnswerRecord(
            student_id=request.student_id,
            question_id=request.question_id,
            question_type=request.question_type,
            student_answer=request.student_answer,
            standard_answer=request.standard_answer,
            full_score=request.full_score,
        )
        db.add(answer_record)
        db.flush()

        score, is_correct = grader.grade(request.student_answer, request.standard_answer)

        grading_status = GradingStatus.SUCCESS
        if grader.needs_manual_review:
            grading_status = GradingStatus.NEEDS_REVIEW

        partial_scores_data = [ps.model_dump() for ps in grader.partial_scores]
        error_explanations_data = [ee.model_dump() for ee in grader.error_explanations]
        risk_flags_data = [rf.model_dump() for rf in grader.risk_flags]

        grading_result = GradingResult(
            answer_record_id=answer_record.id,
            score=round(score, 2),
            is_correct=1 if is_correct else 0,
            status=grading_status,
            partial_scores=partial_scores_data,
            error_explanations=error_explanations_data,
            risk_flags=risk_flags_data,
            needs_manual_review=1 if grader.needs_manual_review else 0,
            review_reason=grader.review_reason,
            graded_at=datetime.utcnow(),
        )
        db.add(grading_result)
        db.commit()
        db.refresh(answer_record)
        db.refresh(grading_result)

        return GradingResponse(
            record_id=answer_record.id,
            result_id=grading_result.id,
            score=grading_result.score,
            full_score=request.full_score,
            is_correct=is_correct,
            status=grading_result.status,
            needs_manual_review=bool(grading_result.needs_manual_review),
            review_reason=grading_result.review_reason,
            partial_scores=grader.partial_scores,
            error_explanations=grader.error_explanations,
            risk_flags=grader.risk_flags,
            graded_at=grading_result.graded_at,
        )

    except MusicGradingException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise InvalidAnswerFormatException(
            message=f"判分过程出现异常：{str(e)}",
            details={"error_type": type(e).__name__}
        ) from e


@app.get("/records", response_model=List[AnswerRecordResponse])
async def get_records(
    student_id: Optional[str] = None,
    question_id: Optional[str] = None,
    question_type: Optional[QuestionType] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(AnswerRecord)
    if student_id:
        query = query.filter(AnswerRecord.student_id == student_id)
    if question_id:
        query = query.filter(AnswerRecord.question_id == question_id)
    if question_type:
        query = query.filter(AnswerRecord.question_type == question_type)

    records = query.order_by(AnswerRecord.created_at.desc()).offset(skip).limit(limit).all()
    return records


@app.get("/records/{record_id}", response_model=AnswerRecordResponse)
async def get_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(AnswerRecord).filter(AnswerRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="答题记录不存在")
    return record


@app.get("/results")
async def get_results(
    needs_review: Optional[bool] = None,
    is_correct: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(GradingResult)
    if needs_review is not None:
        query = query.filter(GradingResult.needs_manual_review == (1 if needs_review else 0))
    if is_correct is not None:
        query = query.filter(GradingResult.is_correct == (1 if is_correct else 0))

    results = query.order_by(GradingResult.graded_at.desc()).offset(skip).limit(limit).all()

    return [
        {
            "id": r.id,
            "record_id": r.answer_record_id,
            "score": r.score,
            "is_correct": bool(r.is_correct),
            "status": r.status.value,
            "needs_manual_review": bool(r.needs_manual_review),
            "review_reason": r.review_reason,
            "partial_scores": r.partial_scores,
            "error_explanations": r.error_explanations,
            "risk_flags": r.risk_flags,
            "graded_at": r.graded_at,
        }
        for r in results
    ]


@app.get("/results/{result_id}")
async def get_result(result_id: int, db: Session = Depends(get_db)):
    result = db.query(GradingResult).filter(GradingResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="判分结果不存在")

    return {
        "id": result.id,
        "record_id": result.answer_record_id,
        "score": result.score,
        "is_correct": bool(result.is_correct),
        "status": result.status.value,
        "needs_manual_review": bool(result.needs_manual_review),
        "review_reason": result.review_reason,
        "partial_scores": result.partial_scores,
        "error_explanations": result.error_explanations,
        "risk_flags": result.risk_flags,
        "rule_version": result.rule_version,
        "graded_at": result.graded_at,
    }
