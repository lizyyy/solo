import re
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models import AttributionRule, TaskResult, AttributionResult, RiskType
from app.schemas import AttributionResultCreate


class RuleEngine:
    def __init__(self, db: Session):
        self.db = db

    def load_active_rules(self) -> List[AttributionRule]:
        return self.db.query(AttributionRule).filter(
            AttributionRule.is_active == True
        ).order_by(AttributionRule.priority.desc()).all()

    def match_rule(self, task_result: TaskResult, rule: AttributionRule) -> Tuple[bool, float]:
        condition = rule.condition_pattern
        error_msg = task_result.error_message or ""
        raw_output = task_result.raw_output or ""
        combined_text = f"{error_msg} {raw_output}"

        if condition.startswith("regex:"):
            pattern = condition[6:]
            if re.search(pattern, combined_text, re.IGNORECASE):
                return True, 0.95
        elif condition.startswith("contains:"):
            keywords = condition[9:].split(",")
            match_count = sum(1 for kw in keywords if kw.strip().lower() in combined_text.lower())
            if match_count > 0:
                confidence = min(match_count / len(keywords), 1.0)
                return True, confidence
        elif condition.startswith("early_terminate:"):
            if task_result.is_early_terminated:
                return True, 1.0

        return False, 0.0

    def analyze_task(self, task_result: TaskResult) -> Optional[AttributionResult]:
        rules = self.load_active_rules()

        for rule in rules:
            matched, confidence = self.match_rule(task_result, rule)
            if matched:
                return AttributionResult(
                    task_id=task_result.task_id,
                    batch_id=task_result.batch_id,
                    blocked_by_rule=rule.rule_name,
                    blocked_by_rule_code=rule.rule_code,
                    block_reason=f"任务状态提前结束，被规则 [{rule.rule_name}] 拦截：{rule.description}",
                    risk_type=rule.risk_type,
                    confidence_score=confidence
                )

        if task_result.is_early_terminated:
            return AttributionResult(
                task_id=task_result.task_id,
                batch_id=task_result.batch_id,
                blocked_by_rule="未知规则",
                blocked_by_rule_code="UNKNOWN_001",
                block_reason="任务状态提前结束，但未匹配到具体拦截规则",
                risk_type=RiskType.UNKNOWN,
                confidence_score=0.5
            )

        return None

    def analyze_batch(self, batch_id: str) -> List[AttributionResult]:
        task_results = self.db.query(TaskResult).filter(
            TaskResult.batch_id == batch_id
        ).all()

        attribution_results = []
        for task_result in task_results:
            existing = self.db.query(AttributionResult).filter(
                AttributionResult.task_id == task_result.task_id
            ).first()

            if existing:
                attribution_results.append(existing)
                continue

            result = self.analyze_task(task_result)
            if result:
                self.db.add(result)
                attribution_results.append(result)

        self.db.commit()
        return attribution_results


def initialize_default_rules(db: Session):
    default_rules = [
        {
            "rule_code": "SEC_001",
            "rule_name": "安全认证失败",
            "description": "设备安全认证未通过，可能存在密钥过期或证书问题",
            "condition_pattern": "contains:authentication failed,auth error,证书过期,密钥无效",
            "risk_type": RiskType.SECURITY,
            "priority": 100
        },
        {
            "rule_code": "NET_001",
            "rule_name": "网络连接超时",
            "description": "边缘节点网络连接异常，无法建立稳定通信",
            "condition_pattern": "contains:connection timeout,network error,连接超时,网络异常",
            "risk_type": RiskType.NETWORK,
            "priority": 90
        },
        {
            "rule_code": "DATA_001",
            "rule_name": "数据完整性校验失败",
            "description": "传输数据校验和不匹配，数据可能被篡改",
            "condition_pattern": "contains:checksum failed,data integrity,校验失败,数据篡改",
            "risk_type": RiskType.DATA_INTEGRITY,
            "priority": 95
        },
        {
            "rule_code": "DEV_001",
            "rule_name": "设备健康状态异常",
            "description": "边缘节点CPU/内存/磁盘使用率超过阈值",
            "condition_pattern": "contains:cpu high,memory high,disk full,资源不足",
            "risk_type": RiskType.DEVICE_HEALTH,
            "priority": 85
        },
        {
            "rule_code": "CFG_001",
            "rule_name": "配置参数无效",
            "description": "任务配置参数验证失败，参数值超出允许范围",
            "condition_pattern": "contains:invalid config,parameter error,配置错误,参数无效",
            "risk_type": RiskType.CONFIGURATION,
            "priority": 80
        },
        {
            "rule_code": "EARLY_001",
            "rule_name": "提前终止通用规则",
            "description": "任务被标记为提前结束但未匹配具体规则",
            "condition_pattern": "early_terminate:true",
            "risk_type": RiskType.UNKNOWN,
            "priority": 1
        }
    ]

    for rule_data in default_rules:
        existing = db.query(AttributionRule).filter(
            AttributionRule.rule_code == rule_data["rule_code"]
        ).first()
        if not existing:
            db_rule = AttributionRule(**rule_data)
            db.add(db_rule)

    db.commit()
