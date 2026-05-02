"""导入导出模块

支持:
- CSV导入 (申请单)
- Markdown导出 (交接单)
- CSV导出 (异常表)
- JSON导出 (审计包)
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import asdict

from .models import (
    Specimen, SpecimenEvent, Anomaly, Patient,
    SpecimenStatus, EventType, AnomalyType
)
from .database import DatabaseManager


class CsvImporter:
    """CSV 导入器
    
    用于从手术间送来的申请单 CSV 文件导入标本信息。
    """
    
    EXPECTED_HEADERS = [
        '标本号', '患者ID', '患者姓名', '年龄', '性别',
        '床位号', '住院号', '部位', '标本类型',
        '手术间', '手术医师', '紧急程度'
    ]
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
    
    def import_from_file(self, file_path: str) -> Tuple[List[Specimen], List[Patient]]:
        """从 CSV 文件导入标本和患者信息
        
        Args:
            file_path: CSV 文件路径
            
        Returns:
            Tuple[List[Specimen], List[Patient]]: 标本列表和患者列表
        """
        self.errors.clear()
        self.warnings.clear()
        
        specimens: List[Specimen] = []
        patients: Dict[str, Patient] = {}
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        specimen, patient = self._parse_row(row, row_num)
                        if specimen:
                            specimens.append(specimen)
                            if patient and patient.patient_id not in patients:
                                patients[patient.patient_id] = patient
                    except Exception as e:
                        self.errors.append(f"第 {row_num} 行解析错误: {e}")
        
        except FileNotFoundError:
            self.errors.append(f"文件不存在: {file_path}")
        except Exception as e:
            self.errors.append(f"读取文件时出错: {e}")
        
        return specimens, list(patients.values())
    
    def _parse_row(self, row: Dict[str, str], row_num: int) -> Tuple[Optional[Specimen], Optional[Patient]]:
        """解析单行数据"""
        
        specimen_no = row.get('标本号', '').strip()
        if not specimen_no:
            self.warnings.append(f"第 {row_num} 行缺少标本号，已跳过")
            return None, None
        
        patient_id = row.get('患者ID', '').strip()
        patient_name = row.get('患者姓名', '').strip()
        
        if not patient_name:
            self.warnings.append(f"第 {row_num} 行缺少患者姓名")
        
        try:
            age = int(row.get('年龄', '0') or 0)
        except (ValueError, TypeError):
            age = 0
            self.warnings.append(f"第 {row_num} 行年龄格式不正确")
        
        patient = None
        if patient_id:
            patient = Patient(
                patient_id=patient_id,
                name=patient_name,
                age=age,
                gender=row.get('性别', '').strip(),
                bed_number=row.get('床位号', '').strip(),
                admission_number=row.get('住院号', '').strip(),
            )
        
        urgent_level = row.get('紧急程度', '常规').strip() or '常规'
        
        specimen = Specimen(
            specimen_no=specimen_no,
            patient_id=patient_id,
            patient_name=patient_name,
            location=row.get('部位', '').strip(),
            specimen_type=row.get('标本类型', '').strip(),
            operation_room=row.get('手术间', '').strip(),
            surgeon=row.get('手术医师', '').strip(),
            urgent_level=urgent_level,
            status=SpecimenStatus.REGISTERED,
            registered_at=datetime.now(),
        )
        
        return specimen, patient


class MarkdownExporter:
    """Markdown 导出器
    
    用于导出交接班记录。
    """
    
    def export_handover(self, specimens: List[Specimen], 
                        events: Dict[int, List[SpecimenEvent]],
                        output_path: str,
                        shift_info: Optional[Dict[str, str]] = None) -> bool:
        """导出交接班 Markdown 文件
        
        Args:
            specimens: 标本列表
            events: 事件字典，key 为标本 ID
            output_path: 输出文件路径
            shift_info: 交接班信息，如 {'交班人': '张三', '接班人': '李四', '时间': '...'}
            
        Returns:
            是否成功导出
        """
        try:
            lines = []
            
            lines.append("# 冰冻切片标本交接班记录")
            lines.append("")
            
            if shift_info:
                lines.append("## 交接班信息")
                lines.append("")
                for key, value in shift_info.items():
                    lines.append(f"- **{key}**: {value}")
                lines.append("")
            
            lines.append(f"## 标本清单 ({len(specimens)} 例)")
            lines.append("")
            
            if not specimens:
                lines.append("当前无未完成标本。")
            else:
                for i, specimen in enumerate(specimens, 1):
                    lines.append(f"### {i}. 标本 {specimen.specimen_no}")
                    lines.append("")
                    
                    lines.append("#### 基本信息")
                    lines.append("")
                    lines.append(f"- **患者**: {specimen.patient_name}")
                    lines.append(f"- **部位**: {specimen.location or '未填写'}")
                    lines.append(f"- **状态**: {specimen.status.value}")
                    lines.append(f"- **紧急程度**: {specimen.urgent_level}")
                    lines.append(f"- **登记时间**: {specimen.registered_at.strftime('%Y-%m-%d %H:%M:%S')}")
                    lines.append("")
                    
                    lines.append("#### 材料核对")
                    lines.append("")
                    lines.append(f"- [{'x' if specimen.has_specimen_bag else ' '}] 标本袋")
                    lines.append(f"- [{'x' if specimen.has_csv else ' '}] 申请单CSV")
                    lines.append(f"- **照片数量**: {specimen.photo_count} 张")
                    lines.append("")
                    
                    if specimen.phone_remark:
                        lines.append("#### 术中电话备注")
                        lines.append("")
                        lines.append(f"> {specimen.phone_remark}")
                        lines.append("")
                    
                    specimen_events = events.get(specimen.id if specimen.id else 0, [])
                    if specimen_events:
                        lines.append("#### 时间线")
                        lines.append("")
                        for event in specimen_events:
                            time_str = event.event_time.strftime('%H:%M:%S')
                            lines.append(f"- `{time_str}` **{event.event_type.value}**: {event.description}")
                            if event.operator:
                                lines.append(f"  - 操作人: {event.operator}")
                        lines.append("")
                    
                    lines.append("---")
                    lines.append("")
            
            lines.append("")
            lines.append(f"*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
            
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            
            return True
        
        except Exception:
            return False


class CsvExporter:
    """CSV 导出器
    
    用于导出异常表。
    """
    
    def export_anomalies(self, anomalies: List[Anomaly], 
                         specimens: Dict[int, Specimen],
                         output_path: str) -> bool:
        """导出异常 CSV 文件
        
        Args:
            anomalies: 异常列表
            specimens: 标本字典，key 为标本 ID
            output_path: 输出文件路径
            
        Returns:
            是否成功导出
        """
        try:
            headers = [
                '异常ID', '标本号', '患者姓名', '异常类型',
                '严重程度', '描述', '检测时间', '是否已解决',
                '解决时间', '解决人', '解决方式'
            ]
            
            rows = []
            for anomaly in anomalies:
                specimen = specimens.get(anomaly.specimen_id)
                
                row = {
                    '异常ID': anomaly.id or '',
                    '标本号': specimen.specimen_no if specimen else '',
                    '患者姓名': specimen.patient_name if specimen else '',
                    '异常类型': anomaly.anomaly_type.value,
                    '严重程度': anomaly.severity,
                    '描述': anomaly.description,
                    '检测时间': anomaly.detected_at.strftime('%Y-%m-%d %H:%M:%S') if anomaly.detected_at else '',
                    '是否已解决': '是' if anomaly.is_resolved else '否',
                    '解决时间': anomaly.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if anomaly.resolved_at else '',
                    '解决人': anomaly.resolved_by or '',
                    '解决方式': anomaly.resolution or '',
                }
                rows.append(row)
            
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)
            
            return True
        
        except Exception:
            return False


class JsonExporter:
    """JSON 导出器
    
    用于导出审计包，包含完整的操作记录。
    """
    
    def export_audit_package(self, db_manager: DatabaseManager,
                              output_path: str,
                              include_all: bool = True) -> bool:
        """导出审计 JSON 包
        
        Args:
            db_manager: 数据库管理器
            output_path: 输出文件路径
            include_all: 是否包含已放行的标本
            
        Returns:
            是否成功导出
        """
        try:
            specimens = db_manager.get_all_specimens(include_released=include_all)
            
            audit_data: Dict[str, Any] = {
                'package_info': {
                    'version': '1.0',
                    'export_time': datetime.now().isoformat(),
                    'specimen_count': len(specimens),
                },
                'specimens': [],
                'events': [],
                'anomalies': [],
            }
            
            specimen_ids = []
            
            for specimen in specimens:
                if specimen.id:
                    specimen_ids.append(specimen.id)
                
                specimen_dict = asdict(specimen)
                specimen_dict['status'] = specimen.status.value
                specimen_dict['registered_at'] = specimen.registered_at.isoformat()
                if specimen.reviewed_at:
                    specimen_dict['reviewed_at'] = specimen.reviewed_at.isoformat()
                if specimen.released_at:
                    specimen_dict['released_at'] = specimen.released_at.isoformat()
                if specimen.due_time:
                    specimen_dict['due_time'] = specimen.due_time.isoformat()
                specimen_dict['created_at'] = specimen.created_at.isoformat()
                specimen_dict['updated_at'] = specimen.updated_at.isoformat()
                
                audit_data['specimens'].append(specimen_dict)
            
            for specimen_id in specimen_ids:
                events = db_manager.get_events_by_specimen(specimen_id)
                for event in events:
                    event_dict = asdict(event)
                    event_dict['event_type'] = event.event_type.value
                    event_dict['event_time'] = event.event_time.isoformat()
                    audit_data['events'].append(event_dict)
            
            anomalies = db_manager.get_unresolved_anomalies()
            for anomaly in anomalies:
                anomaly_dict = asdict(anomaly)
                anomaly_dict['anomaly_type'] = anomaly.anomaly_type.value
                anomaly_dict['detected_at'] = anomaly.detected_at.isoformat()
                if anomaly.resolved_at:
                    anomaly_dict['resolved_at'] = anomaly.resolved_at.isoformat()
                audit_data['anomalies'].append(anomaly_dict)
            
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(audit_data, f, ensure_ascii=False, indent=2)
            
            return True
        
        except Exception:
            return False
