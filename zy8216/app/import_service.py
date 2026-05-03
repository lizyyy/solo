import csv
import json
import yaml
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
from io import StringIO, TextIOWrapper
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models import Animal, Cage, HealthCheck, Rule, Cage
from app.schemas import CageScanCreate
from app.state_machine import CageStateMachine


def parse_datetime(value: str) -> Optional[datetime]:
    if not value:
        return None
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(value.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None


def parse_int(value: str, default: int = 0) -> int:
    if not value:
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def parse_float(value: str) -> Optional[float]:
    if not value:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def parse_bool(value: str) -> bool:
    if not value:
        return False
    return str(value).lower() in ("true", "1", "yes", "y")


class DataImporter:
    def __init__(self, db: Session):
        self.db = db
        self.state_machine = CageStateMachine(db)

    def import_animals_from_csv(self, file_content: str) -> Tuple[int, List[str]]:
        imported = 0
        errors = []
        
        try:
            reader = csv.DictReader(StringIO(file_content))
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    animal = Animal(
                        animal_id=row.get("animal_id", "").strip(),
                        tag_id=row.get("tag_id", "").strip() or None,
                        species=row.get("species", "").strip(),
                        strain=row.get("strain", "").strip() or None,
                        sex=row.get("sex", "").strip() or None,
                        date_of_birth=parse_datetime(row.get("date_of_birth", "")),
                        status=row.get("status", "active").strip().lower(),
                        quarantine_end_date=parse_datetime(row.get("quarantine_end_date", "")),
                        notes=row.get("notes", "").strip() or None
                    )
                    
                    existing = self.db.query(Animal).filter(
                        Animal.animal_id == animal.animal_id
                    ).first()
                    
                    if existing:
                        for key, value in animal.__dict__.items():
                            if key not in ["id", "created_at", "updated_at", "_sa_instance_state"]:
                                setattr(existing, key, value)
                    else:
                        self.db.add(animal)
                    
                    self.db.flush()
                    imported += 1
                    
                except IntegrityError:
                    self.db.rollback()
                    errors.append(f"第 {row_num} 行：动物ID重复或冲突")
                except Exception as e:
                    self.db.rollback()
                    errors.append(f"第 {row_num} 行：{str(e)}")
            
            self.db.commit()
            
        except Exception as e:
            errors.append(f"文件解析错误：{str(e)}")
        
        return imported, errors

    def import_health_checks_from_csv(self, file_content: str) -> Tuple[int, List[str]]:
        imported = 0
        errors = []
        
        try:
            reader = csv.DictReader(StringIO(file_content))
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    animal_id = row.get("animal_id", "").strip()
                    animal = self.db.query(Animal).filter(
                        Animal.animal_id == animal_id
                    ).first()
                    
                    if not animal:
                        errors.append(f"第 {row_num} 行：未找到动物 ID '{animal_id}'")
                        continue
                    
                    health_check = HealthCheck(
                        check_id=row.get("check_id", "").strip() or None,
                        animal_id=animal.id,
                        check_date=parse_datetime(row.get("check_date", "")) or datetime.utcnow(),
                        weight=parse_float(row.get("weight", "")),
                        temperature=parse_float(row.get("temperature", "")),
                        heart_rate=parse_int(row.get("heart_rate", "")) if row.get("heart_rate") else None,
                        respiratory_rate=parse_int(row.get("respiratory_rate", "")) if row.get("respiratory_rate") else None,
                        condition=row.get("condition", "").strip() or None,
                        veterinarian=row.get("veterinarian", "").strip() or None,
                        notes=row.get("notes", "").strip() or None
                    )
                    
                    self.db.add(health_check)
                    self.db.flush()
                    imported += 1
                    
                except Exception as e:
                    self.db.rollback()
                    errors.append(f"第 {row_num} 行：{str(e)}")
            
            self.db.commit()
            
        except Exception as e:
            errors.append(f"文件解析错误：{str(e)}")
        
        return imported, errors

    def import_cage_scans_from_jsonl(self, file_content: str) -> Tuple[int, int, List[str]]:
        imported = 0
        anomaly_count = 0
        errors = []
        scans_data = []
        
        try:
            lines = file_content.strip().split('\n')
            
            for line_num, line in enumerate(lines, start=1):
                if not line.strip():
                    continue
                
                try:
                    data = json.loads(line)
                    
                    scan_data = CageScanCreate(
                        scan_id=data.get("scan_id"),
                        tag_id=data.get("tag_id", "").strip(),
                        cage_id=data.get("cage_id", "").strip(),
                        scan_timestamp=parse_datetime(data.get("scan_timestamp", "")) or datetime.utcnow(),
                        scan_type=data.get("scan_type", "check").strip(),
                        operator=data.get("operator", "").strip() or None,
                        notes=data.get("notes", "").strip() or None
                    )
                    
                    scans_data.append(scan_data)
                    
                except json.JSONDecodeError:
                    errors.append(f"第 {line_num} 行：JSON 解析错误")
                except Exception as e:
                    errors.append(f"第 {line_num} 行：{str(e)}")
            
            imported, anomaly_count, process_errors = self.state_machine.process_scans_batch(scans_data)
            errors.extend(process_errors)
            
        except Exception as e:
            errors.append(f"文件处理错误：{str(e)}")
        
        return imported, anomaly_count, errors

    def import_rules_from_yaml(self, file_content: str) -> Tuple[int, List[str]]:
        imported = 0
        errors = []
        
        try:
            rules_data = yaml.safe_load(file_content)
            
            if not isinstance(rules_data, dict):
                errors.append("YAML 文件格式错误，应为包含 rules 列表的对象")
                return imported, errors
            
            rules_list = rules_data.get("rules", [])
            if not isinstance(rules_list, list):
                rules_list = [rules_data]
            
            for rule_num, rule_data in enumerate(rules_list, start=1):
                try:
                    if not isinstance(rule_data, dict):
                        errors.append(f"第 {rule_num} 条规则：格式错误")
                        continue
                    
                    rule = Rule(
                        rule_name=rule_data.get("rule_name", "").strip(),
                        rule_type=rule_data.get("rule_type", "").strip(),
                        description=rule_data.get("description", "").strip() or None,
                        is_active=rule_data.get("is_active", True),
                        priority=parse_int(str(rule_data.get("priority", 1)))
                    )
                    
                    existing = self.db.query(Rule).filter(
                        Rule.rule_name == rule.rule_name
                    ).first()
                    
                    if existing:
                        for key, value in rule.__dict__.items():
                            if key not in ["id", "created_at", "updated_at", "_sa_instance_state"]:
                                setattr(existing, key, value)
                    else:
                        self.db.add(rule)
                    
                    self.db.flush()
                    imported += 1
                    
                except Exception as e:
                    self.db.rollback()
                    errors.append(f"第 {rule_num} 条规则：{str(e)}")
            
            self.db.commit()
            
        except yaml.YAMLError as e:
            errors.append(f"YAML 解析错误：{str(e)}")
        except Exception as e:
            errors.append(f"文件处理错误：{str(e)}")
        
        return imported, errors

    def import_cages_if_needed(self, cage_ids: List[str]):
        for cage_id in cage_ids:
            existing = self.db.query(Cage).filter(Cage.cage_id == cage_id).first()
            if not existing:
                cage = Cage(
                    cage_id=cage_id,
                    location="自动导入",
                    max_capacity=5,
                    is_quarantine=False
                )
                self.db.add(cage)
        self.db.commit()
