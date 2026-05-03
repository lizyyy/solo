from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import os
import csv

from database import get_db, init_db, SessionLocal
from models import DrugBatch, HandoverScan, VehicleTemperature, Issue
from import_service import (
    import_vehicle_temperatures_jsonl,
    import_drug_batches_csv,
    import_handover_scans_csv,
    import_temperature_rules_yaml,
    DataImportError
)
from business_logic import (
    perform_risk_review,
    generate_report,
    assign_midnight_routes,
    get_batch_temperature_range,
    calculate_temperature_exceed_duration
)

app = FastAPI(
    title="冷链药品转运复核系统",
    description="区域药房冷链药品转运记录复核服务",
    version="1.0.0"
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/")
def root():
    return {
        "message": "冷链药品转运复核系统",
        "version": "1.0.0",
        "endpoints": {
            "导入": "/api/import/*",
            "查询": "/api/batches/*",
            "复核": "/api/review/*",
            "导出": "/api/export/*"
        }
    }


@app.post("/api/import/temperatures")
def import_temperatures(
    file: UploadFile = File(..., description="车辆温度 JSONL 文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.jsonl'):
        raise HTTPException(
            status_code=400,
            detail={"error": "文件格式错误", "message": "请上传 .jsonl 格式的温度记录文件"}
        )
    
    try:
        content = file.file.read().decode('utf-8')
        result = import_vehicle_temperatures_jsonl(db, content)
        
        return {
            "success": True,
            "data": result,
            "message": f"成功导入 {result['success']} 条温度记录"
        }
    except DataImportError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": "数据导入错误", "message": str(e)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "服务器错误", "message": str(e)}
        )


@app.post("/api/import/batches")
def import_batches(
    file: UploadFile = File(..., description="药品批次 CSV 文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail={"error": "文件格式错误", "message": "请上传 .csv 格式的批次文件"}
        )
    
    try:
        content = file.file.read().decode('utf-8')
        result = import_drug_batches_csv(db, content)
        
        return {
            "success": True,
            "data": result,
            "message": f"成功导入 {result['success']} 条药品批次记录"
        }
    except DataImportError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": "数据导入错误", "message": str(e)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "服务器错误", "message": str(e)}
        )


@app.post("/api/import/scans")
def import_scans(
    file: UploadFile = File(..., description="交接扫描 CSV 文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail={"error": "文件格式错误", "message": "请上传 .csv 格式的扫描记录文件"}
        )
    
    try:
        content = file.file.read().decode('utf-8')
        result = import_handover_scans_csv(db, content)
        
        return {
            "success": True,
            "data": result,
            "message": f"成功导入 {result['success']} 条交接扫描记录"
        }
    except DataImportError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": "数据导入错误", "message": str(e)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "服务器错误", "message": str(e)}
        )


@app.post("/api/import/rules")
def import_rules(
    file: UploadFile = File(..., description="温度规则 YAML 文件"),
    db: Session = Depends(get_db)
):
    if not (file.filename.endswith('.yaml') or file.filename.endswith('.yml')):
        raise HTTPException(
            status_code=400,
            detail={"error": "文件格式错误", "message": "请上传 .yaml 或 .yml 格式的规则文件"}
        )
    
    try:
        content = file.file.read().decode('utf-8')
        result = import_temperature_rules_yaml(db, content)
        
        return {
            "success": True,
            "data": result,
            "message": f"成功导入 {result['success']} 条温度规则"
        }
    except DataImportError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": "数据导入错误", "message": str(e)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "服务器错误", "message": str(e)}
        )


@app.get("/api/batches")
def list_batches(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    batch_number: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(DrugBatch)
    
    if batch_number:
        query = query.filter(DrugBatch.batch_number.contains(batch_number))
    
    total = query.count()
    batches = query.offset(skip).limit(limit).all()
    
    return {
        "success": True,
        "data": {
            "total": total,
            "skip": skip,
            "limit": limit,
            "items": [b.to_dict() for b in batches]
        }
    }


@app.get("/api/batches/{batch_number}")
def get_batch_detail(
    batch_number: str,
    db: Session = Depends(get_db)
):
    batch = db.query(DrugBatch).filter(
        DrugBatch.batch_number == batch_number
    ).first()
    
    if not batch:
        raise HTTPException(
            status_code=404,
            detail={"error": "未找到批次", "message": f"批号 {batch_number} 不存在"}
        )
    
    scans = db.query(HandoverScan).filter(
        HandoverScan.batch_number == batch_number
    ).order_by(HandoverScan.scan_time).all()
    
    min_temp, max_temp = get_batch_temperature_range(db, batch_number)
    
    return {
        "success": True,
        "data": {
            "batch": batch.to_dict(),
            "temperature_range": {
                "min_temp": min_temp,
                "max_temp": max_temp
            },
            "scans": [s.to_dict() for s in scans]
        }
    }


@app.get("/api/review/risk")
def risk_review(db: Session = Depends(get_db)):
    result = perform_risk_review(db)
    
    return {
        "success": True,
        "data": result,
        "message": f"风险复核完成，共发现 {result['total_issues']} 个问题"
    }


@app.get("/api/review/routes/midnight")
def midnight_routes_review(db: Session = Depends(get_db)):
    routes = assign_midnight_routes(db)
    
    return {
        "success": True,
        "data": {
            "total_routes": len(routes),
            "crossed_midnight": len([r for r in routes if r.get("crossed_midnight")]),
            "routes": routes
        }
    }


@app.get("/api/export/report")
def export_report(db: Session = Depends(get_db)):
    report_data = generate_report(db)
    
    report_lines = [
        "# 冷链药品转运复核报告",
        "",
        f"**生成时间**: {report_data['generated_at']}",
        "",
        "## 一、数据概览",
        "",
        "| 数据类型 | 数量 |",
        "|---------|------|",
        f"| 温度记录 | {report_data['summary']['total_temperature_records']} |",
        f"| 药品批次 | {report_data['summary']['total_batches']} |",
        f"| 交接扫描 | {report_data['summary']['total_scans']} |",
        f"| 温度规则 | {report_data['summary']['total_rules']} |",
        f"| 跨午夜路线 | {report_data['summary']['routes_crossed_midnight']} |",
        "",
        "## 二、风险复核结果",
        "",
        f"**总问题数**: {report_data['risk_review']['total_issues']}",
        "",
        "### 问题严重程度分布",
        "",
        "| 严重程度 | 数量 |",
        "|---------|------|",
        f"| Critical (严重) | {report_data['risk_review']['by_severity']['critical']} |",
        f"| High (高) | {report_data['risk_review']['by_severity']['high']} |",
        f"| Medium (中) | {report_data['risk_review']['by_severity']['medium']} |",
        f"| Low (低) | {report_data['risk_review']['by_severity']['low']} |",
        "",
        "### 问题类型分布",
        "",
    ]
    
    if report_data['risk_review']['by_type']:
        for issue_type, count in report_data['risk_review']['by_type'].items():
            report_lines.append(f"- **{issue_type}**: {count} 个")
    else:
        report_lines.append("- 无问题记录")
    
    report_lines.extend([
        "",
        "### 问题详情",
        "",
    ])
    
    if report_data['risk_review']['issues']:
        for i, issue in enumerate(report_data['risk_review']['issues'], 1):
            report_lines.extend([
                f"#### {i}. [{issue['severity'].upper()}] {issue['issue_type']}",
                "",
                f"- **描述**: {issue['description']}",
                f"- **批号**: {issue['batch_number'] or 'N/A'}",
                f"- **车辆**: {issue['vehicle_id'] or 'N/A'}",
                f"- **超温时长**: {issue['exceed_minutes'] or 'N/A'} 分钟",
                f"- **温度**: {issue['temperature'] or 'N/A'}°C",
                f"- **记录时间**: {issue['start_time'] or 'N/A'}",
                "",
            ])
    else:
        report_lines.append("无问题记录，所有批次转运合规。")
    
    report_lines.extend([
        "",
        "## 三、跨午夜路线归属",
        "",
    ])
    
    if report_data['midnight_routes']:
        for route in report_data['midnight_routes']:
            cross_marker = " [跨午夜]" if route.get("crossed_midnight") else ""
            report_lines.extend([
                f"### 路线 {route['route_id']}{cross_marker}",
                "",
                f"- **车辆**: {route['vehicle_id']}",
                f"- **开始时间**: {route['start_time']}",
                f"- **结束时间**: {route['end_time']}",
                f"- **温度记录数**: {route['record_count']}",
                f"- **跨午夜**: {'是' if route.get('crossed_midnight') else '否'}",
                "",
            ])
    else:
        report_lines.append("暂无路线数据。")
    
    report_content = "\n".join(report_lines)
    
    report_path = "cold_chain_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
    
    return FileResponse(
        report_path,
        media_type="text/markdown",
        filename="cold_chain_report.md"
    )


@app.get("/api/export/issues")
def export_issues(db: Session = Depends(get_db)):
    issues = db.query(Issue).order_by(Issue.severity, Issue.created_at.desc()).all()
    
    csv_path = "issues.csv"
    
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "ID", "问题类型", "严重程度", "描述", "批号", "车辆ID",
            "路线ID", "开始时间", "结束时间", "超温时长(分钟)", "温度(°C)", "记录时间"
        ])
        
        for issue in issues:
            writer.writerow([
                issue.id,
                issue.issue_type,
                issue.severity,
                issue.description,
                issue.batch_number or "",
                issue.vehicle_id or "",
                issue.route_id or "",
                issue.start_time.isoformat() if issue.start_time else "",
                issue.end_time.isoformat() if issue.end_time else "",
                issue.exceed_minutes or "",
                issue.temperature or "",
                issue.created_at.isoformat() if issue.created_at else ""
            ])
    
    return FileResponse(
        csv_path,
        media_type="text/csv",
        filename="issues.csv"
    )


@app.delete("/api/data/clear")
def clear_all_data(db: Session = Depends(get_db)):
    try:
        db.query(Issue).delete()
        db.query(HandoverScan).delete()
        db.query(VehicleTemperature).delete()
        db.query(DrugBatch).delete()
        db.commit()
        
        return {
            "success": True,
            "message": "所有数据已清除"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"error": "清除数据失败", "message": str(e)}
        )
