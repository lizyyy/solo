from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from models import (
    RecordStatus,
    PriceTier,
    SightlineScoreRecord,
    SightlineScoreCreate,
    SightlineScoreUpdate,
    StatusTransition,
    ExceptionItem,
    Seat,
    Stage,
    Obstruction,
)
from store import RecordStore, StateMachineError
from persistence import (
    load_store,
    save_store,
    load_sample_data,
    get_seat_map,
    get_stage_map,
    get_obstruction_map,
)
from scoring import compute_sightline_score, compute_price_tier, compute_price_range


store: RecordStore = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global store
    store = load_store()
    if not store.records:
        load_sample_data(store)
        save_store(store)
    yield


app = FastAPI(
    title="舞台座位视线评分服务",
    description="评估每个座位的视线质量，综合考虑柱子遮挡、舞台高度和票价分层",
    version="1.0.0",
    lifespan=lifespan,
)


class BatchScoreRequest(BaseModel):
    seat_ids: list[str]
    stage_id: str
    obstruction_ids: list[str] = []


class BatchScoreResponse(BaseModel):
    results: list[SightlineScoreRecord]
    exceptions: list[ExceptionItem]


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


@app.get("/", tags=["root"])
def root():
    return {"service": "舞台座位视线评分服务", "version": "1.0.0"}


@app.get("/summary", tags=["overview"])
def get_summary():
    return store.get_summary()


@app.get("/seats", tags=["seats"])
def list_seats(section: Optional[str] = None, row: Optional[int] = None):
    seats = list(get_seat_map().values())
    if section:
        seats = [s for s in seats if s.section == section]
    if row is not None:
        seats = [s for s in seats if s.row == row]
    return seats


@app.get("/seats/{seat_id}", tags=["seats"])
def get_seat(seat_id: str):
    seat = get_seat_map().get(seat_id)
    if not seat:
        raise HTTPException(status_code=404, detail=f"座位 {seat_id} 不存在")
    return seat


@app.get("/stages", tags=["stages"])
def list_stages():
    return list(get_stage_map().values())


@app.get("/stages/{stage_id}", tags=["stages"])
def get_stage(stage_id: str):
    stage = get_stage_map().get(stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail=f"舞台 {stage_id} 不存在")
    return stage


@app.get("/obstructions", tags=["obstructions"])
def list_obstructions():
    return list(get_obstruction_map().values())


@app.get("/obstructions/{obstruction_id}", tags=["obstructions"])
def get_obstruction(obstruction_id: str):
    obs = get_obstruction_map().get(obstruction_id)
    if not obs:
        raise HTTPException(status_code=404, detail=f"遮挡物 {obstruction_id} 不存在")
    return obs


@app.post("/records", tags=["records"], response_model=SightlineScoreRecord)
def create_record(data: SightlineScoreCreate):
    seat_map = get_seat_map()
    stage_map = get_stage_map()
    obstruction_map = get_obstruction_map()

    if data.seat_id not in seat_map:
        raise HTTPException(status_code=400, detail=f"座位 {data.seat_id} 不存在")
    if data.stage_id not in stage_map:
        raise HTTPException(status_code=400, detail=f"舞台 {data.stage_id} 不存在")

    record = store.create_record(data, seat_map, stage_map, obstruction_map)
    save_store(store)
    return record


@app.get("/records", tags=["records"])
def list_records(
    status: Optional[RecordStatus] = None,
    is_withdrawn: Optional[bool] = None,
    is_supplement: Optional[bool] = None,
):
    records = store.list_all()
    if status is not None:
        records = [r for r in records if r.status == status]
    if is_withdrawn is not None:
        records = [r for r in records if r.is_withdrawn == is_withdrawn]
    if is_supplement is not None:
        records = [r for r in records if r.is_supplement == is_supplement]
    return records


@app.get("/records/processed", tags=["records"])
def list_processed():
    return store.list_by_status(RecordStatus.PROCESSED)


@app.get("/records/pending", tags=["records"])
def list_pending():
    return store.list_by_status(RecordStatus.PENDING)


@app.get("/records/returned", tags=["records"])
def list_returned():
    return store.list_by_status(RecordStatus.RETURNED)


@app.get("/records/withdrawn", tags=["records"])
def list_withdrawn():
    return store.list_withdrawn()


@app.get("/records/{record_id}", tags=["records"])
def get_record(record_id: str):
    record = store.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    return record


@app.patch("/records/{record_id}", tags=["records"])
def update_record(record_id: str, update: SightlineScoreUpdate):
    try:
        record = store.update_record(record_id, update)
        save_store(store)
        return record
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/records/{record_id}/transition", tags=["records"])
def transition_status(record_id: str, body: StatusTransition):
    try:
        target = RecordStatus(body.action)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无效的目标状态: {body.action}")
    try:
        record = store.transition_status(record_id, target, body.reason)
        save_store(store)
        return record
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except StateMachineError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.post("/records/{record_id}/withdraw", tags=["records"])
def withdraw_record(record_id: str, reason: Optional[str] = None):
    try:
        record = store.withdraw_record(record_id, reason)
        save_store(store)
        return record
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/batch-score", tags=["scoring"])
def batch_score(request: BatchScoreRequest):
    seat_map = get_seat_map()
    stage_map = get_stage_map()
    obstruction_map = get_obstruction_map()

    stage = stage_map.get(request.stage_id)
    if not stage:
        raise HTTPException(status_code=400, detail=f"舞台 {request.stage_id} 不存在")

    obstructions = [
        obstruction_map[oid]
        for oid in request.obstruction_ids
        if oid in obstruction_map
    ]

    results = []
    exception_items = []

    for sid in request.seat_ids:
        seat = seat_map.get(sid)
        if not seat:
            exc = store._add_exception(
                exception_type="missing_seat",
                detail=f"座位 {sid} 不在座位图中，无法评分",
                seat_id=sid,
            )
            exception_items.append(exc)
            continue

        score = compute_sightline_score(seat, stage, obstructions)
        tier = compute_price_tier(score)
        pmin, pmax = compute_price_range(tier)

        affected_obs = []
        for oid in request.obstruction_ids:
            from scoring import is_obstruction_blocking
            obs = obstruction_map.get(oid)
            if obs and is_obstruction_blocking(seat, stage, obs):
                affected_obs.append(oid)

        data = SightlineScoreCreate(
            seat_id=sid,
            stage_id=request.stage_id,
            score=score,
            price_tier=tier,
            price_min=pmin,
            price_max=pmax,
            obstruction_ids=affected_obs,
        )
        record = store.create_record(data, seat_map, stage_map, obstruction_map)
        results.append(record)

    save_store(store)
    return BatchScoreResponse(results=results, exceptions=exception_items)


@app.get("/exceptions", tags=["exceptions"])
def list_exceptions(resolved: Optional[bool] = None):
    return store.list_exceptions(resolved)


@app.post("/exceptions/{item_id}/resolve", tags=["exceptions"])
def resolve_exception(item_id: str):
    item = store.resolve_exception(item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"异常项 {item_id} 不存在")
    save_store(store)
    return item


@app.get("/compute-score", tags=["scoring"])
def compute_score_endpoint(
    seat_id: str,
    stage_id: str,
    obstruction_ids: Optional[str] = None,
):
    seat_map = get_seat_map()
    stage_map = get_stage_map()
    obstruction_map = get_obstruction_map()

    seat = seat_map.get(seat_id)
    if not seat:
        raise HTTPException(status_code=404, detail=f"座位 {seat_id} 不存在")
    stage = stage_map.get(stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail=f"舞台 {stage_id} 不存在")

    obs_id_list = obstruction_ids.split(",") if obstruction_ids else []
    obstructions = [obstruction_map[oid] for oid in obs_id_list if oid in obstruction_map]

    score = compute_sightline_score(seat, stage, obstructions)
    tier = compute_price_tier(score)
    pmin, pmax = compute_price_range(tier)

    blocking_obs = []
    for oid in obs_id_list:
        from scoring import is_obstruction_blocking
        obs = obstruction_map.get(oid)
        if obs and is_obstruction_blocking(seat, stage, obs):
            blocking_obs.append({"id": oid, "type": obs.obs_type.value, "description": obs.description})

    return {
        "seat_id": seat_id,
        "stage_id": stage_id,
        "score": score,
        "price_tier": tier.value,
        "price_range": {"min": pmin, "max": pmax},
        "blocking_obstructions": blocking_obs,
    }
