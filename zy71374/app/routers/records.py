from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.models import ClayRecord, Note, Report

router = APIRouter(tags=["records"])


class ClayCreate(BaseModel):
    experiment_id: int
    clay_type: str
    clay_origin: Optional[str] = None
    properties: Optional[dict] = None


class ClayOut(BaseModel):
    id: int
    experiment_id: int
    clay_type: str
    clay_origin: Optional[str]
    properties: Optional[dict]
    source: str

    class Config:
        from_attributes = True


class NoteCreate(BaseModel):
    experiment_id: int
    author: Optional[str] = None
    content: str


class NoteOut(BaseModel):
    id: int
    experiment_id: int
    author: Optional[str]
    content: str
    source: str

    class Config:
        from_attributes = True


class ReportCreate(BaseModel):
    experiment_id: int
    title: str
    content: dict


class ReportOut(BaseModel):
    id: int
    experiment_id: int
    title: str
    content: dict
    source: str

    class Config:
        from_attributes = True


clay_router = APIRouter(prefix="/clay", tags=["clay"])


@clay_router.post("", response_model=ClayOut)
def create_clay(body: ClayCreate, db: Session = Depends(get_db)):
    rec = ClayRecord(
        experiment_id=body.experiment_id,
        clay_type=body.clay_type,
        clay_origin=body.clay_origin,
        properties=body.properties,
        source="clay",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@clay_router.get("/experiment/{experiment_id}", response_model=list[ClayOut])
def list_clay(experiment_id: int, db: Session = Depends(get_db)):
    return db.query(ClayRecord).filter(ClayRecord.experiment_id == experiment_id).all()


note_router = APIRouter(prefix="/notes", tags=["notes"])


@note_router.post("", response_model=NoteOut)
def create_note(body: NoteCreate, db: Session = Depends(get_db)):
    rec = Note(
        experiment_id=body.experiment_id,
        author=body.author,
        content=body.content,
        source="note",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@note_router.get("/experiment/{experiment_id}", response_model=list[NoteOut])
def list_notes(experiment_id: int, db: Session = Depends(get_db)):
    return db.query(Note).filter(Note.experiment_id == experiment_id).order_by(Note.created_at).all()


report_router = APIRouter(prefix="/reports-raw", tags=["reports-raw"])


@report_router.post("", response_model=ReportOut)
def create_report(body: ReportCreate, db: Session = Depends(get_db)):
    rec = Report(
        experiment_id=body.experiment_id,
        title=body.title,
        content=body.content,
        source="report",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@report_router.get("/experiment/{experiment_id}", response_model=list[ReportOut])
def list_reports(experiment_id: int, db: Session = Depends(get_db)):
    return db.query(Report).filter(Report.experiment_id == experiment_id).order_by(Report.created_at).all()
