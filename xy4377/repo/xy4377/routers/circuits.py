from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Circuit
from schemas import CircuitCreate, CircuitUpdate, CircuitResponse, ImportResult

router = APIRouter(prefix="/api/circuits", tags=["circuits"])


@router.post("/", response_model=CircuitResponse)
def create_circuit(circuit: CircuitCreate, db: Session = Depends(get_db)):
    db_circuit = Circuit(**circuit.model_dump())
    db.add(db_circuit)
    db.commit()
    db.refresh(db_circuit)
    return db_circuit


@router.get("/", response_model=List[CircuitResponse])
def get_circuits(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    circuits = db.query(Circuit).offset(skip).limit(limit).all()
    return circuits


@router.get("/{circuit_id}", response_model=CircuitResponse)
def get_circuit(circuit_id: int, db: Session = Depends(get_db)):
    circuit = db.query(Circuit).filter(Circuit.id == circuit_id).first()
    if circuit is None:
        raise HTTPException(status_code=404, detail="Circuit not found")
    return circuit


@router.put("/{circuit_id}", response_model=CircuitResponse)
def update_circuit(circuit_id: int, circuit: CircuitUpdate, db: Session = Depends(get_db)):
    db_circuit = db.query(Circuit).filter(Circuit.id == circuit_id).first()
    if db_circuit is None:
        raise HTTPException(status_code=404, detail="Circuit not found")
    
    update_data = circuit.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_circuit, key, value)
    
    db.commit()
    db.refresh(db_circuit)
    return db_circuit


@router.delete("/{circuit_id}")
def delete_circuit(circuit_id: int, db: Session = Depends(get_db)):
    db_circuit = db.query(Circuit).filter(Circuit.id == circuit_id).first()
    if db_circuit is None:
        raise HTTPException(status_code=404, detail="Circuit not found")
    
    db.delete(db_circuit)
    db.commit()
    return {"message": "Circuit deleted successfully"}


@router.post("/import", response_model=ImportResult)
def import_circuits(circuits_data: List[CircuitCreate], db: Session = Depends(get_db)):
    imported_count = 0
    failed_count = 0
    errors = []
    
    for idx, circuit_data in enumerate(circuits_data):
        try:
            db_circuit = Circuit(**circuit_data.model_dump())
            db.add(db_circuit)
            imported_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(f"Item {idx + 1}: {str(e)}")
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return ImportResult(
            message="Import failed, rolled back",
            imported_count=0,
            failed_count=imported_count + failed_count,
            errors=[f"Database error: {str(e)}"]
        )
    
    return ImportResult(
        message=f"Import completed: {imported_count} imported, {failed_count} failed",
        imported_count=imported_count,
        failed_count=failed_count,
        errors=errors
    )


@router.delete("/")
def clear_all_circuits(db: Session = Depends(get_db)):
    count = db.query(Circuit).delete()
    db.commit()
    return {"message": f"Cleared {count} circuits"}
