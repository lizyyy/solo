import uuid
from datetime import datetime
from typing import List, Optional, Tuple, Dict
from collections import defaultdict

from .models import (
    TaskRetryRecord,
    TaskStatus,
    AutoJudgment,
    IdempotentIssue,
    DataSource,
    UnifiedView,
    TimelineItem,
    AlarmRecord,
    OldApiDoc,
    CallLog,
)
from .data_loader import DataLoader, UnifiedViewBuilder


class TaskScheduler:
    def __init__(self, data_loader: DataLoader):
        self.data_loader = data_loader
        self.view_builder = UnifiedViewBuilder(data_loader)

    def process_batch(
        self, batch_id: Optional[str] = None, force: bool = False
    ) -> List[TaskRetryRecord]:
        batch_id = batch_id or f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        views = self.view_builder.build_all_views()

        results: List[TaskRetryRecord] = []
        for view in views:
            task = self._process_view(view, batch_id, force)
            results.append(task)

        self.data_loader.save_task_records()
        return results

    def _process_view(
        self, view: UnifiedView, batch_id: str, force: bool
    ) -> TaskRetryRecord:
        existing_task = self._find_existing_task(view)

        if existing_task and not force:
            if existing_task.status == TaskStatus.SUCCESS:
                self._update_task_timestamp(existing_task)
                return existing_task
            if existing_task.status in [
                TaskStatus.CONFIRMED,
                TaskStatus.MANUALLY_MODIFIED,
            ]:
                self._update_task_timestamp(existing_task)
                return existing_task

        if existing_task:
            task = existing_task
            task.retry_count += 1
        else:
            task = self._create_new_task(view, batch_id)

        task.status = TaskStatus.PROCESSING
        task.last_attempt_at = datetime.now()
        task.updated_at = datetime.now()

        idempotent_issue = self._check_idempotent_key(view)
        if idempotent_issue:
            task.idempotent_issue = idempotent_issue
            task.status = TaskStatus.IDEMPOTENT_ISSUE
            task.last_error = f"幂等键问题: {idempotent_issue.description}"
            self._save_task(task)
            return task

        judgment = self._make_auto_judgment(view)
        task.auto_judgment = judgment

        if judgment.judgment_type == "can_retry":
            task.status = TaskStatus.SUCCESS
            task.last_error = None
        elif judgment.judgment_type == "needs_review":
            task.status = TaskStatus.NEEDS_MANUAL_REVIEW
            task.last_error = judgment.suggestion
        elif judgment.judgment_type == "awaiting_supplement":
            task.status = TaskStatus.AWAITING_SUPPLEMENT
            task.last_error = judgment.suggestion

        self._save_task(task)
        return task

    def _find_existing_task(self, view: UnifiedView) -> Optional[TaskRetryRecord]:
        if view.idempotent_key:
            for task in self.data_loader.task_records:
                if task.idempotent_key == view.idempotent_key:
                    return task

        for task in self.data_loader.task_records:
            if task.api_endpoint == view.api_endpoint:
                return task

        return None

    def _create_new_task(
        self, view: UnifiedView, batch_id: str
    ) -> TaskRetryRecord:
        now = datetime.now()
        task = TaskRetryRecord(
            task_id=f"task_{uuid.uuid4().hex[:8]}",
            batch_id=batch_id,
            idempotent_key=view.idempotent_key,
            api_endpoint=view.api_endpoint,
            status=TaskStatus.PENDING,
            created_at=now,
            updated_at=now,
            retry_count=0,
        )

        for item in view.timeline:
            if item.source == DataSource.ALARM_RECORD:
                task.related_alarm_ids.append(item.source_id)
            elif item.source == DataSource.OLD_API_DOC:
                task.related_api_doc_ids.append(item.source_id)
            elif item.source == DataSource.CALL_LOG:
                task.related_call_log_ids.append(item.source_id)

        self.data_loader.task_records.append(task)
        return task

    def _update_task_timestamp(self, task: TaskRetryRecord) -> None:
        task.updated_at = datetime.now()
        self._save_task(task)

    def _save_task(self, task: TaskRetryRecord) -> None:
        if task not in self.data_loader.task_records:
            self.data_loader.task_records.append(task)

    def _check_idempotent_key(self, view: UnifiedView) -> Optional[IdempotentIssue]:
        if not view.idempotent_key:
            source_info = self._determine_missing_key_source(view)
            return IdempotentIssue(
                idempotent_key="MISSING",
                source=source_info["source"],
                issue_type="missing_idempotent_key",
                description=f"缺少幂等键，来源: {source_info['source'].value}, "
                f"检测到 {source_info['count']} 条相关记录无幂等键",
                contact_person=source_info["contact"],
                next_step=source_info["next_step"],
            )

        sources = defaultdict(list)
        for item in view.timeline:
            if item.idempotent_key and item.idempotent_key != view.idempotent_key:
                sources[item.source].append(item.idempotent_key)

        if sources:
            main_source = max(sources.keys(), key=lambda k: len(sources[k]))
            return IdempotentIssue(
                idempotent_key=view.idempotent_key,
                source=main_source,
                issue_type="conflicting_idempotent_key",
                description=f"幂等键冲突，检测到不同来源的幂等键不一致: {dict(sources)}",
                contact_person=self._get_contact_for_source(main_source),
                next_step="请联系接口负责人核对幂等键定义，确认正确的幂等键后手动修正",
            )

        return None

    def _determine_missing_key_source(
        self, view: UnifiedView
    ) -> Dict:
        source_counts = defaultdict(int)
        for item in view.timeline:
            if not item.idempotent_key:
                source_counts[item.source] += 1

        if not source_counts:
            return {
                "source": DataSource.ALARM_RECORD,
                "count": 0,
                "contact": "系统管理员",
                "next_step": "请检查数据导入是否完整",
            }

        main_source = max(source_counts.keys(), key=lambda k: source_counts[k])

        contact_map = {
            DataSource.ALARM_RECORD: "监控系统负责人",
            DataSource.OLD_API_DOC: "接口文档维护人",
            DataSource.CALL_LOG: "日志系统管理员",
        }

        next_step_map = {
            DataSource.ALARM_RECORD: "请联系监控系统负责人补充报警记录中的幂等键",
            DataSource.OLD_API_DOC: "请联系接口文档维护人在旧接口文档中添加幂等键定义",
            DataSource.CALL_LOG: "请联系日志系统管理员检查日志采集配置，确保幂等键被记录",
        }

        return {
            "source": main_source,
            "count": source_counts[main_source],
            "contact": contact_map[main_source],
            "next_step": next_step_map[main_source],
        }

    def _get_contact_for_source(self, source: DataSource) -> str:
        contact_map = {
            DataSource.ALARM_RECORD: "监控系统负责人",
            DataSource.OLD_API_DOC: "接口文档维护人",
            DataSource.CALL_LOG: "日志系统管理员",
        }
        return contact_map.get(source, "系统管理员")

    def _make_auto_judgment(self, view: UnifiedView) -> AutoJudgment:
        failed_calls = [
            t
            for t in view.timeline
            if t.source == DataSource.CALL_LOG and not t.raw_data.get("success")
        ]
        success_calls = [
            t
            for t in view.timeline
            if t.source == DataSource.CALL_LOG and t.raw_data.get("success")
        ]
        alarms = [
            t for t in view.timeline if t.source == DataSource.ALARM_RECORD
        ]

        evidence: List[str] = []

        if success_calls and not failed_calls:
            evidence.append("所有调用日志均显示成功")
            if alarms:
                evidence.append("存在报警记录，但调用均成功，可能报警已恢复")
            return AutoJudgment(
                judgment_type="can_retry",
                reason="接口调用全部成功，无失败记录，可以安全重试",
                confidence=0.9,
                evidence=evidence,
                suggestion="标记为成功，可正常调度",
            )

        if failed_calls:
            last_failed = max(failed_calls, key=lambda x: x.timestamp)
            error_msg = last_failed.raw_data.get("error_message", "")

            evidence.append(f"检测到 {len(failed_calls)} 次失败调用")
            evidence.append(f"最近一次失败原因: {error_msg}")

            if "timeout" in error_msg.lower() or "超时" in error_msg:
                return AutoJudgment(
                    judgment_type="can_retry",
                    reason="失败原因为超时，重试通常可以解决",
                    confidence=0.7,
                    evidence=evidence,
                    suggestion="建议重试，超时问题通常可通过重试解决",
                )

            if "429" in error_msg or "rate limit" in error_msg.lower():
                return AutoJudgment(
                    judgment_type="can_retry",
                    reason="限流导致的失败，等待后重试可恢复",
                    confidence=0.8,
                    evidence=evidence,
                    suggestion="建议延迟后重试，限流问题通常会随时间恢复",
                )

            if "401" in error_msg or "403" in error_msg or "权限" in error_msg:
                evidence.append("权限问题需要人工介入处理")
                return AutoJudgment(
                    judgment_type="needs_review",
                    reason="权限问题导致失败，需要人工检查权限配置",
                    confidence=0.95,
                    evidence=evidence,
                    suggestion="需要人工审核：联系系统管理员检查接口权限配置",
                )

            if "500" in error_msg or "服务器错误" in error_msg:
                evidence.append("服务端错误需要确认服务状态")
                return AutoJudgment(
                    judgment_type="awaiting_supplement",
                    reason="服务端内部错误，需要确认服务可用性",
                    confidence=0.6,
                    evidence=evidence,
                    suggestion="待补充信息：联系服务端开发人员确认服务状态",
                )

            return AutoJudgment(
                judgment_type="needs_review",
                reason=f"未知错误类型: {error_msg}",
                confidence=0.5,
                evidence=evidence,
                suggestion="需要人工审核：请技术人员分析具体错误原因",
            )

        if alarms:
            evidence.append(f"存在 {len(alarms)} 条报警记录，但无对应调用日志")
            return AutoJudgment(
                judgment_type="awaiting_supplement",
                reason="只有报警记录，缺少调用日志无法判断具体问题",
                confidence=0.8,
                evidence=evidence,
                suggestion="待补充信息：请提供相关接口的调用日志",
            )

        return AutoJudgment(
            judgment_type="needs_review",
            reason="数据不完整，无法做出准确判断",
            confidence=0.3,
            evidence=evidence,
            suggestion="需要人工审核：请检查数据完整性",
        )

    def mark_confirmed(self, task_id: str, notes: str = "") -> None:
        task = self._get_task_by_id(task_id)
        if task:
            task.status = TaskStatus.CONFIRMED
            task.manual_notes = notes
            task.updated_at = datetime.now()
            self.data_loader.save_task_records()

    def mark_manually_modified(self, task_id: str, notes: str) -> None:
        task = self._get_task_by_id(task_id)
        if task:
            task.status = TaskStatus.MANUALLY_MODIFIED
            task.manual_notes = notes
            task.updated_at = datetime.now()
            self.data_loader.save_task_records()

    def _get_task_by_id(self, task_id: str) -> Optional[TaskRetryRecord]:
        for task in self.data_loader.task_records:
            if task.task_id == task_id:
                return task
        return None
