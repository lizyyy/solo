from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import engine, get_db, Base
from app import models, schemas, crud
from app.routers import router as orders_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="物业催办外包派单完工复核后端API",
    description="小区物业报修管理系统，支持工单创建、催办、外包派单、完工复核",
    version="1.0.0"
)

app.include_router(orders_router)


@app.get("/")
def root():
    return {
        "message": "物业报修管理系统API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/api/handlers/", response_model=schemas.Handler)
def create_handler(handler: schemas.HandlerCreate, db: Session = Depends(get_db)):
    return crud.create_handler(db, handler)


@app.get("/api/handlers/", response_model=list[schemas.Handler])
def list_handlers(is_outsource: bool = None, db: Session = Depends(get_db)):
    q = db.query(models.Handler)
    if is_outsource is not None:
        q = q.filter(models.Handler.is_outsource == is_outsource)
    return q.all()


@app.get("/api/building-rooms/", response_model=list[schemas.BuildingRoom])
def list_building_rooms(building: str = None, db: Session = Depends(get_db)):
    q = db.query(models.BuildingRoom)
    if building:
        q = q.filter(models.BuildingRoom.building == building)
    return q.all()