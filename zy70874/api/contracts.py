from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import FilmContract
from schemas import FilmContractCreate, FilmContractResponse

router = APIRouter()


@router.post("/", response_model=FilmContractResponse)
def create_contract(
    contract: FilmContractCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(FilmContract).filter(
        FilmContract.film_code == contract.film_code
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"影片代码 {contract.film_code} 的合同已存在")
    
    db_contract = FilmContract(**contract.model_dump())
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return db_contract


@router.get("/", response_model=List[FilmContractResponse])
def get_contracts(
    film_code: str = None,
    is_active: bool = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(FilmContract)
    if film_code:
        query = query.filter(FilmContract.film_code == film_code)
    if is_active is not None:
        query = query.filter(FilmContract.is_active == is_active)
    return query.offset(skip).limit(limit).all()


@router.get("/{contract_id}", response_model=FilmContractResponse)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(FilmContract).filter(FilmContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    return contract


@router.put("/{contract_id}", response_model=FilmContractResponse)
def update_contract(
    contract_id: int,
    contract_update: FilmContractCreate,
    db: Session = Depends(get_db)
):
    contract = db.query(FilmContract).filter(FilmContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    
    for key, value in contract_update.model_dump().items():
        setattr(contract, key, value)
    
    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/{contract_id}")
def deactivate_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(FilmContract).filter(FilmContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    
    contract.is_active = False
    db.commit()
    return {"message": "合同已停用"}
