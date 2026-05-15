import time
from typing import List, Tuple, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from models import (
    Batch, GatewayErrorExtract, ReplayResult, RuleVersion,
    ReplayStatus, BatchStatus
)

DEFAULT_RULES = {
    "approval_opinion_check": {
        "enabled": True,
        "severity": "block",
        "description": "检查审批意见是否存在",
        "conditions": [
            {
                "field": "approval_opinion",
                "operator": "is_empty",
                "block_code": "APPR_OPINION_001",
                "block_reason": "审批意见丢失：该字段为必填项，为空时系统自动拦截"
            }
        ]
    },
    "error_code_validation": {
        "enabled": True,
        "severity": "block",
        "description": "验证错误码格式合法性",
        "conditions": [
            {
                "field": "error_code",
                "operator": "is_empty",
                "block_code": "ERR_CODE_001",
                "block_reason": "错误码丢失：网关错误必须包含错误码"
            }
        ]
    },
    "trace_id_required": {
        "enabled": True,
        "severity": "warn",
        "description": "检查Trace ID是否存在",
        "conditions": [
            {
                "field": "trace_id",
                "operator": "is_empty",
                "block_code": "TRACE_ID_001",
                "block_reason": "Trace ID缺失：可能导致无法追踪完整调用链"
            }
        ]
    }
}

class ReplayEngine:
    def __init__(self, db: Session):
        self.db = db
    
    def _get_active_rules(self, rule_version_id: int = None) -> Tuple[Dict[str, Any], RuleVersion]:
        if rule_version_id:
            rule_version = self.db.query(RuleVersion).filter(
                RuleVersion.id == rule_version_id
            ).first()
            if not rule_version:
                raise ValueError(f"规则版本 {rule_version_id} 不存在")
            rules = rule_version.rules
        else:
            rule_version = self.db.query(RuleVersion).filter(
                RuleVersion.is_active == True
            ).order_by(RuleVersion.effective_from.desc()).first()
            if rule_version:
                rules = rule_version.rules
            else:
                rules = DEFAULT_RULES
                rule_version = None
        
        return rules, rule_version
    
    def _check_condition(self, extract: GatewayErrorExtract, condition: Dict[str, Any]) -> Tuple[bool, str, str]:
        field = condition["field"]
        operator = condition["operator"]
        block_code = condition["block_code"]
        block_reason = condition["block_reason"]
        
        field_value = getattr(extract, field, None)
        
        if operator == "is_empty":
            is_blocked = field_value is None or field_value == "" or field_value == "null"
            return is_blocked, block_code, block_reason
        
        if operator == "not_in":
            allowed_values = condition.get("values", [])
            is_blocked = field_value not in allowed_values
            return is_blocked, block_code, block_reason
        
        if operator == "regex_match":
            import re
            pattern = condition.get("pattern", "")
            is_blocked = bool(re.match(pattern, str(field_value) if field_value else ""))
            return is_blocked, block_code, block_reason
        
        return False, "", ""
    
    def _apply_rules(self, extract: GatewayErrorExtract, rules: Dict[str, Any]) -> Tuple[bool, List[str], str, str]:
        is_blocked = False
        matched_rules = []
        final_block_code = None
        final_block_reason = None
        
        for rule_name, rule_config in rules.items():
            if not rule_config.get("enabled", False):
                continue
            
            severity = rule_config.get("severity", "warn")
            conditions = rule_config.get("conditions", [])
            
            for condition in conditions:
                blocked, block_code, block_reason = self._check_condition(extract, condition)
                if blocked:
                    matched_rules.append(f"{rule_name}:{block_code}")
                    if severity == "block":
                        is_blocked = True
                        final_block_code = block_code
                        final_block_reason = block_reason
                    
                    break
        
        return is_blocked, matched_rules, final_block_code, final_block_reason
    
    def _check_approval_opinion_missing(self, extract: GatewayErrorExtract) -> Tuple[bool, str]:
        has_approval_field = (
            extract.approval_opinion is not None and
            extract.approval_opinion != "" and
            extract.approval_opinion != "null"
        )
        
        if not has_approval_field:
            return True, "审批意见字段为空或缺失，该字段为网关错误重放的核心校验项"
        
        return False, ""
    
    def process_extract(self, extract: GatewayErrorExtract, rules: Dict[str, Any]) -> ReplayResult:
        start_time = time.time()
        
        before_data = {
            "trace_id": extract.trace_id,
            "request_id": extract.request_id,
            "error_code": extract.error_code,
            "error_message": extract.error_message,
            "approval_opinion": extract.approval_opinion,
            "approval_status": extract.approval_status,
            "timestamp": extract.timestamp.isoformat() if extract.timestamp else None
        }
        
        is_blocked, matched_rules, block_code, block_reason = self._apply_rules(extract, rules)
        
        approval_opinion_missing, approval_reason = self._check_approval_opinion_missing(extract)
        if approval_opinion_missing:
            is_blocked = True
            if "approval_opinion_check:APPR_OPINION_001" not in matched_rules:
                matched_rules.append("approval_opinion_check:APPR_OPINION_001")
            block_code = "APPR_OPINION_001"
            block_reason = approval_reason
        
        if is_blocked:
            status = ReplayStatus.BLOCKED
            approval_required = True
        else:
            status = ReplayStatus.SUCCESS
            approval_required = False
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        after_data = before_data.copy()
        after_data.update({
            "replay_status": status,
            "is_blocked": is_blocked,
            "matched_rules": matched_rules,
            "block_code": block_code,
            "block_reason": block_reason,
            "approval_required": approval_required,
            "approval_opinion_missing": approval_opinion_missing
        })
        
        return ReplayResult(
            error_extract_id=extract.id,
            status=status,
            execution_time_ms=execution_time_ms,
            before_data=before_data,
            after_data=after_data,
            block_reason=block_reason,
            block_code=block_code,
            matched_rules=matched_rules,
            approval_required=approval_required,
            approval_opinion_missing=approval_opinion_missing
        )
    
    def replay_batch(self, batch_id: int, rule_version_id: int = None) -> Batch:
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise ValueError(f"批次 {batch_id} 不存在")
        
        rules, rule_version = self._get_active_rules(rule_version_id)
        
        if rule_version:
            batch.rule_version_id = rule_version.id
        
        batch.status = BatchStatus.PROCESSING
        batch.started_at = datetime.now()
        self.db.commit()
        
        error_extracts = self.db.query(GatewayErrorExtract).filter(
            GatewayErrorExtract.batch_id == batch_id
        ).all()
        
        success_count = 0
        failed_count = 0
        blocked_count = 0
        total_execution_time = 0
        
        for extract in error_extracts:
            result = self.process_extract(extract, rules)
            result.batch_id = batch_id
            self.db.add(result)
            
            total_execution_time += result.execution_time_ms
            
            if result.status == ReplayStatus.SUCCESS:
                success_count += 1
            elif result.status == ReplayStatus.BLOCKED:
                blocked_count += 1
            else:
                failed_count += 1
        
        batch.total_count = len(error_extracts)
        batch.success_count = success_count
        batch.failed_count = failed_count
        batch.blocked_count = blocked_count
        batch.execution_time_ms = total_execution_time
        batch.completed_at = datetime.now()
        
        if blocked_count > 0 and success_count > 0:
            batch.status = BatchStatus.PARTIAL_SUCCESS
        elif blocked_count > 0:
            batch.status = BatchStatus.APPROVAL_REQUIRED
        elif failed_count > 0:
            batch.status = BatchStatus.FAILED
        else:
            batch.status = BatchStatus.SUCCESS
        
        self.db.commit()
        self.db.refresh(batch)
        
        return batch
