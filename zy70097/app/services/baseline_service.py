import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models import (
    Equipment, EquipmentGroup, BaselineVersion, 
    EnergyData, ProductionData
)
from app.core.config import settings
from app.services.outlier_service import OutlierService


class BaselineService:
    """基线版本管理服务"""
    
    @staticmethod
    def generate_version_number(db: Session, equipment_id: Optional[int] = None, 
                             group_id: Optional[int] = None) -> str:
        """
        生成版本号
        
        Args:
            db: 数据库会话
            equipment_id: 设备ID
            group_id: 分组ID
            
        Returns:
            版本号字符串
        """
        query = db.query(BaselineVersion)
        
        if equipment_id:
            query = query.filter(BaselineVersion.equipment_id == equipment_id)
        elif group_id:
            query = query.filter(BaselineVersion.group_id == group_id)
        
        count = query.count()
        return f"v{count + 1}.0"
    
    @classmethod
    def calculate_equipment_baseline(cls, db: Session, equipment_id: int,
                                    start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """
        计算单台设备的能效基线
        
        Args:
            db: 数据库会话
            equipment_id: 设备ID
            start_date: 基线开始日期
            end_date: 基线结束日期
            
        Returns:
            基线计算结果
        """
        energy_records = db.query(EnergyData).filter(
            EnergyData.equipment_id == equipment_id,
            EnergyData.record_date >= start_date,
            EnergyData.record_date <= end_date,
            EnergyData.is_outlier == False
        ).order_by(EnergyData.record_date).all()
        
        production_records = db.query(ProductionData).filter(
            ProductionData.equipment_id == equipment_id,
            ProductionData.record_date >= start_date,
            ProductionData.record_date <= end_date,
            ProductionData.is_outlier == False
        ).order_by(ProductionData.record_date).all()
        
        if len(energy_records) < settings.MIN_DATA_POINTS:
            raise ValueError(f"设备 {equipment_id} 在基线周期内数据点不足，需要至少 {settings.MIN_DATA_POINTS} 个点")
        
        energy_values = [r.energy_consumption for r in energy_records]
        production_values = [r.production_quantity for r in production_records]
        
        min_len = min(len(energy_values), len(production_values))
        energy_values = energy_values[:min_len]
        production_values = production_values[:min_len]
        
        efficiencies = OutlierService.calculate_energy_efficiency(energy_values, production_values)
        valid_efficiencies = [e for e in efficiencies if e != float('inf')]
        
        if len(valid_efficiencies) < settings.MIN_DATA_POINTS:
            raise ValueError(f"设备 {equipment_id} 有效能效数据点不足")
        
        outlier_indices, _ = OutlierService.detect_outliers_by_zscore(valid_efficiencies)
        excluded_count = len(outlier_indices)
        
        clean_efficiencies = [e for i, e in enumerate(valid_efficiencies) 
                            if i not in outlier_indices]
        
        if len(clean_efficiencies) < settings.MIN_DATA_POINTS:
            raise ValueError(f"设备 {equipment_id} 剔除异常后数据点不足")
        
        baseline_value = float(np.mean(clean_efficiencies))
        baseline_std = float(np.std(clean_efficiencies))
        
        return {
            "equipment_id": equipment_id,
            "baseline_value": baseline_value,
            "baseline_std": baseline_std,
            "baseline_formula": {
                "method": "mean_of_efficiencies",
                "description": "能效值（能耗/产量）的平均值"
            },
            "data_points_count": len(energy_records),
            "excluded_points_count": excluded_count,
            "start_date": start_date,
            "end_date": end_date
        }
    
    @classmethod
    def calculate_group_baseline(cls, db: Session, group_id: int,
                                start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """
        计算设备分组的能效基线
        
        Args:
            db: 数据库会话
            group_id: 分组ID
            start_date: 基线开始日期
            end_date: 基线结束日期
            
        Returns:
            基线计算结果
        """
        group = db.query(EquipmentGroup).filter(EquipmentGroup.id == group_id).first()
        if not group:
            raise ValueError(f"分组 {group_id} 不存在")
        
        all_efficiencies = []
        all_energy_data = []
        all_production_data = []
        
        for equipment in group.equipments:
            try:
                result = cls.calculate_equipment_baseline(db, equipment.id, start_date, end_date)
                all_efficiencies.append(result["baseline_value"])
                all_energy_data.append({
                    "equipment_id": equipment.id,
                    "data_points": result["data_points_count"],
                    "excluded": result["excluded_points_count"]
                })
            except ValueError:
                continue
        
        if len(all_efficiencies) < 1:
            raise ValueError(f"分组 {group_id} 中没有有效的设备数据")
        
        baseline_value = float(np.mean(all_efficiencies))
        baseline_std = float(np.std(all_efficiencies))
        
        total_data_points = sum(d["data_points"] for d in all_energy_data)
        total_excluded = sum(d["excluded"] for d in all_energy_data)
        
        return {
            "group_id": group_id,
            "baseline_value": baseline_value,
            "baseline_std": baseline_std,
            "baseline_formula": {
                "method": "group_mean",
                "description": "分组内各设备基线值的平均值",
                "equipment_details": all_energy_data
            },
            "data_points_count": total_data_points,
            "excluded_points_count": total_excluded,
            "equipment_count": len(all_efficiencies),
            "start_date": start_date,
            "end_date": end_date
        }
    
    @classmethod
    def create_baseline_version(cls, db: Session, name: str, 
                            equipment_id: Optional[int] = None,
                            group_id: Optional[int] = None,
                            start_date: datetime = None,
                            end_date: datetime = None,
                            description: Optional[str] = None,
                            version: Optional[str] = None,
                            created_by: Optional[str] = None) -> BaselineVersion:
        """
        创建基线版本
        
        Args:
            db: 数据库会话
            name: 版本名称
            equipment_id: 设备ID
            group_id: 分组ID
            start_date: 开始日期
            end_date: 结束日期
            description: 描述
            version: 版本号（可选，不填则自动生成）
            created_by: 创建人
            
        Returns:
            创建的基线版本
        """
        if equipment_id is None and group_id is None:
            raise ValueError("必须指定设备ID或分组ID")
        
        if equipment_id:
            baseline_type = "equipment"
            calculation_result = cls.calculate_equipment_baseline(db, equipment_id, start_date, end_date)
        else:
            baseline_type = "group"
            calculation_result = cls.calculate_group_baseline(db, group_id, start_date, end_date)
        
        if not version:
            version = cls.generate_version_number(db, equipment_id, group_id)
        
        baseline = BaselineVersion(
            version=version,
            name=name,
            equipment_id=equipment_id,
            group_id=group_id,
            baseline_type=baseline_type,
            start_date=start_date,
            end_date=end_date,
            baseline_value=calculation_result["baseline_value"],
            baseline_std=calculation_result["baseline_std"],
            baseline_formula=calculation_result["baseline_formula"],
            is_active=False,
            status="draft",
            data_points_count=calculation_result["data_points_count"],
            excluded_points_count=calculation_result["excluded_points_count"],
            description=description,
            created_by=created_by
        )
        
        db.add(baseline)
        db.commit()
        db.refresh(baseline)
        
        return baseline
    
    @classmethod
    def activate_baseline(cls, db: Session, baseline_id: int, 
                        replace_reason: Optional[str] = None) -> BaselineVersion:
        """
        激活基线版本
        
        Args:
            db: 数据库会话
            baseline_id: 基线版本ID
            replace_reason: 替换原因
            
        Returns:
            激活后的基线版本
        """
        baseline = db.query(BaselineVersion).filter(BaselineVersion.id == baseline_id).first()
        if not baseline:
            raise ValueError(f"基线版本 {baseline_id} 不存在")
        
        if baseline.equipment_id:
            old_active = db.query(BaselineVersion).filter(
                BaselineVersion.equipment_id == baseline.equipment_id,
                BaselineVersion.is_active == True,
                BaselineVersion.id != baseline_id
            ).first()
            
            if old_active:
                old_active.is_active = False
                old_active.status = "deprecated"
                if replace_reason:
                    old_active.replace_reason = replace_reason
        
        elif baseline.group_id:
            old_active = db.query(BaselineVersion).filter(
                BaselineVersion.group_id == baseline.group_id,
                BaselineVersion.is_active == True,
                BaselineVersion.id != baseline_id
            ).first()
            
            if old_active:
                old_active.is_active = False
                old_active.status = "deprecated"
                if replace_reason:
                    old_active.replace_reason = replace_reason
        
        baseline.is_active = True
        baseline.status = "active"
        
        db.commit()
        db.refresh(baseline)
        
        return baseline
    
    @classmethod
    def get_active_baseline(cls, db: Session, 
                          equipment_id: Optional[int] = None,
                          group_id: Optional[int] = None) -> Optional[BaselineVersion]:
        """
        获取当前激活的基线版本
        
        Args:
            db: 数据库会话
            equipment_id: 设备ID
            group_id: 分组ID
            
        Returns:
            激活的基线版本或None
        """
        query = db.query(BaselineVersion).filter(BaselineVersion.is_active == True)
        
        if equipment_id:
            query = query.filter(BaselineVersion.equipment_id == equipment_id)
        elif group_id:
            query = query.filter(BaselineVersion.group_id == group_id)
        
        return query.first()
