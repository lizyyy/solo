from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.models import Machine, Product, Inventory, SalesForecast
from app.schemas.schemas import (
    MachineCreate, MachineResponse, ProductCreate, ProductResponse,
    InventoryCreate, InventoryResponse, SalesForecastCreate, SalesForecastResponse
)

router = APIRouter(prefix="/api/master", tags=["Master Data"])


@router.post("/machines", response_model=MachineResponse, status_code=201)
def create_machine(machine_data: MachineCreate, db: Session = Depends(get_db)):
    existing = db.query(Machine).filter(Machine.id == machine_data.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Machine {machine_data.id} already exists")
    
    machine = Machine(**machine_data.model_dump())
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


@router.get("/machines", response_model=List[MachineResponse])
def list_machines(db: Session = Depends(get_db)):
    return db.query(Machine).all()


@router.get("/machines/{machine_id}", response_model=MachineResponse)
def get_machine(machine_id: str, db: Session = Depends(get_db)):
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail=f"Machine {machine_id} not found")
    return machine


@router.post("/products", response_model=ProductResponse, status_code=201)
def create_product(product_data: ProductCreate, db: Session = Depends(get_db)):
    existing = db.query(Product).filter(Product.id == product_data.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Product {product_data.id} already exists")
    
    product = Product(**product_data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/products", response_model=List[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).all()


@router.post("/inventories", response_model=InventoryResponse, status_code=201)
def create_inventory(inv_data: InventoryCreate, db: Session = Depends(get_db)):
    inv = Inventory(**inv_data.model_dump())
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


@router.get("/inventories", response_model=List[InventoryResponse])
def list_inventories(machine_id: str = None, db: Session = Depends(get_db)):
    query = db.query(Inventory)
    if machine_id:
        query = query.filter(Inventory.machine_id == machine_id)
    return query.all()


@router.put("/inventories/{machine_id}/{product_id}", response_model=InventoryResponse)
def update_inventory(
    machine_id: str,
    product_id: str,
    quantity: int,
    db: Session = Depends(get_db)
):
    inv = db.query(Inventory).filter(
        Inventory.machine_id == machine_id,
        Inventory.product_id == product_id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory not found")
    
    inv.quantity = quantity
    db.commit()
    db.refresh(inv)
    return inv


@router.post("/forecasts", response_model=SalesForecastResponse, status_code=201)
def create_forecast(forecast_data: SalesForecastCreate, db: Session = Depends(get_db)):
    forecast = SalesForecast(**forecast_data.model_dump())
    db.add(forecast)
    db.commit()
    db.refresh(forecast)
    return forecast


@router.get("/forecasts", response_model=List[SalesForecastResponse])
def list_forecasts(machine_id: str = None, db: Session = Depends(get_db)):
    query = db.query(SalesForecast)
    if machine_id:
        query = query.filter(SalesForecast.machine_id == machine_id)
    return query.all()
