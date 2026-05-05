from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pathlib import Path
import json
import uuid

from database import get_db
from models import WindTurbine, Blade, InspectionRecord, BladePhoto, SCADAAllarm, WorkOrder, RiskAssessment
from schemas import (
    SCADAAllarmCreate, SCADAAllarmResponse,
    WorkOrderCreate, WorkOrderResponse,
    APIResponse, ExportRequest
)
from config import settings

router = APIRouter(prefix="/api/data", tags=["数据管理"])


# ========== SCADA 告警管理 ==========
@router.get("/alarms", response_model=APIResponse)
def get_alarms(
    turbine_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    severity: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取SCADA告警列表"""
    query = db.query(SCADAAllarm)
    
    if turbine_id:
        query = query.filter(SCADAAllarm.turbine_id == turbine_id)
    
    if is_active is not None:
        query = query.filter(SCADAAllarm.is_active == is_active)
    
    if severity:
        query = query.filter(SCADAAllarm.severity == severity)
    
    total = query.count()
    alarms = query.order_by(desc(SCADAAllarm.start_time)).offset(skip).limit(limit).all()
    
    return APIResponse(
        message=f"获取到 {len(alarms)} 条告警记录",
        data={
            "total": total,
            "items": [SCADAAllarmResponse.model_validate(a) for a in alarms]
        }
    )


@router.post("/alarms", response_model=APIResponse)
def create_alarm(alarm: SCADAAllarmCreate, db: Session = Depends(get_db)):
    """创建SCADA告警"""
    # 检查风机是否存在
    turbine = db.query(WindTurbine).filter(WindTurbine.id == alarm.turbine_id).first()
    if not turbine:
        raise HTTPException(status_code=404, detail=f"风机 ID {alarm.turbine_id} 不存在")
    
    db_alarm = SCADAAllarm(**alarm.model_dump())
    db.add(db_alarm)
    db.commit()
    db.refresh(db_alarm)
    
    return APIResponse(
        message="告警记录创建成功",
        data=SCADAAllarmResponse.model_validate(db_alarm)
    )


@router.post("/alarms/batch-import", response_model=APIResponse)
async def batch_import_alarms(
    file: UploadFile = File(..., description="SCADA告警JSON文件"),
    db: Session = Depends(get_db)
):
    """批量导入SCADA告警"""
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON格式的文件")
    
    content = await file.read()
    try:
        alarms_data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="无效的JSON格式")
    
    if not isinstance(alarms_data, list):
        alarms_data = [alarms_data]
    
    results = []
    errors = []
    
    for alarm_data in alarms_data:
        try:
            # 查找对应的风机
            turbine_id = alarm_data.get("turbine_id")
            if not turbine_id:
                errors.append("告警数据缺少 turbine_id")
                continue
            
            # 支持通过 turbine_id（编号）查找
            turbine = db.query(WindTurbine).filter(
                (WindTurbine.id == turbine_id) | 
                (WindTurbine.turbine_id == str(turbine_id))
            ).first()
            
            if not turbine:
                errors.append(f"风机 {turbine_id} 不存在")
                continue
            
            # 解析时间
            start_time = alarm_data.get("start_time")
            if isinstance(start_time, str):
                start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            
            end_time = alarm_data.get("end_time")
            if end_time and isinstance(end_time, str):
                end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            
            db_alarm = SCADAAllarm(
                turbine_id=turbine.id,
                alarm_code=alarm_data.get("alarm_code", "UNKNOWN"),
                alarm_name=alarm_data.get("alarm_name"),
                alarm_type=alarm_data.get("alarm_type"),
                severity=alarm_data.get("severity", "中"),
                start_time=start_time or datetime.utcnow(),
                end_time=end_time,
                is_active=alarm_data.get("is_active", True),
                description=alarm_data.get("description")
            )
            db.add(db_alarm)
            results.append({
                "alarm_code": db_alarm.alarm_code,
                "turbine_id": turbine.turbine_id
            })
            
        except Exception as e:
            errors.append(f"导入告警失败: {str(e)}")
    
    db.commit()
    
    return APIResponse(
        message=f"成功导入 {len(results)} 条告警" + (f"，{len(errors)} 个错误" if errors else ""),
        data={
            "success_count": len(results),
            "error_count": len(errors),
            "results": results,
            "errors": errors if errors else None
        }
    )


@router.put("/alarms/{alarm_id}/resolve", response_model=APIResponse)
def resolve_alarm(
    alarm_id: int,
    resolution: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """标记告警为已解决"""
    alarm = db.query(SCADAAllarm).filter(SCADAAllarm.id == alarm_id).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="告警记录不存在")
    
    alarm.is_active = False
    alarm.end_time = datetime.utcnow()
    if resolution:
        alarm.description = (alarm.description or "") + f"\n[已解决] {resolution}"
    
    db.commit()
    
    return APIResponse(message="告警已标记为已解决")


# ========== 维修工单管理 ==========
@router.get("/work-orders", response_model=APIResponse)
def get_work_orders(
    turbine_id: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取维修工单列表"""
    query = db.query(WorkOrder)
    
    if turbine_id:
        query = query.filter(WorkOrder.turbine_id == turbine_id)
    
    if status:
        query = query.filter(WorkOrder.status == status)
    
    if priority:
        query = query.filter(WorkOrder.priority == priority)
    
    total = query.count()
    work_orders = query.order_by(desc(WorkOrder.created_time)).offset(skip).limit(limit).all()
    
    return APIResponse(
        message=f"获取到 {len(work_orders)} 条维修工单",
        data={
            "total": total,
            "items": [WorkOrderResponse.model_validate(w) for w in work_orders]
        }
    )


@router.post("/work-orders", response_model=APIResponse)
def create_work_order(work_order: WorkOrderCreate, db: Session = Depends(get_db)):
    """创建维修工单"""
    # 检查风机是否存在
    turbine = db.query(WindTurbine).filter(WindTurbine.id == work_order.turbine_id).first()
    if not turbine:
        raise HTTPException(status_code=404, detail=f"风机 ID {work_order.turbine_id} 不存在")
    
    # 检查工单编号是否已存在
    existing = db.query(WorkOrder).filter(WorkOrder.work_order_id == work_order.work_order_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"工单编号 {work_order.work_order_id} 已存在")
    
    db_work_order = WorkOrder(**work_order.model_dump())
    db.add(db_work_order)
    db.commit()
    db.refresh(db_work_order)
    
    return APIResponse(
        message="维修工单创建成功",
        data=WorkOrderResponse.model_validate(db_work_order)
    )


@router.post("/work-orders/batch-import", response_model=APIResponse)
async def batch_import_work_orders(
    file: UploadFile = File(..., description="维修工单JSON文件"),
    db: Session = Depends(get_db)
):
    """批量导入维修工单"""
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON格式的文件")
    
    content = await file.read()
    try:
        work_orders_data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="无效的JSON格式")
    
    if not isinstance(work_orders_data, list):
        work_orders_data = [work_orders_data]
    
    results = []
    errors = []
    
    for wo_data in work_orders_data:
        try:
            # 查找对应的风机
            turbine_id = wo_data.get("turbine_id")
            if not turbine_id:
                errors.append("工单数据缺少 turbine_id")
                continue
            
            turbine = db.query(WindTurbine).filter(
                (WindTurbine.id == turbine_id) | 
                (WindTurbine.turbine_id == str(turbine_id))
            ).first()
            
            if not turbine:
                errors.append(f"风机 {turbine_id} 不存在")
                continue
            
            # 检查工单编号是否已存在
            work_order_id = wo_data.get("work_order_id")
            if not work_order_id:
                work_order_id = f"WO_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
            
            existing = db.query(WorkOrder).filter(WorkOrder.work_order_id == work_order_id).first()
            if existing:
                errors.append(f"工单编号 {work_order_id} 已存在")
                continue
            
            # 解析时间
            scheduled_time = wo_data.get("scheduled_time")
            if scheduled_time and isinstance(scheduled_time, str):
                scheduled_time = datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
            
            completed_time = wo_data.get("completed_time")
            if completed_time and isinstance(completed_time, str):
                completed_time = datetime.fromisoformat(completed_time.replace('Z', '+00:00'))
            
            db_wo = WorkOrder(
                turbine_id=turbine.id,
                work_order_id=work_order_id,
                blade_number=wo_data.get("blade_number"),
                issue_type=wo_data.get("issue_type"),
                description=wo_data.get("description"),
                priority=wo_data.get("priority", "中"),
                status=wo_data.get("status", "待处理"),
                scheduled_time=scheduled_time,
                completed_time=completed_time,
                assigned_to=wo_data.get("assigned_to"),
                resolution=wo_data.get("resolution")
            )
            db.add(db_wo)
            results.append({
                "work_order_id": work_order_id,
                "turbine_id": turbine.turbine_id
            })
            
        except Exception as e:
            errors.append(f"导入工单失败: {str(e)}")
    
    db.commit()
    
    return APIResponse(
        message=f"成功导入 {len(results)} 条工单" + (f"，{len(errors)} 个错误" if errors else ""),
        data={
            "success_count": len(results),
            "error_count": len(errors),
            "results": results,
            "errors": errors if errors else None
        }
    )


@router.put("/work-orders/{work_order_id}/complete", response_model=APIResponse)
def complete_work_order(
    work_order_id: int,
    resolution: str = Form(...),
    db: Session = Depends(get_db)
):
    """标记工单为已完成"""
    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not work_order:
        raise HTTPException(status_code=404, detail="工单不存在")
    
    work_order.status = "已完成"
    work_order.completed_time = datetime.utcnow()
    work_order.resolution = resolution
    
    db.commit()
    
    return APIResponse(message="工单已标记为已完成")


# ========== 数据导出功能 ==========
@router.post("/export/markdown", response_model=APIResponse)
def export_markdown(
    export_request: ExportRequest,
    db: Session = Depends(get_db)
):
    """导出Markdown复核单"""
    # 构建查询
    query = db.query(RiskAssessment).join(BladePhoto, RiskAssessment.photo_id == BladePhoto.id)
    
    # 筛选条件
    if export_request.risk_levels:
        risk_level_values = [rl.value for rl in export_request.risk_levels]
        query = query.filter(RiskAssessment.final_risk_level.in_(risk_level_values))
    
    assessments = query.order_by(desc(RiskAssessment.final_risk_score)).all()
    
    # 生成Markdown内容
    markdown_content = generate_review_markdown(assessments, export_request, db)
    
    # 保存文件
    export_dir = Path(settings.EXPORT_DIR)
    export_dir.mkdir(parents=True, exist_ok=True)
    
    file_name = f"review_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.md"
    file_path = export_dir / file_name
    file_path.write_text(markdown_content, encoding='utf-8')
    
    return APIResponse(
        message="Markdown复核单导出成功",
        data={
            "file_name": file_name,
            "file_path": str(file_path),
            "assessment_count": len(assessments)
        }
    )


@router.post("/export/json", response_model=APIResponse)
def export_json(
    export_request: ExportRequest,
    db: Session = Depends(get_db)
):
    """导出JSON明细"""
    # 构建查询
    query = db.query(RiskAssessment).join(BladePhoto, RiskAssessment.photo_id == BladePhoto.id)
    
    # 筛选条件
    if export_request.risk_levels:
        risk_level_values = [rl.value for rl in export_request.risk_levels]
        query = query.filter(RiskAssessment.final_risk_level.in_(risk_level_values))
    
    assessments = query.order_by(desc(RiskAssessment.final_risk_score)).all()
    
    # 生成JSON数据
    json_data = generate_export_json(assessments, export_request, db)
    
    # 保存文件
    export_dir = Path(settings.EXPORT_DIR)
    export_dir.mkdir(parents=True, exist_ok=True)
    
    file_name = f"export_data_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    file_path = export_dir / file_name
    file_path.write_text(json.dumps(json_data, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    
    return APIResponse(
        message="JSON明细导出成功",
        data={
            "file_name": file_name,
            "file_path": str(file_path),
            "assessment_count": len(assessments)
        }
    )


def generate_review_markdown(assessments: List, export_request: ExportRequest, db: Session) -> str:
    """生成复核单Markdown内容"""
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    
    # 统计
    critical_count = sum(1 for a in assessments if a.final_risk_level == "严重")
    high_count = sum(1 for a in assessments if a.final_risk_level == "高")
    medium_count = sum(1 for a in assessments if a.final_risk_level == "中")
    low_count = sum(1 for a in assessments if a.final_risk_level == "低")
    
    md = f"""# 海上风电运维风险复核单

**生成时间**: {now}

## 风险统计摘要

| 风险等级 | 数量 |
|----------|------|
| 严重     | {critical_count} |
| 高       | {high_count} |
| 中       | {medium_count} |
| 低       | {low_count} |
| **合计** | **{len(assessments)}** |

---

## 风险详情

"""
    
    # 按风险等级分组
    risk_groups = {
        "严重": [],
        "高": [],
        "中": [],
        "低": []
    }
    
    for assessment in assessments:
        if assessment.final_risk_level in risk_groups:
            risk_groups[assessment.final_risk_level].append(assessment)
    
    # 生成各等级详情
    for level in ["严重", "高", "中", "低"]:
        level_assessments = risk_groups[level]
        if not level_assessments:
            continue
        
        md += f"### {level}风险 ({len(level_assessments)}项)\n\n"
        
        for idx, assessment in enumerate(level_assessments, 1):
            # 获取照片信息
            photo = db.query(BladePhoto).filter(BladePhoto.id == assessment.photo_id).first()
            blade = None
            turbine = None
            
            if photo:
                blade = db.query(Blade).filter(Blade.id == photo.blade_id).first()
                if blade:
                    turbine = db.query(WindTurbine).filter(WindTurbine.id == blade.turbine_id).first()
            
            turbine_id = turbine.turbine_id if turbine else "未知"
            blade_number = blade.blade_number if blade else "未知"
            segment = photo.segment if photo else "未知"
            distance = photo.distance_from_root if photo else None
            
            md += f"#### {idx}. 评估ID: {assessment.id}\n\n"
            md += f"- **风机编号**: {turbine_id}\n"
            md += f"- **叶片编号**: {blade_number}号叶片\n"
            md += f"- **位置**: {segment}"
            if distance:
                md += f" (距叶根{distance}米)"
            md += "\n"
            md += f"- **检测类型**: {assessment.ai_detection_type or '未知'}\n"
            md += f"- **AI风险等级**: {assessment.ai_risk_level or '未评估'}\n"
            md += f"- **AI风险评分**: {assessment.ai_risk_score:.1%}\n"
            
            if assessment.manual_override:
                md += f"- **人工改判**: 是\n"
                md += f"- **人工风险等级**: {assessment.manual_risk_level}\n"
                md += f"- **改判原因**: {assessment.manual_reason or '无'}\n"
                if assessment.manual_judge:
                    md += f"- **判定人**: {assessment.manual_judge}\n"
            
            md += f"- **最终风险等级**: {assessment.final_risk_level}\n"
            md += f"- **最终风险评分**: {assessment.final_risk_score:.1%}\n"
            
            if assessment.ai_description:
                md += f"- **评估描述**: {assessment.ai_description}\n"
            
            md += "\n---\n\n"
    
    md += """## 复核签字

| 复核人 | 日期 | 意见 |
|--------|------|------|
|        |      |      |

"""
    
    return md


def generate_export_json(assessments: List, export_request: ExportRequest, db: Session) -> Dict:
    """生成导出JSON数据"""
    export_data = {
        "export_time": datetime.utcnow().isoformat(),
        "version": "1.0",
        "summary": {
            "total_assessments": len(assessments),
            "risk_level_distribution": {}
        },
        "assessments": []
    }
    
    # 统计风险等级分布
    risk_counts = {}
    for assessment in assessments:
        level = assessment.final_risk_level
        risk_counts[level] = risk_counts.get(level, 0) + 1
    export_data["summary"]["risk_level_distribution"] = risk_counts
    
    # 生成详细数据
    for assessment in assessments:
        assessment_data = {
            "id": assessment.id,
            "photo_id": assessment.photo_id,
            "inspection_id": assessment.inspection_id,
            "ai_risk_level": assessment.ai_risk_level,
            "ai_risk_score": assessment.ai_risk_score,
            "ai_detection_type": assessment.ai_detection_type,
            "ai_confidence": assessment.ai_confidence,
            "ai_description": assessment.ai_description,
            "manual_override": assessment.manual_override,
            "manual_risk_level": assessment.manual_risk_level,
            "manual_reason": assessment.manual_reason,
            "manual_judge": assessment.manual_judge,
            "manual_time": assessment.manual_time.isoformat() if assessment.manual_time else None,
            "final_risk_level": assessment.final_risk_level,
            "final_risk_score": assessment.final_risk_score,
            "created_at": assessment.created_at.isoformat(),
            "updated_at": assessment.updated_at.isoformat()
        }
        
        # 添加照片信息
        if export_request.include_photos:
            photo = db.query(BladePhoto).filter(BladePhoto.id == assessment.photo_id).first()
            if photo:
                assessment_data["photo"] = {
                    "id": photo.id,
                    "file_name": photo.file_name,
                    "segment": photo.segment,
                    "distance_from_root": photo.distance_from_root
                }
                
                blade = db.query(Blade).filter(Blade.id == photo.blade_id).first()
                if blade:
                    assessment_data["blade"] = {
                        "id": blade.id,
                        "blade_number": blade.blade_number
                    }
                    
                    turbine = db.query(WindTurbine).filter(WindTurbine.id == blade.turbine_id).first()
                    if turbine:
                        assessment_data["turbine"] = {
                            "id": turbine.id,
                            "turbine_id": turbine.turbine_id,
                            "name": turbine.name
                        }
        
        # 添加关联告警
        if export_request.include_alarms and assessment.related_alarm_id:
            alarm = db.query(SCADAAllarm).filter(SCADAAllarm.id == assessment.related_alarm_id).first()
            if alarm:
                assessment_data["related_alarm"] = {
                    "id": alarm.id,
                    "alarm_code": alarm.alarm_code,
                    "alarm_name": alarm.alarm_name,
                    "severity": alarm.severity,
                    "is_active": alarm.is_active
                }
        
        # 添加关联工单
        if export_request.include_work_orders and assessment.related_work_order_id:
            work_order = db.query(WorkOrder).filter(WorkOrder.id == assessment.related_work_order_id).first()
            if work_order:
                assessment_data["related_work_order"] = {
                    "id": work_order.id,
                    "work_order_id": work_order.work_order_id,
                    "issue_type": work_order.issue_type,
                    "status": work_order.status,
                    "priority": work_order.priority
                }
        
        export_data["assessments"].append(assessment_data)
    
    return export_data
