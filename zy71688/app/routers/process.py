from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    Appeal, AppealStatus, Deduction, Material, MaterialStatus,
    RuleMatch, Processing, Flag, FlagType,
)
from app.schemas import (
    ProcessingIn, ProcessingOut, RuleMatchIn, RuleMatchOut,
    FlagOut, MaterialOut,
)
from app.services.cleaner import check_rule_version, check_material_completeness

router = APIRouter(prefix="/process", tags=["处理"])

REQUIRED_MATERIAL_CATEGORIES = ["病案摘要", "扣款清单", "申诉材料"]


@router.post("/appeals/{appeal_id}/rule-match", response_model=list[RuleMatchOut])
def match_rules(appeal_id: int, matches: list[RuleMatchIn], db: Session = Depends(get_db)):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="申诉记录不存在")

    db.query(RuleMatch).filter(RuleMatch.appeal_id == appeal_id).delete()

    results = []
    for m in matches:
        rm = RuleMatch(appeal_id=appeal_id, **m.model_dump())
        db.add(rm)
        db.flush()

        if m.deduction_id:
            ded = db.query(Deduction).filter(Deduction.id == m.deduction_id).first()
            if ded and ded.rule_version and m.rule_version:
                if not check_rule_version(ded.rule_version, m.rule_version):
                    rm.is_version_latest = False
                    flag = Flag(
                        appeal_id=appeal_id,
                        flag_type=FlagType.RULE_VERSION_MISMATCH,
                        detail=f"扣款项{ded.item_name}(规则版本{ded.rule_version})与匹配规则版本{m.rule_version}不一致",
                    )
                    db.add(flag)

        results.append(rm)

    appeal.status = AppealStatus.PROCESSING
    db.commit()
    for r in results:
        db.refresh(r)
    return results


@router.get("/appeals/{appeal_id}/material-check", response_model=list[str])
def check_materials(appeal_id: int, db: Session = Depends(get_db)):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="申诉记录不存在")

    materials = db.query(Material).filter(Material.appeal_id == appeal_id).all()
    mat_dicts = [{"category": m.category, "status": m.status.value} for m in materials]
    missing = check_material_completeness(mat_dicts, REQUIRED_MATERIAL_CATEGORIES)

    if missing:
        existing = db.query(Flag).filter(
            Flag.appeal_id == appeal_id,
            Flag.flag_type == FlagType.MATERIAL_MISSING,
            Flag.is_resolved == False,
        ).first()
        if not existing:
            flag = Flag(
                appeal_id=appeal_id,
                flag_type=FlagType.MATERIAL_MISSING,
                detail=f"缺少必要材料: {', '.join(missing)}",
            )
            db.add(flag)
            db.commit()

    return missing


@router.put("/appeals/{appeal_id}/materials/{material_id}", response_model=MaterialOut)
def update_material_status(
    appeal_id: int, material_id: int, status: MaterialStatus, db: Session = Depends(get_db)
):
    mat = db.query(Material).filter(
        Material.id == material_id, Material.appeal_id == appeal_id
    ).first()
    if not mat:
        raise HTTPException(status_code=404, detail="材料记录不存在")

    mat.status = status
    if status == MaterialStatus.UPLOADED:
        mat.uploaded_at = datetime.utcnow()
    elif status == MaterialStatus.VERIFIED:
        mat.verified_at = datetime.utcnow()

    db.commit()
    db.refresh(mat)
    return mat


@router.post("/appeals/{appeal_id}/processing", response_model=ProcessingOut)
def submit_processing(appeal_id: int, data: ProcessingIn, db: Session = Depends(get_db)):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="申诉记录不存在")

    existing = db.query(Processing).filter(Processing.appeal_id == appeal_id).first()

    if existing:
        for field, new_val in data.model_dump(exclude_unset=True).items():
            old_val = getattr(existing, field)
            if old_val != new_val:
                from app.models.models import ChangeHistory
                change = ChangeHistory(
                    appeal_id=appeal_id,
                    field_name=f"processing.{field}",
                    old_value=str(old_val) if old_val is not None else None,
                    new_value=str(new_val) if new_val is not None else None,
                    changed_by=data.processed_by,
                    reason="处理阶段修改",
                )
                db.add(change)
                setattr(existing, field, new_val)
        existing.processed_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    proc = Processing(appeal_id=appeal_id, **data.model_dump())
    db.add(proc)

    unresolved = db.query(Flag).filter(
        Flag.appeal_id == appeal_id, Flag.is_resolved == False
    ).count()
    if unresolved > 0:
        flag = Flag(
            appeal_id=appeal_id,
            flag_type=FlagType.DATA_INCONSISTENCY,
            detail=f"处理时仍有{unresolved}条未解决标记，请确认后再提交复核",
        )
        db.add(flag)

    appeal.status = AppealStatus.REVIEW
    db.commit()
    db.refresh(proc)
    return proc


@router.get("/appeals/{appeal_id}/flags", response_model=list[FlagOut])
def get_flags(appeal_id: int, db: Session = Depends(get_db)):
    return db.query(Flag).filter(Flag.appeal_id == appeal_id).order_by(Flag.created_at.desc()).all()


@router.put("/appeals/{appeal_id}/flags/{flag_id}", response_model=FlagOut)
def resolve_flag(appeal_id: int, flag_id: int, db: Session = Depends(get_db)):
    flag = db.query(Flag).filter(Flag.id == flag_id, Flag.appeal_id == appeal_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="标记不存在")
    flag.is_resolved = True
    flag.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(flag)
    return flag
