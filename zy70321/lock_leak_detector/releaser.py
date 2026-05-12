import hashlib
from datetime import datetime
from typing import List, Dict, Tuple, Optional

from .models import (
    DataSource,
    LockSnapshot,
    ReleaseResult,
    ReleaseRecord,
    AbnormalReport,
)
from .analyzer import LockAnalyzer, format_duration


class ReleaseChecker:
    def __init__(
        self,
        data_source: DataSource,
        analyzer: LockAnalyzer,
        current_time: Optional[datetime] = None,
    ):
        self.data_source = data_source
        self.analyzer = analyzer
        self.current_time = current_time or datetime.now()

    def find_snapshot(self, lock_key: str) -> Optional[LockSnapshot]:
        for s in self.data_source.snapshots:
            if s.lock_key == lock_key:
                return s
        return None

    def get_previous_release(self, lock_key: str) -> Optional[ReleaseRecord]:
        for r in self.data_source.release_history:
            if r.lock_key == lock_key:
                return r
        return None

    def generate_confirmation_code(self, lock_key: str, holder_id: str) -> str:
        timestamp = self.current_time.strftime("%Y%m%d%H%M")
        data = f"{lock_key}:{holder_id}:{timestamp}"
        return hashlib.md5(data.encode()).hexdigest()[:8].upper()

    def run_release_checks(self, snapshot: LockSnapshot) -> Tuple[List[Dict], bool]:
        checks: List[Dict] = []
        can_release = True

        analysis = self.analyzer.analyze_lock(snapshot)
        policy = analysis.policy

        check_holder_heartbeat = self._check_holder_heartbeat(snapshot, policy)
        checks.append(check_holder_heartbeat)
        if not check_holder_heartbeat["passed"] and check_holder_heartbeat.get("blocking", False):
            can_release = False

        check_lock_age = self._check_lock_age(snapshot, policy)
        checks.append(check_lock_age)

        check_task_status = self._check_task_status(snapshot, policy)
        checks.append(check_task_status)

        check_policy_match = self._check_policy_match(snapshot, policy)
        checks.append(check_policy_match)

        check_lock_expired = self._check_lock_expired(snapshot)
        checks.append(check_lock_expired)

        return checks, can_release

    def _check_holder_heartbeat(self, snapshot: LockSnapshot, policy) -> Dict:
        latest_heartbeat = self.analyzer.get_latest_heartbeat(snapshot.holder_id)

        if not latest_heartbeat:
            return {
                "name": "持有者心跳检查",
                "passed": False,
                "blocking": False,
                "message": "无心跳数据",
                "details": f"holder_id={snapshot.holder_id}",
                "note": "建议先排查为什么没有心跳数据，可能是上报问题或进程已崩溃",
            }

        heartbeat_age = int((self.current_time - latest_heartbeat.timestamp).total_seconds())

        if policy and heartbeat_age <= policy.heartbeat_timeout:
            return {
                "name": "持有者心跳检查",
                "passed": False,
                "blocking": True,
                "message": f"心跳活跃（{format_duration(heartbeat_age)} 前），持有者可能仍在运行",
                "details": f"最后心跳时间={latest_heartbeat.timestamp}, status={latest_heartbeat.status}",
                "note": "⚠️ 高风险！释放正在运行的任务可能导致数据不一致",
            }

        if policy and heartbeat_age > policy.heartbeat_timeout:
            return {
                "name": "持有者心跳检查",
                "passed": True,
                "message": f"心跳已超时（{format_duration(heartbeat_age)} 前），策略超时时间={format_duration(policy.heartbeat_timeout)}",
                "details": f"最后心跳时间={latest_heartbeat.timestamp}, status={latest_heartbeat.status}",
            }

        return {
            "name": "持有者心跳检查",
            "passed": True,
            "message": f"最后心跳在 {format_duration(heartbeat_age)} 前，无策略配置",
            "details": f"最后心跳时间={latest_heartbeat.timestamp}, status={latest_heartbeat.status}",
        }

    def _check_lock_age(self, snapshot: LockSnapshot, policy) -> Dict:
        age_seconds = int((self.current_time - snapshot.acquired_at).total_seconds())

        if policy:
            if age_seconds > policy.max_execution_time:
                return {
                    "name": "锁持有时间检查",
                    "passed": True,
                    "message": f"持有时间 {format_duration(age_seconds)}，已超过策略上限 {format_duration(policy.max_execution_time)}",
                    "details": f"策略 task={policy.task_name}",
                }
            else:
                remaining = policy.max_execution_time - age_seconds
                return {
                    "name": "锁持有时间检查",
                    "passed": False,
                    "message": f"持有时间 {format_duration(age_seconds)}，仍在策略允许范围内（剩余 {format_duration(remaining)}）",
                    "details": f"策略 task={policy.task_name}, 最大执行时间={format_duration(policy.max_execution_time)}",
                    "note": "建议等待任务自然结束，除非确认任务已崩溃",
                }

        return {
            "name": "锁持有时间检查",
            "passed": True,
            "message": f"持有时间 {format_duration(age_seconds)}，无策略配置",
            "details": "建议配置 lock_policies.json",
        }

    def _check_task_status(self, snapshot: LockSnapshot, policy) -> Dict:
        latest_log = self.analyzer.get_latest_execution_log(snapshot.lock_key)

        if not latest_log:
            return {
                "name": "任务状态检查",
                "passed": True,
                "message": "无执行日志",
                "details": "无法确认任务状态，需结合其他检查项判断",
            }

        if latest_log.event == "task_completed":
            return {
                "name": "任务状态检查",
                "passed": True,
                "message": "任务已完成但锁未释放",
                "details": f"完成时间={latest_log.timestamp}",
            }

        if latest_log.event == "task_failed":
            return {
                "name": "任务状态检查",
                "passed": True,
                "message": "任务执行失败但锁未释放",
                "details": f"失败时间={latest_log.timestamp}, error={latest_log.details.get('error', 'unknown')}",
            }

        if latest_log.event == "task_started":
            return {
                "name": "任务状态检查",
                "passed": False,
                "message": "任务标记为正在执行中",
                "details": f"启动时间={latest_log.timestamp}",
                "note": "请结合心跳检查判断任务是否真的还在运行",
            }

        return {
            "name": "任务状态检查",
            "passed": True,
            "message": f"事件={latest_log.event}",
            "details": f"时间={latest_log.timestamp}",
        }

    def _check_policy_match(self, snapshot: LockSnapshot, policy) -> Dict:
        if not policy:
            return {
                "name": "锁策略匹配检查",
                "passed": False,
                "blocking": False,
                "message": "未找到匹配的锁策略配置",
                "details": f"lock_key={snapshot.lock_key}",
                "note": "建议在 lock_policies.json 中配置对应任务的策略",
            }

        if policy.allowed_holders and snapshot.holder_id not in policy.allowed_holders:
            return {
                "name": "锁策略匹配检查",
                "passed": True,
                "message": f"持有者 {snapshot.holder_id} 不在策略允许的持有者列表中",
                "details": f"允许的持有者={policy.allowed_holders}",
            }

        return {
            "name": "锁策略匹配检查",
            "passed": True,
            "message": f"匹配策略: {policy.task_name}",
            "details": f"pattern={policy.lock_key_pattern}",
        }

    def _check_lock_expired(self, snapshot: LockSnapshot) -> Dict:
        is_expired = self.current_time > snapshot.expire_at
        if is_expired:
            return {
                "name": "锁过期时间检查",
                "passed": True,
                "message": f"锁已过期（过期时间={snapshot.expire_at}）",
                "details": "正常情况下已过期的锁应被自动清理",
            }
        else:
            remaining = int((snapshot.expire_at - self.current_time).total_seconds())
            return {
                "name": "锁过期时间检查",
                "passed": True,
                "message": f"锁未过期，剩余 {format_duration(remaining)}",
                "details": f"过期时间={snapshot.expire_at}",
            }
