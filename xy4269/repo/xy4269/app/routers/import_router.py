from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
import json

from app.database import get_db
from app.schemas import ApiResponse, ImportResponse
from app.services.import_service import (
    ConstructionPlanImporter,
    TrackSectionImporter,
    PowerWindowImporter,
    WorkTrainImporter,
    PersonnelQualificationImporter
)

router = APIRouter(prefix="/import", tags=["数据导入"])

FILE_TYPE_HANDLERS = {
    "construction": ("施工计划", ConstructionPlanImporter.import_from_csv, "csv"),
    "topology": ("线路区段拓扑", TrackSectionImporter.import_from_json, "json"),
    "power": ("供电停送电窗口", PowerWindowImporter.import_from_yaml, "yaml"),
    "train": ("作业车占用表", WorkTrainImporter.import_from_csv, "csv"),
    "personnel": ("人员资质表", PersonnelQualificationImporter.import_from_csv, "csv"),
}

@router.post("/construction", response_model=ImportResponse)
async def import_construction_plans(
    file: UploadFile = File(..., description="施工计划 CSV 文件"),
    operator: Optional[str] = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    """导入施工计划 CSV 文件"""
    return await _handle_import(file, "construction", operator, db)

@router.post("/topology", response_model=ImportResponse)
async def import_track_topology(
    file: UploadFile = File(..., description="线路区段拓扑 JSON 文件"),
    operator: Optional[str] = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    """导入线路区段拓扑 JSON 文件"""
    return await _handle_import(file, "topology", operator, db)

@router.post("/power", response_model=ImportResponse)
async def import_power_windows(
    file: UploadFile = File(..., description="供电停送电窗口 YAML 文件"),
    operator: Optional[str] = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    """导入供电停送电窗口 YAML 文件"""
    return await _handle_import(file, "power", operator, db)

@router.post("/train", response_model=ImportResponse)
async def import_work_trains(
    file: UploadFile = File(..., description="作业车占用表 CSV 文件"),
    operator: Optional[str] = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    """导入作业车占用表 CSV 文件"""
    return await _handle_import(file, "train", operator, db)

@router.post("/personnel", response_model=ImportResponse)
async def import_personnel_qualifications(
    file: UploadFile = File(..., description="人员资质表 CSV 文件"),
    operator: Optional[str] = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    """导入人员资质表 CSV 文件"""
    return await _handle_import(file, "personnel", operator, db)

async def _handle_import(
    file: UploadFile,
    file_type: str,
    operator: str,
    db: Session
) -> ImportResponse:
    """统一处理导入请求"""
    if file_type not in FILE_TYPE_HANDLERS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file_type}")
    
    type_name, handler, expected_format = FILE_TYPE_HANDLERS[file_type]
    
    content = await file.read()
    
    try:
        content_str = content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            content_str = content.decode('gbk')
        except UnicodeDecodeError:
            try:
                content_str = content.decode('gb2312')
            except:
                raise HTTPException(status_code=400, detail="无法识别文件编码，请使用 UTF-8 或 GBK 编码")
    
    try:
        import_record, errors = handler(db, content_str, file.filename, operator)
        
        return ImportResponse(
            success=import_record.status.value in ["已成功", "部分成功"],
            message=f"{type_name}导入完成：成功 {import_record.success_records} 条，共 {import_record.total_records} 条",
            import_id=import_record.id,
            file_type=file_type,
            file_name=file.filename,
            total_records=import_record.total_records,
            success_records=import_record.success_records,
            status=import_record.status.value,
            errors=errors if errors else None
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")

@router.get("/types", response_model=ApiResponse)
async def get_import_types():
    """获取支持的导入类型"""
    types_info = []
    for key, (name, _, format) in FILE_TYPE_HANDLERS.items():
        types_info.append({
            "type": key,
            "name": name,
            "format": format,
            "endpoint": f"/api/import/{key}"
        })
    
    return ApiResponse(
        success=True,
        message="支持的导入类型",
        data=types_info
    )
