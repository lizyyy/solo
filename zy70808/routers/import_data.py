from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
from io import BytesIO
from datetime import datetime
from database import get_db
import models
import schemas
import services
import uuid

router = APIRouter(tags=["数据导入"])


def parse_date(date_str):
    if pd.isna(date_str) or not date_str:
        return None
    if isinstance(date_str, datetime):
        return date_str.date()
    try:
        return pd.to_datetime(date_str).date()
    except:
        return None


@router.post("/equipment", response_model=schemas.ImportResult)
async def import_equipment(
    file: UploadFile = File(...),
    created_by: str = "system",
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="请上传 Excel 文件")

    content = await file.read()
    df = pd.read_excel(BytesIO(content))

    success = 0
    failed = 0
    errors = []

    required_columns = ['设备编号', '设备名称']
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Excel 缺少必填列: {col}")

    for idx, row in df.iterrows():
        try:
            equipment_code = str(row.get('设备编号', '')).strip()
            if not equipment_code:
                errors.append(f"第 {idx+2} 行: 设备编号为空")
                failed += 1
                continue

            existing = db.query(models.Equipment).filter(
                models.Equipment.equipment_code == equipment_code
            ).first()

            if existing:
                errors.append(f"第 {idx+2} 行: 设备编号 {equipment_code} 已存在")
                failed += 1
                continue

            equipment = models.Equipment(
                equipment_code=equipment_code,
                name=str(row.get('设备名称', '')).strip(),
                type=str(row.get('设备类型', '')).strip() if pd.notna(row.get('设备类型')) else None,
                floor=str(row.get('楼层', '')).strip() if pd.notna(row.get('楼层')) else None,
                area=str(row.get('区域', '')).strip() if pd.notna(row.get('区域')) else None,
                location=str(row.get('位置', '')).strip() if pd.notna(row.get('位置')) else None,
                installation_date=parse_date(row.get('安装日期')),
                maintenance_person=str(row.get('维保人员', '')).strip() if pd.notna(row.get('维保人员')) else None,
                last_inspection_date=parse_date(row.get('上次维保日期')),
                next_inspection_date=parse_date(row.get('下次维保日期')),
                status="normal"
            )
            db.add(equipment)
            success += 1
        except Exception as e:
            errors.append(f"第 {idx+2} 行: {str(e)}")
            failed += 1

    db.commit()
    return {
        "success": success,
        "failed": failed,
        "errors": errors,
        "total": len(df)
    }


@router.post("/contract", response_model=schemas.ImportResult)
async def import_contract(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="请上传 Excel 文件")

    content = await file.read()
    df = pd.read_excel(BytesIO(content))

    success = 0
    failed = 0
    errors = []

    required_columns = ['合同编号', '设备编号', '开始日期', '结束日期']
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Excel 缺少必填列: {col}")

    for idx, row in df.iterrows():
        try:
            contract_number = str(row.get('合同编号', '')).strip()
            if not contract_number:
                errors.append(f"第 {idx+2} 行: 合同编号为空")
                failed += 1
                continue

            existing = db.query(models.Contract).filter(
                models.Contract.contract_number == contract_number
            ).first()

            if existing:
                errors.append(f"第 {idx+2} 行: 合同编号 {contract_number} 已存在")
                failed += 1
                continue

            equipment_code = str(row.get('设备编号', '')).strip()
            equipment = db.query(models.Equipment).filter(
                models.Equipment.equipment_code == equipment_code
            ).first()

            contract = models.Contract(
                contract_number=contract_number,
                equipment_id=equipment.id if equipment else None,
                equipment_code=equipment_code,
                vendor_name=str(row.get('供应商', '')).strip() if pd.notna(row.get('供应商')) else None,
                start_date=parse_date(row.get('开始日期')),
                end_date=parse_date(row.get('结束日期')),
                contract_amount=int(row.get('金额')) if pd.notna(row.get('金额')) else None,
                contact_person=str(row.get('联系人', '')).strip() if pd.notna(row.get('联系人')) else None,
                contact_phone=str(row.get('联系电话', '')).strip() if pd.notna(row.get('联系电话')) else None,
                status="active"
            )
            db.add(contract)
            success += 1
        except Exception as e:
            errors.append(f"第 {idx+2} 行: {str(e)}")
            failed += 1

    db.commit()
    return {
        "success": success,
        "failed": failed,
        "errors": errors,
        "total": len(df)
    }


@router.post("/photos", response_model=schemas.ImportResult)
async def import_photos(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="请上传 Excel 文件")

    content = await file.read()
    df = pd.read_excel(BytesIO(content))

    success = 0
    failed = 0
    errors = []

    required_columns = ['设备编号']
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Excel 缺少必填列: {col}")

    for idx, row in df.iterrows():
        try:
            equipment_code = str(row.get('设备编号', '')).strip()
            if not equipment_code:
                errors.append(f"第 {idx+2} 行: 设备编号为空")
                failed += 1
                continue

            equipment = db.query(models.Equipment).filter(
                models.Equipment.equipment_code == equipment_code
            ).first()

            photo_code = f"PHOTO{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"

            photo = models.InspectionPhoto(
                photo_code=photo_code,
                equipment_id=equipment.id if equipment else None,
                equipment_code=equipment_code,
                file_name=str(row.get('文件名', '')).strip() if pd.notna(row.get('文件名')) else None,
                file_path=str(row.get('文件路径', '')).strip() if pd.notna(row.get('文件路径')) else None,
                inspection_date=parse_date(row.get('拍摄日期')),
                photographer=str(row.get('拍摄人', '')).strip() if pd.notna(row.get('拍摄人')) else None,
                description=str(row.get('描述', '')).strip() if pd.notna(row.get('描述')) else None
            )
            db.add(photo)
            success += 1
        except Exception as e:
            errors.append(f"第 {idx+2} 行: {str(e)}")
            failed += 1

    db.commit()
    return {
        "success": success,
        "failed": failed,
        "errors": errors,
        "total": len(df)
    }
