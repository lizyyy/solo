import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import asdict

import yaml

from models import (
    Deceased, ColdChamberLog, HandoverRecord, Rule,
    Issue, IssueType, Severity
)


class DataLoader:
    def __init__(self):
        self.deceased_dict: Dict[str, Deceased] = {}
        self.chamber_logs: List[ColdChamberLog] = []
        self.handover_records: List[HandoverRecord] = []
        self.rules: List[Rule] = []
        self.load_issues: List[Issue] = []

    def parse_datetime(self, date_str: str) -> Optional[datetime]:
        if not date_str or date_str.strip() == "":
            return None
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d",
        ]
        date_str = date_str.strip()
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except (ValueError, TypeError):
                continue
        return None

    def parse_bool(self, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('true', 'yes', '是', '1', 't', 'y')
        return bool(value)

    def parse_float(self, value: Any) -> Optional[float]:
        if value is None or value == "" or value == "None":
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    def check_required_fields(
        self, record: Dict[str, Any], required_fields: List[str], 
        record_type: str, record_id: str
    ) -> List[Issue]:
        issues = []
        for field in required_fields:
            if field not in record or record.get(field) in (None, "", "None"):
                issue = Issue(
                    issue_id=f"FIELD_MISS_{record_id}_{field}",
                    issue_type=IssueType.MISSING_FIELD,
                    severity=Severity.MEDIUM,
                    description=f"{record_type}记录[{record_id}]缺少必填字段: {field}",
                    related_records=[{
                        "record_type": record_type,
                        "record_id": record_id,
                        "missing_field": field
                    }]
                )
                issues.append(issue)
        return issues

    def load_deceased(self, file_path: str) -> Tuple[Dict[str, Deceased], List[Issue]]:
        issues = []
        deceased_dict = {}
        
        if not os.path.exists(file_path):
            issue = Issue(
                issue_id="FILE_NOT_FOUND_DECEASED",
                issue_type=IssueType.MISSING_FIELD,
                severity=Severity.CRITICAL,
                description=f"文件不存在: {file_path}"
            )
            issues.append(issue)
            return deceased_dict, issues

        required_fields = ['deceased_id', 'name']
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                deceased_id = row.get('deceased_id', '').strip()
                if not deceased_id:
                    continue
                
                field_issues = self.check_required_fields(
                    row, required_fields, "逝者", deceased_id
                )
                issues.extend(field_issues)
                
                if deceased_id in deceased_dict:
                    issue = Issue(
                        issue_id=f"DUPLICATE_DECEASED_{deceased_id}",
                        issue_type=IssueType.DUPLICATE_HANDOVER,
                        severity=Severity.MEDIUM,
                        description=f"重复的逝者ID: {deceased_id} (姓名: {row.get('name')})",
                        related_records=[{
                            "record_type": "逝者",
                            "record_id": deceased_id,
                            "action": "重复记录"
                        }]
                    )
                    issues.append(issue)
                
                deceased = Deceased(
                    deceased_id=deceased_id,
                    name=row.get('name', '').strip(),
                    gender=row.get('gender', '').strip(),
                    birth_date=self.parse_datetime(row.get('birth_date', '')),
                    death_date=self.parse_datetime(row.get('death_date', '')),
                    cause_of_death=row.get('cause_of_death', '').strip(),
                    contact_person=row.get('contact_person', '').strip(),
                    contact_phone=row.get('contact_phone', '').strip(),
                    remarks=row.get('remarks', '').strip()
                )
                deceased_dict[deceased_id] = deceased

        return deceased_dict, issues

    def load_cold_chamber_logs(self, file_path: str) -> Tuple[List[ColdChamberLog], List[Issue]]:
        issues = []
        logs = []
        
        if not os.path.exists(file_path):
            issue = Issue(
                issue_id="FILE_NOT_FOUND_CHAMBER",
                issue_type=IssueType.MISSING_FIELD,
                severity=Severity.CRITICAL,
                description=f"文件不存在: {file_path}"
            )
            issues.append(issue)
            return logs, issues

        required_fields = ['log_id', 'chamber_id']
        log_ids = set()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    issue = Issue(
                        issue_id=f"JSON_PARSE_ERROR_{line_num}",
                        issue_type=IssueType.MISSING_FIELD,
                        severity=Severity.HIGH,
                        description=f"第{line_num}行JSON解析错误",
                        related_records=[{
                            "record_type": "冷藏柜日志",
                            "line_number": line_num,
                            "error": "JSON格式错误"
                        }]
                    )
                    issues.append(issue)
                    continue
                
                log_id = row.get('log_id', '').strip()
                if not log_id:
                    continue
                
                field_issues = self.check_required_fields(
                    row, required_fields, "冷藏柜日志", log_id
                )
                issues.extend(field_issues)
                
                if log_id in log_ids:
                    issue = Issue(
                        issue_id=f"DUPLICATE_LOG_{log_id}",
                        issue_type=IssueType.DUPLICATE_HANDOVER,
                        severity=Severity.MEDIUM,
                        description=f"重复的日志ID: {log_id}",
                        related_records=[{
                            "record_type": "冷藏柜日志",
                            "record_id": log_id,
                            "action": "重复记录"
                        }]
                    )
                    issues.append(issue)
                
                log_ids.add(log_id)
                
                log = ColdChamberLog(
                    log_id=log_id,
                    chamber_id=row.get('chamber_id', '').strip(),
                    deceased_id=row.get('deceased_id', '').strip() if row.get('deceased_id') else None,
                    operation_type=row.get('operation_type', '').strip(),
                    temperature=self.parse_float(row.get('temperature')),
                    timestamp=self.parse_datetime(row.get('timestamp', '')),
                    operator=row.get('operator', '').strip(),
                    remarks=row.get('remarks', '').strip()
                )
                logs.append(log)

        return logs, issues

    def load_handover_records(self, file_path: str) -> Tuple[List[HandoverRecord], List[Issue]]:
        issues = []
        records = []
        
        if not os.path.exists(file_path):
            issue = Issue(
                issue_id="FILE_NOT_FOUND_HANDOVER",
                issue_type=IssueType.MISSING_FIELD,
                severity=Severity.CRITICAL,
                description=f"文件不存在: {file_path}"
            )
            issues.append(issue)
            return records, issues

        required_fields = ['handover_id', 'deceased_id']
        handover_ids = set()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                handover_id = row.get('handover_id', '').strip()
                if not handover_id:
                    continue
                
                field_issues = self.check_required_fields(
                    row, required_fields, "交接记录", handover_id
                )
                issues.extend(field_issues)
                
                if handover_id in handover_ids:
                    issue = Issue(
                        issue_id=f"DUPLICATE_HANDOVER_{handover_id}",
                        issue_type=IssueType.DUPLICATE_HANDOVER,
                        severity=Severity.HIGH,
                        description=f"重复的交接记录ID: {handover_id}",
                        related_records=[{
                            "record_type": "交接记录",
                            "record_id": handover_id,
                            "action": "重复记录"
                        }]
                    )
                    issues.append(issue)
                
                handover_ids.add(handover_id)
                
                is_signed = self.parse_bool(row.get('is_signed', 'False'))
                
                record = HandoverRecord(
                    handover_id=handover_id,
                    deceased_id=row.get('deceased_id', '').strip(),
                    handover_type=row.get('handover_type', '').strip(),
                    from_chamber=row.get('from_chamber', '').strip() if row.get('from_chamber') else None,
                    to_chamber=row.get('to_chamber', '').strip() if row.get('to_chamber') else None,
                    from_person=row.get('from_person', '').strip(),
                    to_person=row.get('to_person', '').strip(),
                    handover_time=self.parse_datetime(row.get('handover_time', '')),
                    is_signed=is_signed,
                    signed_by=row.get('signed_by', '').strip(),
                    signed_at=self.parse_datetime(row.get('signed_at', '')),
                    remarks=row.get('remarks', '').strip()
                )
                records.append(record)
                
                if not is_signed:
                    issue = Issue(
                        issue_id=f"SIGN_MISS_{handover_id}",
                        issue_type=IssueType.MISSING_SIGNATURE,
                        severity=Severity.HIGH,
                        deceased_id=row.get('deceased_id'),
                        description=f"交接记录[{handover_id}]缺少签收确认",
                        related_records=[{
                            "record_type": "交接记录",
                            "record_id": handover_id,
                            "deceased_id": row.get('deceased_id'),
                            "handover_type": row.get('handover_type', '')
                        }]
                    )
                    issues.append(issue)

        return records, issues

    def load_rules(self, file_path: str) -> Tuple[List[Rule], List[Issue]]:
        issues = []
        rules = []
        
        if not os.path.exists(file_path):
            issue = Issue(
                issue_id="FILE_NOT_FOUND_RULES",
                issue_type=IssueType.MISSING_FIELD,
                severity=Severity.HIGH,
                description=f"文件不存在: {file_path}, 将使用默认规则"
            )
            issues.append(issue)
            default_rules = [
                Rule(
                    rule_id="TEMP_RANGE_DEFAULT",
                    rule_name="冷藏柜温度范围",
                    rule_type="temperature",
                    min_value=-25.0,
                    max_value=-15.0,
                    description="冷藏柜温度应保持在-25°C到-15°C之间"
                )
            ]
            return default_rules, issues

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                
                if data is None:
                    return rules, issues
                
                if 'rules' in data:
                    rule_list = data['rules']
                else:
                    rule_list = [data] if isinstance(data, dict) else data
                
                for idx, rule_data in enumerate(rule_list):
                    rule = Rule(
                        rule_id=rule_data.get('rule_id', f"RULE_{idx}"),
                        rule_name=rule_data.get('rule_name', ''),
                        rule_type=rule_data.get('rule_type', ''),
                        min_value=self.parse_float(rule_data.get('min_value')),
                        max_value=self.parse_float(rule_data.get('max_value')),
                        description=rule_data.get('description', ''),
                        is_active=self.parse_bool(rule_data.get('is_active', True))
                    )
                    rules.append(rule)
        except yaml.YAMLError as e:
            issue = Issue(
                issue_id="YAML_PARSE_ERROR",
                issue_type=IssueType.MISSING_FIELD,
                severity=Severity.HIGH,
                description=f"YAML解析错误: {str(e)}"
            )
            issues.append(issue)

        return rules, issues

    def load_all(
        self, 
        deceased_path: str,
        chamber_logs_path: str,
        handover_path: str,
        rules_path: str
    ) -> List[Issue]:
        all_issues = []
        
        self.deceased_dict, issues = self.load_deceased(deceased_path)
        all_issues.extend(issues)
        
        self.chamber_logs, issues = self.load_cold_chamber_logs(chamber_logs_path)
        all_issues.extend(issues)
        
        self.handover_records, issues = self.load_handover_records(handover_path)
        all_issues.extend(issues)
        
        self.rules, issues = self.load_rules(rules_path)
        all_issues.extend(issues)
        
        self.load_issues = all_issues
        return all_issues

    def get_temperature_rule(self) -> Optional[Rule]:
        for rule in self.rules:
            if rule.rule_type == 'temperature' and rule.is_active:
                return rule
        return None
