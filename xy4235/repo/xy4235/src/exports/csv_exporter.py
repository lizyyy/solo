from typing import Optional
from datetime import datetime, timedelta
import csv

from models.case import Case
from models.risk import RiskStatus
from .base_exporter import BaseExporter, ExportResult


class CSVExporter(BaseExporter):
    """
    CSV风险清单导出器
    导出风险清单为CSV格式
    """
    
    def __init__(self):
        super().__init__()
    
    def export(self, case: Case, output_path: str = None) -> ExportResult:
        """
        导出CSV风险清单
        
        Args:
            case: 病例对象
            output_path: 输出文件路径
            
        Returns:
            导出结果
        """
        self.result = ExportResult()
        
        try:
            # 生成默认文件名
            if output_path is None:
                output_path = self._generate_default_filename(case, "csv")
            
            # 确保输出目录存在
            output_path_obj = self._ensure_output_dir(output_path)
            
            # 生成CSV内容
            self._write_csv(case, str(output_path_obj))
            
            # 设置结果
            self.result.file_path = str(output_path_obj)
            self.result.file_size = self._get_file_size(str(output_path_obj))
            
        except Exception as e:
            self.result.add_error(f"导出CSV风险清单失败: {str(e)}")
        
        return self.result
    
    def _write_csv(self, case: Case, output_path: str):
        """
        写入CSV文件
        """
        # 定义列名
        headers = [
            "风险ID",
            "风险类型",
            "严重程度",
            "状态",
            "描述",
            "建议",
            "检测时间",
            "复核时间",
            "复核人",
            "复核备注",
            "开始时间",
            "结束时间",
            "持续时间(分钟)",
            "最小值",
            "最大值",
            "平均值",
            "触发阈值"
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入标题行
            writer.writerow(headers)
            
            # 写入风险数据
            for risk in case.risks:
                # 获取风险片段信息
                start_time = ""
                end_time = ""
                duration_minutes = ""
                min_value = ""
                max_value = ""
                avg_value = ""
                trigger_value = ""
                
                if risk.segments:
                    # 使用第一个片段的信息
                    seg = risk.segments[0]
                    start_time = seg.start_time.strftime('%Y-%m-%d %H:%M:%S') if seg.start_time else ""
                    end_time = seg.end_time.strftime('%Y-%m-%d %H:%M:%S') if seg.end_time else ""
                    
                    # 计算总持续时间
                    total_duration = risk.get_total_duration()
                    duration_minutes = f"{total_duration.total_seconds() / 60:.1f}"
                    
                    min_value = str(seg.min_value) if seg.min_value is not None else ""
                    max_value = str(seg.max_value) if seg.max_value is not None else ""
                    avg_value = f"{seg.avg_value:.1f}" if seg.avg_value is not None else ""
                    trigger_value = str(seg.trigger_value) if seg.trigger_value is not None else ""
                
                row = [
                    risk.risk_id,
                    risk.risk_type.value,
                    risk.severity.value,
                    risk.status.value,
                    risk.description,
                    risk.recommendation,
                    risk.detected_at.strftime('%Y-%m-%d %H:%M:%S') if risk.detected_at else "",
                    risk.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if risk.reviewed_at else "",
                    risk.reviewed_by or "",
                    risk.review_notes or "",
                    start_time,
                    end_time,
                    duration_minutes,
                    min_value,
                    max_value,
                    avg_value,
                    trigger_value
                ]
                
                writer.writerow(row)


class VitalSignsCSVExporter(BaseExporter):
    """
    生命体征CSV导出器
    导出生命体征数据为CSV格式
    """
    
    def __init__(self):
        super().__init__()
    
    def export(self, case: Case, output_path: str = None) -> ExportResult:
        """
        导出生命体征CSV
        
        Args:
            case: 病例对象
            output_path: 输出文件路径
            
        Returns:
            导出结果
        """
        self.result = ExportResult()
        
        try:
            if not case.vital_signs or not case.vital_signs.records:
                self.result.add_warning("没有生命体征数据可导出")
                return self.result
            
            # 生成默认文件名
            if output_path is None:
                output_path = self._generate_default_filename(case, "vitals.csv")
            
            # 确保输出目录存在
            output_path_obj = self._ensure_output_dir(output_path)
            
            # 生成CSV内容
            self._write_vitals_csv(case, str(output_path_obj))
            
            # 设置结果
            self.result.file_path = str(output_path_obj)
            self.result.file_size = self._get_file_size(str(output_path_obj))
            
        except Exception as e:
            self.result.add_error(f"导出生命体征CSV失败: {str(e)}")
        
        return self.result
    
    def _write_vitals_csv(self, case: Case, output_path: str):
        """
        写入生命体征CSV文件
        """
        # 定义列名
        headers = [
            "时间",
            "心率(bpm)",
            "收缩压(mmHg)",
            "舒张压(mmHg)",
            "平均压(mmHg)",
            "血氧饱和度(%)",
            "体温(°C)",
            "呼吸频率(rpm)",
            "呼气末CO2(mmHg)"
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入标题行
            writer.writerow(headers)
            
            # 写入生命体征数据
            for record in case.vital_signs.records:
                row = [
                    record.timestamp.strftime('%Y-%m-%d %H:%M:%S') if record.timestamp else "",
                    record.heart_rate if record.heart_rate is not None else "",
                    record.systolic_bp if record.systolic_bp is not None else "",
                    record.diastolic_bp if record.diastolic_bp is not None else "",
                    record.mean_bp if record.mean_bp is not None else "",
                    record.spo2 if record.spo2 is not None else "",
                    record.temperature if record.temperature is not None else "",
                    record.respiratory_rate if record.respiratory_rate is not None else "",
                    record.etco2 if record.etco2 is not None else ""
                ]
                
                writer.writerow(row)


class MedicationCSVExporter(BaseExporter):
    """
    给药记录CSV导出器
    导出给药记录为CSV格式
    """
    
    def __init__(self):
        super().__init__()
    
    def export(self, case: Case, output_path: str = None) -> ExportResult:
        """
        导出给药记录CSV
        
        Args:
            case: 病例对象
            output_path: 输出文件路径
            
        Returns:
            导出结果
        """
        self.result = ExportResult()
        
        try:
            if not case.medication or not case.medication.records:
                self.result.add_warning("没有给药记录可导出")
                return self.result
            
            # 生成默认文件名
            if output_path is None:
                output_path = self._generate_default_filename(case, "medications.csv")
            
            # 确保输出目录存在
            output_path_obj = self._ensure_output_dir(output_path)
            
            # 生成CSV内容
            self._write_medications_csv(case, str(output_path_obj))
            
            # 设置结果
            self.result.file_path = str(output_path_obj)
            self.result.file_size = self._get_file_size(str(output_path_obj))
            
        except Exception as e:
            self.result.add_error(f"导出给药记录CSV失败: {str(e)}")
        
        return self.result
    
    def _write_medications_csv(self, case: Case, output_path: str):
        """
        写入给药记录CSV文件
        """
        # 定义列名
        headers = [
            "时间",
            "药物名称",
            "剂量",
            "单位",
            "给药途径",
            "药物类型",
            "浓度",
            "给药人",
            "备注"
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入标题行
            writer.writerow(headers)
            
            # 写入给药记录
            for record in case.medication.records:
                row = [
                    record.timestamp.strftime('%Y-%m-%d %H:%M:%S') if record.timestamp else "",
                    record.medication_name,
                    record.dose,
                    record.unit,
                    record.route.value,
                    record.medication_type.value,
                    record.concentration or "",
                    record.administered_by or "",
                    record.notes or ""
                ]
                
                writer.writerow(row)
