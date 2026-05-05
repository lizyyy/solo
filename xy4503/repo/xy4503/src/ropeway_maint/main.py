import os
import tempfile
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import get_db, init_db
from .importers import (
    CabinInspectionImporter, WireRopeInspectionImporter,
    WindSpeedImporter, GripperLubricationImporter, ReservationPeakImporter
)
from .risk_engine import RiskEngine
from .query_service import QueryService, ExportService

app = FastAPI(
    title="景区索道维保API服务",
    description="用于景区索道维保管理的后端API服务，支持数据导入、风险评估、查询和导出",
    version="0.1.0"
)


@app.on_event("startup")
def startup_event():
    init_db()


class ReviewNoteRequest(BaseModel):
    reviewer: str
    note: str
    action_taken: Optional[str] = None


@app.get("/")
def root():
    return {
        "message": "景区索道维保API服务",
        "version": "0.1.0",
        "endpoints": {
            "导入": [
                "POST /import/cabin-inspection - 导入吊厢点检CSV",
                "POST /import/wire-rope-inspection - 导入钢丝绳探伤JSON",
                "POST /import/wind-speed - 导入风速记录CSV",
                "POST /import/gripper-lubrication - 导入抱索器润滑表CSV",
                "POST /import/reservation-peak - 导入游客预约峰值CSV"
            ],
            "风险评估": [
                "POST /risk/assess - 评估指定日期的风险",
                "GET /risk/shift - 获取指定班次的风险状态"
            ],
            "查询": [
                "GET /query/date - 按日期查询",
                "GET /query/cabin - 按吊厢查询",
                "GET /query/risks - 查询所有风险记录"
            ],
            "导出": [
                "GET /export/markdown - 导出Markdown运营交接单",
                "GET /export/json - 导出JSON审计明细"
            ],
            "复核": [
                "POST /review/note/{risk_id} - 添加人工复核备注"
            ]
        }
    }


@app.post("/import/cabin-inspection")
def import_cabin_inspection(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
        
        count = CabinInspectionImporter.import_csv(tmp_path, db)
        os.unlink(tmp_path)
        
        return {"success": True, "imported_count": count, "message": f"成功导入 {count} 条吊厢点检记录"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@app.post("/import/wire-rope-inspection")
def import_wire_rope_inspection(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
        
        count = WireRopeInspectionImporter.import_json(tmp_path, db)
        os.unlink(tmp_path)
        
        return {"success": True, "imported_count": count, "message": f"成功导入 {count} 条钢丝绳探伤记录"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@app.post("/import/wind-speed")
def import_wind_speed(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
        
        count = WindSpeedImporter.import_csv(tmp_path, db)
        os.unlink(tmp_path)
        
        return {"success": True, "imported_count": count, "message": f"成功导入 {count} 条风速记录"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@app.post("/import/gripper-lubrication")
def import_gripper_lubrication(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
        
        count = GripperLubricationImporter.import_csv(tmp_path, db)
        os.unlink(tmp_path)
        
        return {"success": True, "imported_count": count, "message": f"成功导入 {count} 条抱索器润滑记录"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@app.post("/import/reservation-peak")
def import_reservation_peak(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
        
        count = ReservationPeakImporter.import_csv(tmp_path, db)
        os.unlink(tmp_path)
        
        return {"success": True, "imported_count": count, "message": f"成功导入 {count} 条预约峰值记录"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@app.post("/risk/assess")
def assess_risks(
    date: str = Query(..., description="评估日期，格式: YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    try:
        check_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD 格式")
    
    risk_engine = RiskEngine(db)
    risks = risk_engine.assess_all_risks(check_date)
    
    return {
        "success": True,
        "date": date,
        "total_risks": len(risks),
        "risks": risks
    }


@app.get("/risk/shift")
def get_shift_risks(
    date: str = Query(..., description="班次日期，格式: YYYY-MM-DD"),
    shift_name: str = Query(..., description="班次名称，如: 早班、中班、晚班"),
    db: Session = Depends(get_db)
):
    try:
        shift_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD 格式")
    
    risk_engine = RiskEngine(db)
    result = risk_engine.get_shift_risks(shift_date, shift_name)
    
    return result


@app.get("/query/date")
def query_by_date(
    date: str = Query(..., description="查询日期，格式: YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    try:
        query_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD 格式")
    
    query_service = QueryService(db)
    result = query_service.query_by_date(query_date)
    
    return result


@app.get("/query/cabin")
def query_by_cabin(
    cabin_number: str = Query(..., description="吊厢编号"),
    db: Session = Depends(get_db)
):
    query_service = QueryService(db)
    result = query_service.query_by_cabin(cabin_number)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@app.get("/query/risks")
def query_risks(
    status: Optional[str] = Query(None, description="风险状态筛选: 待处理/已处理/已忽略"),
    db: Session = Depends(get_db)
):
    query_service = QueryService(db)
    risks = query_service.query_all_risks(status)
    
    return {
        "count": len(risks),
        "risks": risks
    }


@app.post("/review/note/{risk_id}")
def add_review_note(
    risk_id: int,
    request: ReviewNoteRequest,
    db: Session = Depends(get_db)
):
    query_service = QueryService(db)
    result = query_service.add_review_note(
        risk_id=risk_id,
        reviewer=request.reviewer,
        note=request.note,
        action_taken=request.action_taken
    )
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@app.get("/export/markdown")
def export_markdown(
    date: str = Query(..., description="导出日期，格式: YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    try:
        export_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD 格式")
    
    export_service = ExportService(db)
    markdown = export_service.export_markdown_handover(export_date)
    
    return PlainTextResponse(
        content=markdown,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=handover_{date}.md"
        }
    )


@app.get("/export/json")
def export_json(
    start_date: str = Query(..., description="开始日期，格式: YYYY-MM-DD"),
    end_date: str = Query(..., description="结束日期，格式: YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD 格式")
    
    export_service = ExportService(db)
    audit_data = export_service.export_json_audit(start, end)
    
    return JSONResponse(
        content=audit_data,
        headers={
            "Content-Disposition": f"attachment; filename=audit_{start_date}_to_{end_date}.json"
        }
    )


def main():
    import uvicorn
    uvicorn.run(
        "ropeway_maint.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )


if __name__ == "__main__":
    main()
