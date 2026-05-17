from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Customer as CustomerModel
from schemas import Customer, CustomerCreate, CustomerUpdate, APIResponse

router = APIRouter()


@router.post("/", response_model=APIResponse)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    db_customer = CustomerModel(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return APIResponse(success=True, message="客户创建成功", data={"customer": Customer.model_validate(db_customer).model_dump()})


@router.get("/", response_model=List[Customer])
def list_customers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    customers = db.query(CustomerModel).offset(skip).limit(limit).all()
    return customers


@router.get("/{customer_id}", response_model=Customer)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    return customer


@router.put("/{customer_id}", response_model=APIResponse)
def update_customer(customer_id: int, customer: CustomerUpdate, db: Session = Depends(get_db)):
    db_customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    
    update_data = customer.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_customer, key, value)
    
    db.commit()
    db.refresh(db_customer)
    return APIResponse(success=True, message="客户更新成功", data={"customer": Customer.model_validate(db_customer).model_dump()})


@router.delete("/{customer_id}", response_model=APIResponse)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    db_customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    
    db_customer.is_active = False
    db.commit()
    return APIResponse(success=True, message="客户已禁用")
