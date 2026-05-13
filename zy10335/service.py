import hashlib
import json
import re
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from models import (
    ProxyRule, RuleStatus, FieldPath, DesensitizationLevel,
    AccessRecord, ValidationRequest
)


def generate_id() -> str:
    return str(uuid.uuid4())


def compute_digest(data: Dict[str, Any]) -> str:
    json_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(json_str.encode('utf-8')).hexdigest()


def get_nested_value(data: Dict[str, Any], path: str) -> Tuple[bool, Any]:
    parts = path.split('.')
    current = data
    for i, part in enumerate(parts):
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list) and part.isdigit():
            idx = int(part)
            if 0 <= idx < len(current):
                current = current[idx]
            else:
                return False, None
        else:
            return False, None
    return True, current


def set_nested_value(data: Dict[str, Any], path: str, value: Any) -> bool:
    parts = path.split('.')
    current = data
    for i, part in enumerate(parts[:-1]):
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list) and part.isdigit():
            idx = int(part)
            if 0 <= idx < len(current):
                current = current[idx]
            else:
                return False
        else:
            return False
    last_part = parts[-1]
    if isinstance(current, dict):
        current[last_part] = value
        return True
    elif isinstance(current, list) and last_part.isdigit():
        idx = int(last_part)
        if 0 <= idx < len(current):
            current[idx] = value
            return True
    return False


def mask_value(value: Any) -> str:
    if value is None:
        return ""
    s = str(value)
    if len(s) <= 2:
        return "*" * len(s)
    return s[0] + "*" * (len(s) - 2) + s[-1]


def hash_value(value: Any) -> str:
    if value is None:
        return ""
    return hashlib.md5(str(value).encode('utf-8')).hexdigest()


def desensitize_value(value: Any, level: DesensitizationLevel) -> Any:
    if level == DesensitizationLevel.NONE:
        return value
    elif level == DesensitizationLevel.MASK:
        return mask_value(value)
    elif level == DesensitizationLevel.HASH:
        return hash_value(value)
    elif level == DesensitizationLevel.ENCRYPT:
        return f"ENC:{hash_value(value)}"
    elif level == DesensitizationLevel.REMOVE:
        return None
    return value


def matches_pattern(value: Any, pattern: Optional[str]) -> bool:
    if pattern is None:
        return True
    if value is None:
        return False
    return bool(re.match(pattern, str(value)))


class DesensitizationService:
    def __init__(self):
        self.rules: Dict[str, ProxyRule] = {}
        self.records: Dict[str, AccessRecord] = {}
        self.request_id_index: Dict[str, str] = {}
    
    def create_rule(self, req, created_by: str) -> ProxyRule:
        rule_id = generate_id()
        rule = ProxyRule(
            rule_id=rule_id,
            name=req.name,
            description=req.description,
            api_path=req.api_path,
            method=req.method,
            fields=req.fields,
            allowed_callers=req.allowed_callers,
            created_by=created_by
        )
        self.rules[rule_id] = rule
        return rule
    
    def get_rule(self, rule_id: str) -> Optional[ProxyRule]:
        return self.rules.get(rule_id)
    
    def list_rules(self, status: Optional[RuleStatus] = None) -> List[ProxyRule]:
        rules = list(self.rules.values())
        if status:
            rules = [r for r in rules if r.status == status]
        return rules
    
    def approve_rule(self, rule_id: str, approved_by: str) -> Optional[ProxyRule]:
        rule = self.rules.get(rule_id)
        if not rule:
            return None
        rule.status = RuleStatus.ACTIVE
        rule.approved_by = approved_by
        rule.approved_at = datetime.now()
        rule.updated_at = datetime.now()
        return rule
    
    def suspend_rule(self, rule_id: str) -> Optional[ProxyRule]:
        rule = self.rules.get(rule_id)
        if not rule:
            return None
        rule.status = RuleStatus.SUSPENDED
        rule.updated_at = datetime.now()
        return rule
    
    def check_duplicate_request(self, request_id: str) -> Optional[AccessRecord]:
        record_id = self.request_id_index.get(request_id)
        if record_id:
            return self.records.get(record_id)
        return None
    
    def validate_caller(self, rule: ProxyRule, caller: str) -> bool:
        if not rule.allowed_callers:
            return True
        return caller in rule.allowed_callers
    
    def process_validation(self, req: ValidationRequest) -> Tuple[Optional[AccessRecord], Dict[str, Any]]:
        existing = self.check_duplicate_request(req.request_id)
        if existing:
            return existing, None
        
        rule = self.rules.get(req.rule_id)
        if not rule:
            raise ValueError(f"RULE_NOT_FOUND", f"规则 {req.rule_id} 不存在")
        
        if rule.status != RuleStatus.ACTIVE:
            raise ValueError(f"RULE_NOT_ACTIVE", f"规则 {req.rule_id} 未激活")
        
        if not self.validate_caller(rule, req.caller):
            raise ValueError(f"CALLER_NOT_ALLOWED", f"调用方 {req.caller} 无权限")
        
        original_digest = compute_digest(req.data)
        desensitized_data = json.loads(json.dumps(req.data))
        matched_fields = []
        
        for field in rule.fields:
            exists, value = get_nested_value(req.data, field.path)
            if exists and matches_pattern(value, field.pattern):
                desensitized = desensitize_value(value, field.level)
                set_nested_value(desensitized_data, field.path, desensitized)
                matched_fields.append(field.path)
        
        desensitized_digest = compute_digest(desensitized_data)
        
        record = AccessRecord(
            record_id=generate_id(),
            rule_id=req.rule_id,
            caller=req.caller,
            request_id=req.request_id,
            api_path=req.api_path,
            original_digest=original_digest,
            desensitized_digest=desensitized_digest,
            matched_fields=matched_fields,
            status="success"
        )
        
        self.records[record.record_id] = record
        self.request_id_index[req.request_id] = record.record_id
        
        return record, desensitized_data
    
    def get_record(self, record_id: str) -> Optional[AccessRecord]:
        return self.records.get(record_id)
    
    def list_records(self, rule_id: Optional[str] = None, caller: Optional[str] = None) -> List[AccessRecord]:
        records = list(self.records.values())
        if rule_id:
            records = [r for r in records if r.rule_id == rule_id]
        if caller:
            records = [r for r in records if r.caller == caller]
        return records
