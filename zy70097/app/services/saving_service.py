import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import (
    Equipment, EquipmentGroup, BaselineVersion, 
    EnergyData, ProductionData, EnergySaving
)
from app.core.config import settings
from app.services.outlier_service import OutlierService


class SavingService:
    """节能收益计算服务"""
    
    @staticmethod
    def normalize_production(production_data: List[float], 
                           reference_production: Optional[float] = None) -> Tuple[float, List[float]]:
        """
        产量归一化
        
        Args:
            production_data: 产量数据列表
            reference_production: 参考产量（可选，不填则使用平均值）
            
        Returns:
            Tuple[归一化因子, 归一化后的产量列表]
        """
        if not production_data:
            return 1.0, []
        
        if reference_production is None:
            reference_production = np.mean(production_data)
        
        if reference_production == 0:
            return 1.0, [0.0] * len(production_data)
        
        normalized = [p / reference_production for p in production_data]
        
        return reference_production, normalized
    
    @classmethod
    def calculate_energy_saving(cls, db: Session, equipment_id: int,
                              baseline_id: Optional[int] = None,
                              period_start: datetime = None,
                              period_end: datetime = None) -> Dict[str, Any]:
        """
        计算单台设备的节能收益
        
        Args:
            db: 数据库会话
            equipment_id: 设备ID
            baseline_id: 基线版本ID（可选，不填则使用激活版本）
            period_start: 统计周期开始
            period_end: 统计周期结束
            
        Returns:
            节能收益计算结果
        """
        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if not equipment:
            raise ValueError(f"设备 {equipment_id} 不存在")
        
        if baseline_id:
            baseline = db.query(BaselineVersion).filter(BaselineVersion.id == baseline_id).first()
            if not baseline:
                raise ValueError(f"基线版本 {baseline_id} 不存在")
        else:
            baseline = db.query(BaselineVersion).filter(
                BaselineVersion.equipment_id == equipment_id,
                BaselineVersion.is_active == True
            ).first()
            if not baseline:
                raise ValueError(f"设备 {equipment_id} 没有激活的基线版本")
        
        energy_records = db.query(EnergyData).filter(
            EnergyData.equipment_id == equipment_id,
            EnergyData.record_date >= period_start,
            EnergyData.record_date <= period_end,
            EnergyData.is_outlier == False
        ).order_by(EnergyData.record_date).all()
        
        production_records = db.query(ProductionData).filter(
            ProductionData.equipment_id == equipment_id,
            ProductionData.record_date >= period_start,
            ProductionData.record_date <= period_end,
            ProductionData.is_outlier == False
        ).order_by(ProductionData.record_date).all()
        
        if len(energy_records) == 0:
            raise ValueError(f"设备 {equipment_id} 在统计周期内没有能耗数据")
        
        if len(production_records) == 0:
            raise ValueError(f"设备 {equipment_id} 在统计周期内没有产量数据")
        
        energy_values = [r.energy_consumption for r in energy_records]
        production_values = [r.production_quantity for r in production_records]
        
        min_len = min(len(energy_values), len(production_values))
        energy_values = energy_values[:min_len]
        production_values = production_values[:min_len]
        
        actual_energy = sum(energy_values)
        total_production = sum(production_values)
        
        _, normalized_productions = cls.normalize_production(production_values)
        
        baseline_energy = sum(
            p * baseline.baseline_value 
            for p in production_values
        )
        
        saving_energy = baseline_energy - actual_energy
        saving_rate = (saving_energy / baseline_energy * 100) if baseline_energy > 0 else 0
        
        return {
            "equipment_id": equipment_id,
            "equipment_name": equipment.name,
            "baseline_id": baseline.id,
            "baseline_version": baseline.version,
            "baseline_value": baseline.baseline_value,
            "period_start": period_start,
            "period_end": period_end,
            "actual_energy": actual_energy,
            "baseline_energy": baseline_energy,
            "saving_energy": saving_energy,
            "saving_rate": saving_rate,
            "normalized_production": total_production,
            "data_points_count": min_len,
            "production_details": [
                {
                    "record_date": production_records[i].record_date.isoformat(),
                    "production": production_values[i],
                    "energy": energy_values[i],
                    "normalized": normalized_productions[i]
                }
                for i in range(min_len)
            ]
        }
    
    @classmethod
    def calculate_group_saving(cls, db: Session, group_id: int,
                              baseline_id: Optional[int] = None,
                              period_start: datetime = None,
                              period_end: datetime = None) -> Dict[str, Any]:
        """
        计算设备分组的节能收益
        
        Args:
            db: 数据库会话
            group_id: 分组ID
            baseline_id: 基线版本ID（可选）
            period_start: 统计周期开始
            period_end: 统计周期结束
            
        Returns:
            分组节能收益计算结果
        """
        group = db.query(EquipmentGroup).filter(EquipmentGroup.id == group_id).first()
        if not group:
            raise ValueError(f"分组 {group_id} 不存在")
        
        if baseline_id:
            baseline = db.query(BaselineVersion).filter(BaselineVersion.id == baseline_id).first()
            if not baseline:
                raise ValueError(f"基线版本 {baseline_id} 不存在")
        else:
            baseline = db.query(BaselineVersion).filter(
                BaselineVersion.group_id == group_id,
                BaselineVersion.is_active == True
            ).first()
        
        equipment_savings = []
        total_actual_energy = 0.0
        total_baseline_energy = 0.0
        total_production = 0.0
        total_data_points = 0
        
        for equipment in group.equipments:
            try:
                if baseline:
                    equipment_baseline_id = baseline.id
                else:
                    equipment_baseline = db.query(BaselineVersion).filter(
                        BaselineVersion.equipment_id == equipment.id,
                        BaselineVersion.is_active == True
                    ).first()
                    equipment_baseline_id = equipment_baseline.id if equipment_baseline else None
                
                if equipment_baseline_id:
                    saving = cls.calculate_energy_saving(
                        db, equipment.id, equipment_baseline_id, 
                        period_start, period_end
                    )
                    equipment_savings.append(saving)
                    total_actual_energy += saving["actual_energy"]
                    total_baseline_energy += saving["baseline_energy"]
                    total_production += saving["normalized_production"]
                    total_data_points += saving["data_points_count"]
            except ValueError:
                continue
        
        if total_baseline_energy == 0:
            raise ValueError(f"分组 {group_id} 中没有有效的节能计算数据")
        
        total_saving = total_baseline_energy - total_actual_energy
        total_saving_rate = (total_saving / total_baseline_energy * 100) if total_baseline_energy > 0 else 0
        
        return {
            "group_id": group_id,
            "group_name": group.name,
            "baseline_id": baseline.id if baseline else None,
            "baseline_version": baseline.version if baseline else None,
            "period_start": period_start,
            "period_end": period_end,
            "actual_energy": total_actual_energy,
            "baseline_energy": total_baseline_energy,
            "saving_energy": total_saving,
            "saving_rate": total_saving_rate,
            "normalized_production": total_production,
            "data_points_count": total_data_points,
            "equipment_count": len(equipment_savings),
            "equipment_savings": equipment_savings
        }
    
    @classmethod
    def create_saving_record(cls, db: Session, 
                            equipment_id: int,
                            baseline_id: int,
                            period_start: datetime,
                            period_end: datetime,
                            created_by: Optional[str] = None) -> EnergySaving:
        """
        创建节能收益记录
        
        Args:
            db: 数据库会话
            equipment_id: 设备ID
            baseline_id: 基线版本ID
            period_start: 统计周期开始
            period_end: 统计周期结束
            created_by: 创建人
            
        Returns:
            创建的节能收益记录
        """
        calculation_result = cls.calculate_energy_saving(
            db, equipment_id, baseline_id, period_start, period_end
        )
        
        saving = EnergySaving(
            equipment_id=equipment_id,
            baseline_id=baseline_id,
            calculation_date=datetime.utcnow(),
            period_start=period_start,
            period_end=period_end,
            actual_energy=calculation_result["actual_energy"],
            baseline_energy=calculation_result["baseline_energy"],
            saving_energy=calculation_result["saving_energy"],
            saving_rate=calculation_result["saving_rate"],
            normalized_production=calculation_result["normalized_production"],
            data_points_count=calculation_result["data_points_count"],
            status="calculated",
            created_by=created_by
        )
        
        db.add(saving)
        db.commit()
        db.refresh(saving)
        
        return saving
