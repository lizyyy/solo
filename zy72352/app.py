from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request
import uuid
import os
from typing import Optional

from config import UPLOAD_DIR, STATIC_DIR, TEMPLATES_DIR
from storage import storage
from data_import import importer
from detector import detector
from safety_reminder import safety_manager
from models import MaintenanceScreenshot, SensorStatus

app = FastAPI(title="风洞小车阻力曲线分析系统")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    sessions = storage.list_sessions()
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "sessions": sessions}
    )


@app.get("/session/{session_id}", response_class=HTMLResponse)
async def session_detail(request: Request, session_id: str):
    session = storage.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    summary = safety_manager.get_summary(session)

    chart_data = []
    for r in session.sensor_records:
        chart_data.append({
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "sensor_id": r.sensor_id,
            "sensor_number": r.sensor_number,
            "wind_speed": r.wind_speed,
            "drag_force": r.drag_force,
            "is_restart": r.is_restart_marker,
            "status": r.status.value,
        })

    reminders_with_details = []
    for r in session.safety_reminders:
        reminder_dict = r.model_dump(mode="json")
        screenshot = next(
            (s for s in session.maintenance_screenshots if s.record_id == r.record_id),
            None
        )
        if screenshot:
            reminder_dict["screenshot"] = screenshot.model_dump(mode="json")
        record = next(
            (rec for rec in session.sensor_records if rec.id == r.record_id),
            None
        )
        if record:
            reminder_dict["record"] = {
                "timestamp": record.timestamp.isoformat(),
                "sensor_id": record.sensor_id,
                "sensor_number": record.sensor_number,
                "wind_speed": record.wind_speed,
                "drag_force": record.drag_force,
            }
        reminders_with_details.append(reminder_dict)

    return templates.TemplateResponse(
        "session.html",
        {
            "request": request,
            "session": session,
            "summary": summary,
            "chart_data": chart_data,
            "reminders": reminders_with_details,
            "device_plate": session.device_plate.model_dump(mode="json") if session.device_plate else None,
        }
    )


@app.post("/api/session")
async def create_session(
    name: str = Form(...),
    date: str = Form(...),
    csv_file: UploadFile = File(...),
    device_file: Optional[UploadFile] = File(None),
):
    import pandas as pd
    from io import StringIO

    content = await csv_file.read()
    csv_content = content.decode("utf-8")

    temp_path = UPLOAD_DIR / f"temp_{uuid.uuid4()}.csv"
    with open(temp_path, "w") as f:
        f.write(csv_content)

    records = importer.import_from_csv(str(temp_path))
    os.remove(temp_path)

    device_plate = None
    if device_file:
        import json
        device_content = await device_file.read()
        device_data = json.loads(device_content.decode("utf-8"))
        device_plate = importer.import_device_plate(device_data)

    session = importer.create_session(name, date, records, device_plate)

    records, restart_events = detector.detect_restarts(session.sensor_records)
    session.sensor_records = records

    pattern_info = detector.analyze_patterns(restart_events)

    session = safety_manager.process_session_reminders(
        session, restart_events, pattern_info
    )

    storage.create_session(session)

    return {
        "session_id": session.id,
        "restart_count": len(restart_events),
        "record_count": len(records),
    }


@app.post("/api/session/{session_id}/screenshot")
async def add_screenshot(
    session_id: str,
    record_id: str = Form(...),
    description: str = Form(...),
    teacher_note: str = Form(...),
    file: UploadFile = File(...),
):
    session = storage.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    file_ext = os.path.splitext(file.filename)[1]
    save_filename = f"{uuid.uuid4()}{file_ext}"
    save_path = UPLOAD_DIR / save_filename

    with open(save_path, "wb") as f:
        f.write(await file.read())

    screenshot = MaintenanceScreenshot(
        id=str(uuid.uuid4()),
        record_id=record_id,
        filename=save_filename,
        uploader="林老师",
        description=description,
        wechat_group_name="设备维修群",
    )

    session.maintenance_screenshots.append(screenshot)

    reminder = safety_manager.get_reminder_by_record(session, record_id)
    if reminder:
        safety_manager.update_after_screenshot(reminder, screenshot, teacher_note)

    storage.update_session(session)

    return {"status": "success", "screenshot_id": screenshot.id}


@app.post("/api/session/{session_id}/check-device")
async def check_device_plate(
    session_id: str,
    record_id: str = Form(...),
    note: str = Form(...),
):
    session = storage.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    reminder = safety_manager.get_reminder_by_record(session, record_id)
    if reminder:
        safety_manager.update_after_device_plate_check(reminder, note)
        storage.update_session(session)
        return {"status": "success"}

    raise HTTPException(status_code=404, detail="未找到安全提醒")


@app.post("/api/session/{session_id}/review")
async def review_reminder(
    session_id: str,
    record_id: str = Form(...),
    note: str = Form(...),
    approve: bool = Form(...),
):
    session = storage.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    reminder = safety_manager.get_reminder_by_record(session, record_id)
    if reminder:
        safety_manager.mark_reviewed(reminder, note, approve)

        for rec in session.sensor_records:
            if rec.id == record_id:
                if approve:
                    rec.status = SensorStatus.VERIFIED
                else:
                    rec.status = SensorStatus.RESTART_DETECTED
                break

        storage.update_session(session)
        return {"status": "success"}

    raise HTTPException(status_code=404, detail="未找到安全提醒")


@app.get("/api/session/{session_id}/data")
async def get_session_data(session_id: str):
    session = storage.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    return {
        "sensor_records": [r.model_dump(mode="json") for r in session.sensor_records],
        "safety_reminders": [r.model_dump(mode="json") for r in session.safety_reminders],
    }


@app.get("/api/sessions")
async def list_sessions():
    return {"sessions": storage.list_sessions()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
