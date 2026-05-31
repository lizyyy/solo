from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
import pandas as pd
import io
import uuid
from datetime import datetime
import re

from ..database import get_db
from .. import models, schemas
from ..database import DATA_DIR
import os

router = APIRouter(prefix="/api/import", tags=["数据导入"])


@router.post("/energy", response_model=schemas.ImportResult)
async def import_energy_data(
    file: UploadFile = File(...),
    equipment_no: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        contents = await file.read()
        batch_id = f"energy_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"

        df = _parse_excel(contents, file.filename)
        if df.empty:
            raise HTTPException(status_code=400, detail="文件中没有有效数据")

        if equipment_no:
            compressor = db.query(models.Compressor).filter(
                models.Compressor.equipment_no == equipment_no
            ).first()
            if not compressor:
                compressor = models.Compressor(
                    equipment_no=equipment_no,
                    name=f"空压机-{equipment_no}",
                )
                db.add(compressor)
                db.flush()
        else:
            equipment_col = _find_column(df, ["设备编号", "设备号", "equipment_no", "equipment"])
            if equipment_col is None:
                raise HTTPException(
                    status_code=400,
                    detail="未指定设备编号且文件中未找到设备编号列"
                )
            equipment_no = str(df[equipment_col].iloc[0])
            compressor = db.query(models.Compressor).filter(
                models.Compressor.equipment_no == equipment_no
            ).first()
            if not compressor:
                compressor = models.Compressor(
                    equipment_no=equipment_no,
                    name=f"空压机-{equipment_no}",
                )
                db.add(compressor)
                db.flush()

        raw_file_path = os.path.join(DATA_DIR, "raw", f"{batch_id}_{file.filename}")
        with open(raw_file_path, 'wb') as f:
            f.write(contents)

        result = _process_energy_records(db, df, compressor.id, batch_id, file.filename)

        return schemas.ImportResult(
            success=True,
            message=f"能耗数据导入完成，共{result['total']}条记录",
            total_records=result['total'],
            inserted_records=result['inserted'],
            updated_records=result['updated'],
            skipped_records=result['skipped'],
            batch_id=batch_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/vibration", response_model=schemas.ImportResult)
async def import_vibration_data(
    file: UploadFile = File(...),
    equipment_no: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        contents = await file.read()
        batch_id = f"vibration_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"

        df = _parse_excel(contents, file.filename)
        if df.empty:
            raise HTTPException(status_code=400, detail="文件中没有有效数据")

        if equipment_no:
            compressor = db.query(models.Compressor).filter(
                models.Compressor.equipment_no == equipment_no
            ).first()
            if not compressor:
                compressor = models.Compressor(
                    equipment_no=equipment_no,
                    name=f"空压机-{equipment_no}",
                )
                db.add(compressor)
                db.flush()
        else:
            equipment_col = _find_column(df, ["设备编号", "设备号", "equipment_no", "equipment"])
            if equipment_col is None:
                raise HTTPException(
                    status_code=400,
                    detail="未指定设备编号且文件中未找到设备编号列"
                )
            equipment_no = str(df[equipment_col].iloc[0])
            compressor = db.query(models.Compressor).filter(
                models.Compressor.equipment_no == equipment_no
            ).first()
            if not compressor:
                compressor = models.Compressor(
                    equipment_no=equipment_no,
                    name=f"空压机-{equipment_no}",
                )
                db.add(compressor)
                db.flush()

        raw_file_path = os.path.join(DATA_DIR, "raw", f"{batch_id}_{file.filename}")
        with open(raw_file_path, 'wb') as f:
            f.write(contents)

        result = _process_vibration_records(db, df, compressor.id, batch_id, file.filename)

        return schemas.ImportResult(
            success=True,
            message=f"振动数据导入完成，共{result['total']}条记录",
            total_records=result['total'],
            inserted_records=result['inserted'],
            updated_records=result['updated'],
            skipped_records=result['skipped'],
            batch_id=batch_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


def _parse_excel(contents: bytes, filename: str) -> pd.DataFrame:
    if filename.endswith('.csv'):
        return pd.read_csv(io.BytesIO(contents))
    elif filename.endswith(('.xlsx', '.xls')):
        return pd.read_excel(io.BytesIO(contents))
    else:
        raise HTTPException(status_code=400, detail="不支持的文件格式，请上传CSV或Excel文件")


def _find_column(df: pd.DataFrame, possible_names: List[str]) -> Optional[str]:
    df_cols = [str(col).strip().lower() for col in df.columns]
    for name in possible_names:
        name_lower = name.lower()
        for i, col in enumerate(df_cols):
            if name_lower in col or col in name_lower:
                return df.columns[i]
    return None


def _parse_datetime(value) -> Optional[datetime]:
    if pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return pd.to_datetime(value).to_pydatetime()
    except:
        return None


def _process_energy_records(
    db: Session,
    df: pd.DataFrame,
    compressor_id: int,
    batch_id: str,
    source_file: str,
) -> dict:
    time_col = _find_column(df, ["时间", "记录时间", "time", "record_time", "datetime"])
    power_col = _find_column(df, ["功率", "有功功率", "power", "active_power"])
    current_col = _find_column(df, ["电流", "current"])
    voltage_col = _find_column(df, ["电压", "voltage"])
    pressure_col = _find_column(df, ["压力", "排气压力", "pressure"])
    flow_col = _find_column(df, ["流量", "排气量", "flow", "flow_rate"])
    temp_col = _find_column(df, ["温度", "排气温度", "temperature"])
    hours_col = _find_column(df, ["运行时间", "运行小时", "running_hours", "hours"])
    load_col = _find_column(df, ["负载率", "加载率", "load_rate", "load"])

    if time_col is None:
        raise HTTPException(status_code=400, detail="未找到时间列")
    if power_col is None:
        raise HTTPException(status_code=400, detail="未找到功率列")

    total = 0
    inserted = 0
    updated = 0
    skipped = 0

    for _, row in df.iterrows():
        total += 1
        record_time = _parse_datetime(row[time_col])

        if record_time is None:
            skipped += 1
            continue

        existing = db.query(models.EnergyRecord).filter(
            and_(
                models.EnergyRecord.compressor_id == compressor_id,
                models.EnergyRecord.record_time == record_time,
            )
        ).first()

        record_data = {
            "power": _safe_float(row.get(power_col)),
            "current": _safe_float(row.get(current_col)) if current_col else None,
            "voltage": _safe_float(row.get(voltage_col)) if voltage_col else None,
            "pressure": _safe_float(row.get(pressure_col)) if pressure_col else None,
            "flow_rate": _safe_float(row.get(flow_col)) if flow_col else None,
            "temperature": _safe_float(row.get(temp_col)) if temp_col else None,
            "running_hours": _safe_float(row.get(hours_col)) if hours_col else None,
            "load_rate": _safe_float(row.get(load_col)) if load_col else None,
        }

        if record_data["load_rate"] is None and record_data["power"] is not None:
            rated_power = 100
            comp = db.query(models.Compressor).filter(
                models.Compressor.id == compressor_id
            ).first()
            if comp and comp.rated_power:
                rated_power = comp.rated_power
            if rated_power > 0:
                record_data["load_rate"] = min(record_data["power"] / rated_power * 100, 100)

        if existing:
            if not existing.is_manual_edited:
                for key, value in record_data.items():
                    if value is not None:
                        setattr(existing, key, value)
                existing.batch_id = batch_id
                existing.source_file = source_file
                updated += 1
            else:
                skipped += 1
        else:
            new_record = models.EnergyRecord(
                compressor_id=compressor_id,
                record_time=record_time,
                batch_id=batch_id,
                source_file=source_file,
                **record_data,
            )
            db.add(new_record)
            inserted += 1

        if total % 100 == 0:
            db.flush()

    db.commit()

    return {
        "total": total,
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
    }


def _process_vibration_records(
    db: Session,
    df: pd.DataFrame,
    compressor_id: int,
    batch_id: str,
    source_file: str,
) -> dict:
    time_col = _find_column(df, ["时间", "记录时间", "time", "record_time", "datetime"])
    x_col = _find_column(df, ["x向振动", "x振动", "x_vibration", "x-direction"])
    y_col = _find_column(df, ["y向振动", "y振动", "y_vibration", "y-direction"])
    z_col = _find_column(df, ["z向振动", "z振动", "z_vibration", "z-direction"])
    overall_col = _find_column(df, ["总振动", "振动总值", "overall_vibration", "vibration"])

    if time_col is None:
        raise HTTPException(status_code=400, detail="未找到时间列")

    total = 0
    inserted = 0
    updated = 0
    skipped = 0

    for _, row in df.iterrows():
        total += 1
        record_time = _parse_datetime(row[time_col])

        if record_time is None:
            skipped += 1
            continue

        x_val = _safe_float(row.get(x_col)) if x_col else None
        y_val = _safe_float(row.get(y_col)) if y_col else None
        z_val = _safe_float(row.get(z_col)) if z_col else None
        overall_val = _safe_float(row.get(overall_col)) if overall_col else None

        if overall_val is None and x_val is not None and y_val is not None and z_val is not None:
            overall_val = (x_val ** 2 + y_val ** 2 + z_val ** 2) ** 0.5

        if x_val is None and y_val is None and z_val is None and overall_val is None:
            skipped += 1
            continue

        existing = db.query(models.VibrationRecord).filter(
            and_(
                models.VibrationRecord.compressor_id == compressor_id,
                models.VibrationRecord.record_time == record_time,
            )
        ).first()

        record_data = {
            "x_vibration": x_val,
            "y_vibration": y_val,
            "z_vibration": z_val,
            "overall_vibration": overall_val,
        }

        if existing:
            if not existing.is_manual_edited:
                for key, value in record_data.items():
                    if value is not None:
                        setattr(existing, key, value)
                existing.batch_id = batch_id
                existing.source_file = source_file
                updated += 1
            else:
                skipped += 1
        else:
            new_record = models.VibrationRecord(
                compressor_id=compressor_id,
                record_time=record_time,
                batch_id=batch_id,
                source_file=source_file,
                **record_data,
            )
            db.add(new_record)
            inserted += 1

        if total % 100 == 0:
            db.flush()

    db.commit()

    return {
        "total": total,
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
    }


def _safe_float(value) -> Optional[float]:
    if pd.isna(value):
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
