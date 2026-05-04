from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from sqlalchemy import func

from ..database import get_db
from .. import models, schemas

router = APIRouter()

@router.get("/chapters", response_model=List[schemas.Chapter])
def get_chapters(db: Session = Depends(get_db)):
    chapters = db.query(models.Chapter).order_by(models.Chapter.chapter_number).all()
    result = []
    for chap in chapters:
        chap_data = schemas.Chapter.model_validate(chap)
        chap_data.panels = [
            schemas.Panel.model_validate(p) for p in chap.panels
        ]
        result.append(chap_data)
    return result

@router.get("/chapters/{chapter_id}", response_model=schemas.Chapter)
def get_chapter(chapter_id: int, db: Session = Depends(get_db)):
    chapter = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="章节不存在")
    return schemas.Chapter.model_validate(chapter)

@router.get("/panels", response_model=List[schemas.Panel])
def get_panels(
    chapter_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: Session = Depends(get_db)
):
    query = db.query(models.Panel)
    if chapter_id:
        query = query.filter(models.Panel.chapter_id == chapter_id)
    
    panels = query.order_by(
        models.Panel.chapter_id,
        models.Panel.panel_number
    ).offset(skip).limit(limit).all()
    
    return [schemas.Panel.model_validate(p) for p in panels]

@router.get("/panels/{panel_id}", response_model=schemas.Panel)
def get_panel(panel_id: int, db: Session = Depends(get_db)):
    panel = db.query(models.Panel).filter(models.Panel.id == panel_id).first()
    if not panel:
        raise HTTPException(status_code=404, detail="分镜格不存在")
    return schemas.Panel.model_validate(panel)

@router.get("/characters", response_model=List[schemas.Character])
def get_characters(db: Session = Depends(get_db)):
    characters = db.query(models.Character).all()
    return [schemas.Character.model_validate(c) for c in characters]

@router.get("/characters/{char_id}", response_model=schemas.Character)
def get_character(char_id: int, db: Session = Depends(get_db)):
    char = db.query(models.Character).filter(models.Character.id == char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="角色不存在")
    return schemas.Character.model_validate(char)

@router.get("/dialogues", response_model=List[schemas.Dialogue])
def get_dialogues(
    chapter_id: Optional[int] = Query(None),
    panel_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    db: Session = Depends(get_db)
):
    query = db.query(models.Dialogue)
    if chapter_id:
        query = query.filter(models.Dialogue.chapter_id == chapter_id)
    if panel_id:
        query = query.filter(models.Dialogue.panel_id == panel_id)
    
    dialogues = query.order_by(
        models.Dialogue.chapter_id,
        models.Dialogue.panel_number,
        models.Dialogue.id
    ).offset(skip).limit(limit).all()
    
    return [schemas.Dialogue.model_validate(d) for d in dialogues]

@router.delete("/clear-all", response_model=dict)
def clear_all_data(db: Session = Depends(get_db)):
    db.query(models.Review).delete()
    db.query(models.Issue).delete()
    db.query(models.Dialogue).delete()
    db.query(models.Panel).delete()
    db.query(models.Chapter).delete()
    db.query(models.Character).delete()
    db.commit()
    
    return {
        "success": True,
        "message": "所有数据已清除"
    }

@router.delete("/clear-issues", response_model=dict)
def clear_issues(db: Session = Depends(get_db)):
    db.query(models.Review).delete()
    db.query(models.Issue).delete()
    db.commit()
    
    return {
        "success": True,
        "message": "所有问题和复核记录已清除"
    }

@router.get("/overview", response_model=Dict[str, Any])
def get_overview(db: Session = Depends(get_db)):
    from sqlalchemy import func
    
    chapter_count = db.query(models.Chapter).count()
    panel_count = db.query(models.Panel).count()
    char_count = db.query(models.Character).count()
    dialogue_count = db.query(models.Dialogue).count()
    issue_count = db.query(models.Issue).count()
    
    issues_by_status = db.query(
        models.Issue.status,
        func.count(models.Issue.id)
    ).group_by(models.Issue.status).all()
    
    issues_by_category = db.query(
        models.Issue.category,
        func.count(models.Issue.id)
    ).group_by(models.Issue.category).all()
    
    return {
        "chapters": chapter_count,
        "panels": panel_count,
        "characters": char_count,
        "dialogues": dialogue_count,
        "issues": issue_count,
        "issues_by_status": {s.value: c for s, c in issues_by_status},
        "issues_by_category": {c.value: cnt for c, cnt in issues_by_category}
    }
