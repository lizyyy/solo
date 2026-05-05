from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
import json

from database import get_db, init_db, RingRecord, RiskStatus
from data_importer import DataImporter
from risk_analyzer import RiskAnalyzer
from exporter import Exporter

app = FastAPI(
    title="盾构施工测量风险分析系统",
    description="地铁盾构施工测量员专用后端 API 服务，用于数据导入、风险分析、查询改判和导出功能",
    version="1.0.0"
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.post("/api/rings/import", summary="导入环号数据")
async def import_ring_data(
    ring_number: int = Form(..., description="环号"),
    segment_layout: Optional[UploadFile] = File(None, description="管片排版表 CSV 文件"),
    jack_stroke: Optional[UploadFile] = File(None, description="千斤顶行程 CSV 文件"),
    grouting: Optional[UploadFile] = File(None, description="同步注浆量 CSV 文件"),
    measurement: Optional[UploadFile] = File(None, description="测量点偏差 CSV 文件"),
    db: Session = Depends(get_db)
):
    existing = db.query(RingRecord).filter(RingRecord.ring_number == ring_number).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"环号 {ring_number} 已存在")
    
    segment_layout_content = await segment_layout.read() if segment_layout else None
    jack_stroke_content = await jack_stroke.read() if jack_stroke else None
    grouting_content = await grouting.read() if grouting else None
    measurement_content = await measurement.read() if measurement else None
    
    ring_data = DataImporter.import_ring_data(
        ring_number=ring_number,
        segment_layout_content=segment_layout_content.decode('utf-8') if segment_layout_content else None,
        jack_stroke_content=jack_stroke_content.decode('utf-8') if jack_stroke_content else None,
        grouting_content=grouting_content.decode('utf-8') if grouting_content else None,
        measurement_content=measurement_content.decode('utf-8') if measurement_content else None
    )
    
    record = RingRecord(**ring_data)
    db.add(record)
    db.commit()
    db.refresh(record)
    
    analysis_result = RiskAnalyzer.analyze_all(record)
    for key, value in analysis_result.items():
        setattr(record, key, value)
    record.analyzed_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    
    return {
        "message": f"环号 {ring_number} 导入成功并完成风险分析",
        "ring_number": ring_number,
        "overall_risk": record.overall_risk.value,
        "risks": {
            "misalignment": record.misalignment_risk.value,
            "attitude": record.attitude_risk.value,
            "grouting": record.grouting_risk.value,
            "recheck_gap": record.recheck_gap_risk.value
        }
    }


@app.get("/api/rings", summary="查询所有环号记录")
def get_all_rings(
    risk_status: Optional[RiskStatus] = Query(None, description="按风险状态筛选"),
    ring_number_from: Optional[int] = Query(None, description="起始环号"),
    ring_number_to: Optional[int] = Query(None, description="结束环号"),
    db: Session = Depends(get_db)
):
    query = db.query(RingRecord)
    
    if risk_status:
        query = query.filter(RingRecord.overall_risk == risk_status)
    
    if ring_number_from is not None:
        query = query.filter(RingRecord.ring_number >= ring_number_from)
    
    if ring_number_to is not None:
        query = query.filter(RingRecord.ring_number <= ring_number_to)
    
    records = query.order_by(RingRecord.ring_number).all()
    
    return [
        {
            "id": r.id,
            "ring_number": r.ring_number,
            "overall_risk": r.overall_risk.value if r.overall_risk else None,
            "misalignment_risk": r.misalignment_risk.value if r.misalignment_risk else None,
            "attitude_risk": r.attitude_risk.value if r.attitude_risk else None,
            "grouting_risk": r.grouting_risk.value if r.grouting_risk else None,
            "recheck_gap_risk": r.recheck_gap_risk.value if r.recheck_gap_risk else None,
            "manual_review_note": r.manual_review_note,
            "manual_override": r.manual_override.value if r.manual_override else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "analyzed_at": r.analyzed_at.isoformat() if r.analyzed_at else None
        }
        for r in records
    ]


@app.get("/api/rings/{ring_number}", summary="查询单个环号详情")
def get_ring(ring_number: int, db: Session = Depends(get_db)):
    record = db.query(RingRecord).filter(RingRecord.ring_number == ring_number).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"环号 {ring_number} 不存在")
    
    return {
        "id": record.id,
        "ring_number": record.ring_number,
        "raw_data": {
            "segment_layout": json.loads(record.segment_layout) if record.segment_layout else None,
            "jack_stroke": json.loads(record.jack_stroke) if record.jack_stroke else None,
            "grouting_volume": record.grouting_volume,
            "measurement_deviation": json.loads(record.measurement_deviation) if record.measurement_deviation else None
        },
        "risks": {
            "overall": {
                "status": record.overall_risk.value if record.overall_risk else None,
                "manual_override": record.manual_override.value if record.manual_override else None
            },
            "misalignment": {
                "status": record.misalignment_risk.value if record.misalignment_risk else None,
                "details": record.misalignment_details
            },
            "attitude": {
                "status": record.attitude_risk.value if record.attitude_risk else None,
                "details": record.attitude_details
            },
            "grouting": {
                "status": record.grouting_risk.value if record.grouting_risk else None,
                "details": record.grouting_details
            },
            "recheck_gap": {
                "status": record.recheck_gap_risk.value if record.recheck_gap_risk else None,
                "details": record.recheck_gap_details
            }
        },
        "review": {
            "note": record.manual_review_note
        },
        "timestamps": {
            "created_at": record.created_at.isoformat() if record.created_at else None,
            "updated_at": record.updated_at.isoformat() if record.updated_at else None,
            "analyzed_at": record.analyzed_at.isoformat() if record.analyzed_at else None
        }
    }


@app.put("/api/rings/{ring_number}/review", summary="人工复核/改判")
def review_ring(
    ring_number: int,
    manual_review_note: Optional[str] = Form(None, description="人工复核备注"),
    manual_override: Optional[RiskStatus] = Form(None, description="人工改判的风险状态"),
    db: Session = Depends(get_db)
):
    record = db.query(RingRecord).filter(RingRecord.ring_number == ring_number).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"环号 {ring_number} 不存在")
    
    if manual_review_note is not None:
        record.manual_review_note = manual_review_note
    
    if manual_override is not None:
        record.manual_override = manual_override
        record.overall_risk = manual_override
    
    db.commit()
    db.refresh(record)
    
    return {
        "message": f"环号 {ring_number} 复核完成",
        "ring_number": ring_number,
        "overall_risk": record.overall_risk.value,
        "manual_review_note": record.manual_review_note,
        "manual_override": record.manual_override.value if record.manual_override else None
    }


@app.post("/api/rings/{ring_number}/reanalyze", summary="重新计算风险")
def reanalyze_ring(ring_number: int, db: Session = Depends(get_db)):
    record = db.query(RingRecord).filter(RingRecord.ring_number == ring_number).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"环号 {ring_number} 不存在")
    
    analysis_result = RiskAnalyzer.analyze_all(record)
    for key, value in analysis_result.items():
        setattr(record, key, value)
    record.analyzed_at = datetime.utcnow()
    
    if record.manual_override:
        record.overall_risk = record.manual_override
    
    db.commit()
    db.refresh(record)
    
    return {
        "message": f"环号 {ring_number} 风险重算完成",
        "ring_number": ring_number,
        "overall_risk": record.overall_risk.value,
        "risks": {
            "misalignment": record.misalignment_risk.value,
            "attitude": record.attitude_risk.value,
            "grouting": record.grouting_risk.value,
            "recheck_gap": record.recheck_gap_risk.value
        },
        "manual_override_applied": record.manual_override is not None
    }


@app.delete("/api/rings/{ring_number}", summary="删除环号记录")
def delete_ring(ring_number: int, db: Session = Depends(get_db)):
    record = db.query(RingRecord).filter(RingRecord.ring_number == ring_number).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"环号 {ring_number} 不存在")
    
    db.delete(record)
    db.commit()
    
    return {"message": f"环号 {ring_number} 已删除"}


@app.get("/api/export/handover", summary="导出 Markdown 交班单", response_class=PlainTextResponse)
def export_handover(
    ring_number_from: Optional[int] = Query(None, description="起始环号"),
    ring_number_to: Optional[int] = Query(None, description="结束环号"),
    shift_date: Optional[str] = Query(None, description="班次日期，格式 YYYY-MM-DD"),
    shift_name: Optional[str] = Query("白班", description="班次名称"),
    operator: Optional[str] = Query("测量员", description="操作员"),
    db: Session = Depends(get_db)
):
    query = db.query(RingRecord)
    
    if ring_number_from is not None:
        query = query.filter(RingRecord.ring_number >= ring_number_from)
    
    if ring_number_to is not None:
        query = query.filter(RingRecord.ring_number <= ring_number_to)
    
    records = query.order_by(RingRecord.ring_number).all()
    
    shift_info = {
        "date": shift_date or datetime.now().strftime("%Y-%m-%d"),
        "shift": shift_name,
        "operator": operator
    }
    
    markdown = Exporter.export_markdown_handover(records, shift_info)
    return PlainTextResponse(content=markdown, media_type="text/markdown; charset=utf-8")


@app.get("/api/export/audit", summary="导出 JSON 审计明细", response_class=JSONResponse)
def export_audit(
    ring_number_from: Optional[int] = Query(None, description="起始环号"),
    ring_number_to: Optional[int] = Query(None, description="结束环号"),
    db: Session = Depends(get_db)
):
    query = db.query(RingRecord)
    
    if ring_number_from is not None:
        query = query.filter(RingRecord.ring_number >= ring_number_from)
    
    if ring_number_to is not None:
        query = query.filter(RingRecord.ring_number <= ring_number_to)
    
    records = query.order_by(RingRecord.ring_number).all()
    
    audit_json = Exporter.export_json_audit(records)
    return JSONResponse(content=json.loads(audit_json))


@app.get("/api/stats/summary", summary="获取风险统计摘要")
def get_stats_summary(db: Session = Depends(get_db)):
    total = db.query(RingRecord).count()
    critical = db.query(RingRecord).filter(RingRecord.overall_risk == RiskStatus.CRITICAL).count()
    warning = db.query(RingRecord).filter(RingRecord.overall_risk == RiskStatus.WARNING).count()
    normal = db.query(RingRecord).filter(RingRecord.overall_risk == RiskStatus.NORMAL).count()
    reviewed = db.query(RingRecord).filter(RingRecord.manual_review_note.isnot(None)).count()
    
    return {
        "total_rings": total,
        "risk_summary": {
            "critical": critical,
            "warning": warning,
            "normal": normal
        },
        "review_status": {
            "reviewed": reviewed,
            "pending": total - reviewed
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
