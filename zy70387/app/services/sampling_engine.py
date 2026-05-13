import hashlib
import random
from typing import Optional, Tuple, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.config import settings
from app.models import SamplingRule, TaskLog
from app.schemas import TaskLogCreate


class SamplingDecision:
    def __init__(
        self,
        should_save: bool,
        reason: str,
        rule: Optional[SamplingRule] = None,
        is_sampled: bool = False,
        is_failure_context: bool = False,
        explanation: str = ""
    ):
        self.should_save = should_save
        self.reason = reason
        self.rule = rule
        self.is_sampled = is_sampled
        self.is_failure_context = is_failure_context
        self.explanation = explanation


class SamplingEngine:
    def __init__(self, db: Session):
        self.db = db
        self._rule_cache: Optional[List[SamplingRule]] = None
        self._cache_time: Optional[datetime] = None

    def _get_active_rules(self) -> List[SamplingRule]:
        if self._rule_cache is None or (
            self._cache_time and 
            datetime.utcnow() - self._cache_time > timedelta(minutes=5)
        ):
            self._rule_cache = (
                self.db.query(SamplingRule)
                .filter(SamplingRule.is_active == True)
                .order_by(SamplingRule.priority.desc())
                .all()
            )
            self._cache_time = datetime.utcnow()
        return self._rule_cache

    def _clear_cache(self):
        self._rule_cache = None
        self._cache_time = None

    def _match_rule(
        self, log: TaskLogCreate, rules: List[SamplingRule]
    ) -> Tuple[Optional[SamplingRule], str]:
        for rule in rules:
            task_type_match = (
                rule.task_type is None or 
                rule.task_type == log.task_type
            )
            tenant_id_match = (
                rule.tenant_id is None or 
                rule.tenant_id == log.tenant_id
            )
            
            if task_type_match and tenant_id_match:
                explanation = f"命中规则 '{rule.name}'"
                if rule.tenant_id:
                    explanation += f"（租户ID匹配: {rule.tenant_id}）"
                if rule.task_type:
                    explanation += f"（任务类型匹配: {rule.task_type}）"
                if rule.is_vip_tenant:
                    explanation += "（VIP租户规则）"
                return rule, explanation
        
        return None, "使用默认规则"

    def _calculate_hash(self, log: TaskLogCreate) -> str:
        content = f"{log.tenant_id}:{log.task_type}:{log.message}:{log.log_level}"
        return hashlib.sha256(content.encode()).hexdigest()

    def _check_duplicate(
        self, log: TaskLogCreate, content_hash: str, rule: SamplingRule
    ) -> bool:
        if not rule.dedup_enabled:
            return False
        
        window_start = datetime.utcnow() - timedelta(
            seconds=rule.dedup_window_seconds
        )
        
        existing = (
            self.db.query(TaskLog)
            .filter(
                TaskLog.task_id == log.task_id,
                TaskLog.content_hash == content_hash,
                TaskLog.timestamp >= window_start
            )
            .first()
        )
        
        return existing is not None

    def _should_sample(self, rule: SamplingRule) -> bool:
        return random.random() < rule.sample_rate

    def _get_failure_context_logs(
        self, log: TaskLogCreate, rule: SamplingRule
    ) -> List[TaskLog]:
        if not log.is_failure:
            return []
        
        window_before = rule.context_window_before
        window_after = rule.context_window_after
        
        recent_logs = (
            self.db.query(TaskLog)
            .filter(
                TaskLog.task_id == log.task_id,
                TaskLog.is_failure == False
            )
            .order_by(TaskLog.timestamp.desc())
            .limit(window_before + window_after + 10)
            .all()
        )
        
        return recent_logs[:window_before]

    def decide(
        self, log: TaskLogCreate, current_time: Optional[datetime] = None
    ) -> SamplingDecision:
        if current_time is None:
            current_time = datetime.utcnow()
        
        rules = self._get_active_rules()
        matched_rule, explanation = self._match_rule(log, rules)
        
        if matched_rule is None:
            matched_rule = SamplingRule(
                id=0,
                name="默认规则",
                sample_rate=settings.DEFAULT_SAMPLE_RATE,
                dedup_enabled=True,
                dedup_window_seconds=300,
                context_window_before=3,
                context_window_after=1,
                retention_days=settings.DEFAULT_RETENTION_DAYS,
                version=1
            )
        
        if log.is_failure:
            return SamplingDecision(
                should_save=True,
                reason="failure_always_save",
                rule=matched_rule,
                is_sampled=False,
                is_failure_context=False,
                explanation=f"{explanation}，失败日志全量保留"
            )
        
        content_hash = self._calculate_hash(log)
        if self._check_duplicate(log, content_hash, matched_rule):
            return SamplingDecision(
                should_save=False,
                reason="duplicate_log",
                rule=matched_rule,
                is_sampled=False,
                is_failure_context=False,
                explanation=f"{explanation}，日志内容在去重窗口内重复"
            )
        
        if self._should_sample(matched_rule):
            return SamplingDecision(
                should_save=True,
                reason="sampled",
                rule=matched_rule,
                is_sampled=True,
                is_failure_context=False,
                explanation=f"{explanation}，采样命中（采样率 {matched_rule.sample_rate}）"
            )
        
        return SamplingDecision(
            should_save=False,
            reason="not_sampled",
            rule=matched_rule,
            is_sampled=False,
            is_failure_context=False,
            explanation=f"{explanation}，未命中采样（采样率 {matched_rule.sample_rate}）"
        )

    def get_failure_context_to_save(
        self, log: TaskLogCreate, matched_rule: SamplingRule
    ) -> List[Tuple[TaskLog, str]]:
        context_logs = self._get_failure_context_logs(log, matched_rule)
        result = []
        
        for ctx_log in context_logs:
            if not ctx_log.is_failure_context:
                result.append((
                    ctx_log,
                    f"失败上下文日志（失败前 {matched_rule.context_window_before} 条内）"
                ))
        
        return result
