from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models import SystemConfig
from app.schemas import (
    SystemConfigCreate,
    SystemConfigResponse
)

router = APIRouter(prefix="/config", tags=["系统配置"])


DEFAULT_CONFIGS = [
    {
        "config_key": "max_storage_days",
        "config_value": "30",
        "config_type": "int",
        "description": "电池存放最大天数，超过此天数需复检"
    },
    {
        "config_key": "max_cell_voltage_diff",
        "config_value": "0.05",
        "config_type": "float",
        "description": "最大允许单体电压差（V），超过此值需复检"
    },
    {
        "config_key": "low_voltage_threshold",
        "config_value": "3.2",
        "config_type": "float",
        "description": "低压告警阈值（V）"
    },
    {
        "config_key": "max_cycle_jump",
        "config_value": "5",
        "config_type": "int",
        "description": "最大允许循环次数跳变值"
    },
    {
        "config_key": "min_temperature_threshold",
        "config_value": "-10.0",
        "config_type": "float",
        "description": "最低推荐环境温度（°C）"
    },
    {
        "config_key": "max_recommended_cycles",
        "config_value": "200",
        "config_type": "int",
        "description": "最大推荐循环次数"
    },
]


@router.get("/", response_model=List[SystemConfigResponse])
def list_configs(db: Session = Depends(get_db)):
    _init_default_configs(db)
    return db.query(SystemConfig).order_by(SystemConfig.config_key).all()


@router.get("/{config_key}", response_model=SystemConfigResponse)
def get_config(config_key: str, db: Session = Depends(get_db)):
    config = db.query(SystemConfig).filter(
        SystemConfig.config_key == config_key
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=404,
            detail=f"配置项 {config_key} 不存在"
        )
    
    return config


@router.post("/", response_model=SystemConfigResponse)
def create_config(config: SystemConfigCreate, db: Session = Depends(get_db)):
    existing = db.query(SystemConfig).filter(
        SystemConfig.config_key == config.config_key
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"配置项 {config.config_key} 已存在，请使用 PUT 更新"
        )
    
    db_config = SystemConfig(
        config_key=config.config_key,
        config_value=config.config_value,
        config_type=config.config_type,
        description=config.description
    )
    
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    
    return db_config


@router.put("/{config_key}", response_model=SystemConfigResponse)
def update_config(
    config_key: str,
    config_value: str,
    description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    config = db.query(SystemConfig).filter(
        SystemConfig.config_key == config_key
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=404,
            detail=f"配置项 {config_key} 不存在"
        )
    
    config.config_value = config_value
    if description is not None:
        config.description = description
    
    db.commit()
    db.refresh(config)
    
    return config


@router.delete("/{config_key}", status_code=204)
def delete_config(config_key: str, db: Session = Depends(get_db)):
    config = db.query(SystemConfig).filter(
        SystemConfig.config_key == config_key
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=404,
            detail=f"配置项 {config_key} 不存在"
        )
    
    db.delete(config)
    db.commit()


def _init_default_configs(db: Session):
    for default_config in DEFAULT_CONFIGS:
        existing = db.query(SystemConfig).filter(
            SystemConfig.config_key == default_config["config_key"]
        ).first()
        
        if not existing:
            db_config = SystemConfig(**default_config)
            db.add(db_config)
    
    db.commit()
