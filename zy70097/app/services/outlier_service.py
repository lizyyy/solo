import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import EnergyData, ProductionData, Equipment
from app.core.config import settings


class OutlierService:
    """异常值检测和剔除服务"""
    
    @staticmethod
    def detect_outliers_by_zscore(values: List[float], threshold: float = None) -> Tuple[List[int], Dict[str, Any]]:
        """
        使用Z-score方法检测异常值
        
        Args:
            values: 数据值列表
            threshold: 异常阈值（标准差倍数）
            
        Returns:
            Tuple[异常索引列表, 统计信息字典]
        """
        if threshold is None:
            threshold = settings.OUTLIER_THRESHOLD
            
        if len(values) < 3:
            return [], {"mean": 0, "std": 0, "threshold": threshold}
        
        values_array = np.array(values)
        mean = np.mean(values_array)
        std = np.std(values_array)
        
        if std == 0:
            return [], {"mean": float(mean), "std": 0, "threshold": threshold}
        
        z_scores = (values_array - mean) / std
        outlier_indices = np.where(np.abs(z_scores) > threshold)[0].tolist()
        
        stats = {
            "mean": float(mean),
            "std": float(std),
            "threshold": threshold,
            "min_z": float(np.min(np.abs(z_scores))),
            "max_z": float(np.max(np.abs(z_scores))),
            "outlier_count": len(outlier_indices)
        }
        
        return outlier_indices, stats
    
    @staticmethod
    def detect_outliers_by_iqr(values: List[float]) -> Tuple[List[int], Dict[str, Any]]:
        """
        使用IQR方法检测异常值
        
        Args:
            values: 数据值列表
            
        Returns:
            Tuple[异常索引列表, 统计信息字典]
        """
        if len(values) < 4:
            return [], {"q1": 0, "q3": 0, "iqr": 0}
        
        values_array = np.array(values)
        q1 = np.percentile(values_array, 25)
        q3 = np.percentile(values_array, 75)
        iqr = q3 - q1
        
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        outlier_indices = np.where((values_array < lower_bound) | (values_array > upper_bound))[0].tolist()
        
        stats = {
            "q1": float(q1),
            "q3": float(q3),
            "iqr": float(iqr),
            "lower_bound": float(lower_bound),
            "upper_bound": float(upper_bound),
            "outlier_count": len(outlier_indices)
        }
        
        return outlier_indices, stats
    
    @staticmethod
    def calculate_energy_efficiency(energy_data: List[float], production_data: List[float]) -> List[float]:
        """
        计算能效值（能耗/产量）
        
        Args:
            energy_data: 能耗数据列表
            production_data: 产量数据列表
            
        Returns:
            能效值列表
        """
        efficiencies = []
        for e, p in zip(energy_data, production_data):
            if p > 0:
                efficiencies.append(e / p)
            else:
                efficiencies.append(float('inf'))
        return efficiencies
    
    @classmethod
    def detect_equipment_outliers(cls, db: Session, equipment_id: int, 
                               start_date: datetime, end_date: datetime,
                               threshold: float = None) -> Dict[str, Any]:
        """
        检测单个设备的异常数据
        
        Args:
            db: 数据库会话
            equipment_id: 设备ID
            start_date: 开始日期
            end_date: 结束日期
            threshold: 异常阈值
            
        Returns:
            检测结果字典
        """
        if threshold is None:
            threshold = settings.OUTLIER_THRESHOLD
        
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
            return {
                "equipment_id": equipment_id,
                "total_points": len(energy_records),
                "outliers": [],
                "message": f"数据点不足，最少需要{settings.MIN_DATA_POINTS}个点"
            }
        
        energy_values = [r.energy_consumption for r in energy_records]
        production_values = [r.production_quantity for r in production_records]
        
        min_len = min(len(energy_values), len(production_values))
        energy_values = energy_values[:min_len]
        production_values = production_values[:min_len]
        
        efficiencies = cls.calculate_energy_efficiency(energy_values, production_values)
        valid_efficiencies = [e for e in efficiencies if e != float('inf')]
        
        if len(valid_efficiencies) < 3:
            return {
                "equipment_id": equipment_id,
                "total_points": len(energy_records),
                "outliers": [],
                "message": "有效能效数据不足"
            }
        
        outlier_indices, stats = cls.detect_outliers_by_zscore(valid_efficiencies, threshold)
        
        outliers = []
        for idx in outlier_indices:
            if idx < len(energy_records):
                record = energy_records[idx]
                if idx < len(efficiencies):
                    outliers.append({
                        "energy_data_id": record.id,
                        "record_date": record.record_date.isoformat(),
                        "energy": record.energy_consumption,
                        "efficiency": efficiencies[idx],
                        "z_score": stats.get("max_z") if idx == outlier_indices[-1] else None
                    })
        
        return {
            "equipment_id": equipment_id,
            "total_points": len(energy_records),
            "outlier_count": len(outliers),
            "outliers": outliers,
            "statistics": stats
        }
    
    @classmethod
    def mark_outliers(cls, db: Session, equipment_id: int, 
                        start_date: datetime, end_date: datetime,
                        threshold: float = None) -> Dict[str, int]:
        """
        标记异常数据
        
        Args:
            db: 数据库会话
            equipment_id: 设备ID
            start_date: 开始日期
            end_date: 结束日期
            threshold: 异常阈值
            
        Returns:
            标记结果字典
        """
        detection_result = cls.detect_equipment_outliers(db, equipment_id, start_date, end_date, threshold)
        
        marked_count = 0
        
        for outlier in detection_result.get("outliers", []):
            energy_data = db.query(EnergyData).filter(EnergyData.id == outlier["energy_data_id"]).first()
            if energy_data:
                energy_data.is_outlier = True
                energy_data.outlier_reason = f"能效值异常，Z-score超出阈值"
                marked_count += 1
        
        db.commit()
        
        return {
            "equipment_id": equipment_id,
            "marked_count": marked_count,
            "total_outliers": detection_result.get("outlier_count", 0)
        }
