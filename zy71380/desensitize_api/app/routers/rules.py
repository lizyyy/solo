from __future__ import annotations

from fastapi import APIRouter, HTTPException
from app.models import RuleCreate, RuleResponse, RuleActivateResponse
from app.engine import rule_manager

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.post("", response_model=RuleResponse)
def create_rule(body: RuleCreate):
    existing = rule_manager.get_rule_by_version(body.version)
    if existing:
        raise HTTPException(status_code=409, detail=f"Rule version '{body.version}' already exists")
    data = body.model_dump()
    rule = rule_manager.create_rule(data)
    return rule


@router.get("", response_model=list[RuleResponse])
def list_rules():
    return rule_manager.list_rules()


@router.get("/active", response_model=RuleResponse)
def get_active_rule():
    rule = rule_manager.get_active_rule()
    if not rule:
        raise HTTPException(status_code=404, detail="No active rule found")
    return rule


@router.get("/{version}", response_model=RuleResponse)
def get_rule(version: str):
    rule = rule_manager.get_rule_by_version(version)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule version '{version}' not found")
    return rule


@router.post("/{version}/activate", response_model=RuleActivateResponse)
def activate_rule(version: str):
    rule = rule_manager.activate_rule(version)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule version '{version}' not found")
    return {
        "version": rule["version"],
        "is_active": rule["is_active"],
        "message": f"Rule version '{version}' activated successfully",
    }


@router.post("/{version}/rollback", response_model=RuleActivateResponse)
def rollback_rule(version: str):
    rule = rule_manager.rollback_rule(version)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule version '{version}' not found")
    return {
        "version": rule["version"],
        "is_active": rule["is_active"],
        "message": f"Rolled back to rule version '{version}'",
    }


@router.get("/{version}/chain", response_model=list[RuleResponse])
def get_version_chain(version: str):
    chain = rule_manager.get_version_chain(version)
    if not chain:
        raise HTTPException(status_code=404, detail=f"Rule version '{version}' not found")
    return chain
