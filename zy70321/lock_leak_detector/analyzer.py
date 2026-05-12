import fnmatch
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from .models import (
    DataSource,
    LockSnapshot,
    LockPolicy,
    HeartbeatRecord,
    ExecutionLog,
    LockAnalysis,
    LockStatus,
    TaskStatus,
)


def format_duration(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds}秒"
    elif seconds < 3600:
        return f"{seconds // 60}分{seconds % 60}秒"
    elif seconds < 86400:
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        return f"{hours}时{minutes}分"
    else:
        days = seconds // 86400
        hours = (seconds % 86400) // 3600
        return f"{days}天{hours}时"


class LockAnalyzer:
    def __init__(self, data_source: DataSource, current_time: Optional[datetime] = None):
        self.data_source = data_source
        self.current_time = current_time or datetime.now()

    def find_policy_for_lock(self, lock_key: str) -> Optional[LockPolicy]:
        for policy in self.data_source.policies:
            if fnmatch.fnmatch(lock_key, policy.lock_key_pattern):
                return policy
        return None

    def get_heartbeats_for_holder(self, holder_id: str) -> List[HeartbeatRecord]:
        return [
            h for h in self.data_source.heartbeats
            if h.holder_id == holder_id
        ]

    def get_latest_heartbeat(self, holder_id: str) -> Optional[HeartbeatRecord]:
        heartbeats = self.get_heartbeats_for_holder(holder_id)
        if not heartbeats:
            return None
        return max(heartbeats, key=lambda h: h.timestamp)

    def get_execution_logs_for_lock(self, lock_key: str) -> List[ExecutionLog]:
        return [
            log for log in self.data_source.execution_logs
            if log.lock_key == lock_key
        ]

    def get_latest_execution_log(self, lock_key: str) -> Optional[ExecutionLog]:
        logs = self.get_execution_logs_for_lock(lock_key)
        if not logs:
            return None
        return max(logs, key=lambda l: l.timestamp)

    def analyze_lock(self, snapshot: LockSnapshot) -> LockAnalysis:
        policy = self.find_policy_for_lock(snapshot.lock_key)
        latest_heartbeat = self.get_latest_heartbeat(snapshot.holder_id)
        latest_log = self.get_latest_execution_log(snapshot.lock_key)

        age_seconds = int((self.current_time - snapshot.acquired_at).total_seconds())
        age_human = format_duration(age_seconds)

        reasons: List[str] = []
        recommendations: List[str] = []
        risk_level = 0

        if not policy:
            reasons.append("未找到匹配的锁策略配置")
            recommendations.append("检查 lock_policies.json 配置")
            risk_level = 2

        heartbeat_age: Optional[int] = None
        if latest_heartbeat:
            heartbeat_age = int((self.current_time - latest_heartbeat.timestamp).total_seconds())

        is_heartbeat_active = False
        if policy and heartbeat_age is not None:
            if heartbeat_age <= policy.heartbeat_timeout:
                is_heartbeat_active = True

        if policy and not latest_heartbeat:
            reasons.append("无心跳数据")
            risk_level = 3
        elif policy and heartbeat_age is not None:
            if heartbeat_age > policy.heartbeat_timeout:
                reasons.append(f"心跳超时: 最后心跳距现在 {format_duration(heartbeat_age)}，策略允许 {format_duration(policy.heartbeat_timeout)}")
                risk_level = 3
            elif heartbeat_age > policy.heartbeat_interval * 2:
                reasons.append(f"心跳延迟: 最后心跳距现在 {format_duration(heartbeat_age)}")
                risk_level = 1

        is_long_task = False
        if policy and age_seconds > policy.max_execution_time:
            if is_heartbeat_active:
                reasons.append(f"超预期长任务: 已持有 {age_human}，策略预期 {format_duration(policy.max_execution_time)}，但心跳活跃")
                is_long_task = True
                risk_level = max(risk_level, 1)
            else:
                reasons.append(f"疑似锁泄漏: 已持有 {age_human}，超过策略最大执行时间 {format_duration(policy.max_execution_time)}")
                risk_level = max(risk_level, 3)

        if self.current_time > snapshot.expire_at:
            reasons.append("锁已过期但仍存在")
            risk_level = 3

        task_status = self._infer_task_status(snapshot, latest_heartbeat, latest_log, policy)

        if is_long_task:
            status = LockStatus.NORMAL
        elif risk_level >= 3:
            status = LockStatus.LEAK
        elif risk_level >= 1:
            status = LockStatus.SUSPICIOUS
        else:
            status = LockStatus.NORMAL

        if status == LockStatus.LEAK:
            recommendations.append("建议执行 explain 命令了解详情后，确认无误再 release")
        elif status == LockStatus.SUSPICIOUS:
            recommendations.append("持续监控，关注心跳恢复情况")
        elif is_long_task:
            recommendations.append("确认是长任务后无需操作，监控任务正常完成")

        return LockAnalysis(
            lock_key=snapshot.lock_key,
            status=status,
            age_seconds=age_seconds,
            age_human=age_human,
            policy=policy,
            last_heartbeat=latest_heartbeat,
            last_execution_log=latest_log,
            risk_level=risk_level,
            reasons=reasons,
            recommendations=recommendations,
        )

    def analyze_all(self) -> List[LockAnalysis]:
        return [self.analyze_lock(s) for s in self.data_source.snapshots]

    def get_summary(self, analyses: List[LockAnalysis]) -> dict:
        counts = {
            LockStatus.NORMAL.value: 0,
            LockStatus.SUSPICIOUS.value: 0,
            LockStatus.LEAK.value: 0,
        }
        for a in analyses:
            counts[a.status.value] += 1
        return counts

    def _infer_task_status(
        self,
        snapshot: LockSnapshot,
        heartbeat: Optional[HeartbeatRecord],
        exec_log: Optional[ExecutionLog],
        policy: Optional[LockPolicy],
    ) -> TaskStatus:
        if exec_log:
            if exec_log.event == "task_completed":
                return TaskStatus.COMPLETED
            elif exec_log.event == "task_failed":
                return TaskStatus.FAILED
            elif exec_log.event == "task_started":
                if heartbeat and heartbeat.status == "alive":
                    return TaskStatus.RUNNING
        if heartbeat and heartbeat.status == "alive":
            return TaskStatus.RUNNING
        return TaskStatus.UNKNOWN
