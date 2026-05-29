from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/export/{experiment_id}")
def export_report(experiment_id: int, db: Session = Depends(get_db)):
    data = report_service.export_experiment_report(db, experiment_id)
    if not data:
        from app.exceptions import AnomalyError
        raise AnomalyError(404, "not_found", f"实验 id={experiment_id} 不存在", suggestion="检查实验编号是否正确")
    return JSONResponse(content=data)
