from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import json
import csv
import io
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.models import (
    PCBData, BOMItem, RuleSet, Rule, CheckResult, 
    Issue, IssueStatus, IssueSeverity, VersionInfo
)
from app.services.rule_engine import RuleEngine
from app.services.report_generator import ReportGenerator
from app.utils import load_json_file, save_json_file

app = FastAPI(
    title="PCB Pre-Validation Tool",
    description="PCB打样前预审工具 - 导入数据、规则检查、可视化",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")

current_project: Dict[str, Any] = {
    "pcb_data": None,
    "bom_items": [],
    "pick_place_items": [],
    "rule_set": None,
    "check_results": [],
    "versions": []
}

version_counter = 0

def get_next_version_id() -> str:
    global version_counter
    version_counter += 1
    return f"v{version_counter}"

@app.get("/")
async def root():
    return {"message": "PCB Pre-Validation Tool API", "version": "1.0.0"}

@app.post("/import/board")
async def import_board(file: UploadFile = File(...)):
    try:
        content = await file.read()
        board_data = json.loads(content)
        
        pcb_data = PCBData(**board_data)
        current_project["pcb_data"] = pcb_data.model_dump()
        
        return JSONResponse(content={
            "success": True,
            "message": f"成功导入板数据: {pcb_data.name}",
            "data": pcb_data.model_dump()
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")

@app.post("/import/bom")
async def import_bom(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(text))
        
        bom_items = []
        for row in csv_reader:
            item = BOMItem(
                reference=row.get("Reference", ""),
                part_number=row.get("PartNumber", row.get("Part Number", "")),
                description=row.get("Description", ""),
                footprint=row.get("Footprint", row.get("Package", "")),
                quantity=int(row.get("Quantity", row.get("Qty", 1))),
                manufacturer=row.get("Manufacturer", ""),
                value=row.get("Value", "")
            )
            bom_items.append(item)
        
        current_project["bom_items"] = [item.model_dump() for item in bom_items]
        
        return JSONResponse(content={
            "success": True,
            "message": f"成功导入BOM: {len(bom_items)} 项",
            "count": len(bom_items)
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")

@app.post("/import/pick-place")
async def import_pick_place(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(text))
        
        pick_place_items = []
        for row in csv_reader:
            item = {
                "reference": row.get("Designator", row.get("Reference", "")),
                "x": float(row.get("X", row.get("Mid X", 0))),
                "y": float(row.get("Y", row.get("Mid Y", 0))),
                "rotation": float(row.get("Rotation", row.get("Rot", 0))),
                "layer": row.get("Layer", row.get("Side", "top")).lower(),
                "part_number": row.get("PartNumber", row.get("Part Number", "")),
                "description": row.get("Description", "")
            }
            pick_place_items.append(item)
        
        current_project["pick_place_items"] = pick_place_items
        
        return JSONResponse(content={
            "success": True,
            "message": f"成功导入Pick-and-Place: {len(pick_place_items)} 项",
            "count": len(pick_place_items)
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")

@app.post("/import/rules")
async def import_rules(file: UploadFile = File(...)):
    try:
        content = await file.read()
        rules_data = json.loads(content)
        
        rule_set = RuleSet(**rules_data)
        current_project["rule_set"] = rule_set.model_dump()
        
        return JSONResponse(content={
            "success": True,
            "message": f"成功导入规则: {len(rule_set.rules)} 条",
            "data": rule_set.model_dump()
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")

@app.get("/data/board")
async def get_board_data():
    if not current_project["pcb_data"]:
        raise HTTPException(status_code=404, detail="未导入板数据")
    return JSONResponse(content=current_project["pcb_data"])

@app.get("/data/bom")
async def get_bom_data():
    return JSONResponse(content={"items": current_project["bom_items"]})

@app.get("/data/rules")
async def get_rules():
    if not current_project["rule_set"]:
        raise HTTPException(status_code=404, detail="未导入规则")
    return JSONResponse(content=current_project["rule_set"])

@app.put("/data/rules/{rule_id}")
async def update_rule(rule_id: str, rule: Rule):
    if not current_project["rule_set"]:
        raise HTTPException(status_code=404, detail="未导入规则")
    
    for i, r in enumerate(current_project["rule_set"]["rules"]):
        if r["id"] == rule_id:
            current_project["rule_set"]["rules"][i] = rule.model_dump()
            return JSONResponse(content={"success": True, "message": f"规则 {rule_id} 已更新"})
    
    raise HTTPException(status_code=404, detail=f"规则 {rule_id} 未找到")

@app.post("/check/run")
async def run_check():
    if not current_project["pcb_data"]:
        raise HTTPException(status_code=400, detail="请先导入板数据")
    if not current_project["rule_set"]:
        raise HTTPException(status_code=400, detail="请先导入规则")
    
    try:
        pcb_data = PCBData(**current_project["pcb_data"])
        rule_set = RuleSet(**current_project["rule_set"])
        bom_items = [BOMItem(**item) for item in current_project["bom_items"]]
        
        engine = RuleEngine(pcb_data, rule_set, bom_items)
        results = engine.run_all_checks()
        
        version_id = get_next_version_id()
        timestamp = datetime.now().isoformat()
        
        check_result = CheckResult(
            version_id=version_id,
            timestamp=timestamp,
            issues=[Issue(**issue) for issue in results["issues"]],
            statistics=results["statistics"],
            summary=results["summary"]
        )
        
        current_project["check_results"].append(check_result.model_dump())
        
        version_info = VersionInfo(
            version_id=version_id,
            timestamp=timestamp,
            issue_count=check_result.statistics.total,
            critical_count=check_result.statistics.critical,
            warning_count=check_result.statistics.warning,
            info_count=check_result.statistics.info
        )
        current_project["versions"].append(version_info.model_dump())
        
        return JSONResponse(content={
            "success": True,
            "version_id": version_id,
            "data": check_result.model_dump()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"检查失败: {str(e)}")

@app.get("/check/results")
async def get_check_results():
    return JSONResponse(content={
        "results": current_project["check_results"],
        "versions": current_project["versions"]
    })

@app.get("/check/results/{version_id}")
async def get_check_result(version_id: str):
    for result in current_project["check_results"]:
        if result["version_id"] == version_id:
            return JSONResponse(content=result)
    raise HTTPException(status_code=404, detail=f"版本 {version_id} 未找到")

@app.put("/check/results/{version_id}/issues/{issue_id}")
async def update_issue_status(version_id: str, issue_id: str, status: str):
    for result in current_project["check_results"]:
        if result["version_id"] == version_id:
            for issue in result["issues"]:
                if issue["id"] == issue_id:
                    try:
                        issue["status"] = IssueStatus(status.upper())
                    except ValueError:
                        raise HTTPException(status_code=400, detail=f"无效的状态: {status}")
                    return JSONResponse(content={
                        "success": True,
                        "message": f"问题 {issue_id} 状态已更新为 {status}"
                    })
    raise HTTPException(status_code=404, detail=f"问题未找到")

@app.get("/compare/{version1_id}/{version2_id}")
async def compare_versions(version1_id: str, version2_id: str):
    result1 = None
    result2 = None
    
    for result in current_project["check_results"]:
        if result["version_id"] == version1_id:
            result1 = result
        if result["version_id"] == version2_id:
            result2 = result
    
    if not result1 or not result2:
        raise HTTPException(status_code=404, detail="版本未找到")
    
    comparison = {
        "version1": version1_id,
        "version2": version2_id,
        "version1_stats": result1["statistics"],
        "version2_stats": result2["statistics"],
        "differences": {
            "total_change": result2["statistics"]["total"] - result1["statistics"]["total"],
            "critical_change": result2["statistics"]["critical"] - result1["statistics"]["critical"],
            "warning_change": result2["statistics"]["warning"] - result1["statistics"]["warning"],
            "info_change": result2["statistics"]["info"] - result1["statistics"]["info"]
        }
    }
    
    return JSONResponse(content=comparison)

@app.post("/export/{version_id}/{format}")
async def export_report(version_id: str, format: str):
    for result in current_project["check_results"]:
        if result["version_id"] == version_id:
            generator = ReportGenerator()
            report_data = {
                "version_id": version_id,
                "timestamp": result["timestamp"],
                "issues": result["issues"],
                "statistics": result["statistics"],
                "summary": result["summary"]
            }
            
            if format.lower() == "json":
                return JSONResponse(content=report_data)
            elif format.lower() == "markdown":
                md_content = generator.generate_markdown(report_data)
                output_path = DATA_DIR / f"report_{version_id}.md"
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(md_content)
                return FileResponse(
                    path=str(output_path),
                    media_type="text/markdown",
                    filename=f"report_{version_id}.md"
                )
            elif format.lower() == "html":
                html_content = generator.generate_html(report_data)
                output_path = DATA_DIR / f"report_{version_id}.html"
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(html_content)
                return FileResponse(
                    path=str(output_path),
                    media_type="text/html",
                    filename=f"report_{version_id}.html"
                )
            else:
                raise HTTPException(status_code=400, detail=f"不支持的格式: {format}")
    
    raise HTTPException(status_code=404, detail=f"版本 {version_id} 未找到")

@app.get("/data/seeds")
async def get_seed_data_list():
    seed_files = [
        {"name": "sample_board.json", "description": "示例板数据"},
        {"name": "sample_bom.csv", "description": "示例BOM"},
        {"name": "sample_rules.json", "description": "示例规则"},
        {"name": "error_board.json", "description": "含错误的板数据"},
        {"name": "sample_pick_place.csv", "description": "示例贴片数据"}
    ]
    return JSONResponse(content={"seeds": seed_files})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
