import pandas as pd
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import (
    Equipment, EquipmentGroup, BaselineVersion,
    EnergyData, ProductionData, EnergySaving, AuditLog
)
from app.core.config import settings


class ExportService:
    """数据导出服务"""
    
    @staticmethod
    def ensure_export_dir():
        """确保导出目录存在"""
        if not os.path.exists(settings.EXPORT_DIR):
            os.makedirs(settings.EXPORT_DIR, exist_ok=True)
    
    @classmethod
    def export_baseline_report(cls, db: Session, 
                             baseline_ids: Optional[List[int]] = None,
                             equipment_ids: Optional[List[int]] = None,
                             group_ids: Optional[List[int]] = None,
                             file_format: str = "xlsx") -> str:
        """
        导出基线报告
        
        Args:
            db: 数据库会话
            baseline_ids: 基线版本ID列表
            equipment_ids: 设备ID列表
            group_ids: 分组ID列表
            file_format: 文件格式
            
        Returns:
            导出文件路径
        """
        cls.ensure_export_dir()
        
        query = db.query(BaselineVersion)
        
        if baseline_ids:
            query = query.filter(BaselineVersion.id.in_(baseline_ids))
        if equipment_ids:
            query = query.filter(BaselineVersion.equipment_id.in_(equipment_ids))
        if group_ids:
            query = query.filter(BaselineVersion.group_id.in_(group_ids))
        
        baselines = query.order_by(BaselineVersion.created_at.desc()).all()
        
        summary_data = []
        detail_data = []
        
        for baseline in baselines:
            equipment_name = ""
            group_name = ""
            
            if baseline.equipment:
                equipment_name = baseline.equipment.name
            if baseline.group:
                group_name = baseline.group.name
            
            summary_data.append({
                "基线版本ID": baseline.id,
                "版本号": baseline.version,
                "版本名称": baseline.name,
                "基线类型": baseline.baseline_type,
                "设备名称": equipment_name,
                "分组名称": group_name,
                "基准能效值 (kWh/单位)": round(baseline.baseline_value, 4),
                "标准差": round(baseline.baseline_std, 4) if baseline.baseline_std else 0,
                "数据点数量": baseline.data_points_count,
                "剔除异常点数量": baseline.excluded_points_count,
                "状态": baseline.status,
                "是否激活": "是" if baseline.is_active else "否",
                "基线开始日期": baseline.start_date.strftime("%Y-%m-%d %H:%M:%S"),
                "基线结束日期": baseline.end_date.strftime("%Y-%m-%d %H:%M:%S"),
                "创建人": baseline.created_by or "",
                "创建时间": baseline.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "描述": baseline.description or ""
            })
            
            if baseline.baseline_formula:
                detail_data.append({
                    "基线版本ID": baseline.id,
                    "版本号": baseline.version,
                    "计算方法": baseline.baseline_formula.get("method", ""),
                    "方法描述": baseline.baseline_formula.get("description", "")
                })
        
        summary_df = pd.DataFrame(summary_data)
        detail_df = pd.DataFrame(detail_data)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"baseline_report_{timestamp}.{file_format}"
        filepath = os.path.join(settings.EXPORT_DIR, filename)
        
        if file_format == "xlsx":
            with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                summary_df.to_excel(writer, sheet_name="基线汇总", index=False)
                if not detail_df.empty:
                    detail_df.to_excel(writer, sheet_name="计算方法明细", index=False)
        else:
            summary_df.to_csv(filepath, index=False, encoding='utf-8-sig')
        
        return filepath
    
    @classmethod
    def export_saving_report(cls, db: Session,
                           period_start: Optional[datetime] = None,
                           period_end: Optional[datetime] = None,
                           equipment_ids: Optional[List[int]] = None,
                           group_ids: Optional[List[int]] = None,
                           baseline_id: Optional[int] = None,
                           file_format: str = "xlsx") -> str:
        """
        导出节能收益报告
        
        Args:
            db: 数据库会话
            period_start: 开始时间
            period_end: 结束时间
            equipment_ids: 设备ID列表
            group_ids: 分组ID列表
            baseline_id: 基线版本ID
            file_format: 文件格式
            
        Returns:
            导出文件路径
        """
        cls.ensure_export_dir()
        
        query = db.query(EnergySaving)
        
        if period_start:
            query = query.filter(EnergySaving.period_start >= period_start)
        if period_end:
            query = query.filter(EnergySaving.period_end <= period_end)
        if equipment_ids:
            query = query.filter(EnergySaving.equipment_id.in_(equipment_ids))
        if baseline_id:
            query = query.filter(EnergySaving.baseline_id == baseline_id)
        
        savings = query.order_by(EnergySaving.calculation_date.desc()).all()
        
        summary_data = []
        
        for saving in savings:
            equipment_name = saving.equipment.name if saving.equipment else ""
            baseline_version = saving.baseline.version if saving.baseline else ""
            baseline_value = saving.baseline.baseline_value if saving.baseline else 0
            
            summary_data.append({
                "收益记录ID": saving.id,
                "设备名称": equipment_name,
                "基线版本": baseline_version,
                "基线能效值": round(baseline_value, 4),
                "统计周期开始": saving.period_start.strftime("%Y-%m-%d %H:%M:%S"),
                "统计周期结束": saving.period_end.strftime("%Y-%m-%d %H:%M:%S"),
                "计算时间": saving.calculation_date.strftime("%Y-%m-%d %H:%M:%S"),
                "实际能耗 (kWh)": round(saving.actual_energy, 2),
                "基准能耗 (kWh)": round(saving.baseline_energy, 2),
                "节能量 (kWh)": round(saving.saving_energy, 2),
                "节能率 (%)": round(saving.saving_rate, 2),
                "归一化产量": round(saving.normalized_production, 2),
                "数据点数量": saving.data_points_count,
                "状态": saving.status,
                "计算人": saving.created_by or "",
                "备注": saving.remark or ""
            })
        
        summary_df = pd.DataFrame(summary_data)
        
        total_row = {
            "收益记录ID": "合计",
            "设备名称": "",
            "基线版本": "",
            "基线能效值": "",
            "统计周期开始": "",
            "统计周期结束": "",
            "计算时间": "",
            "实际能耗 (kWh)": round(summary_df["实际能耗 (kWh)"].sum(), 2) if not summary_df.empty else 0,
            "基准能耗 (kWh)": round(summary_df["基准能耗 (kWh)"].sum(), 2) if not summary_df.empty else 0,
            "节能量 (kWh)": round(summary_df["节能量 (kWh)"].sum(), 2) if not summary_df.empty else 0,
            "节能率 (%)": round(summary_df["节能率 (%)"].mean(), 2) if not summary_df.empty else 0,
            "归一化产量": round(summary_df["归一化产量"].sum(), 2) if not summary_df.empty else 0,
            "数据点数量": summary_df["数据点数量"].sum() if not summary_df.empty else 0,
            "状态": "",
            "计算人": "",
            "备注": ""
        }
        
        total_df = pd.DataFrame([total_row])
        final_df = pd.concat([summary_df, total_df], ignore_index=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"saving_report_{timestamp}.{file_format}"
        filepath = os.path.join(settings.EXPORT_DIR, filename)
        
        if file_format == "xlsx":
            with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                final_df.to_excel(writer, sheet_name="节能收益汇总", index=False)
        else:
            final_df.to_csv(filepath, index=False, encoding='utf-8-sig')
        
        return filepath
    
    @classmethod
    def export_energy_data(cls, db: Session,
                         equipment_ids: Optional[List[int]] = None,
                         start_date: Optional[datetime] = None,
                         end_date: Optional[datetime] = None,
                         include_outliers: bool = True,
                         file_format: str = "xlsx") -> str:
        """
        导出能耗数据
        
        Args:
            db: 数据库会话
            equipment_ids: 设备ID列表
            start_date: 开始时间
            end_date: 结束时间
            include_outliers: 是否包含异常值
            file_format: 文件格式
            
        Returns:
            导出文件路径
        """
        cls.ensure_export_dir()
        
        query = db.query(EnergyData)
        
        if equipment_ids:
            query = query.filter(EnergyData.equipment_id.in_(equipment_ids))
        if start_date:
            query = query.filter(EnergyData.record_date >= start_date)
        if end_date:
            query = query.filter(EnergyData.record_date <= end_date)
        if not include_outliers:
            query = query.filter(EnergyData.is_outlier == False)
        
        energy_records = query.order_by(EnergyData.record_date.desc()).all()
        
        data = []
        for record in energy_records:
            equipment_name = record.equipment.name if record.equipment else ""
            
            data.append({
                "数据ID": record.id,
                "设备名称": equipment_name,
                "记录时间": record.record_date.strftime("%Y-%m-%d %H:%M:%S"),
                "能耗值 (kWh)": record.energy_consumption,
                "能源类型": record.energy_type,
                "是否异常值": "是" if record.is_outlier else "否",
                "异常原因": record.outlier_reason or "",
                "数据来源": record.source or ""
            })
        
        df = pd.DataFrame(data)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"energy_data_{timestamp}.{file_format}"
        filepath = os.path.join(settings.EXPORT_DIR, filename)
        
        if file_format == "xlsx":
            df.to_excel(filepath, sheet_name="能耗数据", index=False, engine='openpyxl')
        else:
            df.to_csv(filepath, index=False, encoding='utf-8-sig')
        
        return filepath
    
    @classmethod
    def export_production_data(cls, db: Session,
                             equipment_ids: Optional[List[int]] = None,
                             start_date: Optional[datetime] = None,
                             end_date: Optional[datetime] = None,
                             include_outliers: bool = True,
                             file_format: str = "xlsx") -> str:
        """
        导出产量数据
        
        Args:
            db: 数据库会话
            equipment_ids: 设备ID列表
            start_date: 开始时间
            end_date: 结束时间
            include_outliers: 是否包含异常值
            file_format: 文件格式
            
        Returns:
            导出文件路径
        """
        cls.ensure_export_dir()
        
        query = db.query(ProductionData)
        
        if equipment_ids:
            query = query.filter(ProductionData.equipment_id.in_(equipment_ids))
        if start_date:
            query = query.filter(ProductionData.record_date >= start_date)
        if end_date:
            query = query.filter(ProductionData.record_date <= end_date)
        if not include_outliers:
            query = query.filter(ProductionData.is_outlier == False)
        
        production_records = query.order_by(ProductionData.record_date.desc()).all()
        
        data = []
        for record in production_records:
            equipment_name = record.equipment.name if record.equipment else ""
            
            data.append({
                "数据ID": record.id,
                "设备名称": equipment_name,
                "记录时间": record.record_date.strftime("%Y-%m-%d %H:%M:%S"),
                "产量": record.production_quantity,
                "产量单位": record.production_unit,
                "班次": record.shift or "",
                "是否异常值": "是" if record.is_outlier else "否",
                "异常原因": record.outlier_reason or "",
                "数据来源": record.source or ""
            })
        
        df = pd.DataFrame(data)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"production_data_{timestamp}.{file_format}"
        filepath = os.path.join(settings.EXPORT_DIR, filename)
        
        if file_format == "xlsx":
            df.to_excel(filepath, sheet_name="产量数据", index=False, engine='openpyxl')
        else:
            df.to_csv(filepath, index=False, encoding='utf-8-sig')
        
        return filepath
    
    @classmethod
    def export_audit_log(cls, db: Session,
                       start_date: Optional[datetime] = None,
                       end_date: Optional[datetime] = None,
                       target_type: Optional[str] = None,
                       action: Optional[str] = None,
                       file_format: str = "xlsx") -> str:
        """
        导出审计日志
        
        Args:
            db: 数据库会话
            start_date: 开始时间
            end_date: 结束时间
            target_type: 目标类型
            action: 操作类型
            file_format: 文件格式
            
        Returns:
            导出文件路径
        """
        cls.ensure_export_dir()
        
        query = db.query(AuditLog)
        
        if start_date:
            query = query.filter(AuditLog.changed_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.changed_at <= end_date)
        if target_type:
            query = query.filter(AuditLog.target_type == target_type)
        if action:
            query = query.filter(AuditLog.action == action)
        
        audit_logs = query.order_by(AuditLog.changed_at.desc()).all()
        
        data = []
        for log in audit_logs:
            data.append({
                "日志ID": log.id,
                "操作类型": log.action,
                "目标类型": log.target_type,
                "目标ID": log.target_id,
                "操作人": log.changed_by or "",
                "操作时间": log.changed_at.strftime("%Y-%m-%d %H:%M:%S"),
                "备注": log.remark or ""
            })
        
        df = pd.DataFrame(data)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"audit_log_{timestamp}.{file_format}"
        filepath = os.path.join(settings.EXPORT_DIR, filename)
        
        if file_format == "xlsx":
            df.to_excel(filepath, sheet_name="审计日志", index=False, engine='openpyxl')
        else:
            df.to_csv(filepath, index=False, encoding='utf-8-sig')
        
        return filepath
