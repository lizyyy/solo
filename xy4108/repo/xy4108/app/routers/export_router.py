from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Response
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..export_service import ExportService
from ..services import MealPlanningService
from ..models import AuditLog

router = APIRouter(prefix="/export", tags=["数据导出"])


@router.get("/children/csv")
def export_children_csv(db: Session = Depends(get_db)):
    csv_content = ExportService.export_children_csv(db)
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=children.csv"}
    )


@router.get("/menu/csv")
def export_menu_csv(
    menu_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    csv_content = ExportService.export_menu_csv(db, menu_date)
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=menu.csv"}
    )


@router.get("/ingredients/csv")
def export_ingredients_csv(db: Session = Depends(get_db)):
    csv_content = ExportService.export_ingredients_csv(db)
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=ingredients.csv"}
    )


@router.get("/substitutions/csv")
def export_substitutions_csv(db: Session = Depends(get_db)):
    csv_content = ExportService.export_substitutions_csv(db)
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=substitutions.csv"}
    )


@router.get("/meal-plan/markdown")
def export_meal_plan_markdown(
    plan_date: date,
    db: Session = Depends(get_db)
):
    meal_plan = MealPlanningService.generate_daily_meal_plan(
        db=db,
        plan_date=plan_date
    )
    md_content = ExportService.generate_meal_plan_markdown(meal_plan)
    return Response(
        content=md_content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=meal_plan_{plan_date}.md"}
    )


@router.get("/meal-plan/json")
def export_meal_plan_json(
    plan_date: date,
    db: Session = Depends(get_db)
):
    meal_plan = MealPlanningService.generate_daily_meal_plan(
        db=db,
        plan_date=plan_date
    )
    json_content = ExportService.to_json(meal_plan)
    return Response(
        content=json_content,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=meal_plan_{plan_date}.json"}
    )


@router.get("/block-list/markdown")
def export_block_list_markdown(
    block_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    block_list = MealPlanningService.get_block_list(
        db=db,
        block_date=block_date
    )
    md_content = ExportService.generate_block_list_markdown(block_list)
    filename = "block_list.md" if not block_date else f"block_list_{block_date}.md"
    return Response(
        content=md_content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/block-list/json")
def export_block_list_json(
    block_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    block_list = MealPlanningService.get_block_list(
        db=db,
        block_date=block_date
    )
    json_content = ExportService.to_json({"block_list": block_list})
    return Response(
        content=json_content,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=block_list.json"}
    )


@router.get("/audit-logs/markdown")
def export_audit_logs_markdown(
    limit: int = 100,
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    log_dicts = []
    for log in logs:
        log_dicts.append({
            "id": log.id,
            "action": log.action.value if log.action else "",
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details": log.details,
            "operator": log.operator,
            "timestamp": log.timestamp
        })
    
    md_content = ExportService.generate_audit_log_markdown(log_dicts)
    return Response(
        content=md_content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=audit_logs.md"}
    )


@router.get("/audit-logs/json")
def export_audit_logs_json(
    limit: int = 100,
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    log_dicts = []
    for log in logs:
        log_dicts.append({
            "id": log.id,
            "action": log.action.value if log.action else "",
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details": log.details,
            "operator": log.operator,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None
        })
    
    json_content = ExportService.to_json({"audit_logs": log_dicts})
    return Response(
        content=json_content,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=audit_logs.json"}
    )
