from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import QuestionBank, EquivalentAnswer
from app.schemas import (
    QuestionBankCreate,
    QuestionBankUpdate,
    QuestionBankResponse,
    EquivalentAnswerCreate,
    EquivalentAnswerResponse,
    ErrorResponse
)
from app.services.question_bank import QuestionBankService
from app.errors import QuestionNotFoundError, VersionNotFoundError

router = APIRouter(prefix="/questions", tags=["题库管理"])


@router.get("/", response_model=List[QuestionBankResponse])
def list_questions(
    skip: int = 0,
    limit: int = 100,
    question_no: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(QuestionBank).filter(QuestionBank.is_active == True)
    if question_no:
        query = query.filter(QuestionBank.question_no == question_no)
    return query.offset(skip).limit(limit).all()


@router.get("/{question_id}", response_model=QuestionBankResponse)
def get_question(question_id: int, db: Session = Depends(get_db)):
    question = db.query(QuestionBank).filter(
        QuestionBank.id == question_id,
        QuestionBank.is_active == True
    ).first()
    if not question:
        raise QuestionNotFoundError(f"ID {question_id}")
    return question


@router.get("/no/{question_no}", response_model=QuestionBankResponse)
def get_question_by_no(question_no: str, db: Session = Depends(get_db)):
    service = QuestionBankService(db)
    question = service.get_question_by_no(question_no)
    if not question:
        raise QuestionNotFoundError(question_no)
    return question


@router.get("/{question_no}/versions", response_model=List[QuestionBankResponse])
def get_question_versions(question_no: str, db: Session = Depends(get_db)):
    service = QuestionBankService(db)
    return service.get_all_versions(question_no)


@router.get("/{question_no}/versions/{version}", response_model=QuestionBankResponse)
def get_question_version(question_no: str, version: int, db: Session = Depends(get_db)):
    service = QuestionBankService(db)
    return service.get_question_version(question_no, version)


@router.post("/", response_model=QuestionBankResponse, status_code=status.HTTP_201_CREATED)
def create_question(question_data: QuestionBankCreate, db: Session = Depends(get_db)):
    service = QuestionBankService(db)
    return service.create_question(question_data)


@router.put("/{question_id}", response_model=QuestionBankResponse)
def update_question(
    question_id: int,
    update_data: QuestionBankUpdate,
    db: Session = Depends(get_db)
):
    service = QuestionBankService(db)
    return service.update_question(question_id, update_data)


@router.post("/equivalent-answers", response_model=EquivalentAnswerResponse, status_code=status.HTTP_201_CREATED)
def add_equivalent_answer(eq_data: EquivalentAnswerCreate, db: Session = Depends(get_db)):
    service = QuestionBankService(db)
    return service.add_equivalent_answer(eq_data)


@router.get("/{question_id}/equivalent-answers", response_model=List[EquivalentAnswerResponse])
def get_equivalent_answers(question_id: int, db: Session = Depends(get_db)):
    service = QuestionBankService(db)
    return service.get_equivalent_answers(question_id)
