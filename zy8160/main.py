from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime, time
from pathlib import Path
import shutil
import aiofiles

import database as db
import schemas
from config import settings
from services import ImportService, ValidationService, ExportService

app = FastAPI(
    title=settings.APP_NAME,
    description="影视制片拍摄计划检查与通告单导出服务",
    version="1.0.0"
)


@app.on_event("startup")
def startup_event():
    db.init_db()


def get_db_session():
    session = db.SessionLocal()
    try:
        yield session
    finally:
        session.close()


@app.post("/import", response_model=schemas.ImportResult)
async def import_data(
    scenes: Optional[UploadFile] = File(None, description="场景数据 CSV 文件"),
    crew: Optional[UploadFile] = File(None, description="剧组人员 JSON 文件"),
    locations: Optional[UploadFile] = File(None, description="拍摄地点 YAML 文件"),
    weather: Optional[UploadFile] = File(None, description="天气数据 JSON 文件"),
    db_session: Session = Depends(get_db_session)
):
    upload_dir = settings.UPLOAD_DIR
    scenes_count = 0
    crew_count = 0
    locations_count = 0
    weather_count = 0

    import_service = ImportService(db_session)

    if scenes:
        file_path = upload_dir / scenes.filename
        async with aiofiles.open(file_path, 'wb') as f:
            content = await scenes.read()
            await f.write(content)
        scenes_count = import_service.import_scenes_csv(file_path)

    if crew:
        file_path = upload_dir / crew.filename
        async with aiofiles.open(file_path, 'wb') as f:
            content = await crew.read()
            await f.write(content)
        crew_count = import_service.import_crew_json(file_path)

    if locations:
        file_path = upload_dir / locations.filename
        async with aiofiles.open(file_path, 'wb') as f:
            content = await locations.read()
            await f.write(content)
        locations_count = import_service.import_locations_yaml(file_path)

    if weather:
        file_path = upload_dir / weather.filename
        async with aiofiles.open(file_path, 'wb') as f:
            content = await weather.read()
            await f.write(content)
        weather_count = import_service.import_weather_json(file_path)

    total = scenes_count + crew_count + locations_count + weather_count
    message = f"导入完成。共导入 {total} 条记录：场景 {scenes_count} 条，剧组人员 {crew_count} 条，地点 {locations_count} 条，天气 {weather_count} 条"

    return schemas.ImportResult(
        scenes_imported=scenes_count,
        crew_imported=crew_count,
        locations_imported=locations_count,
        weather_imported=weather_count,
        message=message
    )


@app.get("/plans/{date_str}/validate", response_model=schemas.ValidationResult)
def validate_plans(
    date_str: str,
    db_session: Session = Depends(get_db_session)
):
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="日期格式错误，请使用 YYYY-MM-DD 格式"
        )

    validation_service = ValidationService(db_session)
    result = validation_service.validate_day_plans(target_date)

    return result


@app.get("/call-sheet/export", response_model=schemas.CallSheetExport)
def export_call_sheet(
    date: str,
    include_validation_notes: bool = True,
    db_session: Session = Depends(get_db_session)
):
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="日期格式错误，请使用 YYYY-MM-DD 格式"
        )

    export_service = ExportService(db_session)
    result = export_service.export_call_sheet(
        target_date=target_date,
        include_validation_notes=include_validation_notes
    )

    return result


@app.get("/call-sheet/export/markdown", response_class=PlainTextResponse)
def export_call_sheet_markdown(
    date: str,
    include_validation_notes: bool = True,
    db_session: Session = Depends(get_db_session)
):
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="日期格式错误，请使用 YYYY-MM-DD 格式"
        )

    export_service = ExportService(db_session)
    result = export_service.export_call_sheet(
        target_date=target_date,
        include_validation_notes=include_validation_notes
    )

    return result.markdown_content


@app.post("/plans/add")
def add_shooting_plan(
    scene_number: str,
    date: str,
    start_time: str,
    end_time: str,
    crew_name: Optional[str] = None,
    notes: Optional[str] = None,
    db_session: Session = Depends(get_db_session)
):
    scene = db_session.query(db.Scene).filter(
        db.Scene.scene_number == scene_number
    ).first()

    if not scene:
        raise HTTPException(
            status_code=404,
            detail=f"场景 {scene_number} 不存在"
        )

    try:
        plan_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="日期格式错误，请使用 YYYY-MM-DD 格式"
        )

    try:
        start = datetime.strptime(start_time, "%H:%M").time()
        end = datetime.strptime(end_time, "%H:%M").time()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="时间格式错误，请使用 HH:MM 格式"
        )

    crew_id = None
    if crew_name:
        crew = db_session.query(db.Crew).filter(
            db.Crew.name == crew_name
        ).first()
        if crew:
            crew_id = crew.id

    plan = db.ShootingPlan(
        scene_id=scene.id,
        date=plan_date,
        start_time=start,
        end_time=end,
        crew_id=crew_id,
        notes=notes
    )

    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)

    return {
        "message": "拍摄计划添加成功",
        "plan_id": plan.id,
        "scene_number": scene_number,
        "date": plan_date,
        "time": f"{start} - {end}"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}
