from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Generator
from schemas import GeneratorCreate, GeneratorUpdate, GeneratorResponse, ImportResult

router = APIRouter(prefix="/api/generators", tags=["generators"])


@router.post("/", response_model=GeneratorResponse)
def create_generator(generator: GeneratorCreate, db: Session = Depends(get_db)):
    db_generator = Generator(**generator.model_dump())
    db.add(db_generator)
    db.commit()
    db.refresh(db_generator)
    return db_generator


@router.get("/", response_model=List[GeneratorResponse])
def get_generators(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    generators = db.query(Generator).offset(skip).limit(limit).all()
    return generators


@router.get("/{generator_id}", response_model=GeneratorResponse)
def get_generator(generator_id: int, db: Session = Depends(get_db)):
    generator = db.query(Generator).filter(Generator.id == generator_id).first()
    if generator is None:
        raise HTTPException(status_code=404, detail="Generator not found")
    return generator


@router.put("/{generator_id}", response_model=GeneratorResponse)
def update_generator(generator_id: int, generator: GeneratorUpdate, db: Session = Depends(get_db)):
    db_generator = db.query(Generator).filter(Generator.id == generator_id).first()
    if db_generator is None:
        raise HTTPException(status_code=404, detail="Generator not found")
    
    update_data = generator.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_generator, key, value)
    
    db.commit()
    db.refresh(db_generator)
    return db_generator


@router.delete("/{generator_id}")
def delete_generator(generator_id: int, db: Session = Depends(get_db)):
    db_generator = db.query(Generator).filter(Generator.id == generator_id).first()
    if db_generator is None:
        raise HTTPException(status_code=404, detail="Generator not found")
    
    db.delete(db_generator)
    db.commit()
    return {"message": "Generator deleted successfully"}


@router.post("/import", response_model=ImportResult)
def import_generators(generators_data: List[GeneratorCreate], db: Session = Depends(get_db)):
    imported_count = 0
    failed_count = 0
    errors = []
    
    for idx, generator_data in enumerate(generators_data):
        try:
            db_generator = Generator(**generator_data.model_dump())
            db.add(db_generator)
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
def clear_all_generators(db: Session = Depends(get_db)):
    count = db.query(Generator).delete()
    db.commit()
    return {"message": f"Cleared {count} generators"}
