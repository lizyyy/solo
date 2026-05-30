import csv
import io
from datetime import date, datetime
from typing import Optional
from fastapi import Depends
from sqlalchemy.orm import Session, joinedload
from app import models, schemas
from app.database import get_db
from app.exceptions import (
    AuthorizationExpiredError,
    EpisodeOveruseError,
    InvalidStatusTransitionError,
    FileVersionMismatchError,
    ContractNotConfirmedError,
    EntityNotFoundError,
    DuplicateEpisodeError,
)
from app.state_machine import is_valid_transition


def _get_or_404(db: Session, model, entity_id: int, name: str):
    obj = db.query(model).filter(model.id == entity_id).first()
    if not obj:
        raise EntityNotFoundError(name, entity_id)
    return obj


# ── Show CRUD ──

def create_show(db: Session, data: schemas.ShowCreate) -> models.Show:
    show = models.Show(**data.model_dump())
    db.add(show)
    db.commit()
    db.refresh(show)
    return show


def get_show(db: Session, show_id: int) -> models.Show:
    return _get_or_404(db, models.Show, show_id, "Show")


def list_shows(db: Session, skip: int = 0, limit: int = 100) -> list[models.Show]:
    return db.query(models.Show).offset(skip).limit(limit).all()


# ── IntroMusic CRUD ──

def create_intro_music(db: Session, data: schemas.IntroMusicCreate) -> models.IntroMusic:
    music = models.IntroMusic(**data.model_dump())
    db.add(music)
    db.commit()
    db.refresh(music)
    fv = models.FileVersion(
        intro_music_id=music.id,
        version=music.current_version,
        file_path=f"/music/{music.id}/{music.current_version}.mp3",
        file_hash=f"sha256:placeholder_{music.id}_{music.current_version}",
        is_active=True,
    )
    db.add(fv)
    db.commit()
    db.refresh(music)
    return music


def get_intro_music(db: Session, music_id: int) -> models.IntroMusic:
    return _get_or_404(db, models.IntroMusic, music_id, "IntroMusic")


def list_intro_musics(db: Session, skip: int = 0, limit: int = 100) -> list[models.IntroMusic]:
    return db.query(models.IntroMusic).offset(skip).limit(limit).all()


def add_file_version(db: Session, music_id: int, data: schemas.FileVersionCreate) -> models.FileVersion:
    music = get_intro_music(db, music_id)
    for fv in music.file_versions:
        fv.is_active = False
    fv = models.FileVersion(
        intro_music_id=music_id,
        is_active=True,
        **data.model_dump(),
    )
    db.add(fv)
    music.current_version = data.version
    db.commit()
    db.refresh(fv)
    return fv


# ── AuthContract CRUD ──

def create_contract(db: Session, data: schemas.AuthContractCreate, operator: str) -> models.AuthContract:
    show = _get_or_404(db, models.Show, data.show_id, "Show")
    music = _get_or_404(db, models.IntroMusic, data.intro_music_id, "IntroMusic")
    if data.auth_end_date < data.auth_start_date:
        raise ValueError("auth_end_date must be after auth_start_date")
    contract = models.AuthContract(
        **data.model_dump(),
        status=models.AuthStatus.PENDING,
        used_episode_count=0,
        locked_file_version=music.current_version,
    )
    db.add(contract)
    db.flush()
    log = models.AuditLog(
        contract_id=contract.id,
        action="CONTRACT_CREATED",
        from_status=None,
        to_status=models.AuthStatus.PENDING.value,
        reason="New authorization contract created",
        operator=operator,
        detail=f"Show: {show.name}, Music: {music.title}, Episodes: {data.authorized_episode_count}",
    )
    db.add(log)
    db.commit()
    db.refresh(contract)
    return contract


def get_contract(db: Session, contract_id: int) -> models.AuthContract:
    return _get_or_404(db, models.AuthContract, contract_id, "AuthContract")


def list_contracts(
    db: Session,
    status: Optional[models.AuthStatus] = None,
    skip: int = 0,
    limit: int = 100,
) -> list[models.AuthContract]:
    q = db.query(models.AuthContract)
    if status:
        q = q.filter(models.AuthContract.status == status)
    return q.offset(skip).limit(limit).all()


# ── Status Transition ──

def transition_status(
    db: Session, contract_id: int, req: schemas.StatusTransitionRequest
) -> models.AuthContract:
    contract = get_contract(db, contract_id)
    if not is_valid_transition(contract.status, req.to_status):
        raise InvalidStatusTransitionError(contract_id, contract.status.value, req.to_status.value)
    from_status = contract.status
    contract.status = req.to_status
    if req.to_status == models.AuthStatus.CONFIRMED:
        music = get_intro_music(db, contract.intro_music_id)
        contract.locked_file_version = music.current_version
    log = models.AuditLog(
        contract_id=contract_id,
        action="STATUS_TRANSITION",
        from_status=from_status.value,
        to_status=req.to_status.value,
        reason=req.reason,
        operator=req.operator,
        detail=req.detail,
    )
    db.add(log)
    db.commit()
    db.refresh(contract)
    return contract


# ── Episode Usage ──

def add_episode_usage(
    db: Session, contract_id: int, data: schemas.EpisodeUsageCreate, operator: str
) -> models.EpisodeUsage:
    contract = get_contract(db, contract_id)
    if contract.status != models.AuthStatus.CONFIRMED:
        raise ContractNotConfirmedError(contract_id, contract.status.value)
    today = date.today()
    if today > contract.auth_end_date:
        raise AuthorizationExpiredError(contract_id, str(contract.auth_end_date))
    if contract.used_episode_count >= contract.authorized_episode_count:
        raise EpisodeOveruseError(contract_id, contract.authorized_episode_count, contract.used_episode_count)
    existing = (
        db.query(models.EpisodeUsage)
        .filter(
            models.EpisodeUsage.contract_id == contract_id,
            models.EpisodeUsage.episode_number == data.episode_number,
        )
        .first()
    )
    if existing:
        raise DuplicateEpisodeError(contract_id, data.episode_number)
    music = get_intro_music(db, contract.intro_music_id)
    if contract.locked_file_version and contract.locked_file_version != music.current_version:
        raise FileVersionMismatchError(contract_id, contract.locked_file_version, music.current_version)
    usage = models.EpisodeUsage(
        contract_id=contract_id,
        episode_number=data.episode_number,
        episode_title=data.episode_title,
        file_version_used=contract.locked_file_version or music.current_version,
    )
    db.add(usage)
    contract.used_episode_count += 1
    log = models.AuditLog(
        contract_id=contract_id,
        action="EPISODE_USAGE_ADDED",
        from_status=contract.status.value,
        to_status=contract.status.value,
        reason=f"Episode {data.episode_number}: {data.episode_title} registered",
        operator=operator,
        detail=f"File version: {usage.file_version_used}, Running total: {contract.used_episode_count}/{contract.authorized_episode_count}",
    )
    db.add(log)
    db.commit()
    db.refresh(usage)
    return usage


# ── Aggregate Query ──

def get_contract_aggregate(db: Session, contract_id: int) -> schemas.ContractAggregateRead:
    contract = (
        db.query(models.AuthContract)
        .options(joinedload(models.AuthContract.show), joinedload(models.AuthContract.intro_music))
        .filter(models.AuthContract.id == contract_id)
        .first()
    )
    if not contract:
        raise EntityNotFoundError("AuthContract", contract_id)
    today = date.today()
    is_expired = today > contract.auth_end_date
    current_version = contract.intro_music.current_version
    file_version_mismatch = bool(
        contract.locked_file_version and contract.locked_file_version != current_version
    )
    return schemas.ContractAggregateRead(
        contract_id=contract.id,
        contract_ref=contract.contract_ref,
        status=contract.status,
        show=schemas.ShowBrief.model_validate(contract.show),
        intro_music=schemas.IntroMusicBrief.model_validate(contract.intro_music),
        authorized_episode_count=contract.authorized_episode_count,
        used_episode_count=contract.used_episode_count,
        remaining_episodes=contract.authorized_episode_count - contract.used_episode_count,
        auth_start_date=contract.auth_start_date,
        auth_end_date=contract.auth_end_date,
        is_expired=is_expired,
        locked_file_version=contract.locked_file_version,
        current_file_version=current_version,
        file_version_mismatch=file_version_mismatch,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
    )


def list_contracts_aggregate(
    db: Session,
    status: Optional[models.AuthStatus] = None,
    skip: int = 0,
    limit: int = 100,
) -> list[schemas.ContractAggregateRead]:
    contracts = list_contracts(db, status=status, skip=skip, limit=limit)
    return [get_contract_aggregate(db, c.id) for c in contracts]


# ── Export ──

def export_contracts_csv(db: Session, status: Optional[models.AuthStatus] = None) -> str:
    records = list_contracts_aggregate(db, status=status, skip=0, limit=10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "contract_id", "contract_ref", "status",
        "show_id", "show_name", "show_producer",
        "music_id", "music_title", "music_artist", "music_current_version",
        "authorized_episodes", "used_episodes", "remaining_episodes",
        "auth_start_date", "auth_end_date", "is_expired",
        "locked_file_version", "current_file_version", "file_version_mismatch",
        "created_at", "updated_at",
    ])
    for r in records:
        writer.writerow([
            r.contract_id, r.contract_ref, r.status.value,
            r.show.id, r.show.name, r.show.producer,
            r.intro_music.id, r.intro_music.title, r.intro_music.artist, r.intro_music.current_version,
            r.authorized_episode_count, r.used_episode_count, r.remaining_episodes,
            r.auth_start_date, r.auth_end_date, r.is_expired,
            r.locked_file_version, r.current_file_version, r.file_version_mismatch,
            r.created_at.isoformat(), r.updated_at.isoformat(),
        ])
    return output.getvalue()


# ── Audit Log ──

def get_contract_audit_logs(db: Session, contract_id: int) -> list[models.AuditLog]:
    _get_or_404(db, models.AuthContract, contract_id, "AuthContract")
    return (
        db.query(models.AuditLog)
        .filter(models.AuditLog.contract_id == contract_id)
        .order_by(models.AuditLog.created_at.desc())
        .all()
    )


def get_episode_usages(db: Session, contract_id: int) -> list[models.EpisodeUsage]:
    _get_or_404(db, models.AuthContract, contract_id, "AuthContract")
    return (
        db.query(models.EpisodeUsage)
        .filter(models.EpisodeUsage.contract_id == contract_id)
        .order_by(models.EpisodeUsage.used_at.desc())
        .all()
    )


def get_file_versions(db: Session, music_id: int) -> list[models.FileVersion]:
    _get_or_404(db, models.IntroMusic, music_id, "IntroMusic")
    return (
        db.query(models.FileVersion)
        .filter(models.FileVersion.intro_music_id == music_id)
        .order_by(models.FileVersion.created_at.desc())
        .all()
    )
