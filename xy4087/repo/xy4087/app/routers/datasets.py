from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import os
import tempfile

from app.database import get_db
from app.models import Dataset, Field
from app.schemas import (
    DatasetCreate, DatasetResponse, DatasetListResponse,
    FieldCreate, FieldResponse, MessageResponse
)
from app.services.csv_parser import csv_parser
from app.services.budget_manager import budget_manager

router = APIRouter(prefix="/datasets", tags=["数据集管理"])


@router.get("/", response_model=List[DatasetListResponse])
def list_datasets(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取所有数据集列表"""
    datasets = db.query(Dataset).offset(skip).limit(limit).all()
    return datasets


@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """获取单个数据集详情"""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"数据集 {dataset_id} 不存在")
    return dataset


@router.post("/", response_model=DatasetResponse)
def create_dataset(dataset: DatasetCreate, db: Session = Depends(get_db)):
    """创建新数据集（元数据）"""
    try:
        # 创建数据集
        db_dataset = Dataset(
            name=dataset.name,
            description=dataset.description
        )
        db.add(db_dataset)
        db.flush()  # 获取ID
        
        # 创建字段
        for field_data in dataset.fields:
            db_field = Field(
                dataset_id=db_dataset.id,
                name=field_data.name,
                field_type=field_data.field_type,
                description=field_data.description
            )
            db.add(db_field)
        
        # 创建预算账本
        budget_manager.create_ledger(
            db=db,
            dataset_id=db_dataset.id,
            total_epsilon=dataset.total_epsilon,
            delta=dataset.delta,
            suppression_threshold=dataset.suppression_threshold
        )
        
        db.commit()
        db.refresh(db_dataset)
        
        return db_dataset
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{dataset_id}/import")
def import_csv(
    dataset_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """导入CSV数据到数据集"""
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"数据集 {dataset_id} 不存在")
    
    # 保存上传的文件到临时位置
    try:
        # 创建临时文件
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".csv"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            # 读取上传文件内容
            content = file.file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # 解析CSV
        # 获取字段配置
        fields = db.query(Field).filter(Field.dataset_id == dataset_id).all()
        field_configs = [
            {'name': f.name, 'field_type': f.field_type}
            for f in fields
        ] if fields else None
        
        parse_result = csv_parser.parse_csv(tmp_path, field_configs)
        
        if not parse_result['success']:
            # 清理临时文件
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise HTTPException(status_code=400, detail=parse_result['error'])
        
        # 保存数据
        df = parse_result['dataframe']
        csv_parser.save_dataset_data(dataset_id, df)
        
        # 更新字段信息（样本值等）
        field_analysis = parse_result.get('field_analysis', {})
        for field in fields:
            if field.name in field_analysis:
                analysis = field_analysis[field.name]
                sample_values = analysis.get('sample_values', [])
                if sample_values:
                    field.sample_values = json.dumps(sample_values, ensure_ascii=False)
        
        db.commit()
        
        # 清理临时文件
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        
        return {
            "success": True,
            "dataset_id": dataset_id,
            "row_count": parse_result['row_count'],
            "column_count": parse_result['column_count'],
            "field_analysis": {
                k: {
                    'name': v['name'],
                    'dtype': v['dtype'],
                    'null_count': v['null_count'],
                    'unique_count': v['unique_count']
                }
                for k, v in field_analysis.items()
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{dataset_id}", response_model=MessageResponse)
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """删除数据集"""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"数据集 {dataset_id} 不存在")
    
    try:
        # 删除数据文件
        csv_parser.delete_dataset_data(dataset_id)
        
        # 删除数据库记录（级联删除会处理相关表）
        db.delete(dataset)
        db.commit()
        
        return MessageResponse(message=f"数据集 {dataset_id} 已成功删除", success=True)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{dataset_id}/fields", response_model=List[FieldResponse])
def get_dataset_fields(dataset_id: int, db: Session = Depends(get_db)):
    """获取数据集的字段列表"""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"数据集 {dataset_id} 不存在")
    
    return dataset.fields
