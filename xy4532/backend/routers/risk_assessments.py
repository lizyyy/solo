from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
import json

from database import get_db
from models import RiskAssessment, BladePhoto, Blade, WindTurbine, SCADAAllarm, WorkOrder
from schemas import (
    RiskAssessmentResponse, ManualJudgmentRequest,
    APIResponse
)
from risk_scoring import risk_scoring_engine
from feature_extractor import feature_extractor, defect_detector

router = APIRouter(prefix="/api/risk-assessments", tags=["风险评估"])


@router.get("/", response_model=APIResponse)
def get_risk_assessments(
    turbine_id: Optional[int] = None,
    inspection_id: Optional[int] = None,
    risk_level: Optional[str] = None,
    has_manual_override: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """获取风险评估列表"""
    query = db.query(RiskAssessment)
    
    # 关联查询
    if turbine_id:
        query = query.join(BladePhoto, RiskAssessment.photo_id == BladePhoto.id)\
                     .join(Blade, BladePhoto.blade_id == Blade.id)\
                     .filter(Blade.turbine_id == turbine_id)
    
    if inspection_id:
        query = query.filter(RiskAssessment.inspection_id == inspection_id)
    
    if risk_level:
        query = query.filter(RiskAssessment.final_risk_level == risk_level)
    
    if has_manual_override is not None:
        query = query.filter(RiskAssessment.manual_override == has_manual_override)
    
    total = query.count()
    assessments = query.order_by(desc(RiskAssessment.final_risk_score), desc(RiskAssessment.created_at))\
                        .offset(skip).limit(limit).all()
    
    return APIResponse(
        message=f"获取到 {len(assessments)} 条风险评估记录",
        data={
            "total": total,
            "items": [RiskAssessmentResponse.model_validate(a) for a in assessments]
        }
    )


@router.get("/{assessment_id}", response_model=APIResponse)
def get_risk_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """获取单个风险评估详情"""
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="风险评估记录不存在")
    
    # 获取关联信息
    photo = db.query(BladePhoto).filter(BladePhoto.id == assessment.photo_id).first()
    
    related_alarm = None
    if assessment.related_alarm_id:
        related_alarm = db.query(SCADAAllarm).filter(SCADAAllarm.id == assessment.related_alarm_id).first()
    
    related_work_order = None
    if assessment.related_work_order_id:
        related_work_order = db.query(WorkOrder).filter(WorkOrder.id == assessment.related_work_order_id).first()
    
    # 解析图像特征
    image_features = None
    if photo and photo.image_features:
        try:
            image_features = json.loads(photo.image_features)
        except:
            pass
    
    return APIResponse(
        message="获取风险评估详情成功",
        data={
            "assessment": RiskAssessmentResponse.model_validate(assessment),
            "photo": {
                "id": photo.id,
                "file_name": photo.file_name,
                "segment": photo.segment,
                "distance_from_root": photo.distance_from_root
            } if photo else None,
            "image_features": image_features,
            "related_alarm": {
                "id": related_alarm.id,
                "alarm_code": related_alarm.alarm_code,
                "alarm_name": related_alarm.alarm_name,
                "severity": related_alarm.severity,
                "is_active": related_alarm.is_active
            } if related_alarm else None,
            "related_work_order": {
                "id": related_work_order.id,
                "work_order_id": related_work_order.work_order_id,
                "issue_type": related_work_order.issue_type,
                "priority": related_work_order.priority,
                "status": related_work_order.status
            } if related_work_order else None
        }
    )


@router.post("/manual-judgment", response_model=APIResponse)
def create_manual_judgment(
    judgment: ManualJudgmentRequest,
    db: Session = Depends(get_db)
):
    """人工改判风险等级"""
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == judgment.assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="风险评估记录不存在")
    
    # 更新人工改判信息
    assessment.manual_override = True
    assessment.manual_risk_level = judgment.manual_risk_level.value
    assessment.manual_reason = judgment.manual_reason
    assessment.manual_judge = judgment.judge_name
    assessment.manual_time = datetime.utcnow()
    
    # 更新最终结果（以人工改判为准）
    assessment.final_risk_level = judgment.manual_risk_level.value
    
    # 重新计算风险评分（根据人工等级设置对应范围的分数）
    score_ranges = {
        "严重": (0.85, 0.95),
        "高": (0.65, 0.79),
        "中": (0.35, 0.59),
        "低": (0.1, 0.29)
    }
    
    # 使用原AI评分的相对位置，但调整到新等级的范围内
    original_score = assessment.ai_risk_score
    new_range = score_ranges.get(judgment.manual_risk_level.value, (0.5, 0.5))
    
    # 简单的映射方式
    assessment.final_risk_score = (new_range[0] + new_range[1]) / 2
    
    db.commit()
    db.refresh(assessment)
    
    return APIResponse(
        message="人工改判成功",
        data={
            "assessment_id": assessment.id,
            "original_ai_risk_level": assessment.ai_risk_level,
            "original_ai_risk_score": assessment.ai_risk_score,
            "manual_risk_level": assessment.manual_risk_level,
            "final_risk_level": assessment.final_risk_level,
            "final_risk_score": assessment.final_risk_score,
            "manual_reason": assessment.manual_reason,
            "manual_judge": assessment.manual_judge,
            "manual_time": assessment.manual_time
        }
    )


@router.post("/{assessment_id}/reassess", response_model=APIResponse)
def reassess_risk(
    assessment_id: int,
    include_alarms: bool = True,
    include_work_orders: bool = True,
    db: Session = Depends(get_db)
):
    """重新评估风险"""
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="风险评估记录不存在")
    
    photo = db.query(BladePhoto).filter(BladePhoto.id == assessment.photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="关联的照片记录不存在")
    
    # 获取相关告警
    related_alarms = None
    if include_alarms:
        blade = db.query(Blade).filter(Blade.id == photo.blade_id).first()
        if blade:
            alarms = db.query(SCADAAllarm).filter(
                SCADAAllarm.turbine_id == blade.turbine_id,
                SCADAAllarm.is_active == True
            ).all()
            related_alarms = [
                {
                    "severity": a.severity,
                    "alarm_type": a.alarm_type,
                    "is_active": a.is_active
                }
                for a in alarms
            ]
    
    # 获取相关工单
    related_work_orders = None
    if include_work_orders:
        blade = db.query(Blade).filter(Blade.id == photo.blade_id).first()
        if blade:
            work_orders = db.query(WorkOrder).filter(
                WorkOrder.turbine_id == blade.turbine_id,
                WorkOrder.blade_number == blade.blade_number,
                WorkOrder.status.in_(["待处理", "处理中"])
            ).all()
            related_work_orders = [
                {
                    "status": wo.status,
                    "priority": wo.priority,
                    "issue_type": wo.issue_type
                }
                for wo in work_orders
            ]
    
    # 准备缺陷信息
    defect_info = {
        "type": assessment.ai_detection_type.lower().replace(" ", "_") if assessment.ai_detection_type else "unknown",
        "name": assessment.ai_detection_type or "未知缺陷",
        "confidence": assessment.ai_confidence or 0.5
    }
    
    # 准备位置信息
    location_info = {}
    if photo.segment:
        location_info["segment"] = photo.segment
    if photo.distance_from_root:
        location_info["distance_from_root"] = photo.distance_from_root
    
    # 重新计算风险
    risk_result = risk_scoring_engine.calculate_risk(
        defect_info=defect_info,
        location_info=location_info if location_info else None,
        related_alarms=related_alarms,
        related_work_orders=related_work_orders
    )
    
    # 只有在没有人工改判的情况下才更新AI评估
    if not assessment.manual_override:
        assessment.ai_risk_level = risk_result["risk_level"]
        assessment.ai_risk_score = risk_result["risk_score"]
        assessment.ai_description = risk_result["description"]
        
        # 更新最终结果
        assessment.final_risk_level = risk_result["risk_level"]
        assessment.final_risk_score = risk_result["risk_score"]
        
        db.commit()
        db.refresh(assessment)
    
    return APIResponse(
        message="重新评估完成",
        data={
            "assessment_id": assessment.id,
            "risk_result": risk_result,
            "was_manually_overridden": assessment.manual_override,
            "related_alarms_count": len(related_alarms) if related_alarms else 0,
            "related_work_orders_count": len(related_work_orders) if related_work_orders else 0
        }
    )


@router.post("/batch-reassess", response_model=APIResponse)
def batch_reassess(
    assessment_ids: List[int],
    include_alarms: bool = True,
    include_work_orders: bool = True,
    db: Session = Depends(get_db)
):
    """批量重新评估风险"""
    results = []
    errors = []
    
    for assessment_id in assessment_ids:
        try:
            assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
            if not assessment:
                errors.append(f"评估记录 {assessment_id} 不存在")
                continue
            
            # 跳过已人工改判的记录
            if assessment.manual_override:
                results.append({
                    "assessment_id": assessment_id,
                    "status": "skipped",
                    "reason": "已人工改判，跳过重新评估"
                })
                continue
            
            photo = db.query(BladePhoto).filter(BladePhoto.id == assessment.photo_id).first()
            if not photo:
                errors.append(f"评估记录 {assessment_id} 的关联照片不存在")
                continue
            
            # 准备缺陷信息
            defect_info = {
                "type": assessment.ai_detection_type.lower().replace(" ", "_") if assessment.ai_detection_type else "unknown",
                "name": assessment.ai_detection_type or "未知缺陷",
                "confidence": assessment.ai_confidence or 0.5
            }
            
            # 准备位置信息
            location_info = {}
            if photo.segment:
                location_info["segment"] = photo.segment
            if photo.distance_from_root:
                location_info["distance_from_root"] = photo.distance_from_root
            
            # 重新计算风险
            risk_result = risk_scoring_engine.calculate_risk(
                defect_info=defect_info,
                location_info=location_info if location_info else None,
                related_alarms=None,
                related_work_orders=None
            )
            
            # 更新评估
            assessment.ai_risk_level = risk_result["risk_level"]
            assessment.ai_risk_score = risk_result["risk_score"]
            assessment.final_risk_level = risk_result["risk_level"]
            assessment.final_risk_score = risk_result["risk_score"]
            
            results.append({
                "assessment_id": assessment_id,
                "status": "updated",
                "old_risk_level": assessment.ai_risk_level,
                "new_risk_level": risk_result["risk_level"],
                "risk_score": risk_result["risk_score"]
            })
            
        except Exception as e:
            errors.append(f"评估记录 {assessment_id} 处理失败: {str(e)}")
    
    db.commit()
    
    return APIResponse(
        message=f"批量重新评估完成，成功 {len([r for r in results if r.get('status') == 'updated'])} 条",
        data={
            "total": len(assessment_ids),
            "updated": len([r for r in results if r.get('status') == 'updated']),
            "skipped": len([r for r in results if r.get('status') == 'skipped']),
            "errors": len(errors),
            "results": results,
            "error_details": errors if errors else None
        }
    )


@router.get("/statistics/summary", response_model=APIResponse)
def get_risk_statistics(db: Session = Depends(get_db)):
    """获取风险统计摘要"""
    # 按风险等级统计
    from sqlalchemy import func
    
    risk_summary = db.query(
        RiskAssessment.final_risk_level,
        func.count(RiskAssessment.id).label("count")
    ).group_by(RiskAssessment.final_risk_level).all()
    
    # 人工改判统计
    manual_override_count = db.query(RiskAssessment).filter(
        RiskAssessment.manual_override == True
    ).count()
    
    # 高风险数量
    high_risk_count = db.query(RiskAssessment).filter(
        RiskAssessment.final_risk_level.in_(["严重", "高"])
    ).count()
    
    return APIResponse(
        message="获取风险统计成功",
        data={
            "risk_level_distribution": {
                row.final_risk_level: row.count
                for row in risk_summary
            },
            "manual_override_count": manual_override_count,
            "high_risk_count": high_risk_count,
            "risk_levels_order": ["严重", "高", "中", "低"]
        }
    )
