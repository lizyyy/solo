from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from database import SessionLocal, engine, get_db
import models
import schemas
from services import ScoreService, AppealService, PenaltyService, ReportService
from exceptions import register_exception_handlers, NotFoundException

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="比赛成绩申诉处理系统",
    description="成绩申诉、处罚扣减、组别排名重算API",
    version="1.0.0"
)

register_exception_handlers(app)


@app.get("/")
def read_root():
    return {"message": "比赛成绩申诉处理系统 API", "version": "1.0.0"}


@app.post("/age-groups/", response_model=schemas.AgeGroup, tags=["组别管理"])
def create_age_group(age_group: schemas.AgeGroupCreate, db: Session = Depends(get_db)):
    db_age_group = models.AgeGroup(**age_group.model_dump())
    db.add(db_age_group)
    db.commit()
    db.refresh(db_age_group)
    return db_age_group


@app.get("/age-groups/", response_model=List[schemas.AgeGroup], tags=["组别管理"])
def read_age_groups(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    age_groups = db.query(models.AgeGroup).offset(skip).limit(limit).all()
    return age_groups


@app.post("/participants/", response_model=schemas.Participant, tags=["选手管理"])
def create_participant(participant: schemas.ParticipantCreate, db: Session = Depends(get_db)):
    db_participant = models.Participant(**participant.model_dump())
    db.add(db_participant)
    db.commit()
    db.refresh(db_participant)
    return db_participant


@app.get("/participants/", response_model=List[schemas.Participant], tags=["选手管理"])
def read_participants(
    age_group_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Participant)
    if age_group_id:
        query = query.filter(models.Participant.age_group_id == age_group_id)
    return query.offset(skip).limit(limit).all()


@app.post("/time-records/", response_model=schemas.TimeRecord, tags=["计时记录"])
def create_time_record(time_record: schemas.TimeRecordCreate, db: Session = Depends(get_db)):
    db_time_record = models.TimeRecord(**time_record.model_dump())
    db.add(db_time_record)
    db.commit()
    db.refresh(db_time_record)
    return db_time_record


@app.get("/time-records/{participant_id}", response_model=List[schemas.TimeRecord], tags=["计时记录"])
def read_time_records(participant_id: int, db: Session = Depends(get_db)):
    time_records = db.query(models.TimeRecord).filter(
        models.TimeRecord.participant_id == participant_id
    ).all()
    return time_records


@app.post("/penalties/", response_model=schemas.Penalty, tags=["处罚管理"])
def create_penalty(penalty: schemas.PenaltyCreate, db: Session = Depends(get_db)):
    return PenaltyService.add_penalty(db, penalty)


@app.post("/penalties/{penalty_id}/apply", response_model=schemas.Penalty, tags=["处罚管理"])
def apply_penalty(penalty_id: int, db: Session = Depends(get_db)):
    return PenaltyService.apply_penalty(db, penalty_id)


@app.get("/penalties/", response_model=List[schemas.Penalty], tags=["处罚管理"])
def read_penalties(
    participant_id: Optional[int] = None,
    applied: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Penalty)
    if participant_id:
        query = query.filter(models.Penalty.participant_id == participant_id)
    if applied is not None:
        query = query.filter(models.Penalty.applied == applied)
    return query.all()


@app.post("/appeals/", response_model=schemas.Appeal, tags=["申诉管理"])
def create_appeal(appeal: schemas.AppealCreate, db: Session = Depends(get_db)):
    return AppealService.create_appeal(db, appeal)


@app.get("/appeals/", response_model=List[schemas.Appeal], tags=["申诉管理"])
def read_appeals(
    status: Optional[str] = None,
    participant_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Appeal)
    if status:
        query = query.filter(models.Appeal.status == status)
    if participant_id:
        query = query.filter(models.Appeal.participant_id == participant_id)
    return query.all()


@app.post("/appeals/{appeal_id}/review", response_model=schemas.Appeal, tags=["申诉管理"])
def review_appeal(
    appeal_id: int,
    review_data: schemas.AppealReview,
    db: Session = Depends(get_db)
):
    return AppealService.review_appeal(db, appeal_id, review_data)


@app.post("/appeals/{appeal_id}/process", tags=["申诉管理"])
def process_appeal(appeal_id: int, db: Session = Depends(get_db)):
    return AppealService.process_appeal_decision(db, appeal_id)


@app.post("/scores/recalculate", response_model=List[schemas.Score], tags=["成绩管理"])
def recalculate_scores(
    request: schemas.RecalculateRequest,
    db: Session = Depends(get_db)
):
    scores = ScoreService.recalculate_scores(
        db,
        participant_ids=request.participant_ids,
        age_group_ids=request.age_group_ids,
        apply_penalties=request.apply_penalties
    )

    if request.update_ranks:
        ScoreService.update_ranks(db, age_group_ids=request.age_group_ids)

    db.commit()
    return scores


@app.post("/scores/update-ranks", tags=["成绩管理"])
def update_ranks(
    age_group_ids: Optional[List[int]] = None,
    db: Session = Depends(get_db)
):
    ScoreService.update_ranks(db, age_group_ids)
    db.commit()
    return {"message": "Ranks updated successfully"}


@app.get("/scores/", response_model=List[schemas.Score], tags=["成绩管理"])
def read_scores(
    age_group_id: Optional[int] = None,
    has_appeal: Optional[bool] = None,
    sort_by_rank: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(models.Score)
    if age_group_id:
        query = query.filter(models.Score.age_group_id == age_group_id)
    if has_appeal is not None:
        query = query.filter(models.Score.has_appeal == has_appeal)
    if sort_by_rank:
        query = query.order_by(models.Score.final_time_seconds)
    return query.all()


@app.get("/scores/{participant_id}", response_model=schemas.Score, tags=["成绩管理"])
def read_participant_score(participant_id: int, db: Session = Depends(get_db)):
    score = db.query(models.Score).filter(
        models.Score.participant_id == participant_id
    ).first()
    if not score:
        raise NotFoundException(
            message=f"No score found for participant {participant_id}",
            details={"participant_id": participant_id}
        )
    return score


@app.post("/reports/generate/{appeal_id}", tags=["报告导出"])
def generate_report(
    appeal_id: int,
    include_raw_data: bool = True,
    generated_by: str = "system",
    db: Session = Depends(get_db)
):
    report_content = ReportService.generate_review_report(
        db, appeal_id, include_raw_data
    )
    report = ReportService.save_report(
        db, appeal_id, report_content, generated_by, "json"
    )
    db.commit()
    db.refresh(report)
    return report


@app.get("/reports/{report_id}/export", tags=["报告导出"])
def export_report(report_id: int, format: str = "json", db: Session = Depends(get_db)):
    return ReportService.export_report(db, report_id, format)


@app.get("/reports/", tags=["报告导出"])
def list_reports(appeal_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.ReviewReport)
    if appeal_id:
        query = query.filter(models.ReviewReport.appeal_id == appeal_id)
    return query.all()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
