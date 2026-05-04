import csv
import json
from io import StringIO
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete, or_

from app.database import get_db
from app.core.text_processor import TextProcessor
from app.models import SensitiveWord, Synonym, Whitelist, ContextRule, LexiconVersion
from app.schemas import (
    SensitiveWordCreate, SensitiveWordUpdate, SensitiveWordResponse,
    SynonymCreate, SynonymResponse,
    WhitelistCreate, WhitelistResponse,
    ContextRuleCreate, ContextRuleResponse,
    LexiconVersionResponse, LexiconImportResult,
    SuccessResponse, PaginatedResponse
)

router = APIRouter()
text_processor = TextProcessor()


@router.get("/words", response_model=PaginatedResponse[SensitiveWordResponse])
async def list_sensitive_words(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(SensitiveWord)
    
    if category:
        query = query.where(SensitiveWord.category == category)
    if severity:
        query = query.where(SensitiveWord.severity == severity)
    if keyword:
        normalized_keyword = text_processor.normalize(keyword)
        query = query.where(
            or_(
                SensitiveWord.word.contains(keyword),
                SensitiveWord.normalized_word.contains(normalized_keyword)
            )
        )
    if is_active is not None:
        query = query.where(SensitiveWord.is_active == is_active)
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    offset = (page - 1) * page_size
    query = query.order_by(SensitiveWord.created_at.desc()).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    words = result.scalars().all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        items=[SensitiveWordResponse.model_validate(w) for w in words],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1
    )


@router.get("/words/{word_id}", response_model=SensitiveWordResponse)
async def get_sensitive_word(
    word_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(SensitiveWord).where(SensitiveWord.id == word_id))
    word = result.scalar_one_or_none()
    
    if not word:
        raise HTTPException(status_code=404, detail="敏感词不存在")
    
    return SensitiveWordResponse.model_validate(word)


@router.post("/words", response_model=SensitiveWordResponse)
async def create_sensitive_word(
    word_data: SensitiveWordCreate,
    db: AsyncSession = Depends(get_db)
):
    normalized_word = text_processor.normalize(word_data.word)
    pinyin = text_processor.to_pinyin(normalized_word)
    
    existing = await db.execute(
        select(SensitiveWord).where(SensitiveWord.normalized_word == normalized_word)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该敏感词已存在")
    
    new_word = SensitiveWord(
        word=word_data.word,
        normalized_word=normalized_word,
        pinyin=pinyin,
        category=word_data.category,
        severity=word_data.severity,
        description=word_data.description,
        suggestion=word_data.suggestion,
        is_regex=word_data.is_regex,
        is_active=word_data.is_active
    )
    
    db.add(new_word)
    await db.commit()
    await db.refresh(new_word)
    
    return SensitiveWordResponse.model_validate(new_word)


@router.put("/words/{word_id}", response_model=SensitiveWordResponse)
async def update_sensitive_word(
    word_id: int,
    word_data: SensitiveWordUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(SensitiveWord).where(SensitiveWord.id == word_id))
    word = result.scalar_one_or_none()
    
    if not word:
        raise HTTPException(status_code=404, detail="敏感词不存在")
    
    update_data = word_data.model_dump(exclude_unset=True)
    
    if 'word' in update_data:
        update_data['normalized_word'] = text_processor.normalize(update_data['word'])
        update_data['pinyin'] = text_processor.to_pinyin(update_data['normalized_word'])
    
    for key, value in update_data.items():
        setattr(word, key, value)
    
    await db.commit()
    await db.refresh(word)
    
    return SensitiveWordResponse.model_validate(word)


@router.delete("/words/{word_id}", response_model=SuccessResponse)
async def delete_sensitive_word(
    word_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(SensitiveWord).where(SensitiveWord.id == word_id))
    word = result.scalar_one_or_none()
    
    if not word:
        raise HTTPException(status_code=404, detail="敏感词不存在")
    
    await db.delete(word)
    await db.commit()
    
    return SuccessResponse(message="删除成功")


@router.get("/synonyms", response_model=PaginatedResponse[SynonymResponse])
async def list_synonyms(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sensitive_word_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(Synonym)
    
    if sensitive_word_id:
        query = query.where(Synonym.sensitive_word_id == sensitive_word_id)
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    offset = (page - 1) * page_size
    query = query.order_by(Synonym.created_at.desc()).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    synonyms = result.scalars().all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        items=[SynonymResponse.model_validate(s) for s in synonyms],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1
    )


@router.post("/synonyms", response_model=SynonymResponse)
async def create_synonym(
    synonym_data: SynonymCreate,
    db: AsyncSession = Depends(get_db)
):
    word_result = await db.execute(
        select(SensitiveWord).where(SensitiveWord.id == synonym_data.sensitive_word_id)
    )
    if not word_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="关联的敏感词不存在")
    
    normalized_synonym = text_processor.normalize(synonym_data.synonym)
    
    new_synonym = Synonym(
        sensitive_word_id=synonym_data.sensitive_word_id,
        synonym=synonym_data.synonym,
        normalized_synonym=normalized_synonym
    )
    
    db.add(new_synonym)
    await db.commit()
    await db.refresh(new_synonym)
    
    return SynonymResponse.model_validate(new_synonym)


@router.delete("/synonyms/{synonym_id}", response_model=SuccessResponse)
async def delete_synonym(
    synonym_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Synonym).where(Synonym.id == synonym_id))
    synonym = result.scalar_one_or_none()
    
    if not synonym:
        raise HTTPException(status_code=404, detail="同义词不存在")
    
    await db.delete(synonym)
    await db.commit()
    
    return SuccessResponse(message="删除成功")


@router.get("/whitelist", response_model=PaginatedResponse[WhitelistResponse])
async def list_whitelist(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(Whitelist)
    
    if keyword:
        normalized = text_processor.normalize(keyword)
        query = query.where(
            or_(
                Whitelist.term.contains(keyword),
                Whitelist.normalized_term.contains(normalized)
            )
        )
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    offset = (page - 1) * page_size
    query = query.order_by(Whitelist.created_at.desc()).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    items = result.scalars().all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        items=[WhitelistResponse.model_validate(w) for w in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1
    )


@router.post("/whitelist", response_model=WhitelistResponse)
async def create_whitelist_item(
    item_data: WhitelistCreate,
    db: AsyncSession = Depends(get_db)
):
    normalized_term = text_processor.normalize(item_data.term)
    
    existing = await db.execute(
        select(Whitelist).where(Whitelist.normalized_term == normalized_term)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该白名单词条已存在")
    
    new_item = Whitelist(
        term=item_data.term,
        normalized_term=normalized_term,
        reason=item_data.reason,
        context=item_data.context
    )
    
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    
    return WhitelistResponse.model_validate(new_item)


@router.delete("/whitelist/{item_id}", response_model=SuccessResponse)
async def delete_whitelist_item(
    item_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Whitelist).where(Whitelist.id == item_id))
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="白名单词条不存在")
    
    await db.delete(item)
    await db.commit()
    
    return SuccessResponse(message="删除成功")


@router.get("/context-rules", response_model=List[ContextRuleResponse])
async def list_context_rules(
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(ContextRule)
    if is_active is not None:
        query = query.where(ContextRule.is_active == is_active)
    
    result = await db.execute(query)
    rules = result.scalars().all()
    
    return [ContextRuleResponse.model_validate(r) for r in rules]


@router.post("/context-rules", response_model=ContextRuleResponse)
async def create_context_rule(
    rule_data: ContextRuleCreate,
    db: AsyncSession = Depends(get_db)
):
    new_rule = ContextRule(**rule_data.model_dump())
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)
    
    return ContextRuleResponse.model_validate(new_rule)


@router.delete("/context-rules/{rule_id}", response_model=SuccessResponse)
async def delete_context_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ContextRule).where(ContextRule.id == rule_id))
    rule = result.scalar_one_or_none()
    
    if not rule:
        raise HTTPException(status_code=404, detail="上下文规则不存在")
    
    await db.delete(rule)
    await db.commit()
    
    return SuccessResponse(message="删除成功")


@router.post("/import/csv", response_model=LexiconImportResult)
async def import_from_csv(
    file: UploadFile = File(...),
    category: str = "other",
    severity: str = "medium",
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传 CSV 文件")
    
    content = await file.read()
    text_content = content.decode('utf-8')
    
    added = 0
    updated = 0
    skipped = 0
    errors = []
    
    try:
        reader = csv.DictReader(StringIO(text_content))
        
        for row_num, row in enumerate(reader, start=2):
            word = row.get('word') or row.get('敏感词') or row.get('term')
            
            if not word or not word.strip():
                skipped += 1
                continue
            
            word = word.strip()
            normalized_word = text_processor.normalize(word)
            pinyin = text_processor.to_pinyin(normalized_word)
            
            row_category = row.get('category') or row.get('分类') or category
            row_severity = row.get('severity') or row.get('级别') or severity
            description = row.get('description') or row.get('描述')
            suggestion = row.get('suggestion') or row.get('建议')
            
            try:
                existing = await db.execute(
                    select(SensitiveWord).where(SensitiveWord.normalized_word == normalized_word)
                )
                existing_word = existing.scalar_one_or_none()
                
                if existing_word:
                    existing_word.category = row_category
                    existing_word.severity = row_severity
                    if description:
                        existing_word.description = description
                    if suggestion:
                        existing_word.suggestion = suggestion
                    updated += 1
                else:
                    new_word = SensitiveWord(
                        word=word,
                        normalized_word=normalized_word,
                        pinyin=pinyin,
                        category=row_category,
                        severity=row_severity,
                        description=description,
                        suggestion=suggestion
                    )
                    db.add(new_word)
                    added += 1
                
                await db.flush()
                
            except Exception as e:
                errors.append({
                    'row': row_num,
                    'word': word,
                    'error': str(e)
                })
                skipped += 1
        
        await db.commit()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
    
    return LexiconImportResult(
        success=True,
        total_processed=added + updated + skipped,
        added=added,
        updated=updated,
        skipped=skipped,
        errors=errors
    )


@router.post("/import/json", response_model=LexiconImportResult)
async def import_from_json(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传 JSON 文件")
    
    content = await file.read()
    
    try:
        data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"JSON 解析失败: {str(e)}")
    
    added = 0
    updated = 0
    skipped = 0
    errors = []
    
    words = data.get('words', []) if isinstance(data, dict) else data
    
    for idx, item in enumerate(words):
        if isinstance(item, str):
            word = item
            category = "other"
            severity = "medium"
            description = None
            suggestion = None
        elif isinstance(item, dict):
            word = item.get('word') or item.get('term')
            category = item.get('category', 'other')
            severity = item.get('severity', 'medium')
            description = item.get('description')
            suggestion = item.get('suggestion')
        else:
            skipped += 1
            continue
        
        if not word or not word.strip():
            skipped += 1
            continue
        
        word = word.strip()
        normalized_word = text_processor.normalize(word)
        pinyin = text_processor.to_pinyin(normalized_word)
        
        try:
            existing = await db.execute(
                select(SensitiveWord).where(SensitiveWord.normalized_word == normalized_word)
            )
            existing_word = existing.scalar_one_or_none()
            
            if existing_word:
                existing_word.category = category
                existing_word.severity = severity
                if description:
                    existing_word.description = description
                if suggestion:
                    existing_word.suggestion = suggestion
                updated += 1
            else:
                new_word = SensitiveWord(
                    word=word,
                    normalized_word=normalized_word,
                    pinyin=pinyin,
                    category=category,
                    severity=severity,
                    description=description,
                    suggestion=suggestion
                )
                db.add(new_word)
                added += 1
            
            await db.flush()
            
        except Exception as e:
            errors.append({
                'index': idx,
                'word': word,
                'error': str(e)
            })
            skipped += 1
    
    await db.commit()
    
    return LexiconImportResult(
        success=True,
        total_processed=added + updated + skipped,
        added=added,
        updated=updated,
        skipped=skipped,
        errors=errors
    )


@router.get("/versions", response_model=List[LexiconVersionResponse])
async def list_versions(
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(LexiconVersion).order_by(LexiconVersion.created_at.desc())
    )
    versions = result.scalars().all()
    
    return [LexiconVersionResponse.model_validate(v) for v in versions]


@router.post("/versions/create", response_model=LexiconVersionResponse)
async def create_version(
    description: Optional[str] = None,
    is_rollback_point: bool = False,
    db: AsyncSession = Depends(get_db)
):
    word_count = await db.execute(select(func.count(SensitiveWord.id)))
    word_count = word_count.scalar()
    
    synonym_count = await db.execute(select(func.count(Synonym.id)))
    synonym_count = synonym_count.scalar()
    
    whitelist_count = await db.execute(select(func.count(Whitelist.id)))
    whitelist_count = whitelist_count.scalar()
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    version = f"v{timestamp}"
    
    new_version = LexiconVersion(
        version=version,
        description=description,
        word_count=word_count,
        synonym_count=synonym_count,
        whitelist_count=whitelist_count,
        is_active=False,
        is_rollback_point=is_rollback_point
    )
    
    db.add(new_version)
    await db.commit()
    await db.refresh(new_version)
    
    return LexiconVersionResponse.model_validate(new_version)
