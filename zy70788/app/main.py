from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from app.config import settings
from app.database import init_db, get_db, FixtureStatus, FixtureExceptionType
from app.schemas import (
    FixtureCreate, FixtureUpdate, FixtureManualFix, FixtureResponse,
    FixtureDetailResponse, ExceptionCreate, ExceptionResponse,
    ReportResponse, ReplayScriptGenerate, StatusUpdate
)
from app.services import (
    create_fixture, get_fixture_by_id, get_all_fixtures,
    update_fixture_status, manual_fix_fixture, withdraw_fixture,
    close_fixture, add_exception, resolve_exception,
    create_recording_report, export_fixture_data, save_replay_script
)

app = FastAPI(title=settings.PROJECT_NAME)


@app.on_event("startup")
def startup_event():
    init_db()


@app.post(f"{settings.API_V1_STR}/fixtures/", response_model=FixtureResponse, status_code=201)
def create_new_fixture(fixture_data: FixtureCreate, db: Session = Depends(get_db)):
    fixture = create_fixture(db, fixture_data)
    return fixture


@app.get(f"{settings.API_V1_STR}/fixtures/", response_model=List[FixtureResponse])
def list_fixtures(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[FixtureStatus] = None,
    db: Session = Depends(get_db)
):
    return get_all_fixtures(db, skip=skip, limit=limit, status=status)


@app.get(f"{settings.API_V1_STR}/fixtures/{{fixture_id}}/", response_model=FixtureDetailResponse)
def get_fixture(fixture_id: str, db: Session = Depends(get_db)):
    fixture = get_fixture_by_id(db, fixture_id)
    if not fixture:
        raise HTTPException(status_code=404, detail="夹具不存在")
    return fixture


@app.patch(f"{settings.API_V1_STR}/fixtures/{{fixture_id}}/status/", response_model=FixtureResponse)
def update_status(fixture_id: str, status_update: StatusUpdate, db: Session = Depends(get_db)):
    fixture = update_fixture_status(db, fixture_id, status_update.status, status_update.handler)
    if not fixture:
        raise HTTPException(status_code=404, detail="夹具不存在")
    return fixture


@app.post(f"{settings.API_V1_STR}/fixtures/{{fixture_id}}/fix/", response_model=FixtureResponse)
def manual_fix(fixture_id: str, fix_data: FixtureManualFix, db: Session = Depends(get_db)):
    fixture = manual_fix_fixture(db, fixture_id, fix_data)
    if not fixture:
        raise HTTPException(status_code=404, detail="夹具不存在")
    return fixture


@app.post(f"{settings.API_V1_STR}/fixtures/{{fixture_id}}/withdraw/", response_model=FixtureResponse)
def withdraw(fixture_id: str, handler: str, conclusion: str, db: Session = Depends(get_db)):
    fixture = withdraw_fixture(db, fixture_id, handler, conclusion)
    if not fixture:
        raise HTTPException(status_code=404, detail="夹具不存在")
    return fixture


@app.post(f"{settings.API_V1_STR}/fixtures/{{fixture_id}}/close/", response_model=FixtureResponse)
def close(fixture_id: str, handler: str, db: Session = Depends(get_db)):
    fixture = close_fixture(db, fixture_id, handler)
    if not fixture:
        raise HTTPException(status_code=404, detail="夹具不存在")
    return fixture


@app.post(f"{settings.API_V1_STR}/fixtures/{{fixture_id}}/exceptions/", response_model=ExceptionResponse, status_code=201)
def create_exception(fixture_id: str, exception_data: ExceptionCreate, db: Session = Depends(get_db)):
    fixture = get_fixture_by_id(db, fixture_id)
    if not fixture:
        raise HTTPException(status_code=404, detail="夹具不存在")
    exception = add_exception(db, fixture.id, exception_data)
    return exception


@app.patch(f"{settings.API_V1_STR}/exceptions/{{exception_id}}/resolve/", response_model=ExceptionResponse)
def resolve_exception_endpoint(exception_id: int, conclusion: str, handler: str, db: Session = Depends(get_db)):
    exception = resolve_exception(db, exception_id, conclusion, handler)
    if not exception:
        raise HTTPException(status_code=404, detail="异常不存在")
    return exception


@app.post(f"{settings.API_V1_STR}/fixtures/{{fixture_id}}/report/", response_model=ReportResponse, status_code=201)
def generate_report(fixture_id: str, db: Session = Depends(get_db)):
    report = create_recording_report(db, fixture_id)
    if not report:
        raise HTTPException(status_code=404, detail="夹具不存在")
    return report


@app.post(f"{settings.API_V1_STR}/fixtures/{{fixture_id}}/replay-script/")
def generate_replay_script(fixture_id: str, script_data: ReplayScriptGenerate, db: Session = Depends(get_db)):
    fixture = get_fixture_by_id(db, fixture_id)
    if not fixture:
        raise HTTPException(status_code=404, detail="夹具不存在")
    
    script_path = save_replay_script(fixture, script_data.target_url)
    return {
        "fixture_id": fixture_id,
        "script_path": script_path,
        "target_url": script_data.target_url or fixture.request_url
    }


@app.get(f"{settings.API_V1_STR}/fixtures/{{fixture_id}}/export/")
def export_fixture(fixture_id: str, db: Session = Depends(get_db)):
    fixture = get_fixture_by_id(db, fixture_id)
    if not fixture:
        raise HTTPException(status_code=404, detail="夹具不存在")
    
    export_data = export_fixture_data(fixture)
    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": f"attachment; filename=fixture_{fixture_id}.json"
        }
    )


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}
