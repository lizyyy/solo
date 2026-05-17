from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app import crud, schemas
from app.database import get_db

router = APIRouter(
    prefix="/handlers",
    tags=["handlers"],
)


@router.post("/", response_model=schemas.Handler)
def create_handler(handler: schemas.HandlerCreate, db: Session = Depends(get_db)):
    return crud.create_handler(db=db, handler=handler)


@router.get("/", response_model=List[schemas.Handler])
def read_handlers(
    skip: int = 0,
    limit: int = 100,
    is_outsourcer: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    handlers = crud.get_handlers(db, skip=skip, limit=limit, is_outsourcer=is_outsourcer)
    return handlers


@router.get("/{handler_id}", response_model=schemas.Handler)
def read_handler(handler_id: int, db: Session = Depends(get_db)):
    db_handler = crud.get_handler(db, handler_id=handler_id)
    if db_handler is None:
        raise HTTPException(status_code=404, detail="Handler not found")
    return db_handler
