from sqlalchemy.orm import Session
from models import Translation, LanguageKey, LanguagePack, TranslationStatus
from schemas import TranslationCreate, TranslationUpdate, PlaceholderValidationResult
from services.placeholder_validator import PlaceholderValidator
from services.idempotency import IdempotencyService
from typing import List, Optional
from datetime import datetime


class TranslationService:
    @staticmethod
    def get_translation(db: Session, translation_id: int) -> Optional[Translation]:
        return db.query(Translation).filter(Translation.id == translation_id).first()

    @staticmethod
    def get_translations(db: Session, skip: int = 0, limit: int = 100,
                        language_pack_id: Optional[int] = None,
                        status: Optional[TranslationStatus] = None) -> List[Translation]:
        query = db.query(Translation)
        if language_pack_id:
            query = query.filter(Translation.language_pack_id == language_pack_id)
        if status:
            query = query.filter(Translation.status == status)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def create_translation(db: Session, translation: TranslationCreate) -> Translation:
        db_translation = Translation(**translation.dict())
        
        if translation.translated_text:
            db_translation.is_missing = False
            db_translation = TranslationService._validate_placeholder(db, db_translation)
        
        db.add(db_translation)
        db.commit()
        db.refresh(db_translation)
        return db_translation

    @staticmethod
    def update_translation(db: Session, translation_id: int, 
                          translation_update: TranslationUpdate,
                          operator: str, idempotency_key: Optional[str] = None) -> Optional[Translation]:
        if idempotency_key:
            existing_log = IdempotencyService.check_and_mark_operation(
                db, idempotency_key, "update_translation", operator
            )
            if existing_log:
                return db.query(Translation).filter(Translation.id == translation_id).first()

        db_translation = TranslationService.get_translation(db, translation_id)
        if not db_translation:
            return None

        old_value = db_translation.translated_text
        old_status = db_translation.status.value

        update_data = translation_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_translation, key, value)

        if 'translated_text' in update_data:
            db_translation.is_missing = False
            db_translation.last_modified_by = operator
            db_translation = TranslationService._validate_placeholder(db, db_translation)
            db_translation.status = TranslationStatus.MODIFIED

        db.commit()
        db.refresh(db_translation)

        IdempotencyService.create_operation_log(
            db, translation_id, "update_translation", operator,
            old_value=old_value, new_value=db_translation.translated_text,
            old_status=old_status, new_status=db_translation.status.value,
            idempotency_key=idempotency_key
        )

        return db_translation

    @staticmethod
    def _validate_placeholder(db: Session, translation: Translation) -> Translation:
        lang_key = db.query(LanguageKey).filter(LanguageKey.id == translation.language_key_id).first()
        if lang_key and translation.translated_text:
            result = PlaceholderValidator.validate(
                lang_key.default_value,
                translation.translated_text,
                lang_key.placeholder_pattern
            )
            translation.placeholder_valid = result.is_valid
            translation.placeholder_errors = "\n".join(result.errors) if result.errors else None
        return translation

    @staticmethod
    def start_review(db: Session, translation_id: int, operator: str,
                     idempotency_key: Optional[str] = None) -> Optional[Translation]:
        if idempotency_key:
            existing_log = IdempotencyService.check_and_mark_operation(
                db, idempotency_key, "start_review", operator
            )
            if existing_log:
                return db.query(Translation).filter(Translation.id == translation_id).first()

        db_translation = TranslationService.get_translation(db, translation_id)
        if not db_translation or db_translation.status == TranslationStatus.REVIEWING:
            return db_translation

        old_status = db_translation.status.value
        db_translation.status = TranslationStatus.REVIEWING
        db.commit()
        db.refresh(db_translation)

        IdempotencyService.create_operation_log(
            db, translation_id, "start_review", operator,
            old_status=old_status, new_status=db_translation.status.value,
            idempotency_key=idempotency_key
        )

        return db_translation

    @staticmethod
    def review_translation(db: Session, translation_id: int, approved: bool,
                           comment: Optional[str], operator: str,
                           idempotency_key: Optional[str] = None) -> Optional[Translation]:
        if idempotency_key:
            existing_log = IdempotencyService.check_and_mark_operation(
                db, idempotency_key, "review_translation", operator
            )
            if existing_log:
                return db.query(Translation).filter(Translation.id == translation_id).first()

        db_translation = TranslationService.get_translation(db, translation_id)
        if not db_translation:
            return None

        old_status = db_translation.status.value
        db_translation.review_comment = comment
        db_translation.reviewed_at = datetime.utcnow()

        if approved:
            db_translation.status = TranslationStatus.APPROVED
        else:
            db_translation.status = TranslationStatus.REJECTED

        db.commit()
        db.refresh(db_translation)

        IdempotencyService.create_operation_log(
            db, translation_id, "review_translation", operator,
            old_status=old_status, new_status=db_translation.status.value,
            idempotency_key=idempotency_key
        )

        return db_translation

    @staticmethod
    def compare_translation(db: Session, language_key_id: int, language_pack_id: int,
                           candidate_translation: str) -> dict:
        existing = db.query(Translation).filter(
            Translation.language_key_id == language_key_id,
            Translation.language_pack_id == language_pack_id
        ).first()

        is_new = existing is None or existing.translated_text is None
        
        similarity_score = 0.0
        if existing and existing.translated_text:
            from difflib import SequenceMatcher
            similarity_score = SequenceMatcher(
                None, candidate_translation, existing.translated_text
            ).ratio()

        suggestion = "新翻译" if is_new else "与现有翻译相似度 {:.0%}".format(similarity_score)
        if similarity_score > 0.9:
            suggestion += " - 高度相似，建议复用"
        elif similarity_score > 0.7:
            suggestion += " - 中度相似"
        elif not is_new:
            suggestion += " - 差异较大"

        return {
            "is_new": is_new,
            "similarity_score": similarity_score,
            "existing_translation": existing.translated_text if existing else None,
            "suggestion": suggestion
        }

    @staticmethod
    def recalculate_translations(db: Session, language_pack_id: Optional[int] = None,
                                language_key_id: Optional[int] = None) -> int:
        query = db.query(Translation)
        if language_pack_id:
            query = query.filter(Translation.language_pack_id == language_pack_id)
        if language_key_id:
            query = query.filter(Translation.language_key_id == language_key_id)
        
        translations = query.all()
        updated_count = 0

        for translation in translations:
            if translation.translated_text:
                old_valid = translation.placeholder_valid
                translation = TranslationService._validate_placeholder(db, translation)
                if old_valid != translation.placeholder_valid:
                    updated_count += 1

        db.commit()
        return updated_count
