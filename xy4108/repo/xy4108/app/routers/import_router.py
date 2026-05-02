from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..database import get_db
from ..import_service import CSVImportService
from ..schemas import ImportResult

router = APIRouter(prefix="/import", tags=["数据导入"])


@router.post("/children", response_model=ImportResult)
def import_children(
    file: UploadFile = File(...),
    operator: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    content = file.file.read()
    return CSVImportService.import_children(
        db=db,
        csv_content=content,
        operator=operator
    )


@router.post("/menu", response_model=ImportResult)
def import_menu(
    file: UploadFile = File(...),
    operator: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    content = file.file.read()
    return CSVImportService.import_menu(
        db=db,
        csv_content=content,
        operator=operator
    )


@router.post("/ingredients", response_model=ImportResult)
def import_ingredients(
    file: UploadFile = File(...),
    operator: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    content = file.file.read()
    return CSVImportService.import_ingredients(
        db=db,
        csv_content=content,
        operator=operator
    )
