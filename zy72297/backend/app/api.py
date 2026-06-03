from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel as PydanticModel
from typing import Optional
from pathlib import Path

from .service import (
    create_profile,
    get_profile,
    list_profiles,
    import_coordinate_origin,
    attach_inspection_photo,
    update_annotation,
    resolve_conflict,
    export_detail,
)

app = FastAPI(title="道路积水深度剖面系统")


class CreateProfileRequest(PydanticModel):
    project_name: str
    coordinate_origin_description: str


class ImportOriginRequest(PydanticModel):
    lines: list[str]
    operator: str = "system"


class AttachPhotoRequest(PydanticModel):
    obstacle_id: str
    photo_id: str
    photo_description: str
    operator: str = "许工"


class UpdateAnnotationRequest(PydanticModel):
    obstacle_id: str
    new_depth: Optional[float] = None
    new_position: Optional[dict] = None
    operator: str = "许工"


class ResolveConflictRequest(PydanticModel):
    conflict_id: str
    chosen_name: str
    operator: str
    rollback: bool = False


STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"

@app.get("/")
async def index():
    return HTMLResponse(content=open(STATIC_DIR / "index.html", encoding="utf-8").read())


@app.post("/api/profiles")
async def api_create_profile(req: CreateProfileRequest):
    return create_profile(req.project_name, req.coordinate_origin_description).model_dump(mode="json")


@app.get("/api/profiles")
async def api_list_profiles():
    return list_profiles()


@app.get("/api/profiles/{profile_id}")
async def api_get_profile(profile_id: str):
    try:
        return get_profile(profile_id).model_dump(mode="json")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Profile not found")


@app.post("/api/profiles/{profile_id}/import-origin")
async def api_import_origin(profile_id: str, req: ImportOriginRequest):
    try:
        return import_coordinate_origin(profile_id, req.lines, req.operator).model_dump(mode="json")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Profile not found")


@app.post("/api/profiles/{profile_id}/attach-photo")
async def api_attach_photo(profile_id: str, req: AttachPhotoRequest):
    try:
        return attach_inspection_photo(
            profile_id, req.obstacle_id, req.photo_id, req.photo_description, req.operator
        ).model_dump(mode="json")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Profile not found")


@app.post("/api/profiles/{profile_id}/update-annotation")
async def api_update_annotation(profile_id: str, req: UpdateAnnotationRequest):
    try:
        return update_annotation(
            profile_id, req.obstacle_id, req.new_depth, req.new_position, req.operator
        ).model_dump(mode="json")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Profile not found")


@app.post("/api/profiles/{profile_id}/resolve-conflict")
async def api_resolve_conflict(profile_id: str, req: ResolveConflictRequest):
    try:
        return resolve_conflict(
            profile_id, req.conflict_id, req.chosen_name, req.operator, req.rollback
        ).model_dump(mode="json")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Profile not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/profiles/{profile_id}/export")
async def api_export_detail(profile_id: str):
    try:
        return export_detail(profile_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Profile not found")


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
