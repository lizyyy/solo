import random
import time
import uuid
from datetime import datetime
from typing import Callable, Dict, Tuple

from .models import (
    ExecutionState, PrecheckRule, Service,
    StepExecution, StepStatus, SwitchStatus, SyncStatus, VerifyRule
)


class RuleEngine:
    def __init__(self, fail_on_verify_rule_id: str = None):
        self.fail_on_verify_rule_id = fail_on_verify_rule_id
        self._precheck_executors: Dict[str, Callable] = {
            "primary_health": self._check_primary_health,
            "secondary_health": self._check_secondary_health,
            "network_connectivity": self._check_network_connectivity,
            "database_replication": self._check_database_replication,
            "disk_space": self._check_disk_space,
            "service_config": self._check_service_config,
        }
        self._verify_executors: Dict[str, Callable] = {
            "endpoint_reachable": self._verify_endpoint_reachable,
            "database_writable": self._verify_database_writable,
            "traffic_redirected": self._verify_traffic_redirected,
            "data_consistency": self._verify_data_consistency,
            "service_logs_clean": self._verify_service_logs_clean,
        }

    def execute_precheck(
        self,
        state: ExecutionState,
        rule: PrecheckRule,
        service: Service = None,
    ) -> StepExecution:
        step_id = str(uuid.uuid4())[:8]
        step = StepExecution(
            id=step_id,
            name=rule.name,
            step_type="precheck",
            service_id=service.id if service else None,
            rule_id=rule.id,
            status=StepStatus.RUNNING,
            started_at=datetime.now(),
        )

        time.sleep(random.uniform(0.1, 0.5))

        executor = self._precheck_executors.get(rule.id.split("_")[0], self._default_check)
        success, message, details = executor(rule, service)

        step.completed_at = datetime.now()
        step.duration_seconds = (step.completed_at - step.started_at).total_seconds()

        if success:
            step.status = StepStatus.PASSED
        else:
            step.status = StepStatus.FAILED
            step.error_message = message
        step.details = details

        return step

    def execute_verify(
        self,
        state: ExecutionState,
        rule: VerifyRule,
        service: Service,
    ) -> StepExecution:
        step_id = str(uuid.uuid4())[:8]
        step = StepExecution(
            id=step_id,
            name=rule.name,
            step_type="verify",
            service_id=service.id,
            rule_id=rule.id,
            status=StepStatus.RUNNING,
            started_at=datetime.now(),
        )

        time.sleep(random.uniform(0.2, 0.8))

        if self.fail_on_verify_rule_id and rule.id == self.fail_on_verify_rule_id:
            success = False
            message = "模拟验证失败场景"
            details = {"error_type": "simulated_failure", "service": service.name}
        else:
            executor = self._verify_executors.get(rule.id.split("_")[0], self._default_check)
            success, message, details = executor(rule, service)

        step.completed_at = datetime.now()
        step.duration_seconds = (step.completed_at - step.started_at).total_seconds()

        if success:
            step.status = StepStatus.PASSED
        else:
            step.status = StepStatus.FAILED
            step.error_message = message
        step.details = details

        return step

    def execute_switch(self, state: ExecutionState, service: Service) -> StepExecution:
        step_id = str(uuid.uuid4())[:8]
        step = StepExecution(
            id=step_id,
            name=f"切换服务: {service.name}",
            step_type="switch",
            service_id=service.id,
            rule_id=None,
            status=StepStatus.RUNNING,
            started_at=datetime.now(),
        )

        time.sleep(random.uniform(0.5, 2.0))

        target_status = "secondary" if service.status == "primary" else "primary"
        service.status = target_status

        step.completed_at = datetime.now()
        step.duration_seconds = (step.completed_at - step.started_at).total_seconds()
        step.status = StepStatus.PASSED
        step.details = {
            "from_status": "secondary" if target_status == "primary" else "primary",
            "to_status": target_status,
            "endpoint": service.secondary_endpoint if target_status == "secondary" else service.primary_endpoint,
        }

        return step

    def check_sync_status(self, state: ExecutionState, service: Service) -> SyncStatus:
        time.sleep(random.uniform(0.1, 0.3))
        lag = random.uniform(0, 300)
        is_synced = lag < 60

        return SyncStatus(
            service_id=service.id,
            lag_seconds=round(lag, 2),
            is_synced=is_synced,
            last_sync_time=datetime.now(),
        )

    def _check_primary_health(self, rule, service) -> Tuple[bool, str, dict]:
        if service:
            return True, "主站健康检查通过", {"endpoint": service.primary_endpoint}
        return True, "全局主站健康检查通过", {}

    def _check_secondary_health(self, rule, service) -> Tuple[bool, str, dict]:
        if service:
            return True, "备站健康检查通过", {"endpoint": service.secondary_endpoint}
        return True, "全局备站健康检查通过", {}

    def _check_network_connectivity(self, rule, service) -> Tuple[bool, str, dict]:
        return True, "网络连接正常", {"latency_ms": round(random.uniform(1, 50), 2)}

    def _check_database_replication(self, rule, service) -> Tuple[bool, str, dict]:
        lag = random.uniform(0, 30)
        return True, "数据库复制正常", {"replication_lag_seconds": round(lag, 2)}

    def _check_disk_space(self, rule, service) -> Tuple[bool, str, dict]:
        used = random.uniform(30, 70)
        return True, "磁盘空间充足", {"usage_percent": round(used, 2)}

    def _check_service_config(self, rule, service) -> Tuple[bool, str, dict]:
        return True, "服务配置正确", {"version": "v2.5.1"}

    def _verify_endpoint_reachable(self, rule, service) -> Tuple[bool, str, dict]:
        endpoint = service.secondary_endpoint if service.status == "secondary" else service.primary_endpoint
        return True, "端点可访问", {"endpoint": endpoint, "response_time_ms": round(random.uniform(50, 200), 2)}

    def _verify_database_writable(self, rule, service) -> Tuple[bool, str, dict]:
        return True, "数据库可写入", {"write_test": "passed"}

    def _verify_traffic_redirected(self, rule, service) -> Tuple[bool, str, dict]:
        traffic_ratio = random.uniform(95, 100)
        return True, "流量已重定向", {"traffic_to_target_percent": round(traffic_ratio, 2)}

    def _verify_data_consistency(self, rule, service) -> Tuple[bool, str, dict]:
        return True, "数据一致性检查通过", {"records_checked": random.randint(1000, 5000)}

    def _verify_service_logs_clean(self, rule, service) -> Tuple[bool, str, dict]:
        return True, "服务日志无异常", {"error_count": 0, "warning_count": random.randint(0, 5)}

    def _default_check(self, rule, service) -> Tuple[bool, str, dict]:
        return True, "检查通过", {}
