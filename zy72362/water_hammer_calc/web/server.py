from __future__ import annotations
from collections import Counter
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from ..api.main import app as api_app, data_store
from ..models import CalcStatus

app = FastAPI()

app.mount("/api", api_app)

app.mount("/static", StaticFiles(directory="water_hammer_calc/web/static"), name="static")

templates = Jinja2Templates(directory="water_hammer_calc/web/templates")

STATUS_COLOR_MAP = {
    "DRAFT": "primary",
    "NEEDS_REVIEW": "warning",
    "REVIEWED_BY_TRAINER": "info",
    "APPROVED": "success",
    "REJECTED": "danger",
    "FINALIZED": "secondary",
}

STATUS_BADGE_BG = {
    "DRAFT": "bg-primary",
    "NEEDS_REVIEW": "bg-warning text-dark",
    "REVIEWED_BY_TRAINER": "bg-info",
    "APPROVED": "bg-success",
    "REJECTED": "bg-danger",
    "FINALIZED": "bg-secondary",
}


@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    nameplate_count = len(data_store.list_nameplates())
    screenshot_count = len(data_store.list_screenshots())
    calc_ids = data_store.list_calculations()
    calculation_count = len(calc_ids)

    status_counts = Counter()
    for cid in calc_ids:
        loaded = data_store.load_calculation(cid)
        if loaded:
            _, result = loaded
            status_key = CalcStatus(result.status).name
            status_counts[status_key] += 1

    status_breakdown = []
    for status_name in ["DRAFT", "NEEDS_REVIEW", "REVIEWED_BY_TRAINER", "APPROVED", "REJECTED", "FINALIZED"]:
        status_breakdown.append({
            "name": status_name,
            "label": CalcStatus[status_name].value,
            "count": status_counts.get(status_name, 0),
            "badge_class": STATUS_BADGE_BG[status_name],
            "color": STATUS_COLOR_MAP[status_name],
        })

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "nameplate_count": nameplate_count,
        "screenshot_count": screenshot_count,
        "calculation_count": calculation_count,
        "status_breakdown": status_breakdown,
    })


@app.get("/calculations/{calc_id}", response_class=HTMLResponse)
def calculation_detail(request: Request, calc_id: str):
    loaded = data_store.load_calculation(calc_id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Calculation not found")
    input_data, result = loaded

    status_name = CalcStatus(result.status).name
    status_label = result.status
    status_badge = STATUS_BADGE_BG[status_name]
    status_color = STATUS_COLOR_MAP[status_name]

    has_override_without_reason = any(
        f.needs_review and (f.reason is None or f.reason.strip() == "")
        for f in result.override_flags
    )

    change_history = [c.model_dump(mode="json") for c in result.change_history]
    parameter_entries = [p.model_dump(mode="json") for p in result.parameter_entries]
    override_flags = [f.model_dump(mode="json") for f in result.override_flags]

    nameplate_link = None
    for entry in result.parameter_entries:
        if entry.provenance.source.value == "设备铭牌参数" and "equipment_id" in entry.provenance.detail:
            try:
                import json
                detail = json.loads(entry.provenance.detail)
                if "equipment_id" in detail:
                    nameplate_link = f"/api/nameplates/{detail['equipment_id']}"
                    break
            except Exception:
                pass

    return templates.TemplateResponse("calc_detail.html", {
        "request": request,
        "calc_id": calc_id,
        "status_name": status_name,
        "status_label": status_label,
        "status_badge": status_badge,
        "status_color": status_color,
        "engineer_name": result.engineer_name,
        "trainer_name": result.trainer_name,
        "reviewed_by_engineer": result.reviewed_by_engineer,
        "reviewed_by_trainer": result.reviewed_by_trainer,
        "has_override_without_reason": has_override_without_reason,
        "change_history": change_history,
        "parameter_entries": parameter_entries,
        "override_flags": override_flags,
        "replay_link": f"/calculations/{calc_id}/replay",
        "nameplate_link": nameplate_link or "/api/nameplates",
        "max_pressure": result.max_pressure,
        "pressure_rise": result.pressure_rise,
        "classification": result.classification,
        "wave_speed_used": result.wave_speed_used,
        "joukowsky_pressure": result.joukowsky_pressure,
    })


@app.get("/calculations/{calc_id}/replay", response_class=HTMLResponse)
def calculation_replay(request: Request, calc_id: str):
    loaded = data_store.load_calculation(calc_id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Calculation not found")
    input_data, result = loaded

    status_name = CalcStatus(result.status).name
    status_label = result.status
    status_badge = STATUS_BADGE_BG[status_name]

    parameter_entries = [p.model_dump(mode="json") for p in result.parameter_entries]
    override_flags = [f.model_dump(mode="json") for f in result.override_flags]
    change_history = [c.model_dump(mode="json") for c in result.change_history]

    all_next_actions = []
    all_missing_materials = []
    for entry in result.parameter_entries:
        if entry.next_action and entry.next_action.strip():
            all_next_actions.append({
                "param": entry.name,
                "action": entry.next_action,
            })
        if entry.missing_materials:
            for m in entry.missing_materials:
                all_missing_materials.append({
                    "param": entry.name,
                    "material": m,
                })

    modifiable_params = [
        {"name": f.parameter_name, "original": f.original_value, "overridden": f.overridden_value}
        for f in result.override_flags
    ]

    return templates.TemplateResponse("calc_replay.html", {
        "request": request,
        "calc_id": calc_id,
        "status_name": status_name,
        "status_label": status_label,
        "status_badge": status_badge,
        "engineer_name": result.engineer_name,
        "trainer_name": result.trainer_name,
        "reviewed_by_engineer": result.reviewed_by_engineer,
        "reviewed_by_trainer": result.reviewed_by_trainer,
        "parameter_entries": parameter_entries,
        "override_flags": override_flags,
        "change_history": change_history,
        "replay_narrative": result.replay_narrative,
        "all_next_actions": all_next_actions,
        "all_missing_materials": all_missing_materials,
        "modifiable_params": modifiable_params,
        "detail_link": f"/calculations/{calc_id}",
        "export_link": f"/api/calculations/{calc_id}/export",
        "available_screenshots": data_store.list_screenshots(),
    })
