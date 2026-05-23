from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import QuoteCreate, QuoteResponse
from services import create_quote, freeze_quote, log_exception, get_device_by_serial
from models import Quote

router = APIRouter()


@router.post("/", response_model=QuoteResponse)
def create_new_quote(quote: QuoteCreate, db: Session = Depends(get_db)):
    try:
        return create_quote(db, quote)
    except ValueError as e:
        log_exception(db, quote.serial_number, "/quotes/", quote.model_dump(), str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_exception(db, quote.serial_number, "/quotes/", quote.model_dump(), str(e))
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.post("/{quote_id}/freeze", response_model=QuoteResponse)
def freeze_quote_endpoint(quote_id: int, db: Session = Depends(get_db)):
    try:
        return freeze_quote(db, quote_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[QuoteResponse])
def list_quotes(serial_number: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Quote)
    if serial_number:
        device = get_device_by_serial(db, serial_number)
        if device:
            query = query.filter(Quote.device_id == device.id)
    return query.offset(skip).limit(limit).all()
