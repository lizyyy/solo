from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime
import json
import io

from database import get_db, engine, Base
import models
import schemas
from importer import DataImporter
from risk_detector import RiskDetector

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="行道树巡检闭环管理系统",
    description="市政绿化队行道树巡检和病虫害处置闭环复核系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/import/trees", response_model=schemas.ImportResult)
async def import_trees(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """导入树木数据 (GeoJSON格式)"""
    content = await file.read()
    try:
        content_str = content.decode('utf-8')
    except UnicodeDecodeError:
        content_str = content.decode('gbk')
    
    importer = DataImporter(db)
    result = importer.import_geojson(content_str)
    
    return schemas.ImportResult(**result)


@app.post("/import/inspections", response_model=schemas.ImportResult)
async def import_inspections(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """导入巡检数据 (CSV格式)"""
    content = await file.read()
    try:
        content_str = content.decode('utf-8')
    except UnicodeDecodeError:
        content_str = content.decode('gbk')
    
    importer = DataImporter(db)
    result = importer.import_csv(content_str)
    
    return schemas.ImportResult(**result)


@app.post("/import/treatments", response_model=schemas.ImportResult)
async def import_treatments(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """导入处置数据 (JSONL格式)"""
    content = await file.read()
    try:
        content_str = content.decode('utf-8')
    except UnicodeDecodeError:
        content_str = content.decode('gbk')
    
    importer = DataImporter(db)
    result = importer.import_jsonl(content_str)
    
    return schemas.ImportResult(**result)


@app.post("/import/rules", response_model=schemas.ImportResult)
async def import_rules(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """导入规则配置 (YAML格式)"""
    content = await file.read()
    try:
        content_str = content.decode('utf-8')
    except UnicodeDecodeError:
        content_str = content.decode('gbk')
    
    importer = DataImporter(db)
    result = importer.import_yaml(content_str)
    
    return schemas.ImportResult(**result)


@app.get("/trees/{tree_id}", response_model=schemas.TreeDetailResponse)
def get_tree_detail(tree_id: str, db: Session = Depends(get_db)):
    """获取单棵树木详情，包括关联的巡检、处置和风险记录"""
    tree = db.query(models.Tree).filter(models.Tree.tree_id == tree_id).first()
    if not tree:
        raise HTTPException(status_code=404, detail=f"树木 {tree_id} 不存在")
    
    inspections = db.query(models.Inspection).filter(
        models.Inspection.tree_id == tree_id
    ).order_by(models.Inspection.inspection_date.desc()).all()
    
    treatments = db.query(models.Treatment).filter(
        models.Treatment.tree_id == tree_id
    ).order_by(models.Treatment.treatment_date.desc()).all()
    
    risks = db.query(models.Risk).filter(
        models.Risk.tree_id == tree_id
    ).order_by(models.Risk.created_at.desc()).all()
    
    inspection_responses = []
    for insp in inspections:
        insp_dict = {c.name: getattr(insp, c.name) for c in insp.__table__.columns}
        try:
            insp_dict["photo_paths"] = json.loads(insp_dict["photo_paths"])
        except:
            insp_dict["photo_paths"] = []
        inspection_responses.append(schemas.InspectionResponse(**insp_dict))
    
    treatment_responses = [schemas.TreatmentResponse.model_validate(t) for t in treatments]
    risk_responses = [schemas.RiskResponse.model_validate(r) for r in risks]
    
    tree_response = schemas.TreeResponse.model_validate(tree)
    
    return schemas.TreeDetailResponse(
        **tree_response.model_dump(),
        inspections=inspection_responses,
        treatments=treatment_responses,
        risks=risk_responses
    )


@app.get("/trees", response_model=List[schemas.TreeResponse])
def list_trees(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取树木列表"""
    trees = db.query(models.Tree).offset(skip).limit(limit).all()
    return [schemas.TreeResponse.model_validate(t) for t in trees]


@app.get("/risks", response_model=List[schemas.RiskResponse])
def list_risks(
    risk_type: Optional[str] = None,
    severity: Optional[str] = None,
    is_resolved: Optional[bool] = None,
    tree_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取风险列表，支持筛选"""
    query = db.query(models.Risk)
    
    if risk_type:
        query = query.filter(models.Risk.risk_type == risk_type)
    if severity:
        query = query.filter(models.Risk.severity == severity)
    if is_resolved is not None:
        query = query.filter(models.Risk.is_resolved == is_resolved)
    if tree_id:
        query = query.filter(models.Risk.tree_id == tree_id)
    
    risks = query.order_by(models.Risk.created_at.desc()).all()
    return [schemas.RiskResponse.model_validate(r) for r in risks]


@app.post("/risks/{risk_id}/resolve")
def resolve_risk(
    risk_id: int,
    resolved_by: str = "system",
    db: Session = Depends(get_db)
):
    """标记风险为已解决"""
    risk = db.query(models.Risk).filter(models.Risk.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="风险不存在")
    
    risk.is_resolved = True
    risk.resolved_by = resolved_by
    risk.resolved_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": f"风险 {risk_id} 已标记为已解决"}


@app.post("/risk-detection/run")
def run_risk_detection(db: Session = Depends(get_db)):
    """运行风险检测"""
    detector = RiskDetector(db)
    result = detector.run_detection()
    
    return result


@app.get("/risk-summary")
def get_risk_summary(db: Session = Depends(get_db)):
    """获取风险统计摘要"""
    from sqlalchemy import func
    
    summary = db.query(
        models.Risk.risk_type,
        models.Risk.severity,
        func.count(models.Risk.id).label('count'),
        func.sum(func.case((models.Risk.is_resolved == False, 1), else_=0)).label('unresolved_count')
    ).group_by(
        models.Risk.risk_type,
        models.Risk.severity
    ).all()
    
    result = []
    for item in summary:
        result.append({
            "risk_type": item.risk_type,
            "severity": item.severity,
            "count": item.count,
            "unresolved_count": item.unresolved_count
        })
    
    return {"summary": result, "total_risks": sum(s.count for s in summary)}


@app.get("/closed-loop", response_model=List[schemas.ClosedLoopResponse])
def get_closed_loops(
    tree_id: Optional[str] = None,
    include_unclosed: bool = Query(False, description="是否包含未闭环的记录"),
    db: Session = Depends(get_db)
):
    """获取处置闭环列表
    
    闭环定义：有病虫害发现的巡检记录，并且有对应的处置记录
    """
    inspections = db.query(models.Inspection).filter(
        or_(
            models.Inspection.pest_damage == True,
            models.Inspection.disease_present == True
        )
    )
    
    if tree_id:
        inspections = inspections.filter(models.Inspection.tree_id == tree_id)
    
    inspections = inspections.order_by(models.Inspection.inspection_date.desc()).all()
    
    closed_loops = []
    
    for inspection in inspections:
        treatments = db.query(models.Treatment).filter(
            models.Treatment.tree_id == inspection.tree_id,
            models.Treatment.treatment_date >= inspection.inspection_date
        ).order_by(models.Treatment.treatment_date).all()
        
        if treatments:
            for treatment in treatments:
                status = "closed"
                if treatment.is_effective is None:
                    status = "pending_verification"
                elif treatment.is_effective:
                    status = "closed_effective"
                else:
                    status = "closed_ineffective"
                
                closed_loops.append(schemas.ClosedLoopResponse(
                    tree_id=inspection.tree_id,
                    inspection_id=inspection.inspection_id,
                    treatment_id=treatment.treatment_id,
                    inspection_date=inspection.inspection_date,
                    treatment_date=treatment.treatment_date,
                    pest_damage=inspection.pest_damage,
                    disease_present=inspection.disease_present,
                    chemical_used=treatment.chemical_used,
                    is_effective=treatment.is_effective,
                    status=status
                ))
        elif include_unclosed:
            closed_loops.append(schemas.ClosedLoopResponse(
                tree_id=inspection.tree_id,
                inspection_id=inspection.inspection_id,
                treatment_id="",
                inspection_date=inspection.inspection_date,
                treatment_date=datetime.min,
                pest_damage=inspection.pest_damage,
                disease_present=inspection.disease_present,
                chemical_used="",
                is_effective=None,
                status="open"
            ))
    
    return closed_loops


@app.get("/reports/markdown")
def get_markdown_report(
    include_resolved: bool = Query(False, description="是否包含已解决的风险"),
    db: Session = Depends(get_db)
):
    """生成Markdown格式报告"""
    from sqlalchemy import func, or_
    
    tree_count = db.query(func.count(models.Tree.id)).scalar()
    inspection_count = db.query(func.count(models.Inspection.id)).scalar()
    treatment_count = db.query(func.count(models.Treatment.id)).scalar()
    
    risk_query = db.query(models.Risk)
    if not include_resolved:
        risk_query = risk_query.filter(models.Risk.is_resolved == False)
    
    risks = risk_query.order_by(models.Risk.severity.desc(), models.Risk.created_at.desc()).all()
    
    risk_by_type = {}
    for risk in risks:
        if risk.risk_type not in risk_by_type:
            risk_by_type[risk.risk_type] = {"count": 0, "severity": risk.severity}
        risk_by_type[risk.risk_type]["count"] += 1
    
    closed_query = db.query(models.Inspection).filter(
        or_(
            models.Inspection.pest_damage == True,
            models.Inspection.disease_present == True
        )
    )
    pest_inspection_count = closed_query.count()
    
    closed_count = 0
    for insp in closed_query.all():
        has_treatment = db.query(models.Treatment).filter(
            models.Treatment.tree_id == insp.tree_id,
            models.Treatment.treatment_date >= insp.inspection_date
        ).first()
        if has_treatment:
            closed_count += 1
    
    markdown = f"""# 行道树巡检和病虫害处置闭环报告

> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 一、数据概览

| 统计项 | 数量 |
|--------|------|
| 树木总数 | {tree_count} |
| 巡检记录 | {inspection_count} |
| 处置记录 | {treatment_count} |
| 病虫害巡检数 | {pest_inspection_count} |
| 已闭环数 | {closed_count} |

---

## 二、风险检测统计

"""
    
    if risk_by_type:
        markdown += "| 风险类型 | 数量 | 严重程度 |\n|----------|------|----------|\n"
        for risk_type, data in risk_by_type.items():
            type_name = {
                "duplicate_coordinate": "坐标重复",
                "missing_photo": "照片缺失",
                "banned_chemical": "禁用药剂",
                "spray_after_rain": "雨后喷药无效",
                "midnight_inspection": "跨午夜巡检"
            }.get(risk_type, risk_type)
            markdown += f"| {type_name} | {data['count']} | {data['severity']} |\n"
    else:
        markdown += "暂无未解决的风险。\n"
    
    markdown += "\n---\n\n## 三、风险详情\n\n"
    
    if risks:
        for i, risk in enumerate(risks, 1):
            type_name = {
                "duplicate_coordinate": "坐标重复",
                "missing_photo": "照片缺失",
                "banned_chemical": "禁用药剂",
                "spray_after_rain": "雨后喷药无效",
                "midnight_inspection": "跨午夜巡检"
            }.get(risk.risk_type, risk.risk_type)
            
            status_emoji = "✅" if risk.is_resolved else "⚠️"
            
            markdown += f"### {i}. {status_emoji} {type_name} (严重程度: {risk.severity})\n\n"
            markdown += f"- **描述**: {risk.description}\n"
            markdown += f"- **树号**: {risk.tree_id or 'N/A'}\n"
            markdown += f"- **巡检ID**: {risk.inspection_id or 'N/A'}\n"
            markdown += f"- **处置ID**: {risk.treatment_id or 'N/A'}\n"
            markdown += f"- **详情**: {risk.details}\n"
            markdown += f"- **状态**: {'已解决' if risk.is_resolved else '未解决'}\n"
            markdown += f"- **检测时间**: {risk.created_at.strftime('%Y-%m-%d %H:%M:%S') if risk.created_at else 'N/A'}\n\n"
    else:
        markdown += "暂无风险记录。\n"
    
    markdown += "\n---\n\n## 四、闭环统计\n\n"
    if pest_inspection_count > 0:
        closure_rate = (closed_count / pest_inspection_count * 100) if pest_inspection_count > 0 else 0
        markdown += f"- 闭环率: {closure_rate:.1f}%\n"
        markdown += f"- 待闭环数: {pest_inspection_count - closed_count}\n"
    else:
        markdown += "暂无病虫害巡检记录。\n"
    
    return PlainTextResponse(content=markdown, media_type="text/markdown")


@app.get("/reports/csv")
def get_csv_report(
    include_resolved: bool = Query(False, description="是否包含已解决的风险"),
    db: Session = Depends(get_db)
):
    """生成CSV格式报告"""
    import csv
    
    risk_query = db.query(models.Risk)
    if not include_resolved:
        risk_query = risk_query.filter(models.Risk.is_resolved == False)
    
    risks = risk_query.order_by(models.Risk.severity.desc(), models.Risk.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "风险ID", "风险类型", "严重程度", "树号", "巡检ID", "处置ID",
        "描述", "详情", "状态", "检测时间"
    ])
    
    type_name_map = {
        "duplicate_coordinate": "坐标重复",
        "missing_photo": "照片缺失",
        "banned_chemical": "禁用药剂",
        "spray_after_rain": "雨后喷药无效",
        "midnight_inspection": "跨午夜巡检"
    }
    
    for risk in risks:
        writer.writerow([
            risk.id,
            type_name_map.get(risk.risk_type, risk.risk_type),
            risk.severity,
            risk.tree_id or "",
            risk.inspection_id or "",
            risk.treatment_id or "",
            risk.description,
            risk.details,
            "已解决" if risk.is_resolved else "未解决",
            risk.created_at.strftime('%Y-%m-%d %H:%M:%S') if risk.created_at else ""
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=risk_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@app.get("/inspections", response_model=List[schemas.InspectionResponse])
def list_inspections(
    tree_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取巡检记录列表"""
    query = db.query(models.Inspection)
    if tree_id:
        query = query.filter(models.Inspection.tree_id == tree_id)
    
    inspections = query.order_by(models.Inspection.inspection_date.desc()).offset(skip).limit(limit).all()
    
    results = []
    for insp in inspections:
        insp_dict = {c.name: getattr(insp, c.name) for c in insp.__table__.columns}
        try:
            insp_dict["photo_paths"] = json.loads(insp_dict["photo_paths"])
        except:
            insp_dict["photo_paths"] = []
        results.append(schemas.InspectionResponse(**insp_dict))
    
    return results


@app.get("/treatments", response_model=List[schemas.TreatmentResponse])
def list_treatments(
    tree_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取处置记录列表"""
    query = db.query(models.Treatment)
    if tree_id:
        query = query.filter(models.Treatment.tree_id == tree_id)
    
    treatments = query.order_by(models.Treatment.treatment_date.desc()).offset(skip).limit(limit).all()
    return [schemas.TreatmentResponse.model_validate(t) for t in treatments]


@app.delete("/clear-data")
def clear_all_data(db: Session = Depends(get_db)):
    """清空所有数据（用于测试）"""
    db.query(models.Risk).delete()
    db.query(models.Treatment).delete()
    db.query(models.Inspection).delete()
    db.query(models.Tree).delete()
    db.query(models.Rule).delete()
    db.commit()
    
    return {"success": True, "message": "所有数据已清空"}


@app.get("/health")
def health_check():
    """健康检查"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
