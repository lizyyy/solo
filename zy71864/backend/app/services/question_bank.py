from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
import hashlib

from app.models import QuestionBank, EquivalentAnswer, EvaluationRecord, DiagnosisBatch, DiagnosisResult, FilterCondition
from app.schemas import QuestionBankCreate, QuestionBankUpdate, EquivalentAnswerCreate
from app.errors import QuestionNotFoundError, VersionNotFoundError


class QuestionBankService:
    def __init__(self, db: Session):
        self.db = db

    def create_question(self, question_data: QuestionBankCreate) -> QuestionBank:
        question = QuestionBank(
            question_no=question_data.question_no,
            content=question_data.content,
            standard_answer=question_data.standard_answer,
            recurrence_formula=question_data.recurrence_formula,
            created_by=question_data.created_by,
            version=1,
            is_active=True
        )
        self.db.add(question)
        self.db.commit()
        self.db.refresh(question)
        return question

    def update_question(self, question_id: int, update_data: QuestionBankUpdate) -> QuestionBank:
        old_question = self.db.query(QuestionBank).filter(
            QuestionBank.id == question_id,
            QuestionBank.is_active == True
        ).first()

        if not old_question:
            raise QuestionNotFoundError(f"ID {question_id}")

        old_question.is_active = False
        self.db.commit()

        new_version = old_question.version + 1
        new_question = QuestionBank(
            question_no=old_question.question_no,
            content=update_data.content if update_data.content else old_question.content,
            standard_answer=update_data.standard_answer if update_data.standard_answer else old_question.standard_answer,
            recurrence_formula=update_data.recurrence_formula if update_data.recurrence_formula else old_question.recurrence_formula,
            created_by=update_data.created_by if update_data.created_by else old_question.created_by,
            version=new_version,
            is_active=True,
            parent_id=old_question.id
        )
        self.db.add(new_question)
        self.db.commit()
        self.db.refresh(new_question)

        self._copy_equivalent_answers(old_question.id, new_question.id)

        return new_question

    def _copy_equivalent_answers(self, old_question_id: int, new_question_id: int):
        old_equivalents = self.db.query(EquivalentAnswer).filter(
            EquivalentAnswer.question_bank_id == old_question_id
        ).all()

        for eq in old_equivalents:
            new_eq = EquivalentAnswer(
                question_bank_id=new_question_id,
                answer_expression=eq.answer_expression,
                description=eq.description
            )
            self.db.add(new_eq)
        self.db.commit()

    def get_question_by_no(self, question_no: str) -> Optional[QuestionBank]:
        return self.db.query(QuestionBank).filter(
            QuestionBank.question_no == question_no,
            QuestionBank.is_active == True
        ).first()

    def get_question_version(self, question_no: str, version: int) -> Optional[QuestionBank]:
        question = self.db.query(QuestionBank).filter(
            QuestionBank.question_no == question_no,
            QuestionBank.version == version
        ).first()
        if not question:
            raise VersionNotFoundError(question_no, version)
        return question

    def get_all_versions(self, question_no: str) -> List[QuestionBank]:
        return self.db.query(QuestionBank).filter(
            QuestionBank.question_no == question_no
        ).order_by(QuestionBank.version.desc()).all()

    def add_equivalent_answer(self, eq_data: EquivalentAnswerCreate) -> EquivalentAnswer:
        question = self.get_question_by_no(str(eq_data.question_bank_id))
        if not question:
            question = self.db.query(QuestionBank).filter(
                QuestionBank.id == eq_data.question_bank_id
            ).first()
            if not question:
                raise QuestionNotFoundError(str(eq_data.question_bank_id))

        eq = EquivalentAnswer(
            question_bank_id=eq_data.question_bank_id,
            answer_expression=eq_data.answer_expression,
            description=eq_data.description
        )
        self.db.add(eq)
        self.db.commit()
        self.db.refresh(eq)
        return eq

    def get_equivalent_answers(self, question_bank_id: int) -> List[EquivalentAnswer]:
        return self.db.query(EquivalentAnswer).filter(
            EquivalentAnswer.question_bank_id == question_bank_id
        ).all()


class IdempotencyService:
    def __init__(self, db: Session):
        self.db = db

    def generate_material_hash(self, evaluation_record_ids: List[int]) -> str:
        sorted_ids = sorted(evaluation_record_ids)
        id_string = ",".join(map(str, sorted_ids))
        return hashlib.sha256(id_string.encode()).hexdigest()

    def check_existing_batch(self, material_hash: str) -> Optional[DiagnosisBatch]:
        return self.db.query(DiagnosisBatch).filter(
            DiagnosisBatch.batch_hash == material_hash
        ).first()

    def get_or_create_batch(
        self,
        batch_name: str,
        material_hash: str,
        evaluation_record_ids: List[int],
        filter_condition_id: Optional[int] = None
    ) -> Tuple[DiagnosisBatch, bool]:
        existing_batch = self.check_existing_batch(material_hash)
        if existing_batch:
            return existing_batch, True

        batch = DiagnosisBatch(
            batch_hash=material_hash,
            batch_name=batch_name,
            material_count=len(evaluation_record_ids),
            status="processing",
            filter_condition_id=filter_condition_id
        )
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch, False

    def get_batch_results(self, batch_id: int) -> List[DiagnosisResult]:
        return self.db.query(DiagnosisResult).filter(
            DiagnosisResult.batch_id == batch_id
        ).all()


class FilterConditionService:
    def __init__(self, db: Session):
        self.db = db

    def save_condition(
        self,
        user_id: str,
        condition_json: dict,
        condition_name: Optional[str] = None
    ) -> FilterCondition:
        self.db.query(FilterCondition).filter(
            FilterCondition.user_id == user_id,
            FilterCondition.is_current == True
        ).update({"is_current": False})

        condition = FilterCondition(
            user_id=user_id,
            condition_name=condition_name or f"筛选条件_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            condition_json=condition_json,
            is_current=True
        )
        self.db.add(condition)
        self.db.commit()
        self.db.refresh(condition)
        return condition

    def get_current_condition(self, user_id: str) -> Optional[FilterCondition]:
        return self.db.query(FilterCondition).filter(
            FilterCondition.user_id == user_id,
            FilterCondition.is_current == True
        ).first()

    def get_condition(self, condition_id: int) -> Optional[FilterCondition]:
        return self.db.query(FilterCondition).filter(
            FilterCondition.id == condition_id
        ).first()

    def validate_export_consistency(
        self,
        batch_id: int,
        filter_condition_id: Optional[int]
    ) -> bool:
        batch = self.db.query(DiagnosisBatch).filter(
            DiagnosisBatch.id == batch_id
        ).first()
        if not batch:
            return False
        return batch.filter_condition_id == filter_condition_id
