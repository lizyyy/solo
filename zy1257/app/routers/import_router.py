from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.schemas import ImportResult
from app.services.importer import DataImporter

router = APIRouter(prefix="/import", tags=["Data Import"])


@router.post("/nodes-yaml", response_model=ImportResult)
async def import_nodes_yaml(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".yaml") and not file.filename.endswith(".yml"):
        raise HTTPException(status_code=400, detail="File must be YAML format")
    
    content = await file.read()
    yaml_content = content.decode("utf-8")
    
    importer = DataImporter(db)
    nodes_count = importer.import_nodes_yaml(yaml_content)
    
    return ImportResult(
        nodes_imported=nodes_count,
        slots_imported=0,
        requests_imported=0,
        slot_events_imported=0
    )


@router.post("/slot-events-jsonl", response_model=ImportResult)
async def import_slot_events_jsonl(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".jsonl"):
        raise HTTPException(status_code=400, detail="File must be JSONL format")
    
    content = await file.read()
    jsonl_content = content.decode("utf-8")
    
    importer = DataImporter(db)
    events_count = importer.import_slot_events_jsonl(jsonl_content)
    
    return ImportResult(
        nodes_imported=0,
        slots_imported=0,
        requests_imported=0,
        slot_events_imported=events_count
    )


@router.post("/requests-jsonl", response_model=ImportResult)
async def import_requests_jsonl(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".jsonl"):
        raise HTTPException(status_code=400, detail="File must be JSONL format")
    
    content = await file.read()
    jsonl_content = content.decode("utf-8")
    
    importer = DataImporter(db)
    requests_count = importer.import_requests_jsonl(jsonl_content)
    
    return ImportResult(
        nodes_imported=0,
        slots_imported=0,
        requests_imported=requests_count,
        slot_events_imported=0
    )


@router.post("/clear", response_model=dict)
async def clear_all_data(
    db: Session = Depends(get_db)
):
    importer = DataImporter(db)
    importer.clear_all_data()
    return {"message": "All data cleared successfully"}
