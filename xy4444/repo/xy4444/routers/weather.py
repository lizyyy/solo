from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io
import json
import pandas as pd

from database import get_db
from models.weather import WeatherData
from models.audit import AuditLog
from pydantic import BaseModel

router = APIRouter(prefix="/api/weather", tags=["气象数据"])


class WeatherDataCreate(BaseModel):
    observation_time: datetime
    airport_code: str
    temperature: Optional[float] = None
    dew_point: Optional[float] = None
    wind_speed: Optional[float] = None
    wind_direction: Optional[int] = None
    wind_gust: Optional[float] = None
    visibility: Optional[float] = None
    ceiling: Optional[int] = None
    precipitation_type: Optional[str] = None
    precipitation_intensity: Optional[str] = None
    is_freezing_rain: bool = False
    is_snow: bool = False
    relative_humidity: Optional[float] = None
    pressure: Optional[float] = None


@router.post("/", response_model=dict)
def create_weather_data(data: WeatherDataCreate, db: Session = Depends(get_db)):
    db_data = WeatherData(
        observation_time=data.observation_time,
        airport_code=data.airport_code,
        temperature=data.temperature,
        dew_point=data.dew_point,
        wind_speed=data.wind_speed,
        wind_direction=data.wind_direction,
        wind_gust=data.wind_gust,
        visibility=data.visibility,
        ceiling=data.ceiling,
        precipitation_type=data.precipitation_type,
        precipitation_intensity=data.precipitation_intensity,
        is_freezing_rain=data.is_freezing_rain,
        is_snow=data.is_snow,
        relative_humidity=data.relative_humidity,
        pressure=data.pressure
    )
    db.add(db_data)
    
    audit = AuditLog(
        action="CREATE_WEATHER_DATA",
        entity_type="WeatherData",
        details=f"创建气象数据，机场: {data.airport_code}, 时间: {data.observation_time}"
    )
    db.add(audit)
    
    db.commit()
    db.refresh(db_data)
    
    return {"message": "创建成功", "weather": db_data.to_dict()}


@router.post("/import/json", response_model=dict)
def import_weather_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(
            status_code=400,
            detail="请上传 JSON 文件"
        )
    
    content = file.file.read()
    
    try:
        data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="JSON 文件格式错误"
        )
    
    if isinstance(data, dict):
        data = [data]
    
    imported_count = 0
    errors = []
    
    for idx, item in enumerate(data):
        try:
            def parse_datetime(val):
                if not val:
                    return None
                if isinstance(val, str):
                    try:
                        return datetime.fromisoformat(val.replace('Z', '+00:00'))
                    except:
                        try:
                            return datetime.strptime(val, '%Y-%m-%d %H:%M:%S')
                        except:
                            return None
                return val
            
            def parse_bool(val):
                if val is None:
                    return False
                if isinstance(val, bool):
                    return val
                return str(val).lower() in ['true', '1', 'yes', '是']
            
            def parse_float(val):
                if val is None or val == '':
                    return None
                try:
                    return float(val)
                except:
                    return None
            
            def parse_int(val):
                if val is None or val == '':
                    return None
                try:
                    return int(val)
                except:
                    return None
            
            observation_time = parse_datetime(item.get('observation_time'))
            if not observation_time:
                observation_time = datetime.utcnow()
            
            airport_code = str(item.get('airport_code', 'UNKNOWN')).strip()
            
            new_weather = WeatherData(
                observation_time=observation_time,
                airport_code=airport_code,
                temperature=parse_float(item.get('temperature')),
                dew_point=parse_float(item.get('dew_point')),
                wind_speed=parse_float(item.get('wind_speed')),
                wind_direction=parse_int(item.get('wind_direction')),
                wind_gust=parse_float(item.get('wind_gust')),
                visibility=parse_float(item.get('visibility')),
                ceiling=parse_int(item.get('ceiling')),
                precipitation_type=str(item.get('precipitation_type', '')).strip() if item.get('precipitation_type') else None,
                precipitation_intensity=str(item.get('precipitation_intensity', '')).strip() if item.get('precipitation_intensity') else None,
                is_freezing_rain=parse_bool(item.get('is_freezing_rain', False)),
                is_snow=parse_bool(item.get('is_snow', False)),
                relative_humidity=parse_float(item.get('relative_humidity')),
                pressure=parse_float(item.get('pressure'))
            )
            db.add(new_weather)
            
            audit = AuditLog(
                action="IMPORT_WEATHER_DATA",
                entity_type="WeatherData",
                details=f"导入气象数据，机场: {airport_code}, 时间: {observation_time}"
            )
            db.add(audit)
            
            imported_count += 1
            
        except Exception as e:
            errors.append(f"第 {idx+1} 条: {str(e)}")
            continue
    
    db.commit()
    
    return {
        "message": "导入完成",
        "imported": imported_count,
        "errors": errors
    }


@router.get("/", response_model=dict)
def get_weather_data(
    skip: int = 0,
    limit: int = 100,
    airport_code: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(WeatherData)
    
    if airport_code:
        query = query.filter(WeatherData.airport_code == airport_code)
    if start_time:
        query = query.filter(WeatherData.observation_time >= start_time)
    if end_time:
        query = query.filter(WeatherData.observation_time <= end_time)
    
    total = query.count()
    weather_list = query.order_by(WeatherData.observation_time.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "weather_data": [w.to_dict() for w in weather_list]
    }


@router.get("/latest", response_model=dict)
def get_latest_weather(
    airport_code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(WeatherData)
    
    if airport_code:
        query = query.filter(WeatherData.airport_code == airport_code)
    
    latest = query.order_by(WeatherData.observation_time.desc()).first()
    
    if not latest:
        raise HTTPException(status_code=404, detail="暂无气象数据")
    
    return {"latest": latest.to_dict()}


@router.get("/{data_id}", response_model=dict)
def get_weather_by_id(data_id: int, db: Session = Depends(get_db)):
    weather = db.query(WeatherData).filter(
        WeatherData.id == data_id
    ).first()
    
    if not weather:
        raise HTTPException(status_code=404, detail=f"气象数据 {data_id} 不存在")
    
    return {"weather": weather.to_dict()}


@router.delete("/{data_id}", response_model=dict)
def delete_weather_data(data_id: int, db: Session = Depends(get_db)):
    weather = db.query(WeatherData).filter(
        WeatherData.id == data_id
    ).first()
    
    if not weather:
        raise HTTPException(status_code=404, detail=f"气象数据 {data_id} 不存在")
    
    db.delete(weather)
    
    audit = AuditLog(
        action="DELETE_WEATHER_DATA",
        entity_type="WeatherData",
        details=f"删除气象数据 ID: {data_id}"
    )
    db.add(audit)
    
    db.commit()
    
    return {"message": "删除成功"}
