import csv
import json
import yaml
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import os
import uuid

from app.models import (
    ImportRecord, ImportStatus,
    ConstructionPlan, TrackSection, PowerWindow,
    WorkTrain, PersonnelQualification, PlanPersonnel,
    AuditLog, ApprovalStatus
)
from app.config import settings

def parse_datetime(value: str) -> datetime:
    """解析多种格式的日期时间字符串"""
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y%m%d %H:%M:%S",
    ]
    
    if not value or not isinstance(value, str):
        return None
    
    value = value.strip()
    if not value:
        return None
    
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except (ValueError, TypeError):
            continue
    
    try:
        from dateutil import parser
        return parser.parse(value)
    except:
        raise ValueError(f"无法解析日期时间格式: {value}")

def parse_bool(value: str) -> bool:
    """解析布尔值"""
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    value = str(value).lower().strip()
    return value in ['true', 'yes', '是', '1', 'y', 't']

def save_upload_file(file_content: bytes, filename: str, file_type: str) -> str:
    """保存上传的文件到上传目录"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    ext = os.path.splitext(filename)[1] or '.dat'
    saved_filename = f"{file_type}_{timestamp}_{uuid.uuid4().hex[:8]}{ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, saved_filename)
    
    with open(saved_path, 'wb') as f:
        f.write(file_content)
    
    return saved_path

def create_import_record(
    db: Session,
    file_type: str,
    file_name: str,
    operator: str = "system"
) -> ImportRecord:
    """创建导入记录"""
    record = ImportRecord(
        file_type=file_type,
        file_name=file_name,
        operator=operator,
        status=ImportStatus.PENDING
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

def log_audit(
    db: Session,
    operation_type: str,
    operator: str,
    target_type: str = None,
    target_id: int = None,
    details: Dict = None
):
    """记录审计日志"""
    log = AuditLog(
        operation_type=operation_type,
        operator=operator,
        target_type=target_type,
        target_id=target_id,
        details=json.dumps(details, ensure_ascii=False) if details else None
    )
    db.add(log)
    db.commit()

def parse_csv_content(content: str, encoding: str = 'utf-8') -> List[Dict]:
    """解析 CSV 内容"""
    import io
    results = []
    try:
        content = content.encode('latin1').decode('utf-8')
    except:
        pass
    
    f = io.StringIO(content)
    reader = csv.DictReader(f)
    for row in reader:
        results.append({k.strip(): v.strip() if isinstance(v, str) else v for k, v in row.items()})
    return results

def parse_json_content(content: str) -> Any:
    """解析 JSON 内容"""
    return json.loads(content)

def parse_yaml_content(content: str) -> Any:
    """解析 YAML 内容"""
    return yaml.safe_load(content)

class ConstructionPlanImporter:
    """施工计划 CSV 导入器"""
    
    REQUIRED_FIELDS = ['plan_no', 'plan_name', 'line', 'track_section', 'start_time', 'end_time']
    
    @staticmethod
    def import_from_csv(
        db: Session,
        content: str,
        file_name: str,
        operator: str = "system"
    ) -> Tuple[ImportRecord, List[Dict]]:
        """从 CSV 导入施工计划"""
        import_record = create_import_record(db, "construction", file_name, operator)
        
        try:
            data = parse_csv_content(content)
            import_record.total_records = len(data)
            db.commit()
            
            errors = []
            success_count = 0
            
            for idx, row in enumerate(data, start=1):
                try:
                    ConstructionPlanImporter._validate_row(row, idx)
                    
                    plan = ConstructionPlan(
                        import_record_id=import_record.id,
                        plan_no=str(row.get('plan_no', '')).strip(),
                        plan_name=str(row.get('plan_name', '')).strip(),
                        line=str(row.get('line', '')).strip(),
                        track_section=str(row.get('track_section', '')).strip(),
                        start_time=parse_datetime(row.get('start_time')),
                        end_time=parse_datetime(row.get('end_time')),
                        work_type=str(row.get('work_type', '')).strip() if row.get('work_type') else None,
                        work_content=str(row.get('work_content', '')).strip() if row.get('work_content') else None,
                        construction_unit=str(row.get('construction_unit', '')).strip() if row.get('construction_unit') else None,
                        responsible_person=str(row.get('responsible_person', '')).strip() if row.get('responsible_person') else None,
                        contact_phone=str(row.get('contact_phone', '')).strip() if row.get('contact_phone') else None,
                        power_requirement=str(row.get('power_requirement', '')).strip() if row.get('power_requirement') else None,
                        work_train_required=parse_bool(row.get('work_train_required', False)),
                        status=ApprovalStatus.DRAFT
                    )
                    
                    db.add(plan)
                    db.commit()
                    db.refresh(plan)
                    success_count += 1
                    
                except Exception as e:
                    error_msg = f"第 {idx} 行: {str(e)}"
                    errors.append({"row": idx, "error": str(e), "data": row})
                    db.rollback()
            
            import_record.success_records = success_count
            if success_count == 0:
                import_record.status = ImportStatus.FAILED
            elif success_count < import_record.total_records:
                import_record.status = ImportStatus.PARTIAL
            else:
                import_record.status = ImportStatus.SUCCESS
            
            import_record.error_message = json.dumps(errors, ensure_ascii=False) if errors else None
            db.commit()
            
            log_audit(db, "导入", operator, "construction", None, {
                "file_name": file_name,
                "total": import_record.total_records,
                "success": success_count,
                "errors": len(errors)
            })
            
            return import_record, errors
            
        except Exception as e:
            import_record.status = ImportStatus.FAILED
            import_record.error_message = str(e)
            db.commit()
            raise
    
    @staticmethod
    def _validate_row(row: Dict, row_num: int):
        """验证单行数据"""
        for field in ConstructionPlanImporter.REQUIRED_FIELDS:
            if field not in row or not row.get(field):
                raise ValueError(f"缺少必填字段: {field}")
        
        try:
            start = parse_datetime(row.get('start_time'))
            end = parse_datetime(row.get('end_time'))
            if start >= end:
                raise ValueError("开始时间必须早于结束时间")
        except Exception as e:
            raise ValueError(f"时间格式错误: {str(e)}")

class TrackSectionImporter:
    """线路区段拓扑 JSON 导入器"""
    
    @staticmethod
    def import_from_json(
        db: Session,
        content: str,
        file_name: str,
        operator: str = "system"
    ) -> Tuple[ImportRecord, List[Dict]]:
        """从 JSON 导入线路区段"""
        import_record = create_import_record(db, "topology", file_name, operator)
        
        try:
            data = parse_json_content(content)
            if isinstance(data, dict):
                data = data.get('sections', [data]) if 'sections' in data else [data]
            elif not isinstance(data, list):
                raise ValueError("JSON 格式错误，应为数组或包含 sections 字段的对象")
            
            import_record.total_records = len(data)
            db.commit()
            
            errors = []
            success_count = 0
            
            for idx, item in enumerate(data, start=1):
                try:
                    if not item.get('section_id') or not item.get('section_name'):
                        raise ValueError("缺少 section_id 或 section_name")
                    
                    section = TrackSection(
                        import_record_id=import_record.id,
                        section_id=str(item.get('section_id', '')).strip(),
                        section_name=str(item.get('section_name', '')).strip(),
                        line=str(item.get('line', '')).strip(),
                        start_mileage=float(item['start_mileage']) if item.get('start_mileage') else None,
                        end_mileage=float(item['end_mileage']) if item.get('end_mileage') else None,
                        adjacent_sections=json.dumps(item.get('adjacent_sections', []), ensure_ascii=False) if item.get('adjacent_sections') else None,
                        power_section=str(item.get('power_section', '')).strip() if item.get('power_section') else None,
                        is_double_track=parse_bool(item.get('is_double_track', False)),
                        direction=str(item.get('direction', '')).strip() if item.get('direction') else None
                    )
                    
                    db.add(section)
                    db.commit()
                    db.refresh(section)
                    success_count += 1
                    
                except Exception as e:
                    errors.append({"row": idx, "error": str(e), "data": item})
                    db.rollback()
            
            import_record.success_records = success_count
            if success_count == 0:
                import_record.status = ImportStatus.FAILED
            elif success_count < import_record.total_records:
                import_record.status = ImportStatus.PARTIAL
            else:
                import_record.status = ImportStatus.SUCCESS
            
            import_record.error_message = json.dumps(errors, ensure_ascii=False) if errors else None
            db.commit()
            
            log_audit(db, "导入", operator, "topology", None, {
                "file_name": file_name,
                "total": import_record.total_records,
                "success": success_count,
                "errors": len(errors)
            })
            
            return import_record, errors
            
        except Exception as e:
            import_record.status = ImportStatus.FAILED
            import_record.error_message = str(e)
            db.commit()
            raise

class PowerWindowImporter:
    """供电停送电窗口 YAML 导入器"""
    
    @staticmethod
    def import_from_yaml(
        db: Session,
        content: str,
        file_name: str,
        operator: str = "system"
    ) -> Tuple[ImportRecord, List[Dict]]:
        """从 YAML 导入停电窗口"""
        import_record = create_import_record(db, "power", file_name, operator)
        
        try:
            data = parse_yaml_content(content)
            if isinstance(data, dict):
                data = data.get('windows', [data]) if 'windows' in data else [data]
            elif not isinstance(data, list):
                raise ValueError("YAML 格式错误，应为数组或包含 windows 字段的对象")
            
            import_record.total_records = len(data)
            db.commit()
            
            errors = []
            success_count = 0
            
            for idx, item in enumerate(data, start=1):
                try:
                    if not item.get('window_id') or not item.get('power_section'):
                        raise ValueError("缺少 window_id 或 power_section")
                    
                    window = PowerWindow(
                        import_record_id=import_record.id,
                        window_id=str(item.get('window_id', '')).strip(),
                        power_section=str(item.get('power_section', '')).strip(),
                        line=str(item.get('line', '')).strip(),
                        start_time=parse_datetime(item.get('start_time')),
                        end_time=parse_datetime(item.get('end_time')),
                        voltage=str(item.get('voltage', '')).strip() if item.get('voltage') else None,
                        substation=str(item.get('substation', '')).strip() if item.get('substation') else None,
                        feeder=str(item.get('feeder', '')).strip() if item.get('feeder') else None,
                        status=str(item.get('status', '计划')).strip()
                    )
                    
                    db.add(window)
                    db.commit()
                    db.refresh(window)
                    success_count += 1
                    
                except Exception as e:
                    errors.append({"row": idx, "error": str(e), "data": item})
                    db.rollback()
            
            import_record.success_records = success_count
            if success_count == 0:
                import_record.status = ImportStatus.FAILED
            elif success_count < import_record.total_records:
                import_record.status = ImportStatus.PARTIAL
            else:
                import_record.status = ImportStatus.SUCCESS
            
            import_record.error_message = json.dumps(errors, ensure_ascii=False) if errors else None
            db.commit()
            
            log_audit(db, "导入", operator, "power", None, {
                "file_name": file_name,
                "total": import_record.total_records,
                "success": success_count,
                "errors": len(errors)
            })
            
            return import_record, errors
            
        except Exception as e:
            import_record.status = ImportStatus.FAILED
            import_record.error_message = str(e)
            db.commit()
            raise

class WorkTrainImporter:
    """作业车占用表导入器"""
    
    @staticmethod
    def import_from_csv(
        db: Session,
        content: str,
        file_name: str,
        operator: str = "system"
    ) -> Tuple[ImportRecord, List[Dict]]:
        """从 CSV 导入作业车"""
        import_record = create_import_record(db, "train", file_name, operator)
        
        try:
            data = parse_csv_content(content)
            import_record.total_records = len(data)
            db.commit()
            
            errors = []
            success_count = 0
            
            for idx, row in enumerate(data, start=1):
                try:
                    required = ['train_id', 'line', 'start_section', 'end_section', 'direction', 'start_time', 'end_time']
                    for field in required:
                        if field not in row or not row.get(field):
                            raise ValueError(f"缺少必填字段: {field}")
                    
                    train = WorkTrain(
                        import_record_id=import_record.id,
                        train_id=str(row.get('train_id', '')).strip(),
                        train_type=str(row.get('train_type', '')).strip() if row.get('train_type') else None,
                        line=str(row.get('line', '')).strip(),
                        start_section=str(row.get('start_section', '')).strip(),
                        end_section=str(row.get('end_section', '')).strip(),
                        direction=str(row.get('direction', '')).strip(),
                        start_time=parse_datetime(row.get('start_time')),
                        end_time=parse_datetime(row.get('end_time')),
                        operator=str(row.get('operator', '')).strip() if row.get('operator') else None,
                        status=str(row.get('status', '待发车')).strip()
                    )
                    
                    db.add(train)
                    db.commit()
                    db.refresh(train)
                    success_count += 1
                    
                except Exception as e:
                    errors.append({"row": idx, "error": str(e), "data": row})
                    db.rollback()
            
            import_record.success_records = success_count
            if success_count == 0:
                import_record.status = ImportStatus.FAILED
            elif success_count < import_record.total_records:
                import_record.status = ImportStatus.PARTIAL
            else:
                import_record.status = ImportStatus.SUCCESS
            
            import_record.error_message = json.dumps(errors, ensure_ascii=False) if errors else None
            db.commit()
            
            log_audit(db, "导入", operator, "train", None, {
                "file_name": file_name,
                "total": import_record.total_records,
                "success": success_count,
                "errors": len(errors)
            })
            
            return import_record, errors
            
        except Exception as e:
            import_record.status = ImportStatus.FAILED
            import_record.error_message = str(e)
            db.commit()
            raise

class PersonnelQualificationImporter:
    """人员资质表导入器"""
    
    @staticmethod
    def import_from_csv(
        db: Session,
        content: str,
        file_name: str,
        operator: str = "system"
    ) -> Tuple[ImportRecord, List[Dict]]:
        """从 CSV 导入人员资质"""
        import_record = create_import_record(db, "personnel", file_name, operator)
        
        try:
            data = parse_csv_content(content)
            import_record.total_records = len(data)
            db.commit()
            
            errors = []
            success_count = 0
            
            for idx, row in enumerate(data, start=1):
                try:
                    required = ['employee_id', 'name', 'qualification_type', 'certificate_no', 'expiry_date']
                    for field in required:
                        if field not in row or not row.get(field):
                            raise ValueError(f"缺少必填字段: {field}")
                    
                    personnel = PersonnelQualification(
                        import_record_id=import_record.id,
                        employee_id=str(row.get('employee_id', '')).strip(),
                        name=str(row.get('name', '')).strip(),
                        department=str(row.get('department', '')).strip() if row.get('department') else None,
                        qualification_type=str(row.get('qualification_type', '')).strip(),
                        qualification_level=str(row.get('qualification_level', '')).strip() if row.get('qualification_level') else None,
                        certificate_no=str(row.get('certificate_no', '')).strip(),
                        issue_date=parse_datetime(row.get('issue_date')) if row.get('issue_date') else None,
                        expiry_date=parse_datetime(row.get('expiry_date')),
                        is_active=parse_bool(row.get('is_active', True)),
                        last_audit_date=parse_datetime(row.get('last_audit_date')) if row.get('last_audit_date') else None
                    )
                    
                    db.add(personnel)
                    db.commit()
                    db.refresh(personnel)
                    success_count += 1
                    
                except Exception as e:
                    errors.append({"row": idx, "error": str(e), "data": row})
                    db.rollback()
            
            import_record.success_records = success_count
            if success_count == 0:
                import_record.status = ImportStatus.FAILED
            elif success_count < import_record.total_records:
                import_record.status = ImportStatus.PARTIAL
            else:
                import_record.status = ImportStatus.SUCCESS
            
            import_record.error_message = json.dumps(errors, ensure_ascii=False) if errors else None
            db.commit()
            
            log_audit(db, "导入", operator, "personnel", None, {
                "file_name": file_name,
                "total": import_record.total_records,
                "success": success_count,
                "errors": len(errors)
            })
            
            return import_record, errors
            
        except Exception as e:
            import_record.status = ImportStatus.FAILED
            import_record.error_message = str(e)
            db.commit()
            raise
