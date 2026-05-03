"""
模拟器：模拟 API 调用行为（延迟、失败、限流等）
"""

import random
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple
from uuid import uuid4

from .models import (
    ModelConfig,
    RouteAttempt,
    RouteResult,
    RouteStatus,
    TestCase,
)
from .strategy_engine import StrategyEngine


@dataclass
class SimulationConfig:
    """模拟配置"""
    base_latency_ms: int = 500
    latency_variance_ms: int = 300
    
    failure_rate: float = 0.05
    timeout_rate: float = 0.03
    rate_limit_rate: float = 0.02
    
    input_tokens_min: int = 100
    input_tokens_max: int = 2000
    output_tokens_min: int = 50
    output_tokens_max: int = 1000
    
    deterministic: bool = False
    seed: Optional[int] = None


@dataclass
class MockResponse:
    """模拟响应"""
    status: RouteStatus
    input_tokens: int
    output_tokens: int
    latency_ms: int
    error_message: Optional[str] = None


class ModelBehaviorSimulator:
    """模型行为模拟器"""
    
    def __init__(self, model_config: ModelConfig, sim_config: SimulationConfig):
        self.model_config = model_config
        self.sim_config = sim_config
        
        if sim_config.deterministic and sim_config.seed is not None:
            random.seed(sim_config.seed)
        
        self._request_count = 0
        self._consecutive_failures = 0
    
    def simulate_call(self, test_case: TestCase) -> MockResponse:
        """模拟一次 API 调用"""
        self._request_count += 1
        
        latency = self._generate_latency()
        
        input_tokens = random.randint(
            self.sim_config.input_tokens_min,
            self.sim_config.input_tokens_max
        )
        output_tokens = random.randint(
            self.sim_config.output_tokens_min,
            self.sim_config.output_tokens_max
        )
        
        roll = random.random()
        cumulative = 0.0
        
        if test_case.metadata.get("force_timeout"):
            return MockResponse(
                status=RouteStatus.TIMEOUT,
                input_tokens=input_tokens,
                output_tokens=0,
                latency_ms=latency,
                error_message="Request timed out"
            )
        
        if test_case.metadata.get("force_rate_limit"):
            return MockResponse(
                status=RouteStatus.RATE_LIMITED,
                input_tokens=input_tokens,
                output_tokens=0,
                latency_ms=latency // 10,
                error_message="Rate limit exceeded"
            )
        
        if test_case.metadata.get("force_failure"):
            return MockResponse(
                status=RouteStatus.FAILED,
                input_tokens=input_tokens,
                output_tokens=0,
                latency_ms=latency,
                error_message="Internal server error"
            )
        
        cumulative += self.sim_config.rate_limit_rate
        if roll < cumulative:
            return MockResponse(
                status=RouteStatus.RATE_LIMITED,
                input_tokens=input_tokens,
                output_tokens=0,
                latency_ms=latency // 10,
                error_message="Rate limit exceeded (429)"
            )
        
        cumulative += self.sim_config.timeout_rate
        if roll < cumulative:
            return MockResponse(
                status=RouteStatus.TIMEOUT,
                input_tokens=input_tokens,
                output_tokens=0,
                latency_ms=latency * 2,
                error_message=f"Request timed out after {self.model_config.timeout_ms}ms"
            )
        
        cumulative += self.sim_config.failure_rate
        if roll < cumulative:
            error_messages = [
                "Internal server error (500)",
                "Service unavailable (503)",
                "Bad gateway (502)",
                "Invalid response format"
            ]
            return MockResponse(
                status=RouteStatus.FAILED,
                input_tokens=input_tokens,
                output_tokens=0,
                latency_ms=latency,
                error_message=random.choice(error_messages)
            )
        
        self._consecutive_failures = 0
        return MockResponse(
            status=RouteStatus.SUCCESS,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency
        )
    
    def _generate_latency(self) -> int:
        """生成模拟延迟"""
        base = self.sim_config.base_latency_ms
        variance = self.sim_config.latency_variance_ms
        
        if self._consecutive_failures > 0:
            base *= (1 + self._consecutive_failures * 0.1)
        
        if random.random() < 0.1:
            base *= 3
        
        latency = int(random.gauss(base, variance / 3))
        return max(1, latency)


class Orchestrator:
    """路由编排器：协调策略引擎和模拟器"""
    
    def __init__(
        self,
        strategy_engine: StrategyEngine,
        sim_config: SimulationConfig,
        models: Dict[str, ModelConfig]
    ):
        self.strategy_engine = strategy_engine
        self.sim_config = sim_config
        self.models = models
        
        self._simulators: Dict[str, ModelBehaviorSimulator] = {}
        for model_key, model_config in models.items():
            self._simulators[model_key] = ModelBehaviorSimulator(
                model_config=model_config,
                sim_config=sim_config
            )
    
    def execute_test_case(
        self,
        test_case: TestCase,
        context: Dict[str, Any]
    ) -> RouteResult:
        """执行单个测试用例"""
        result_id = str(uuid4())
        attempts: List[RouteAttempt] = []
        total_input_tokens = 0
        total_output_tokens = 0
        total_cost = 0.0
        retry_count = 0
        degradation_triggered = False
        circuit_triggered = False
        budget_exceeded = False
        sensitive_blocked = False
        hit_reason: Optional[str] = None
        
        if self.strategy_engine.check_sensitive_tags(test_case):
            sensitive_blocked = True
            hit_reason = "sensitive_blocked"
            return RouteResult(
                id=result_id,
                test_case_id=test_case.id,
                policy_name=self.strategy_engine.policy.name,
                policy_version=self.strategy_engine.policy.version,
                final_model="blocked",
                final_status=RouteStatus.SENSITIVE_BLOCKED,
                final_latency_ms=0,
                total_input_tokens=0,
                total_output_tokens=0,
                total_cost=0.0,
                attempts=[],
                success=False,
                sensitive_blocked=True,
                hit_reason=hit_reason
            )
        
        current_model = self.strategy_engine.select_primary_model(test_case, context)
        if not current_model:
            hit_reason = "no_primary_available"
            return RouteResult(
                id=result_id,
                test_case_id=test_case.id,
                policy_name=self.strategy_engine.policy.name,
                policy_version=self.strategy_engine.policy.version,
                final_model="none_available",
                final_status=RouteStatus.FAILED,
                final_latency_ms=0,
                total_input_tokens=0,
                total_output_tokens=0,
                total_cost=0.0,
                attempts=[],
                success=False,
                hit_reason=hit_reason
            )
        
        excluded_models: List[str] = []
        attempt_number = 1
        
        while True:
            model_key = f"{current_model.provider}.{current_model.model_name}"
            
            cb_state = self.strategy_engine.get_circuit_state(model_key)
            if cb_state == "open":
                circuit_triggered = True
                hit_reason = f"circuit_open:{model_key}"
                
                if not degradation_triggered:
                    degradation_model = self.strategy_engine.select_degradation_model(current_model)
                    if degradation_model:
                        degradation_triggered = True
                        excluded_models.append(model_key)
                        current_model = degradation_model
                        continue
                
                fallback_model = self.strategy_engine.select_fallback_model(
                    test_case, excluded_models
                )
                if fallback_model:
                    excluded_models.append(model_key)
                    current_model = fallback_model
                    continue
                break
            
            budget_usage = self.strategy_engine.get_budget_usage(model_key)
            if budget_usage.get("daily", 0) >= 1.0 or budget_usage.get("monthly", 0) >= 1.0:
                budget_exceeded = True
                hit_reason = f"budget_exceeded:{model_key}"
                
                fallback_model = self.strategy_engine.select_fallback_model(
                    test_case, excluded_models
                )
                if fallback_model:
                    excluded_models.append(model_key)
                    current_model = fallback_model
                    continue
                break
            
            simulator = self._simulators[model_key]
            mock_response = simulator.simulate_call(test_case)
            
            cost = (
                (mock_response.input_tokens / 1000) * current_model.input_price_per_1k +
                (mock_response.output_tokens / 1000) * current_model.output_price_per_1k
            )
            
            total_input_tokens += mock_response.input_tokens
            total_output_tokens += mock_response.output_tokens
            total_cost += cost
            
            attempt = RouteAttempt(
                model_name=model_key,
                attempt_number=attempt_number,
                input_tokens=mock_response.input_tokens,
                output_tokens=mock_response.output_tokens,
                latency_ms=mock_response.latency_ms,
                status=mock_response.status,
                error_message=mock_response.error_message
            )
            attempts.append(attempt)
            
            if mock_response.status == RouteStatus.SUCCESS:
                self.strategy_engine.record_attempt_result(
                    model_key=model_key,
                    success=True,
                    cost=cost,
                    tokens=mock_response.input_tokens + mock_response.output_tokens
                )
                
                if degradation_triggered:
                    hit_reason = hit_reason or "degraded_success"
                elif circuit_triggered:
                    hit_reason = hit_reason or "circuit_recovered"
                else:
                    hit_reason = hit_reason or "primary_success"
                
                return RouteResult(
                    id=result_id,
                    test_case_id=test_case.id,
                    policy_name=self.strategy_engine.policy.name,
                    policy_version=self.strategy_engine.policy.version,
                    final_model=model_key,
                    final_status=RouteStatus.SUCCESS,
                    final_latency_ms=sum(a.latency_ms for a in attempts),
                    total_input_tokens=total_input_tokens,
                    total_output_tokens=total_output_tokens,
                    total_cost=total_cost,
                    attempts=attempts,
                    success=True,
                    degradation_triggered=degradation_triggered,
                    retry_count=retry_count,
                    circuit_triggered=circuit_triggered,
                    budget_exceeded=budget_exceeded,
                    sensitive_blocked=sensitive_blocked,
                    hit_reason=hit_reason
                )
            
            self.strategy_engine.record_attempt_result(
                model_key=model_key,
                success=False,
                cost=cost,
                tokens=mock_response.input_tokens
            )
            
            error_type = mock_response.status.value
            
            if self.strategy_engine.should_retry(
                error_type=error_type,
                current_attempt=attempt_number,
                max_retries=current_model.max_retries
            ):
                retry_count += 1
                attempt_number += 1
                hit_reason = hit_reason or f"retry_on_{error_type}"
                continue
            
            if degradation_triggered:
                hit_reason = hit_reason or "degraded_failure"
            else:
                hit_reason = hit_reason or f"failure:{error_type}"
            
            if not degradation_triggered and self.strategy_engine.policy.degradation_enabled:
                degradation_model = self.strategy_engine.select_degradation_model(current_model)
                if degradation_model:
                    degradation_triggered = True
                    excluded_models.append(model_key)
                    current_model = degradation_model
                    attempt_number += 1
                    continue
            
            fallback_model = self.strategy_engine.select_fallback_model(
                test_case, excluded_models
            )
            if fallback_model:
                excluded_models.append(model_key)
                current_model = fallback_model
                attempt_number += 1
                continue
            
            return RouteResult(
                id=result_id,
                test_case_id=test_case.id,
                policy_name=self.strategy_engine.policy.name,
                policy_version=self.strategy_engine.policy.version,
                final_model=model_key,
                final_status=mock_response.status,
                final_latency_ms=sum(a.latency_ms for a in attempts),
                total_input_tokens=total_input_tokens,
                total_output_tokens=total_output_tokens,
                total_cost=total_cost,
                attempts=attempts,
                success=False,
                degradation_triggered=degradation_triggered,
                retry_count=retry_count,
                circuit_triggered=circuit_triggered,
                budget_exceeded=budget_exceeded,
                sensitive_blocked=sensitive_blocked,
                hit_reason=hit_reason
            )
    
    def execute_batch(
        self,
        test_cases: List[TestCase],
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> Tuple[str, List[RouteResult]]:
        """批量执行测试用例"""
        run_id = str(uuid4())[:8]
        results: List[RouteResult] = []
        total = len(test_cases)
        
        for i, test_case in enumerate(test_cases):
            context = {"batch_index": i, "run_id": run_id}
            result = self.execute_test_case(test_case, context)
            results.append(result)
            
            if progress_callback:
                progress_callback(i + 1, total)
        
        return run_id, results
