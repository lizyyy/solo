"""
策略引擎：路由策略解析与模型选择决策
"""

from abc import ABC, abstractmethod
from collections import deque
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from .models import (
    ModelConfig,
    ModelTier,
    RoutingPolicy,
    TestCase,
)


class SelectionStrategy(ABC):
    """模型选择策略基类"""
    
    @abstractmethod
    def select(self, models: List[ModelConfig], context: Dict[str, Any]) -> Optional[ModelConfig]:
        pass


class RoundRobinStrategy(SelectionStrategy):
    """轮询策略"""
    
    def __init__(self):
        self._counters: Dict[str, int] = {}
    
    def select(self, models: List[ModelConfig], context: Dict[str, Any]) -> Optional[ModelConfig]:
        if not models:
            return None
        
        key = context.get("model_key", "default")
        if key not in self._counters:
            self._counters[key] = 0
        
        index = self._counters[key] % len(models)
        self._counters[key] += 1
        return models[index]


class LeastLoadStrategy(SelectionStrategy):
    """最少负载策略"""
    
    def __init__(self):
        self._request_counts: Dict[str, int] = {}
    
    def select(self, models: List[ModelConfig], context: Dict[str, Any]) -> Optional[ModelConfig]:
        if not models:
            return None
        
        return min(
            models,
            key=lambda m: self._request_counts.get(f"{m.provider}.{m.model_name}", 0)
        )
    
    def increment_count(self, model_key: str):
        self._request_counts[model_key] = self._request_counts.get(model_key, 0) + 1


class PriorityStrategy(SelectionStrategy):
    """优先级策略"""
    
    def select(self, models: List[ModelConfig], context: Dict[str, Any]) -> Optional[ModelConfig]:
        if not models:
            return None
        
        priority_order = {
            ModelTier.PRIMARY: 0,
            ModelTier.SECONDARY: 1,
            ModelTier.FALLBACK: 2,
        }
        
        sorted_models = sorted(
            models,
            key=lambda m: priority_order.get(m.tier, 99)
        )
        return sorted_models[0] if sorted_models else None


class CircuitBreaker:
    """熔断器"""
    
    class State:
        CLOSED = "closed"
        OPEN = "open"
        HALF_OPEN = "half_open"
    
    def __init__(self, threshold: int = 5, timeout_ms: int = 60000):
        self.threshold = threshold
        self.timeout_ms = timeout_ms
        
        self._state = self.State.CLOSED
        self._failure_count = 0
        self._last_failure_time: Optional[datetime] = None
        self._success_count_in_half_open = 0
    
    def record_success(self):
        if self._state == self.State.HALF_OPEN:
            self._success_count_in_half_open += 1
            if self._success_count_in_half_open >= 3:
                self._state = self.State.CLOSED
                self._failure_count = 0
                self._success_count_in_half_open = 0
        else:
            self._failure_count = 0
            self._state = self.State.CLOSED
    
    def record_failure(self):
        self._failure_count += 1
        self._last_failure_time = datetime.now()
        
        if self._state == self.State.HALF_OPEN:
            self._state = self.State.OPEN
            self._success_count_in_half_open = 0
        elif self._failure_count >= self.threshold:
            self._state = self.State.OPEN
    
    def allow_request(self) -> bool:
        if self._state == self.State.CLOSED:
            return True
        
        if self._state == self.State.OPEN:
            if self._last_failure_time and (
                datetime.now() - self._last_failure_time
            ) > timedelta(milliseconds=self.timeout_ms):
                self._state = self.State.HALF_OPEN
                return True
            return False
        
        if self._state == self.State.HALF_OPEN:
            return True
        
        return True
    
    def get_state(self) -> str:
        return self._state


class BudgetTracker:
    """预算追踪器"""
    
    def __init__(self, daily_budget: Optional[float] = None, monthly_budget: Optional[float] = None):
        self.daily_budget = daily_budget
        self.monthly_budget = monthly_budget
        
        self._daily_spent: float = 0.0
        self._monthly_spent: float = 0.0
        self._daily_reset_date: Optional[datetime] = None
        self._monthly_reset_date: Optional[datetime] = None
    
    def _check_reset(self):
        now = datetime.now()
        
        if self._daily_reset_date and now.date() > self._daily_reset_date.date():
            self._daily_spent = 0.0
        
        if self._monthly_reset_date and (
            now.year > self._monthly_reset_date.year or
            now.month > self._monthly_reset_date.month
        ):
            self._monthly_spent = 0.0
    
    def record_spend(self, amount: float):
        self._check_reset()
        self._daily_spent += amount
        self._monthly_spent += amount
        
        if self._daily_reset_date is None:
            self._daily_reset_date = datetime.now()
        if self._monthly_reset_date is None:
            self._monthly_reset_date = datetime.now()
    
    def can_spend(self, estimated_amount: float = 0.0) -> bool:
        self._check_reset()
        
        if self.daily_budget is not None:
            if self._daily_spent + estimated_amount > self.daily_budget:
                return False
        
        if self.monthly_budget is not None:
            if self._monthly_spent + estimated_amount > self.monthly_budget:
                return False
        
        return True
    
    def get_usage_percentage(self) -> Dict[str, float]:
        self._check_reset()
        
        result = {}
        if self.daily_budget and self.daily_budget > 0:
            result["daily"] = min(1.0, self._daily_spent / self.daily_budget)
        if self.monthly_budget and self.monthly_budget > 0:
            result["monthly"] = min(1.0, self._monthly_spent / self.monthly_budget)
        return result


class RateLimiter:
    """速率限制器"""
    
    def __init__(self, rpm_limit: int = 100, tpm_limit: int = 100000):
        self.rpm_limit = rpm_limit
        self.tpm_limit = tpm_limit
        
        self._requests: deque = deque()
        self._tokens: deque = deque()
    
    def _cleanup_old(self, now: datetime):
        one_minute_ago = now - timedelta(minutes=1)
        
        while self._requests and self._requests[0] < one_minute_ago:
            self._requests.popleft()
        
        while self._tokens and self._tokens[0][0] < one_minute_ago:
            self._tokens.popleft()
    
    def can_acquire(self, token_estimate: int = 0) -> bool:
        now = datetime.now()
        self._cleanup_old(now)
        
        if len(self._requests) >= self.rpm_limit:
            return False
        
        current_tokens = sum(t for _, t in self._tokens)
        if current_tokens + token_estimate > self.tpm_limit:
            return False
        
        return True
    
    def acquire(self, tokens: int = 0) -> bool:
        if not self.can_acquire(tokens):
            return False
        
        now = datetime.now()
        self._requests.append(now)
        if tokens > 0:
            self._tokens.append((now, tokens))
        return True


class SensitiveTagFilter:
    """敏感标签过滤器"""
    
    def __init__(self, blocked_tags: List[str]):
        self.blocked_tags = set(blocked_tags)
    
    def is_blocked(self, test_case: TestCase) -> bool:
        return bool(self.blocked_tags & set(test_case.sensitive_tags))
    
    def add_blocked_tag(self, tag: str):
        self.blocked_tags.add(tag)
    
    def remove_blocked_tag(self, tag: str):
        self.blocked_tags.discard(tag)


class StrategyEngine:
    """策略引擎主类"""
    
    def __init__(self, policy: RoutingPolicy, models: Dict[str, ModelConfig]):
        self.policy = policy
        self.models = models
        
        self._selection_strategies: Dict[str, SelectionStrategy] = {
            "round_robin": RoundRobinStrategy(),
            "least_load": LeastLoadStrategy(),
            "priority": PriorityStrategy(),
        }
        
        self._circuit_breakers: Dict[str, CircuitBreaker] = {}
        self._budget_trackers: Dict[str, BudgetTracker] = {}
        self._rate_limiters: Dict[str, RateLimiter] = {}
        
        self._init_components()
        
        self._sensitive_filter: Optional[SensitiveTagFilter] = None
        if policy.sensitive_tag_blocking_enabled and policy.blocked_sensitive_tags:
            self._sensitive_filter = SensitiveTagFilter(policy.blocked_sensitive_tags)
    
    def _init_components(self):
        for model_key, model_config in self.models.items():
            if model_config.enabled:
                if self.policy.circuit_breaker_enabled:
                    self._circuit_breakers[model_key] = CircuitBreaker(
                        threshold=model_config.circuit_breaker_threshold,
                        timeout_ms=model_config.circuit_breaker_timeout_ms
                    )
                
                if self.policy.budget_tracking_enabled:
                    self._budget_trackers[model_key] = BudgetTracker(
                        daily_budget=model_config.daily_budget,
                        monthly_budget=model_config.monthly_budget
                    )
                
                self._rate_limiters[model_key] = RateLimiter(
                    rpm_limit=model_config.rpm_limit,
                    tpm_limit=model_config.tpm_limit
                )
    
    def select_primary_model(
        self,
        test_case: TestCase,
        context: Dict[str, Any]
    ) -> Optional[ModelConfig]:
        """选择主模型"""
        enabled_models = [
            m for m in self.models.values()
            if m.enabled and m.tier == ModelTier.PRIMARY
        ]
        
        if not enabled_models:
            return None
        
        available_models = self._filter_available_models(enabled_models, test_case)
        
        if not available_models:
            return None
        
        strategy = self._selection_strategies.get(
            self.policy.primary_selection_strategy,
            self._selection_strategies["round_robin"]
        )
        
        return strategy.select(available_models, context)
    
    def select_fallback_model(
        self,
        test_case: TestCase,
        exclude_models: List[str]
    ) -> Optional[ModelConfig]:
        """选择降级/备用模型"""
        if not self.policy.fallback_enabled:
            return None
        
        fallback_models = [
            m for m in self.models.values()
            if m.enabled and m.tier in [ModelTier.SECONDARY, ModelTier.FALLBACK]
        ]
        
        available_models = [
            m for m in fallback_models
            if f"{m.provider}.{m.model_name}" not in exclude_models
        ]
        
        if not available_models:
            return None
        
        available_models = self._filter_available_models(available_models, test_case)
        
        return available_models[0] if available_models else None
    
    def select_degradation_model(
        self,
        current_model: ModelConfig
    ) -> Optional[ModelConfig]:
        """选择降级模型（根据当前模型配置的降级列表）"""
        if not self.policy.degradation_enabled:
            return None
        
        for degradation_model_name in current_model.degradation_models:
            if degradation_model_name in self.models:
                model = self.models[degradation_model_name]
                if model.enabled:
                    return model
        
        return self.select_fallback_model(
            test_case=None,  # type: ignore
            exclude_models=[f"{current_model.provider}.{current_model.model_name}"]
        )
    
    def _filter_available_models(
        self,
        models: List[ModelConfig],
        test_case: Optional[TestCase]
    ) -> List[ModelConfig]:
        """过滤可用模型"""
        available = []
        
        for model in models:
            model_key = f"{model.provider}.{model.model_name}"
            
            if self.policy.circuit_breaker_enabled:
                cb = self._circuit_breakers.get(model_key)
                if cb and not cb.allow_request():
                    continue
            
            if self.policy.budget_tracking_enabled:
                bt = self._budget_trackers.get(model_key)
                if bt and not bt.can_spend():
                    continue
            
            rl = self._rate_limiters.get(model_key)
            if rl and not rl.can_acquire():
                continue
            
            available.append(model)
        
        return available
    
    def check_sensitive_tags(self, test_case: TestCase) -> bool:
        """检查敏感标签"""
        if not self._sensitive_filter:
            return False
        return self._sensitive_filter.is_blocked(test_case)
    
    def record_attempt_result(
        self,
        model_key: str,
        success: bool,
        cost: float = 0.0,
        tokens: int = 0
    ):
        """记录尝试结果"""
        if success:
            cb = self._circuit_breakers.get(model_key)
            if cb:
                cb.record_success()
        else:
            cb = self._circuit_breakers.get(model_key)
            if cb:
                cb.record_failure()
        
        if self.policy.budget_tracking_enabled:
            bt = self._budget_trackers.get(model_key)
            if bt and cost > 0:
                bt.record_spend(cost)
        
        rl = self._rate_limiters.get(model_key)
        if rl and tokens > 0:
            rl.acquire(tokens)
    
    def get_circuit_state(self, model_key: str) -> Optional[str]:
        """获取熔断器状态"""
        cb = self._circuit_breakers.get(model_key)
        if cb:
            return cb.get_state()
        return None
    
    def get_budget_usage(self, model_key: str) -> Dict[str, float]:
        """获取预算使用情况"""
        bt = self._budget_trackers.get(model_key)
        if bt:
            return bt.get_usage_percentage()
        return {}
    
    def should_retry(self, error_type: str, current_attempt: int, max_retries: int) -> bool:
        """判断是否应该重试"""
        if not self.policy.retry_enabled:
            return False
        
        if error_type not in self.policy.retry_on_errors:
            return False
        
        effective_max = self.policy.max_retries_override or max_retries
        return current_attempt < effective_max
