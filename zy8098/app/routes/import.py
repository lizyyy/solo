from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from .. import schemas, crud, services
from ..database import get_db

router = APIRouter(prefix="/api/import", tags=["import"])


@router.post("/meals", response_model=List[schemas.Meal])
async def import_meals(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        meals = services.ImportService.import_meals(db, content.decode("utf-8"))
        return meals
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@router.post("/sample-events")
async def import_sample_events(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        events = services.ImportService.import_sample_events(db, content.decode("utf-8"))
        return {"imported": len(events)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@router.post("/fridge-rules", response_model=List[schemas.FridgeRule])
async def import_fridge_rules(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        rules = services.ImportService.import_fridge_rules(db, content.decode("utf-8"))
        return rules
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@router.post("/meals/text", response_model=List[schemas.Meal])
def import_meals_text(content: str, db: Session = Depends(get_db)):
    try:
        meals = services.ImportService.import_meals(db, content)
        return meals
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@router.post("/sample-events/text")
def import_sample_events_text(content: str, db: Session = Depends(get_db)):
    try:
        events = services.ImportService.import_sample_events(db, content)
        return {"imported": len(events)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@router.post("/fridge-rules/text", response_model=List[schemas.FridgeRule])
def import_fridge_rules_text(content: str, db: Session = Depends(get_db)):
    try:
        rules = services.ImportService.import_fridge_rules(db, content)
        return rules
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")
