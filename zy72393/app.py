from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from typing import Optional, List
import os
import uuid
import shutil
from datetime import datetime

from sail_lift_curve.workflow import WorkflowEngine
from sail_lift_curve.visualizer import plot_lift_curve_2d, plot_lift_curve_3d, generate_summary_chart

app = FastAPI(title="实验风帆升力曲线")

UPLOAD_DIR = "./uploads"
OUTPUT_DIR = "./output"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

templates = Jinja2Templates(directory="templates")

projects: dict[str, WorkflowEngine] = {}


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    project_list = []
    if os.path.exists(OUTPUT_DIR):
        for f in os.listdir(OUTPUT_DIR):
            if f.startswith("project_") and f.endswith(".json"):
                pid = f.replace("project_", "").replace(".json", "")
                project_list.append({"id": pid, "file": f})
    
    return templates.TemplateResponse("index.html", {
        "request": request,
        "projects": project_list,
    })


@app.post("/api/import")
async def api_import(file: UploadFile = File(...), name: str = Form("风帆升力曲线项目")):
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}_{file.filename}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    try:
        engine = WorkflowEngine(name=name)
        records, thresholds = engine.step1_import_equipment(file_path)
        projects[engine.state.project_id] = engine
        
        project_path = engine.save_project(OUTPUT_DIR)
        
        return JSONResponse({
            "success": True,
            "project_id": engine.state.project_id,
            "total_records": len(records),
            "threshold_count": len(thresholds),
            "step": engine.state.step,
            "step_description": engine.state.step_description,
            "project_path": project_path,
        })
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=400)


@app.get("/api/project/{project_id}")
async def get_project(project_id: str):
    if not os.path.exists(os.path.join(OUTPUT_DIR, f"project_{project_id}.json")):
        raise HTTPException(status_code=404, detail="项目不存在")
    
    engine = WorkflowEngine.load_project(os.path.join(OUTPUT_DIR, f"project_{project_id}.json"))
    projects[project_id] = engine
    
    status_counts = {}
    for r in engine.state.equipment_records:
        status_counts[r.status] = status_counts.get(r.status, 0) + 1
    
    threshold_summaries = []
    for t in engine.state.threshold_records:
        equip = None
        for r in engine.state.equipment_records:
            if r.record_id == t.equipment_record_id:
                equip = r
                break
        conversion = None
        for n in engine.state.unit_conversion_notes:
            if n.threshold_record_id == t.record_id:
                conversion = n
                break
        threshold_summaries.append({
            "record_id": t.record_id,
            "equipment_id": equip.equipment_id if equip else None,
            "equipment_name": equip.equipment_name if equip else None,
            "raw_value": t.raw_value,
            "averaged_value": t.averaged_value,
            "deviation_percent": t.deviation_percent,
            "status": t.status,
            "screenshot_ref": equip.maintenance_screenshot_ref if equip else None,
            "has_conversion": conversion is not None,
            "conversion": {
                "why_kept": conversion.why_kept if conversion else "",
                "missing_materials": conversion.missing_materials if conversion else "",
                "next_action": conversion.next_action if conversion else "",
                "contact_person": conversion.contact_person if conversion else "",
            } if conversion else None,
        })
    
    return JSONResponse({
        "project_id": engine.state.project_id,
        "name": engine.state.name,
        "step": engine.state.step,
        "step_description": engine.state.step_description,
        "total_records": len(engine.state.equipment_records),
        "threshold_count": len(engine.state.threshold_records),
        "pending_count": len(engine.get_pending_threshold_records()),
        "confirmed_count": len(engine.get_confirmed_records()),
        "status_counts": status_counts,
        "threshold_records": threshold_summaries,
    })


@app.post("/api/project/{project_id}/review")
async def review_record(
    project_id: str,
    threshold_id: str = Form(...),
    screenshot_ref: Optional[str] = Form(None),
    notes: str = Form(""),
    confirm: bool = Form(False),
):
    project_file = os.path.join(OUTPUT_DIR, f"project_{project_id}.json")
    if not os.path.exists(project_file):
        raise HTTPException(status_code=404, detail="项目不存在")
    
    engine = WorkflowEngine.load_project(project_file)
    
    result = engine.step2_laocen_review(
        threshold_record_id=threshold_id,
        screenshot_ref=screenshot_ref,
        reviewer_notes=notes,
        confirm=confirm,
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="阈值记录不存在")
    
    engine.save_project(OUTPUT_DIR)
    projects[project_id] = engine
    
    return JSONResponse({
        "success": True,
        "threshold_id": threshold_id,
        "status": result.status,
        "confirmed_by": result.confirmed_by,
    })


@app.post("/api/project/{project_id}/convert")
async def update_conversion(
    project_id: str,
    threshold_id: str = Form(...),
    original_unit: str = Form("Cl"),
    converted_unit: str = Form("kgf"),
    factor: float = Form(9.8),
    why_kept: str = Form(...),
    missing: str = Form(...),
    next_action: str = Form(...),
    contact: str = Form("老岑"),
):
    project_file = os.path.join(OUTPUT_DIR, f"project_{project_id}.json")
    if not os.path.exists(project_file):
        raise HTTPException(status_code=404, detail="项目不存在")
    
    engine = WorkflowEngine.load_project(project_file)
    
    note = engine.step3_update_conversion_note(
        threshold_record_id=threshold_id,
        original_unit=original_unit,
        converted_unit=converted_unit,
        conversion_factor=factor,
        why_kept=why_kept,
        missing_materials=missing,
        next_action=next_action,
        contact_person=contact,
    )
    
    if not note:
        raise HTTPException(status_code=404, detail="阈值记录不存在")
    
    engine.save_project(OUTPUT_DIR)
    projects[project_id] = engine
    
    return JSONResponse({
        "success": True,
        "note_id": note.record_id,
        "converted_value": note.converted_value,
    })


@app.get("/api/project/{project_id}/plot/{mode}")
async def get_plot(project_id: str, mode: str):
    project_file = os.path.join(OUTPUT_DIR, f"project_{project_id}.json")
    if not os.path.exists(project_file):
        raise HTTPException(status_code=404, detail="项目不存在")
    
    engine = WorkflowEngine.load_project(project_file)
    curve_data = engine.get_lift_curve_data()
    
    if mode == "2d":
        fig = plot_lift_curve_2d(curve_data, engine.state.equipment_records, engine.state.threshold_records)
    elif mode == "3d":
        fig = plot_lift_curve_3d(curve_data, engine.state.equipment_records, engine.state.threshold_records)
    elif mode == "summary":
        fig = generate_summary_chart(engine.state.equipment_records, engine.state.threshold_records)
    else:
        raise HTTPException(status_code=400, detail="不支持的图表类型")
    
    plot_path = os.path.join(OUTPUT_DIR, f"plot_{project_id}_{mode}.html")
    fig.write_html(plot_path, include_plotlyjs="cdn")
    
    return FileResponse(plot_path, media_type="text/html")


@app.get("/api/project/{project_id}/record/{record_id}")
async def get_record_detail(project_id: str, record_id: str):
    project_file = os.path.join(OUTPUT_DIR, f"project_{project_id}.json")
    if not os.path.exists(project_file):
        raise HTTPException(status_code=404, detail="项目不存在")
    
    engine = WorkflowEngine.load_project(project_file)
    detail = engine.get_record_detail(record_id)
    
    if not detail:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    result = {
        "equipment_record": {
            "record_id": detail["equipment_record"].record_id,
            "equipment_id": detail["equipment_record"].equipment_id,
            "equipment_name": detail["equipment_record"].equipment_name,
            "nameplate_params": detail["equipment_record"].nameplate_params,
            "lift_coefficient": detail["equipment_record"].lift_coefficient,
            "angle_of_attack": detail["equipment_record"].angle_of_attack,
            "wind_speed": detail["equipment_record"].wind_speed,
            "measurement_time": detail["equipment_record"].measurement_time.isoformat(),
            "raw_value": detail["equipment_record"].raw_value,
            "averaged_value": detail["equipment_record"].averaged_value,
            "threshold_upper": detail["equipment_record"].threshold_upper,
            "threshold_lower": detail["equipment_record"].threshold_lower,
            "status": detail["equipment_record"].status,
            "notes": detail["equipment_record"].notes,
            "screenshot_ref": detail["equipment_record"].maintenance_screenshot_ref,
        },
        "threshold_record": None,
        "conversion_note": None,
    }
    
    if detail["threshold_record"]:
        t = detail["threshold_record"]
        result["threshold_record"] = {
            "record_id": t.record_id,
            "raw_value": t.raw_value,
            "averaged_value": t.averaged_value,
            "threshold_upper": t.threshold_upper,
            "threshold_lower": t.threshold_lower,
            "deviation_percent": t.deviation_percent,
            "status": t.status,
            "confirmed_by": t.confirmed_by,
            "confirmed_time": t.confirmed_time.isoformat() if t.confirmed_time else None,
        }
    
    if detail["conversion_note"]:
        n = detail["conversion_note"]
        result["conversion_note"] = {
            "record_id": n.record_id,
            "original_unit": n.original_unit,
            "converted_unit": n.converted_unit,
            "original_value": n.original_value,
            "converted_value": n.converted_value,
            "why_kept": n.why_kept,
            "missing_materials": n.missing_materials,
            "next_action": n.next_action,
            "contact_person": n.contact_person,
            "last_updated": n.last_updated.isoformat() if n.last_updated else None,
        }
    
    return JSONResponse(result)


@app.get("/api/project/{project_id}/report")
async def get_report(project_id: str):
    project_file = os.path.join(OUTPUT_DIR, f"project_{project_id}.json")
    if not os.path.exists(project_file):
        raise HTTPException(status_code=404, detail="项目不存在")
    
    engine = WorkflowEngine.load_project(project_file)
    report_text = engine.generate_report_text()
    
    report_path = os.path.join(OUTPUT_DIR, f"report_{project_id}.txt")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_text)
    
    return FileResponse(report_path, media_type="text/plain", filename=f"report_{project_id}.txt")


@app.get("/project/{project_id}", response_class=HTMLResponse)
async def project_page(request: Request, project_id: str):
    return templates.TemplateResponse("project.html", {
        "request": request,
        "project_id": project_id,
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
