from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import pandas as pd
from io import BytesIO
from datetime import datetime
from app.database import get_db
from app import crud, schemas

router = APIRouter(prefix="/export", tags=["导出管理"])


@router.get("/statistics", response_model=schemas.StatisticsResponse)
def get_statistics(db: Session = Depends(get_db)):
    return crud.get_statistics(db)


@router.get("/excel")
def export_to_excel(
    batch_id: Optional[int] = Query(None, description="批次ID，不传则导出所有"),
    db: Session = Depends(get_db)
):
    export_data = crud.get_export_data(db, batch_id=batch_id)
    
    df = pd.DataFrame(export_data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='返修归因数据')
    
    output.seek(0)
    
    filename = f"返修归因导出_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/data")
def export_json(
    batch_id: Optional[int] = Query(None, description="批次ID，不传则导出所有"),
    db: Session = Depends(get_db)
):
    export_data = crud.get_export_data(db, batch_id=batch_id)
    statistics = crud.get_statistics(db)
    
    return {
        "statistics": statistics,
        "data": export_data
    }
