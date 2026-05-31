import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from collections import defaultdict

from .models import (
    AlarmRecord,
    OldApiDoc,
    CallLog,
    TimelineItem,
    DataSource,
    UnifiedView,
    TaskStatus,
    TaskRetryRecord,
)


class DataLoader:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.alarm_records: List[AlarmRecord] = []
        self.old_api_docs: List[OldApiDoc] = []
        self.call_logs: List[CallLog] = []
        self.task_records: List[TaskRetryRecord] = []

    def load_all(self) -> None:
        self._load_alarm_records()
        self._load_old_api_docs()
        self._load_call_logs()
        self._load_task_records()

    def _load_alarm_records(self) -> None:
        file_path = self.data_dir / "alarm_records.json"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.alarm_records = [AlarmRecord(**item) for item in data]

    def _load_old_api_docs(self) -> None:
        file_path = self.data_dir / "old_api_docs.json"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.old_api_docs = [OldApiDoc(**item) for item in data]

    def _load_call_logs(self) -> None:
        file_path = self.data_dir / "call_logs.json"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.call_logs = [CallLog(**item) for item in data]

    def _load_task_records(self) -> None:
        file_path = self.data_dir / "task_records.json"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.task_records = [TaskRetryRecord(**item) for item in data]

    def save_task_records(self) -> None:
        file_path = self.data_dir / "task_records.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(
                [r.model_dump(mode="json") for r in self.task_records],
                f,
                ensure_ascii=False,
                indent=2,
            )


class TimelineBuilder:
    @staticmethod
    def build_timeline(
        alarms: List[AlarmRecord],
        api_docs: List[OldApiDoc],
        call_logs: List[CallLog],
        idempotent_key: Optional[str] = None,
        api_endpoint: Optional[str] = None,
    ) -> List[TimelineItem]:
        items: List[TimelineItem] = []

        for alarm in alarms:
            if idempotent_key and alarm.idempotent_key != idempotent_key:
                continue
            if api_endpoint and alarm.api_endpoint != api_endpoint:
                continue
            items.append(
                TimelineItem(
                    timestamp=alarm.alarm_time,
                    source=DataSource.ALARM_RECORD,
                    source_id=alarm.id,
                    title=f"[{alarm.alarm_level}] {alarm.api_endpoint or '未知接口'}",
                    content=alarm.alarm_content,
                    idempotent_key=alarm.idempotent_key,
                    api_endpoint=alarm.api_endpoint,
                    raw_data=alarm.model_dump(mode="json"),
                )
            )

        for doc in api_docs:
            if idempotent_key and doc.idempotent_key != idempotent_key:
                continue
            if api_endpoint and doc.api_endpoint != api_endpoint:
                continue
            items.append(
                TimelineItem(
                    timestamp=doc.deprecated_date,
                    source=DataSource.OLD_API_DOC,
                    source_id=doc.id,
                    title=f"旧接口文档: {doc.api_name}",
                    content=f"版本: {doc.version}, 负责人: {doc.owner}\n{doc.remarks or ''}",
                    idempotent_key=doc.idempotent_key,
                    api_endpoint=doc.api_endpoint,
                    raw_data=doc.model_dump(mode="json"),
                )
            )

        for log in call_logs:
            if idempotent_key and log.idempotent_key != idempotent_key:
                continue
            if api_endpoint and log.api_endpoint != api_endpoint:
                continue
            status_icon = "✅" if log.success else "❌"
            items.append(
                TimelineItem(
                    timestamp=log.call_time,
                    source=DataSource.CALL_LOG,
                    source_id=log.id,
                    title=f"{status_icon} {log.http_method} {log.api_endpoint}",
                    content=f"状态码: {log.response_status}, 耗时: {log.duration_ms}ms\n"
                    f"调用方: {log.caller_system}\n"
                    f"错误: {log.error_message or '无'}",
                    idempotent_key=log.idempotent_key,
                    api_endpoint=log.api_endpoint,
                    raw_data=log.model_dump(mode="json"),
                )
            )

        return sorted(items, key=lambda x: x.timestamp)


class UnifiedViewBuilder:
    def __init__(self, data_loader: DataLoader):
        self.data_loader = data_loader

    def build_by_idempotent_key(self, idempotent_key: str) -> Optional[UnifiedView]:
        timeline = TimelineBuilder.build_timeline(
            self.data_loader.alarm_records,
            self.data_loader.old_api_docs,
            self.data_loader.call_logs,
            idempotent_key=idempotent_key,
        )

        if not timeline:
            return None

        api_endpoint = timeline[0].api_endpoint or "未知接口"
        related_tasks = [
            t
            for t in self.data_loader.task_records
            if t.idempotent_key == idempotent_key
        ]

        latest_status = self._get_latest_status(related_tasks)

        return UnifiedView(
            idempotent_key=idempotent_key,
            api_endpoint=api_endpoint,
            timeline=timeline,
            latest_status=latest_status,
            task_records=related_tasks,
            summary=self._generate_summary(timeline, related_tasks),
        )

    def build_by_api_endpoint(self, api_endpoint: str) -> Optional[UnifiedView]:
        timeline = TimelineBuilder.build_timeline(
            self.data_loader.alarm_records,
            self.data_loader.old_api_docs,
            self.data_loader.call_logs,
            api_endpoint=api_endpoint,
        )

        if not timeline:
            return None

        idempotent_keys = set(
            t.idempotent_key for t in timeline if t.idempotent_key
        )
        related_tasks = [
            t
            for t in self.data_loader.task_records
            if t.api_endpoint == api_endpoint
        ]

        latest_status = self._get_latest_status(related_tasks)

        return UnifiedView(
            idempotent_key=next(iter(idempotent_keys), None),
            api_endpoint=api_endpoint,
            timeline=timeline,
            latest_status=latest_status,
            task_records=related_tasks,
            summary=self._generate_summary(timeline, related_tasks),
        )

    def build_all_views(self) -> List[UnifiedView]:
        views: List[UnifiedView] = []

        idempotent_keys = set()
        for alarm in self.data_loader.alarm_records:
            if alarm.idempotent_key:
                idempotent_keys.add(alarm.idempotent_key)
        for doc in self.data_loader.old_api_docs:
            if doc.idempotent_key:
                idempotent_keys.add(doc.idempotent_key)
        for log in self.data_loader.call_logs:
            if log.idempotent_key:
                idempotent_keys.add(log.idempotent_key)

        for key in idempotent_keys:
            view = self.build_by_idempotent_key(key)
            if view:
                views.append(view)

        api_endpoints = set()
        for alarm in self.data_loader.alarm_records:
            if alarm.api_endpoint:
                api_endpoints.add(alarm.api_endpoint)
        for doc in self.data_loader.old_api_docs:
            if doc.api_endpoint:
                api_endpoints.add(doc.api_endpoint)
        for log in self.data_loader.call_logs:
            if log.api_endpoint:
                api_endpoints.add(log.api_endpoint)

        covered_endpoints = set(v.api_endpoint for v in views)
        for endpoint in api_endpoints - covered_endpoints:
            view = self.build_by_api_endpoint(endpoint)
            if view:
                views.append(view)

        return views

    def _get_latest_status(self, tasks: List[TaskRetryRecord]) -> TaskStatus:
        if not tasks:
            return TaskStatus.PENDING
        latest = max(tasks, key=lambda t: t.updated_at)
        return latest.status

    def _generate_summary(
        self, timeline: List[TimelineItem], tasks: List[TaskRetryRecord]
    ) -> str:
        alarm_count = sum(
            1 for t in timeline if t.source == DataSource.ALARM_RECORD
        )
        call_count = sum(
            1 for t in timeline if t.source == DataSource.CALL_LOG
        )
        doc_count = sum(
            1 for t in timeline if t.source == DataSource.OLD_API_DOC
        )

        success_calls = sum(
            1
            for t in timeline
            if t.source == DataSource.CALL_LOG and t.raw_data.get("success")
        )
        failed_calls = call_count - success_calls

        latest_task = max(tasks, key=lambda t: t.updated_at) if tasks else None
        status_str = latest_task.status.value if latest_task else "未处理"

        return (
            f"报警 {alarm_count} 次 | "
            f"调用日志 {call_count} 条 (成功 {success_calls}, 失败 {failed_calls}) | "
            f"接口文档 {doc_count} 份 | "
            f"当前状态: {status_str}"
        )
