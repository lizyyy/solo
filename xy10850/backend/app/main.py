from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
import json
import io

from . import crud, models, schemas
from .database import SessionLocal, engine
from .orchestrator import OrchestrationEngine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="BFF Endpoint Orchestrator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"message": "BFF Endpoint Orchestrator API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/page-modules/", response_model=schemas.PageModule)
def create_page_module(page_module: schemas.PageModuleCreate, db: Session = Depends(get_db)):
    return crud.create_page_module(db=db, page_module=page_module)


@app.get("/page-modules/", response_model=List[schemas.PageModule])
def read_page_modules(
        skip: int = 0,
        limit: int = 100,
        name: Optional[str] = None,
        status: Optional[str] = None,
        db: Session = Depends(get_db)
):
    return crud.get_page_modules(db, skip=skip, limit=limit, name=name, status=status)


@app.get("/page-modules/{page_module_id}", response_model=schemas.PageModule)
def read_page_module(page_module_id: int, db: Session = Depends(get_db)):
    db_page_module = crud.get_page_module(db, page_module_id=page_module_id)
    if db_page_module is None:
        raise HTTPException(status_code=404, detail="Page module not found")
    return db_page_module


@app.put("/page-modules/{page_module_id}", response_model=schemas.PageModule)
def update_page_module(page_module_id: int, page_module: schemas.PageModuleUpdate, db: Session = Depends(get_db)):
    db_page_module = crud.update_page_module(db, page_module_id=page_module_id, page_module=page_module)
    if db_page_module is None:
        raise HTTPException(status_code=404, detail="Page module not found")
    return db_page_module


@app.delete("/page-modules/{page_module_id}", response_model=schemas.PageModule)
def delete_page_module(page_module_id: int, db: Session = Depends(get_db)):
    db_page_module = crud.delete_page_module(db, page_module_id=page_module_id)
    if db_page_module is None:
        raise HTTPException(status_code=404, detail="Page module not found")
    return db_page_module


@app.post("/upstream-apis/", response_model=schemas.UpstreamApi)
def create_upstream_api(upstream_api: schemas.UpstreamApiCreate, db: Session = Depends(get_db)):
    return crud.create_upstream_api(db=db, upstream_api=upstream_api)


@app.get("/upstream-apis/", response_model=List[schemas.UpstreamApi])
def read_upstream_apis(
        skip: int = 0,
        limit: int = 100,
        name: Optional[str] = None,
        base_url: Optional[str] = None,
        db: Session = Depends(get_db)
):
    return crud.get_upstream_apis(db, skip=skip, limit=limit, name=name, base_url=base_url)


@app.get("/upstream-apis/{upstream_api_id}", response_model=schemas.UpstreamApi)
def read_upstream_api(upstream_api_id: int, db: Session = Depends(get_db)):
    db_upstream = crud.get_upstream_api(db, upstream_api_id=upstream_api_id)
    if db_upstream is None:
        raise HTTPException(status_code=404, detail="Upstream API not found")
    return db_upstream


@app.put("/upstream-apis/{upstream_api_id}", response_model=schemas.UpstreamApi)
def update_upstream_api(upstream_api_id: int, upstream_api: schemas.UpstreamApiUpdate, db: Session = Depends(get_db)):
    db_upstream = crud.update_upstream_api(db, upstream_api_id=upstream_api_id, upstream_api=upstream_api)
    if db_upstream is None:
        raise HTTPException(status_code=404, detail="Upstream API not found")
    return db_upstream


@app.delete("/upstream-apis/{upstream_api_id}", response_model=schemas.UpstreamApi)
def delete_upstream_api(upstream_api_id: int, db: Session = Depends(get_db)):
    db_upstream = crud.delete_upstream_api(db, upstream_api_id=upstream_api_id)
    if db_upstream is None:
        raise HTTPException(status_code=404, detail="Upstream API not found")
    return db_upstream


@app.post("/bff-endpoints/", response_model=schemas.BffEndpoint)
def create_bff_endpoint(endpoint: schemas.BffEndpointCreate, db: Session = Depends(get_db)):
    return crud.create_bff_endpoint(db=db, endpoint=endpoint)


@app.get("/bff-endpoints/", response_model=List[schemas.BffEndpoint])
def read_bff_endpoints(
        skip: int = 0,
        limit: int = 100,
        name: Optional[str] = None,
        path: Optional[str] = None,
        status: Optional[str] = None,
        page_module_id: Optional[int] = None,
        db: Session = Depends(get_db)
):
    return crud.get_bff_endpoints(
        db, skip=skip, limit=limit, name=name, path=path,
        status=status, page_module_id=page_module_id
    )


@app.get("/bff-endpoints/{endpoint_id}", response_model=schemas.BffEndpoint)
def read_bff_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    db_endpoint = crud.get_bff_endpoint(db, endpoint_id=endpoint_id)
    if db_endpoint is None:
        raise HTTPException(status_code=404, detail="BFF Endpoint not found")
    return db_endpoint


@app.put("/bff-endpoints/{endpoint_id}", response_model=schemas.BffEndpoint)
def update_bff_endpoint(endpoint_id: int, endpoint: schemas.BffEndpointUpdate, db: Session = Depends(get_db)):
    db_endpoint = crud.update_bff_endpoint(db, endpoint_id=endpoint_id, endpoint=endpoint)
    if db_endpoint is None:
        raise HTTPException(status_code=404, detail="BFF Endpoint not found")
    return db_endpoint


@app.delete("/bff-endpoints/{endpoint_id}", response_model=schemas.BffEndpoint)
def delete_bff_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    db_endpoint = crud.delete_bff_endpoint(db, endpoint_id=endpoint_id)
    if db_endpoint is None:
        raise HTTPException(status_code=404, detail="BFF Endpoint not found")
    return db_endpoint


@app.post("/bff-endpoints/{endpoint_id}/status", response_model=schemas.BffEndpoint)
def transition_endpoint_status(
        endpoint_id: int,
        transition: schemas.StatusTransition,
        db: Session = Depends(get_db)
):
    try:
        db_endpoint = crud.transition_endpoint_status(
            db, endpoint_id=endpoint_id, new_status=transition.new_status, reason=transition.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if db_endpoint is None:
        raise HTTPException(status_code=404, detail="BFF Endpoint not found")
    return db_endpoint


@app.post("/execute")
async def execute_endpoint_execution(
        request: schemas.ExecuteRequest,
        db: Session = Depends(get_db)
):
    engine = OrchestrationEngine(db)
    try:
        result = await engine.execute_endpoint(
            endpoint_id=request.endpoint_id,
            request_data=request.request_data,
            skip_cache=request.skip_cache
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/bff-endpoints/{endpoint_id}/statistics")
def get_endpoint_statistics(endpoint_id: int, days: int = 7, db: Session = Depends(get_db)):
    return crud.get_endpoint_statistics(db, endpoint_id=endpoint_id, days=days)


@app.get("/call-history/", response_model=List[schemas.CallHistory])
def read_call_history(
        endpoint_id: Optional[int] = None,
        request_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        error_only: bool = False,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        db: Session = Depends(get_db)
):
    start_dt = datetime.combine(start_date, datetime.min.time()) if start_date else None
    end_dt = datetime.combine(end_date, datetime.max.time()) if end_date else None
    return crud.get_call_histories(
        db, endpoint_id=endpoint_id, request_id=request_id,
        skip=skip, limit=limit, error_only=error_only,
        start_date=start_dt, end_date=end_dt
    )


@app.get("/call-history/{history_id}", response_model=schemas.CallHistory)
def read_single_call_history(history_id: int, db: Session = Depends(get_db)):
    db_history = crud.get_call_history(db, history_id=history_id)
    if db_history is None:
        raise HTTPException(status_code=404, detail="Call history not found")
    return db_history


@app.get("/call-history/export")
def export_call_history_data(
        endpoint_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        format: str = Query("xlsx", enum=["xlsx", "csv", "json"]),
        db: Session = Depends(get_db)
):
    start_dt = datetime.combine(start_date, datetime.min.time()) if start_date else None
    end_dt = datetime.combine(end_date, datetime.max.time()) if end_date else None

    data = crud.export_call_history(
        db, endpoint_id=endpoint_id, start_date=start_dt,
        end_date=end_dt, format=format
    )

    media_types = {
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "csv": "text/csv",
        "json": "application/json"
    }

    filename = f"call_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{format}"

    return StreamingResponse(
        io.BytesIO(data),
        media_type=media_types[format],
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/bff-endpoints/batch-import", response_model=schemas.BatchImportResult)
async def batch_import_endpoints(
        file: UploadFile = File(...),
        db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.json', '.csv')):
        raise HTTPException(status_code=400, detail="Only JSON and CSV files are supported")

    try:
        contents = await file.read()
        if file.filename.endswith('.json'):
            data = json.loads(contents.decode('utf-8'))
            if not isinstance(data, list):
                raise HTTPException(status_code=400, detail="JSON must contain an array of endpoints")
        else:
            import csv
            reader = csv.DictReader(contents.decode('utf-8').splitlines())
            data = list(reader)

        result = crud.batch_import_endpoints(db, endpoints_data=data)
        return result
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@app.get("/bff-endpoints/{endpoint_id}/upstreams", response_model=List[schemas.EndpointUpstream])
def read_endpoint_upstreams(endpoint_id: int, db: Session = Depends(get_db)):
    return crud.get_endpoint_upstreams(db, endpoint_id=endpoint_id)


@app.post("/bff-endpoints/{endpoint_id}/upstreams", response_model=schemas.EndpointUpstream)
def create_endpoint_upstream(endpoint_id: int, upstream: schemas.EndpointUpstreamCreate, db: Session = Depends(get_db)):
    return crud.create_endpoint_upstream(db, endpoint_id=endpoint_id, upstream=upstream)


@app.put("/bff-endpoints/upstreams/{upstream_id}", response_model=schemas.EndpointUpstream)
def update_endpoint_upstream(upstream_id: int, upstream: schemas.EndpointUpstreamCreate, db: Session = Depends(get_db)):
    db_upstream = crud.update_endpoint_upstream(db, upstream_id=upstream_id, upstream=upstream)
    if db_upstream is None:
        raise HTTPException(status_code=404, detail="Endpoint upstream not found")
    return db_upstream


@app.delete("/bff-endpoints/upstreams/{upstream_id}", response_model=schemas.EndpointUpstream)
def delete_endpoint_upstream(upstream_id: int, db: Session = Depends(get_db)):
    db_upstream = crud.delete_endpoint_upstream(db, upstream_id=upstream_id)
    if db_upstream is None:
        raise HTTPException(status_code=404, detail="Endpoint upstream not found")
    return db_upstream


@app.get("/bff-endpoints/{endpoint_id}/fields", response_model=List[schemas.AggregateField])
def read_aggregate_fields(endpoint_id: int, db: Session = Depends(get_db)):
    return crud.get_aggregate_fields(db, endpoint_id=endpoint_id)


@app.post("/bff-endpoints/{endpoint_id}/fields", response_model=schemas.AggregateField)
def create_aggregate_field(endpoint_id: int, field: schemas.AggregateFieldCreate, db: Session = Depends(get_db)):
    field_data = field.model_dump()
    field_data["endpoint_id"] = endpoint_id
    return crud.create_aggregate_field(db, field=schemas.AggregateFieldCreate(**field_data))


@app.put("/bff-endpoints/fields/{field_id}", response_model=schemas.AggregateField)
def update_aggregate_field(field_id: int, field: schemas.AggregateFieldCreate, db: Session = Depends(get_db)):
    db_field = crud.update_aggregate_field(db, field_id=field_id, field=field)
    if db_field is None:
        raise HTTPException(status_code=404, detail="Aggregate field not found")
    return db_field


@app.delete("/bff-endpoints/fields/{field_id}", response_model=schemas.AggregateField)
def delete_aggregate_field(field_id: int, db: Session = Depends(get_db)):
    db_field = crud.delete_aggregate_field(db, field_id=field_id)
    if db_field is None:
        raise HTTPException(status_code=404, detail="Aggregate field not found")
    return db_field


@app.post("/bff-endpoints/{endpoint_id}/cache/invalidate")
def invalidate_endpoint_cache(endpoint_id: int, db: Session = Depends(get_db)):
    from .orchestrator import OrchestrationEngine
    engine = OrchestrationEngine(db)
    engine.cache_manager.invalidate(endpoint_id=endpoint_id)
    return {"message": "Cache invalidated successfully", "endpoint_id": endpoint_id}


@app.post("/cache/invalidate")
def invalidate_cache_by_key(cache_key: str, db: Session = Depends(get_db)):
    from .orchestrator import OrchestrationEngine
    engine = OrchestrationEngine(db)
    engine.cache_manager.invalidate(cache_key=cache_key)
    return {"message": "Cache invalidated successfully", "cache_key": cache_key}


@app.get("/cache/entries")
def list_cache_entries(endpoint_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    from .models import CacheEntry
    query = db.query(CacheEntry)
    if endpoint_id:
        query = query.filter(CacheEntry.endpoint_id == endpoint_id)
    entries = query.offset(skip).limit(limit).all()
    return {"total": query.count(), "entries": entries}
