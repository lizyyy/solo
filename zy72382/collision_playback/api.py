from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pathlib import Path
import shutil
from typing import Optional, List

from .config import PHOTO_DIR, RECORD_STATUS, PLAYBACK_SOURCE, OPERATOR_LAOCEN, OPERATOR_ENGINEER
from .models import (
    SensorRecord, SensorRecordCreate, SensorRecordDetail, RecordImportResult,
    ManualCorrection, ManualCorrectionCreate,
    WorkPhoto, WorkPhotoCreate,
    PlaybackRun, PlaybackRunCreate,
)
from . import database, core


app = FastAPI(title="小车碰撞动量回放 API", version="1.0.0")

_static_dir = Path(__file__).resolve().parent / "web" / "static"
app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")


@app.on_event("startup")
async def startup_event():
    await database.init_db()


@app.get("/", response_class=HTMLResponse)
async def root():
    """返回小看板页面"""
    static_dir = Path(__file__).resolve().parent / "web" / "static"
    index_path = static_dir / "index.html"
    if index_path.exists():
        return index_path.read_text(encoding="utf-8")
    return HTMLResponse("<h1>小车碰撞动量回放系统</h1><p>请查看 /docs 获取 API 文档</p>")


@app.post("/api/records/import", response_model=RecordImportResult)
async def api_import_record(record: SensorRecordCreate):
    """导入传感器记录"""
    return await core.import_sensor_record(record)


@app.get("/api/records", response_model=List[SensorRecord])
async def api_list_records(status: Optional[str] = None):
    """获取所有记录，可按状态过滤"""
    records = await core.get_all_records()
    if status:
        records = [r for r in records if r.status == status]
    return records


@app.get("/api/records/{record_id}", response_model=SensorRecordDetail)
async def api_get_record(record_id: int):
    """获取单条记录详情"""
    detail = await core.get_record_detail(record_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    return detail


@app.get("/api/records/sensor/{sensor_no}", response_model=SensorRecordDetail)
async def api_get_record_by_sensor(sensor_no: str):
    """通过传感器编号获取记录详情"""
    record = await database.get_sensor_record_by_sensor_no(sensor_no)
    if not record:
        raise HTTPException(status_code=404, detail=f"传感器 {sensor_no} 不存在")
    detail = await core.get_record_detail(record.id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"记录不存在")
    return detail


@app.post("/api/records/{record_id}/correct")
async def api_apply_correction(
    record_id: int,
    field_name: str = Form(...),
    new_value: float = Form(...),
    operator: str = Form(OPERATOR_LAOCEN),
    reason: Optional[str] = Form(None),
):
    """应用人工修正"""
    result = await core.apply_manual_correction(record_id, field_name, new_value, operator, reason)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/api/records/{record_id}/photo")
async def api_upload_photo(
    record_id: int,
    file: UploadFile = File(...),
    note: Optional[str] = Form(None),
    extracted_friction: Optional[float] = Form(None),
    uploader: str = Form(OPERATOR_LAOCEN),
):
    """上传工况照片"""
    record = await database.get_sensor_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")

    import time
    timestamp = int(time.time())
    suffix = Path(file.filename).suffix if file.filename else ".bin"
    dest_filename = f"{record.sensor_no}_{timestamp}{suffix}"
    dest_path = PHOTO_DIR / dest_filename

    with dest_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = await core.upload_work_photo(
        record_id=record_id,
        source_file_path=str(dest_path),
        note=note,
        extracted_friction_coeff=extracted_friction,
        uploader=uploader,
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/api/records/{record_id}/playback")
async def api_run_playback(record_id: int, run_by: str = Form(OPERATOR_LAOCEN)):
    """运行参数回放"""
    result = await core.run_playback(record_id, run_by)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/api/records/{record_id}/review")
async def api_review_record(record_id: int, reviewer: str = Form(OPERATOR_ENGINEER)):
    """设备工程师复核"""
    result = await core.review_record(record_id, reviewer)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/api/records/pending/list", response_model=List[SensorRecordDetail])
async def api_get_pending_records():
    """获取所有待复核的记录"""
    return await core.get_pending_review_records()


@app.get("/api/summary")
async def api_get_summary():
    """获取系统摘要"""
    records = await core.get_all_record_details()
    total = len(records)
    normal = sum(1 for r in records if r.status == RECORD_STATUS["NORMAL"])
    pending = sum(1 for r in records if r.status == RECORD_STATUS["PENDING_REVIEW"])
    reviewed = sum(1 for r in records if r.status == RECORD_STATUS["REVIEWED"])
    with_photos = sum(1 for r in records if r.photos)
    with_corrections = sum(1 for r in records if r.has_manual_correction)

    return {
        "total": total,
        "normal": normal,
        "pending": pending,
        "reviewed": reviewed,
        "with_photos": with_photos,
        "with_corrections": with_corrections,
        "status_labels": RECORD_STATUS,
        "source_labels": PLAYBACK_SOURCE,
        "commands": {
            "list": "python -m collision_playback list",
            "show": "python -m collision_playback show <记录ID>",
            "show_by_sensor": "python -m collision_playback show-by-sensor <编号>",
            "playback": "python -m collision_playback playback <记录ID>",
            "pending": "python -m collision_playback pending",
            "review": "python -m collision_playback review <记录ID>",
            "summary": "python -m collision_playback summary",
        },
    }


@app.get("/api/details", response_model=List[SensorRecordDetail])
async def api_get_all_details():
    """获取所有记录的完整详情"""
    return await core.get_all_record_details()


@app.post("/api/demo/load")
async def api_load_demo(clear_first: bool = False):
    """加载演示数据"""
    if clear_first:
        await database.clear_all_data()
    from . import demo_data
    result = await demo_data.load_demo_data()
    return {"message": result}
