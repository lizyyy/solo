from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import SelfCheckResultResponse
from services.self_check_service import (
    run_all_self_checks, get_latest_check_results,
    check_duplicate_imports, check_manual_judgment_overridden,
    check_supplement_recalculation, check_export_consistency
)

router = APIRouter(prefix="/api/self-check", tags=["自检模块"])


@router.post("/run-all")
def run_all_checks(operator: str = "system", db: Session = Depends(get_db)):
    results = run_all_self_checks(db, operator)
    return {
        "code": 0,
        "message": "自检完成",
        "data": {
            "total_checks": len(results),
            "passed": sum(1 for r in results if r.status == "passed"),
            "warnings": sum(1 for r in results if r.status == "warning"),
            "total_issues": sum(r.issues_found for r in results),
            "details": [
                {
                    "id": r.id,
                    "check_type": r.check_type,
                    "check_name": r.check_name,
                    "status": r.status,
                    "issues_found": r.issues_found,
                    "details": r.details
                }
                for r in results
            ]
        }
    }


@router.get("/latest", response_model=List[SelfCheckResultResponse])
def get_latest(db: Session = Depends(get_db)):
    return get_latest_check_results(db)


@router.post("/duplicate-imports")
def check_duplicates(operator: str = "system", db: Session = Depends(get_db)):
    result = check_duplicate_imports(db, operator)
    return {
        "code": 0,
        "message": "重复导入检测完成",
        "data": {
            "check_name": result.check_name,
            "status": result.status,
            "issues_found": result.issues_found,
            "details": result.details
        }
    }


@router.post("/manual-judgment-overridden")
def check_overridden(operator: str = "system", db: Session = Depends(get_db)):
    result = check_manual_judgment_overridden(db, operator)
    return {
        "code": 0,
        "message": "人工改判被覆盖检测完成",
        "data": {
            "check_name": result.check_name,
            "status": result.status,
            "issues_found": result.issues_found,
            "details": result.details
        }
    }


@router.post("/supplement-recalculation")
def check_recalculation(operator: str = "system", db: Session = Depends(get_db)):
    result = check_supplement_recalculation(db, operator)
    return {
        "code": 0,
        "message": "补录后重算一致性检测完成",
        "data": {
            "check_name": result.check_name,
            "status": result.status,
            "issues_found": result.issues_found,
            "details": result.details
        }
    }


@router.post("/export-consistency")
def check_consistency(operator: str = "system", db: Session = Depends(get_db)):
    result = check_export_consistency(db, operator)
    return {
        "code": 0,
        "message": "导出一致性校验完成",
        "data": {
            "check_name": result.check_name,
            "status": result.status,
            "issues_found": result.issues_found,
            "details": result.details
        }
    }
