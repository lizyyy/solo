from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Depends, Query, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app.database import engine, Base, get_db
from app.models import AuthStatus
from app import schemas, crud

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="播客片头授权追踪服务",
    description="Podcast Intro Music Authorization Tracking Service",
    version="1.0.0",
)


# ── Shows ──

@app.post("/shows", response_model=schemas.ShowRead, status_code=201)
def create_show(data: schemas.ShowCreate, db: Session = Depends(get_db)):
    return crud.create_show(db, data)


@app.get("/shows", response_model=list[schemas.ShowRead])
def list_shows(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.list_shows(db, skip, limit)


@app.get("/shows/{show_id}", response_model=schemas.ShowRead)
def get_show(show_id: int, db: Session = Depends(get_db)):
    return crud.get_show(db, show_id)


# ── Intro Music ──

@app.post("/intro-musics", response_model=schemas.IntroMusicRead, status_code=201)
def create_intro_music(data: schemas.IntroMusicCreate, db: Session = Depends(get_db)):
    return crud.create_intro_music(db, data)


@app.get("/intro-musics", response_model=list[schemas.IntroMusicRead])
def list_intro_musics(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.list_intro_musics(db, skip, limit)


@app.get("/intro-musics/{music_id}", response_model=schemas.IntroMusicRead)
def get_intro_music(music_id: int, db: Session = Depends(get_db)):
    return crud.get_intro_music(db, music_id)


@app.post("/intro-musics/{music_id}/file-versions", response_model=schemas.FileVersionRead, status_code=201)
def add_file_version(music_id: int, data: schemas.FileVersionCreate, db: Session = Depends(get_db)):
    return crud.add_file_version(db, music_id, data)


@app.get("/intro-musics/{music_id}/file-versions", response_model=list[schemas.FileVersionRead])
def list_file_versions(music_id: int, db: Session = Depends(get_db)):
    return crud.get_file_versions(db, music_id)


# ── Auth Contracts ──

@app.post("/contracts", response_model=schemas.AuthContractRead, status_code=201)
def create_contract(
    data: schemas.AuthContractCreate,
    operator: str = Query(..., description="creator"),
    db: Session = Depends(get_db),
):
    return crud.create_contract(db, data, operator)


# ── Categorized Views (MUST be before /contracts/{contract_id}) ──

@app.get("/views/confirmed", response_model=list[schemas.ContractAggregateRead])
def list_confirmed_contracts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.list_contracts_aggregate(db, status=AuthStatus.CONFIRMED, skip=skip, limit=limit)


@app.get("/views/pending", response_model=list[schemas.ContractAggregateRead])
def list_pending_contracts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.list_contracts_aggregate(db, status=AuthStatus.PENDING, skip=skip, limit=limit)


@app.get("/views/returned", response_model=list[schemas.ContractAggregateRead])
def list_returned_contracts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.list_contracts_aggregate(db, status=AuthStatus.RETURNED, skip=skip, limit=limit)


# ── Aggregate Views ──

@app.get("/contracts-aggregate", response_model=list[schemas.ContractAggregateRead])
def list_contracts_aggregate(
    status: Optional[AuthStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return crud.list_contracts_aggregate(db, status=status, skip=skip, limit=limit)


# ── Export ──

@app.get("/contracts/export", response_class=PlainTextResponse)
def export_contracts(status: Optional[AuthStatus] = None, db: Session = Depends(get_db)):
    csv_content = crud.export_contracts_csv(db, status=status)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=podcast_intro_auth_export.csv"},
    )


# ── Contract detail routes ──

@app.get("/contracts", response_model=list[schemas.AuthContractRead])
def list_contracts(
    status: Optional[AuthStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return crud.list_contracts(db, status=status, skip=skip, limit=limit)


@app.get("/contracts/{contract_id}", response_model=schemas.AuthContractRead)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    return crud.get_contract(db, contract_id)


@app.get("/contracts/{contract_id}/aggregate", response_model=schemas.ContractAggregateRead)
def get_contract_aggregate(contract_id: int, db: Session = Depends(get_db)):
    return crud.get_contract_aggregate(db, contract_id)


# ── Status Transition ──

@app.post("/contracts/{contract_id}/transition", response_model=schemas.AuthContractRead)
def transition_status(
    contract_id: int,
    req: schemas.StatusTransitionRequest,
    db: Session = Depends(get_db),
):
    return crud.transition_status(db, contract_id, req)


# ── Episode Usage ──

@app.post("/contracts/{contract_id}/episodes", response_model=schemas.EpisodeUsageRead, status_code=201)
def add_episode_usage(
    contract_id: int,
    data: schemas.EpisodeUsageCreate,
    operator: str = Query(..., description="operator"),
    db: Session = Depends(get_db),
):
    return crud.add_episode_usage(db, contract_id, data, operator)


@app.get("/contracts/{contract_id}/episodes", response_model=list[schemas.EpisodeUsageRead])
def list_episode_usages(contract_id: int, db: Session = Depends(get_db)):
    return crud.get_episode_usages(db, contract_id)


# ── Audit Logs ──

@app.get("/contracts/{contract_id}/audit-logs", response_model=list[schemas.AuditLogRead])
def get_contract_audit_logs(contract_id: int, db: Session = Depends(get_db)):
    return crud.get_contract_audit_logs(db, contract_id)


# ── Health ──

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
