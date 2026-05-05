from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
import json
import os
from pathlib import Path
import uuid

from database import get_db
from models import InspectionRecord, BladePhoto, WindTurbine, Blade, RiskAssessment
from schemas import (
    InspectionRecordCreate, InspectionRecordResponse,
    BladePhotoResponse, RiskAssessmentResponse,
    APIResponse
)
from config import settings
from feature_extractor import feature_extractor, defect_detector
from risk_scoring import risk_scoring_engine

router = APIRouter(prefix="/api/inspections", tags=["巡检管理"])


@router.get("/", response_model=APIResponse)
def get_inspections(
    turbine_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """获取巡检记录列表"""
    query = db.query(InspectionRecord)
    
    if turbine_id:
        query = query.filter(InspectionRecord.turbine_id == turbine_id)
    
    total = query.count()
    inspections = query.order_by(desc(InspectionRecord.inspection_date)).offset(skip).limit(limit).all()
    
    return APIResponse(
        message=f"获取到 {len(inspections)} 条巡检记录",
        data={
            "total": total,
            "items": [InspectionRecordResponse.model_validate(i) for i in inspections]
        }
    )


@router.get("/{inspection_id}", response_model=APIResponse)
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    """获取单个巡检记录详情"""
    inspection = db.query(InspectionRecord).filter(InspectionRecord.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    
    return APIResponse(
        message="获取巡检记录成功",
        data=InspectionRecordResponse.model_validate(inspection)
    )


@router.post("/", response_model=APIResponse)
def create_inspection(inspection: InspectionRecordCreate, db: Session = Depends(get_db)):
    """创建巡检记录"""
    # 检查风机是否存在
    turbine = db.query(WindTurbine).filter(WindTurbine.id == inspection.turbine_id).first()
    if not turbine:
        raise HTTPException(status_code=404, detail=f"风机 ID {inspection.turbine_id} 不存在")
    
    db_inspection = InspectionRecord(**inspection.model_dump())
    db.add(db_inspection)
    db.commit()
    db.refresh(db_inspection)
    
    return APIResponse(
        message="巡检记录创建成功",
        data=InspectionRecordResponse.model_validate(db_inspection)
    )


@router.post("/{inspection_id}/upload-drone-track", response_model=APIResponse)
async def upload_drone_track(
    inspection_id: int,
    file: UploadFile = File(..., description="无人机航迹JSON文件"),
    db: Session = Depends(get_db)
):
    """上传无人机航迹文件"""
    inspection = db.query(InspectionRecord).filter(InspectionRecord.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    
    # 验证文件类型
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON格式的航迹文件")
    
    # 读取文件内容
    content = await file.read()
    try:
        # 验证JSON格式
        json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="无效的JSON格式")
    
    # 保存文件
    upload_dir = Path(settings.UPLOAD_DIR) / "drone_tracks"
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = upload_dir / f"{inspection_id}_{uuid.uuid4().hex}_{file.filename}"
    file_path.write_bytes(content)
    
    # 更新巡检记录
    inspection.drone_track_file = str(file_path)
    db.commit()
    
    return APIResponse(
        message="无人机航迹文件上传成功",
        data={
            "file_path": str(file_path),
            "file_name": file.filename
        }
    )


@router.post("/{inspection_id}/upload-photos", response_model=APIResponse)
async def upload_photos(
    inspection_id: int,
    files: List[UploadFile] = File(..., description="叶片照片文件"),
    blade_id: Optional[int] = Form(None, description="叶片ID（可选，会从文件名解析）"),
    segment: Optional[str] = Form(None, description="分段位置（可选，会从文件名解析）"),
    distance_from_root: Optional[float] = Form(None, description="距离叶根距离（可选）"),
    db: Session = Depends(get_db)
):
    """批量上传叶片照片"""
    inspection = db.query(InspectionRecord).filter(InspectionRecord.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    
    turbine_id = inspection.turbine_id
    
    # 创建上传目录
    upload_dir = Path(settings.UPLOAD_DIR) / "photos" / f"turbine_{turbine_id}" / f"inspection_{inspection_id}"
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    results = []
    errors = []
    
    for file in files:
        try:
            # 验证文件类型
            if not file.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.webp')):
                errors.append(f"文件 {file.filename} 不是支持的图片格式")
                continue
            
            # 从文件名解析信息（如果未提供）
            parsed_blade_id = blade_id
            parsed_segment = segment
            
            # 文件名格式示例: W001_B1_LE_15m.jpg (风机_叶片_分段_距离)
            filename_parts = file.filename.replace('.', '_').split('_')
            for part in filename_parts:
                # 解析叶片编号 B1, B2, B3
                if part.startswith('B') and len(part) == 2 and part[1].isdigit():
                    blade_num = int(part[1])
                    # 查找对应的叶片ID
                    blade = db.query(Blade).filter(
                        Blade.turbine_id == turbine_id,
                        Blade.blade_number == blade_num
                    ).first()
                    if blade:
                        parsed_blade_id = blade.id
                
                # 解析分段位置 LE, TE, PS, SS, tip, root, mid
                if part.upper() in ['LE', 'TE', 'PS', 'SS']:
                    parsed_segment = part.upper()
                elif part.lower() in ['tip', 'root', 'mid']:
                    parsed_segment = part.lower()
                
                # 解析距离 15m, 25m
                if part.endswith('m') and part[:-1].replace('.', '', 1).isdigit():
                    try:
                        distance_from_root = float(part[:-1])
                    except:
                        pass
            
            if not parsed_blade_id:
                errors.append(f"无法解析文件 {file.filename} 的叶片编号，请手动指定 blade_id")
                continue
            
            # 保存文件
            file_path = upload_dir / file.filename
            content = await file.read()
            file_path.write_bytes(content)
            
            # 创建照片记录
            photo = BladePhoto(
                blade_id=parsed_blade_id,
                inspection_id=inspection_id,
                file_path=str(file_path),
                file_name=file.filename,
                segment=parsed_segment,
                distance_from_root=distance_from_root
            )
            db.add(photo)
            db.flush()  # 获取ID
            
            # 提取图像特征
            try:
                features = feature_extractor.extract_features(str(file_path))
                photo.image_features = json.dumps(features, ensure_ascii=False)
                
                # 检测缺陷
                defects = defect_detector.detect_defects(features)
                
                # 如果检测到缺陷，进行风险评估
                if defects:
                    top_defect = defects[0]
                    
                    # 准备位置信息
                    location_info = {}
                    if photo.segment:
                        location_info["segment"] = photo.segment
                    if photo.distance_from_root:
                        location_info["distance_from_root"] = photo.distance_from_root
                    
                    # 计算风险评分
                    risk_result = risk_scoring_engine.calculate_risk(
                        defect_info=top_defect,
                        location_info=location_info if location_info else None
                    )
                    
                    # 创建风险评估记录
                    assessment = RiskAssessment(
                        photo_id=photo.id,
                        inspection_id=inspection_id,
                        ai_risk_level=risk_result["risk_level"],
                        ai_risk_score=risk_result["risk_score"],
                        ai_detection_type=top_defect["name"],
                        ai_confidence=top_defect["confidence"],
                        ai_description=risk_result["description"],
                        final_risk_level=risk_result["risk_level"],
                        final_risk_score=risk_result["risk_score"]
                    )
                    db.add(assessment)
                
                results.append({
                    "photo_id": photo.id,
                    "file_name": file.filename,
                    "blade_id": parsed_blade_id,
                    "segment": parsed_segment,
                    "defects_detected": len(defects),
                    "top_defect": top_defect["name"] if defects else None,
                    "risk_level": risk_result["risk_level"] if defects else None
                })
                
            except Exception as e:
                errors.append(f"处理文件 {file.filename} 时出错: {str(e)}")
                continue
            
        except Exception as e:
            errors.append(f"上传文件 {file.filename} 时出错: {str(e)}")
            continue
    
    db.commit()
    
    return APIResponse(
        message=f"成功上传 {len(results)} 张照片" + (f"，{len(errors)} 个错误" if errors else ""),
        data={
            "success_count": len(results),
            "error_count": len(errors),
            "results": results,
            "errors": errors if errors else None
        }
    )


@router.get("/{inspection_id}/photos", response_model=APIResponse)
def get_inspection_photos(
    inspection_id: int,
    blade_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """获取巡检记录的所有照片"""
    inspection = db.query(InspectionRecord).filter(InspectionRecord.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    
    query = db.query(BladePhoto).filter(BladePhoto.inspection_id == inspection_id)
    
    if blade_id:
        query = query.filter(BladePhoto.blade_id == blade_id)
    
    photos = query.order_by(BladePhoto.blade_id, BladePhoto.distance_from_root).all()
    
    return APIResponse(
        message=f"获取到 {len(photos)} 张照片",
        data=[BladePhotoResponse.model_validate(p) for p in photos]
    )


@router.get("/{inspection_id}/risk-assessments", response_model=APIResponse)
def get_inspection_risk_assessments(
    inspection_id: int,
    risk_level: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取巡检记录的风险评估"""
    inspection = db.query(InspectionRecord).filter(InspectionRecord.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    
    query = db.query(RiskAssessment).filter(RiskAssessment.inspection_id == inspection_id)
    
    if risk_level:
        query = query.filter(RiskAssessment.final_risk_level == risk_level)
    
    assessments = query.order_by(desc(RiskAssessment.final_risk_score)).all()
    
    return APIResponse(
        message=f"获取到 {len(assessments)} 条风险评估记录",
        data=[RiskAssessmentResponse.model_validate(a) for a in assessments]
    )
