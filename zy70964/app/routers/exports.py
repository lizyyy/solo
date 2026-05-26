from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import QueryRequest
from app import services

router = APIRouter(prefix="/api/v1/exports", tags=["exports"])


@router.post("/items/csv")
def export_items_csv(req: QueryRequest, db: Session = Depends(get_db)):
    csv_text = services.export_items_csv(db, req)
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=qc_items.csv"},
    )


@router.get("/items/{item_id}/trace/csv")
def export_item_trace_csv(item_id: int, db: Session = Depends(get_db)):
    try:
        csv_text = services.export_trace_csv(db, item_id)
    except LookupError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=trace_{item_id}.csv"},
    )
