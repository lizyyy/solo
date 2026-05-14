from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Translation, LanguageKey, LanguagePack, TranslationStatus
from schemas import (
    TranslationResponse, TranslationCreate, TranslationUpdate,
    TranslationCompareRequest, TranslationCompareResponse,
    TranslationReviewRequest, LanguageKeyResponse, LanguageKeyCreate,
    LanguageKeyUpdate, LanguagePackResponse, LanguagePackCreate,
    PlaceholderValidationResult, BatchOperationResponse
)
from services.translation_service import TranslationService
from services.placeholder_validator import PlaceholderValidator

router = APIRouter(prefix="/api/translation", tags=["翻译管理"])


@router.get("/language-keys", response_model=List[LanguageKeyResponse])
def get_language_keys(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(LanguageKey).offset(skip).limit(limit).all()


@router.post("/language-keys", response_model=LanguageKeyResponse)
def create_language_key(lang_key: LanguageKeyCreate, db: Session = Depends(get_db)):
    existing = db.query(LanguageKey).filter(LanguageKey.key == lang_key.key).first()
    if existing:
        raise HTTPException(status_code=400, detail="Language key already exists")
    
    db_lang_key = LanguageKey(**lang_key.dict())
    db.add(db_lang_key)
    db.commit()
    db.refresh(db_lang_key)
    
    language_packs = db.query(LanguagePack).all()
    for pack in language_packs:
        db_translation = Translation(
            language_key_id=db_lang_key.id,
            language_pack_id=pack.id,
            is_missing=True
        )
        db.add(db_translation)
    db.commit()
    
    return db_lang_key


@router.put("/language-keys/{key_id}", response_model=LanguageKeyResponse)
def update_language_key(key_id: int, lang_key: LanguageKeyUpdate, db: Session = Depends(get_db)):
    db_lang_key = db.query(LanguageKey).filter(LanguageKey.id == key_id).first()
    if not db_lang_key:
        raise HTTPException(status_code=404, detail="Language key not found")
    
    update_data = lang_key.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_lang_key, key, value)
    
    db.commit()
    db.refresh(db_lang_key)
    
    TranslationService.recalculate_translations(db, language_key_id=key_id)
    
    return db_lang_key


@router.get("/language-packs", response_model=List[LanguagePackResponse])
def get_language_packs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(LanguagePack).offset(skip).limit(limit).all()


@router.post("/language-packs", response_model=LanguagePackResponse)
def create_language_pack(lang_pack: LanguagePackCreate, db: Session = Depends(get_db)):
    existing = db.query(LanguagePack).filter(
        LanguagePack.language_code == lang_pack.language_code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Language pack already exists")
    
    db_lang_pack = LanguagePack(**lang_pack.dict())
    db.add(db_lang_pack)
    db.commit()
    db.refresh(db_lang_pack)
    
    language_keys = db.query(LanguageKey).all()
    for key in language_keys:
        db_translation = Translation(
            language_key_id=key.id,
            language_pack_id=db_lang_pack.id,
            is_missing=True
        )
        db.add(db_translation)
    db.commit()
    
    return db_lang_pack


@router.get("", response_model=List[TranslationResponse])
def get_translations(
    skip: int = 0,
    limit: int = 100,
    language_pack_id: Optional[int] = None,
    status: Optional[TranslationStatus] = None,
    db: Session = Depends(get_db)
):
    return TranslationService.get_translations(
        db, skip=skip, limit=limit, language_pack_id=language_pack_id, status=status
    )


@router.get("/{translation_id}", response_model=TranslationResponse)
def get_translation(translation_id: int, db: Session = Depends(get_db)):
    translation = TranslationService.get_translation(db, translation_id)
    if not translation:
        raise HTTPException(status_code=404, detail="Translation not found")
    return translation


@router.post("", response_model=TranslationResponse)
def create_translation(translation: TranslationCreate, db: Session = Depends(get_db)):
    return TranslationService.create_translation(db, translation)


@router.put("/{translation_id}", response_model=TranslationResponse)
def update_translation(
    translation_id: int,
    translation: TranslationUpdate,
    x_operator: str = Header(default="system"),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    updated = TranslationService.update_translation(
        db, translation_id, translation, x_operator, x_idempotency_key
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Translation not found")
    return updated


@router.post("/{translation_id}/start-review", response_model=TranslationResponse)
def start_review(
    translation_id: int,
    x_operator: str = Header(default="system"),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    translation = TranslationService.start_review(
        db, translation_id, x_operator, x_idempotency_key
    )
    if not translation:
        raise HTTPException(status_code=404, detail="Translation not found")
    return translation


@router.post("/{translation_id}/review", response_model=TranslationResponse)
def review_translation(
    translation_id: int,
    review_data: TranslationReviewRequest,
    x_operator: str = Header(default="system"),
    db: Session = Depends(get_db)
):
    translation = TranslationService.review_translation(
        db, translation_id, review_data.approved, review_data.comment,
        x_operator, review_data.idempotency_key
    )
    if not translation:
        raise HTTPException(status_code=404, detail="Translation not found")
    return translation


@router.post("/compare", response_model=TranslationCompareResponse)
def compare_translation(compare_data: TranslationCompareRequest, db: Session = Depends(get_db)):
    return TranslationService.compare_translation(
        db, compare_data.language_key_id, compare_data.language_pack_id,
        compare_data.candidate_translation
    )


@router.post("/validate-placeholder", response_model=PlaceholderValidationResult)
def validate_placeholder(
    source_text: str,
    translated_text: str,
    pattern: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return PlaceholderValidator.validate(source_text, translated_text, pattern)


@router.post("/recalculate", response_model=BatchOperationResponse)
def recalculate_translations(
    language_pack_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    updated_count = TranslationService.recalculate_translations(db, language_pack_id)
    return {
        "success": updated_count,
        "failed": 0,
        "total": updated_count,
        "errors": []
    }
