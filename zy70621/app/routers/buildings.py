from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import crud, schemas, models
from app.database import get_db

router = APIRouter(
    prefix="/buildings",
    tags=["buildings"],
)


@router.post("/", response_model=schemas.Building)
def create_building(building: schemas.BuildingCreate, db: Session = Depends(get_db)):
    return crud.create_building(db=db, building=building)


@router.get("/", response_model=List[schemas.Building])
def read_buildings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    buildings = crud.get_buildings(db, skip=skip, limit=limit)
    return buildings


@router.get("/{building_id}", response_model=schemas.Building)
def read_building(building_id: int, db: Session = Depends(get_db)):
    db_building = crud.get_building(db, building_id=building_id)
    if db_building is None:
        raise HTTPException(status_code=404, detail="Building not found")
    return db_building
