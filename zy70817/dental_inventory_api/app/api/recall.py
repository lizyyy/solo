from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.utils.database import get_db
from app.services.parser import MarkdownRecallParser
from app.models.recall import RecallNotice
from app.models.schemas import RecallNoticeCreate
from datetime import datetime

router = APIRouter()

@router.post("/upload")
async def upload_recall_notice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.md'):
        raise HTTPException(status_code=400, detail="仅支持Markdown文件")
    
    content = await file.read()
    content_str = content.decode('utf-8')
    
    try:
        notice_data = MarkdownRecallParser.parse(content_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Markdown解析失败: {str(e)}")
    
    notice = RecallNotice(
        title=notice_data['title'],
        notice_date=notice_data['notice_date'],
        issuer=notice_data['issuer'],
        affected_material=notice_data['affected_material'],
        affected_batches=notice_data['affected_batches'],
        reason=notice_data['reason'],
        level=notice_data['level']
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    
    return {"message": "召回公告已保存", "notice": notice}

@router.post("/")
async def create_recall_notice(
    notice: RecallNoticeCreate,
    db: Session = Depends(get_db)
):
    db_notice = RecallNotice(**notice.dict())
    db.add(db_notice)
    db.commit()
    db.refresh(db_notice)
    return db_notice

@router.get("/")
async def list_recall_notices(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(RecallNotice)
    if active_only:
        query = query.filter(RecallNotice.is_active == 1)
    notices = query.order_by(RecallNotice.notice_date.desc()).all()
    return {"notices": notices}

@router.put("/{notice_id}/deactivate")
async def deactivate_recall(
    notice_id: int,
    db: Session = Depends(get_db)
):
    notice = db.query(RecallNotice).filter(RecallNotice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="召回公告未找到")
    notice.is_active = 0
    db.commit()
    return {"message": "召回公告已停用"}
