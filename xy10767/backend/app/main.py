from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import json

from . import crud, models, schemas
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="数据血缘浏览器 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/datasets/", response_model=schemas.Dataset)
def create_dataset(dataset: schemas.DatasetCreate, db: Session = Depends(get_db)):
    return crud.create_dataset(db=db, dataset=dataset)


@app.get("/api/datasets/", response_model=List[schemas.Dataset])
def read_datasets(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    datasets = crud.get_datasets(db, skip=skip, limit=limit)
    return datasets


@app.get("/api/datasets/{dataset_id}", response_model=schemas.DatasetDetail)
def read_dataset(dataset_id: int, db: Session = Depends(get_db)):
    db_dataset = crud.get_dataset(db, dataset_id=dataset_id)
    if db_dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return db_dataset


@app.post("/api/upstream-tasks/", response_model=schemas.UpstreamTask)
def create_upstream_task(task: schemas.UpstreamTaskCreate, db: Session = Depends(get_db)):
    return crud.create_upstream_task(db=db, task=task)


@app.get("/api/upstream-tasks/", response_model=List[schemas.UpstreamTask])
def read_upstream_tasks(dataset_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_upstream_tasks(db, dataset_id=dataset_id, skip=skip, limit=limit)


@app.post("/api/downstream-reports/", response_model=schemas.DownstreamReport)
def create_downstream_report(report: schemas.DownstreamReportCreate, db: Session = Depends(get_db)):
    return crud.create_downstream_report(db=db, report=report)


@app.get("/api/downstream-reports/", response_model=List[schemas.DownstreamReport])
def read_downstream_reports(dataset_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_downstream_reports(db, dataset_id=dataset_id, skip=skip, limit=limit)


@app.post("/api/field-mappings/", response_model=schemas.FieldMapping)
def create_field_mapping(mapping: schemas.FieldMappingCreate, db: Session = Depends(get_db)):
    return crud.create_field_mapping(db=db, mapping=mapping)


@app.get("/api/field-mappings/", response_model=List[schemas.FieldMapping])
def read_field_mappings(dataset_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_field_mappings(db, dataset_id=dataset_id, skip=skip, limit=limit)


@app.put("/api/field-mappings/{mapping_id}/correct", response_model=schemas.FieldMapping)
def correct_field_mapping(
    mapping_id: int, 
    correction: schemas.FieldMappingManualCorrection, 
    db: Session = Depends(get_db)
):
    db_mapping = crud.manual_correct_field_mapping(db, mapping_id=mapping_id, correction=correction)
    if db_mapping is None:
        raise HTTPException(status_code=404, detail="Field mapping not found")
    return db_mapping


@app.post("/api/change-impacts/", response_model=schemas.ChangeImpact)
def create_change_impact(impact: schemas.ChangeImpactCreate, db: Session = Depends(get_db)):
    return crud.create_change_impact(db=db, impact=impact)


@app.get("/api/change-impacts/", response_model=List[schemas.ChangeImpact])
def read_change_impacts(dataset_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_change_impacts(db, dataset_id=dataset_id, skip=skip, limit=limit)


@app.get("/api/lineage-graphs/{dataset_id}", response_model=schemas.LineageGraph)
def read_lineage_graph(dataset_id: int, db: Session = Depends(get_db)):
    db_graph = crud.get_lineage_graph(db, dataset_id=dataset_id)
    if db_graph is None:
        raise HTTPException(status_code=404, detail="Lineage graph not found")
    return db_graph


@app.post("/api/lineage-graphs/{dataset_id}/recalculate", response_model=schemas.LineageGraph)
def recalculate_lineage_graph(dataset_id: int, db: Session = Depends(get_db)):
    db_graph = crud.recalculate_lineage_graph(db, dataset_id=dataset_id)
    if db_graph is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return db_graph


@app.get("/api/failed-items/", response_model=List[schemas.FailedItemDetail])
def read_failed_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_failed_items(db, skip=skip, limit=limit)


@app.get("/api/failed-items/{item_type}/{item_id}")
def read_failed_item_detail(item_type: str, item_id: int, db: Session = Depends(get_db)):
    if item_type == "upstream_task":
        item = db.query(models.UpstreamTask).filter(models.UpstreamTask.id == item_id).first()
        if item:
            dataset = crud.get_dataset(db, item.dataset_id)
            return {
                "id": item.id,
                "type": "upstream_task",
                "name": item.name,
                "task_type": item.task_type,
                "source_system": item.source_system,
                "status": item.status,
                "handler": item.handler,
                "handled_at": item.handled_at,
                "handle_reason": item.handle_reason,
                "is_failed": item.is_failed,
                "created_at": item.created_at,
                "dataset_name": dataset.name if dataset else None,
                "dataset_id": item.dataset_id
            }
    elif item_type == "change_impact":
        item = db.query(models.ChangeImpact).filter(models.ChangeImpact.id == item_id).first()
        if item:
            dataset = crud.get_dataset(db, item.dataset_id)
            return {
                "id": item.id,
                "type": "change_impact",
                "change_type": item.change_type,
                "change_description": item.change_description,
                "severity": item.severity,
                "status": item.status,
                "handler": item.handler,
                "handled_at": item.handled_at,
                "handle_reason": item.handle_reason,
                "is_failed": item.is_failed,
                "created_at": item.created_at,
                "dataset_name": dataset.name if dataset else None,
                "dataset_id": item.dataset_id
            }
    elif item_type == "field_mapping":
        item = db.query(models.FieldMapping).filter(models.FieldMapping.id == item_id).first()
        if item:
            dataset = crud.get_dataset(db, item.dataset_id)
            return {
                "id": item.id,
                "type": "field_mapping",
                "source_field": item.source_field,
                "target_field": item.target_field,
                "mapping_rule": item.mapping_rule,
                "transformation_logic": item.transformation_logic,
                "status": item.status,
                "error_message": item.error_message,
                "is_manual_correction": item.is_manual_correction,
                "corrected_by": item.corrected_by,
                "corrected_at": item.corrected_at,
                "correction_reason": item.correction_reason,
                "created_at": item.created_at,
                "dataset_name": dataset.name if dataset else None,
                "dataset_id": item.dataset_id
            }
    
    raise HTTPException(status_code=404, detail="Failed item not found")


@app.post("/api/demo/")
def create_demo_data(db: Session = Depends(get_db)):
    dataset = crud.create_demo_data(db)
    return {"message": "Demo data created successfully", "dataset_id": dataset.id}


@app.get("/api/export/{dataset_id}")
def export_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = crud.get_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    tasks = crud.get_upstream_tasks(db, dataset_id)
    reports = crud.get_downstream_reports(db, dataset_id)
    mappings = crud.get_field_mappings(db, dataset_id)
    impacts = crud.get_change_impacts(db, dataset_id)
    graph = crud.get_lineage_graph(db, dataset_id)
    
    export_data = {
        "dataset": {
            "id": dataset.id,
            "name": dataset.name,
            "description": dataset.description,
            "owner": dataset.owner,
            "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
            "status": dataset.status
        },
        "upstream_tasks": [
            {
                "id": t.id,
                "name": t.name,
                "task_type": t.task_type,
                "source_system": t.source_system,
                "status": t.status,
                "is_failed": t.is_failed,
                "handler": t.handler,
                "handle_reason": t.handle_reason
            } for t in tasks
        ],
        "downstream_reports": [
            {
                "id": r.id,
                "name": r.name,
                "report_type": r.report_type,
                "target_audience": r.target_audience,
                "status": r.status
            } for r in reports
        ],
        "field_mappings": [
            {
                "id": m.id,
                "source_field": m.source_field,
                "target_field": m.target_field,
                "mapping_rule": m.mapping_rule,
                "transformation_logic": m.transformation_logic,
                "status": m.status,
                "is_manual_correction": m.is_manual_correction,
                "error_message": m.error_message
            } for m in mappings
        ],
        "change_impacts": [
            {
                "id": i.id,
                "change_type": i.change_type,
                "change_description": i.change_description,
                "severity": i.severity,
                "status": i.status,
                "is_failed": i.is_failed,
                "handler": i.handler,
                "handle_reason": i.handle_reason
            } for i in impacts
        ],
        "lineage_graph": {
            "nodes": graph.nodes if graph else [],
            "edges": graph.edges if graph else [],
            "version": graph.version if graph else 0,
            "calculated_at": graph.calculated_at.isoformat() if graph and graph.calculated_at else None
        }
    }
    
    return export_data


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
