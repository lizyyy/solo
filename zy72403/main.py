from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from models import init_db, SessionLocal, ArchiveRecord
from services import (
    import_sign_in_photos_batch,
    add_ticket_export_to_annotation,
    update_archive_remark,
    run_transposition_calc,
    review_song_name,
    get_archive_detail_for_display,
    generate_weekly_report
)

app = FastAPI(title="乐谱转调批注归档系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class PhotoImportItem(BaseModel):
    file_name: str
    file_path: str = ""
    file_hash: Optional[str] = None
    course_name: str = ""
    teacher_name: str = ""
    sign_date: Optional[datetime] = None
    song_live_name: str = ""
    extracted_text: str = ""
    remark: str = ""


class PhotoImportRequest(BaseModel):
    photos: List[PhotoImportItem]
    operator: str = "老周"


class TicketExportRequest(BaseModel):
    annotation_id: int
    file_name: str = ""
    file_path: str = ""
    song_copyright_name: str = ""
    revenue_amount: str = ""
    performance_date: Optional[datetime] = None
    operator: str = "老周"


class RemarkUpdateRequest(BaseModel):
    archive_id: int
    new_remark: str
    operator: str = "老周"


class TranspositionCalcRequest(BaseModel):
    annotation_id: int
    original_key: str
    target_key: str
    operator: str = "音乐老师"


class SongReviewRequest(BaseModel):
    song_id: int
    approved: bool
    reviewer: str = "音乐老师"
    review_note: str = ""


@app.on_event("startup")
def startup():
    init_db()


@app.post("/api/photos/import", summary="批量导入课时签到照片")
def api_import_photos(req: PhotoImportRequest, db: Session = Depends(get_db)):
    photos_data = [p.model_dump() for p in req.photos]
    result = import_sign_in_photos_batch(db, photos_data, req.operator)
    return result


@app.post("/api/tickets/add", summary="为批注补充票务导出表信息")
def api_add_ticket(req: TicketExportRequest, db: Session = Depends(get_db)):
    result = add_ticket_export_to_annotation(
        db, req.annotation_id, req.model_dump(), req.operator
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.post("/api/archives/remark", summary="更新归档备注并记录变更历史")
def api_update_remark(req: RemarkUpdateRequest, db: Session = Depends(get_db)):
    result = update_archive_remark(db, req.archive_id, req.new_remark, req.operator)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.post("/api/calc/transposition", summary="执行转调计算（带参数版本说明）")
def api_calc_transposition(req: TranspositionCalcRequest, db: Session = Depends(get_db)):
    result = run_transposition_calc(db, req.annotation_id, req.original_key, req.target_key, req.operator)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/api/songs/review", summary="音乐老师复核歌曲名称（现场名/版权名）")
def api_review_song(req: SongReviewRequest, db: Session = Depends(get_db)):
    result = review_song_name(db, req.song_id, req.approved, req.reviewer, req.review_note)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/api/archives/{archive_id}", summary="获取归档详情（支持3D/图表模式，可追溯数据源）")
def api_get_archive(
    archive_id: int,
    display_mode: str = "list",
    db: Session = Depends(get_db)
):
    result = get_archive_detail_for_display(db, archive_id, display_mode)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/api/archives", summary="归档列表")
def api_list_archives(db: Session = Depends(get_db)):
    archives = db.query(ArchiveRecord).order_by(ArchiveRecord.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "archive_no": a.archive_no,
            "keep_reason": a.keep_reason,
            "next_action": a.next_action,
            "next_action_owner": a.next_action_owner,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in archives
    ]


@app.get("/api/reports/weekly", summary="生成本周人性化周报")
def api_weekly_report(
    week_start: Optional[datetime] = None,
    week_end: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    result = generate_weekly_report(db, week_start, week_end)
    return result


@app.get("/", summary="系统说明")
def root():
    return {
        "name": "乐谱转调批注归档系统",
        "features": [
            "✅ 防重复导入：基于文件哈希，重复照片自动跳过",
            "✅ 变更历史：备注修改自动记录改前改后",
            "✅ 三步工作流：签到导入→票务补录→周报生成",
            "✅ 同名复核：现场名≠版权名时自动留待音乐老师复核",
            "✅ 人性化周报：说明保留原因、缺失材料、下一步找谁",
            "✅ 参数透明：转调计算附带参数版本和取舍理由",
            "✅ 可追溯展示：3D/图表模式可点击回溯源照片和票务表"
        ],
        "workflow": {
            "Step 1": "老周导入课时签到照片 → 自动创建归档记录",
            "Step 2": "老周补看票务导出表 → 如现场名≠版权名则转交音乐老师",
            "Step 3": "音乐老师复核转调 → 系统生成店长周报"
        }
    }
