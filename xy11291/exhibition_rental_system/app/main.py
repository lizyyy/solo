from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db, engine
from app.models import Base
from app import crud, schemas
from app.audit import DataMasker

Base.metadata.create_all(bind=engine)

app = FastAPI(title="会展设备租赁管理系统", version="1.0.0")


def serialize_validation(validation):
    if not validation:
        return None
    return {
        "passed": validation["passed"],
        "results": [
            {
                "passed": r.passed,
                "rule_name": r.rule_name,
                "message": r.message,
                "details": r.details
            } for r in validation["results"]
        ],
        "failed_rules": [
            {
                "passed": r.passed,
                "rule_name": r.rule_name,
                "message": r.message,
                "details": r.details
            } for r in validation["failed_rules"]
        ]
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"服务器内部错误: {str(exc)}"}
    )


@app.get("/")
def root():
    return {"message": "会展设备租赁管理系统 API", "version": "1.0.0"}


@app.post("/booths/", response_model=schemas.BoothResponse)
def create_booth(booth: schemas.BoothCreate, db: Session = Depends(get_db)):
    return crud.create_booth(db=db, booth=booth)


@app.get("/booths/", response_model=List[schemas.BoothSafeResponse])
def read_booths(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    booths = crud.get_booths(db, skip=skip, limit=limit)
    return booths


@app.post("/equipment/", response_model=schemas.EquipmentResponse)
def create_equipment(equipment: schemas.EquipmentCreate, db: Session = Depends(get_db)):
    return crud.create_equipment(db=db, equipment=equipment)


@app.get("/equipment/", response_model=List[schemas.EquipmentResponse])
def read_equipment(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    equipment = crud.get_equipment(db, skip=skip, limit=limit)
    return equipment


@app.post("/rentals/")
def create_rental(rental: schemas.RentalCreate, request: Request, db: Session = Depends(get_db)):
    result = crud.create_rental(
        db=db,
        rental=rental,
        operator_id=1,
        ip_address=request.client.host if request.client else None
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail={
            "reason": result["reason"],
            "validation": serialize_validation(result["validation"])
        })
    
    return {
        "success": True,
        "rental": schemas.RentalResponse.from_orm(result["rental"]),
        "validation": serialize_validation(result["validation"])
    }


@app.get("/rentals/", response_model=List[schemas.RentalResponse])
def read_rentals(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    rentals = crud.get_rentals(db, skip=skip, limit=limit)
    return rentals


@app.post("/returns/")
def create_return(return_data: schemas.ReturnCreate, request: Request, db: Session = Depends(get_db)):
    result = crud.create_return(
        db=db,
        return_data=return_data,
        operator_id=1,
        ip_address=request.client.host if request.client else None
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail={
            "reason": result["reason"],
            "validation": serialize_validation(result["validation"])
        })
    
    return {
        "success": True,
        "return": schemas.ReturnResponse.from_orm(result["return"]),
        "validation": serialize_validation(result["validation"])
    }


@app.get("/returns/", response_model=List[schemas.ReturnResponse])
def read_returns(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    returns = crud.get_returns(db, skip=skip, limit=limit)
    return returns


@app.post("/rentals/{rental_id}/rollback/")
def rollback_rental(rental_id: int, reason: str, request: Request, db: Session = Depends(get_db)):
    result = crud.rollback_rental(
        db=db,
        rental_id=rental_id,
        operator_id=1,
        reason=reason,
        ip_address=request.client.host if request.client else None
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["reason"])
    
    return result


@app.get("/audit-logs/", response_model=List[schemas.AuditLogResponse])
def read_audit_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    logs = crud.get_audit_logs(db, skip=skip, limit=limit)
    return logs


@app.post("/batch/rentals/")
def batch_create_rentals(rentals: List[schemas.RentalCreate], request: Request, db: Session = Depends(get_db)):
    handler = crud.BatchOperationHandler(db)
    
    def process_rental(rental):
        result = crud.create_rental(
            db=db,
            rental=rental,
            operator_id=1,
            ip_address=request.client.host if request.client else None
        )
        if not result["success"]:
            raise Exception(result["reason"])
        return schemas.RentalResponse.from_orm(result["rental"])
    
    batch_result = handler.process_batch(rentals, process_rental)
    db.commit()
    
    return batch_result
