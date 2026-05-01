"""存储管理器"""

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Type

from ..models.config import ProjectConfig
from ..models.quarantine import QuarantineEntry, QuarantineStore, ReviewRecord
from ..models.violation import Violation, ViolationSummary


@dataclass
class StorageResult:
    """存储操作结果"""

    success: bool = True
    message: str = ""
    errors: List[str] = field(default_factory=list)
    data: Optional[Any] = None

    def add_error(self, error: str) -> None:
        """添加错误"""
        self.errors.append(error)
        self.success = False

    def has_errors(self) -> bool:
        """是否有错误"""
        return len(self.errors) > 0


class StorageManager:
    """存储管理器"""

    def __init__(
        self,
        project_config: ProjectConfig,
        auto_create_dirs: bool = True,
    ):
        """
        初始化存储管理器

        Args:
            project_config: 项目配置
            auto_create_dirs: 是否自动创建目录
        """
        self.config = project_config
        self.quarantine_file = project_config.quarantine_file
        self.review_file = project_config.review_file
        self.data_dir = project_config.data_dir
        self.output_dir = project_config.output_dir

        if auto_create_dirs:
            self._ensure_directories()

    def _ensure_directories(self) -> None:
        """确保必要的目录存在"""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # 确保父目录存在
        if self.quarantine_file.parent:
            self.quarantine_file.parent.mkdir(parents=True, exist_ok=True)
        if self.review_file.parent:
            self.review_file.parent.mkdir(parents=True, exist_ok=True)

    def load_quarantine_store(self) -> QuarantineStore:
        """
        加载隔离存储

        Returns:
            隔离存储对象（如果文件不存在则返回空对象）
        """
        if not self.quarantine_file.exists():
            return QuarantineStore(
                project_name=self.config.project_name,
                exercise_name=self.config.exercise_name,
            )

        try:
            import json

            with open(self.quarantine_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            # 反序列化
            return self._deserialize_quarantine_store(data)

        except Exception as e:
            # 加载失败，返回空对象
            return QuarantineStore(
                project_name=self.config.project_name,
                exercise_name=self.config.exercise_name,
            )

    def save_quarantine_store(self, store: QuarantineStore) -> StorageResult:
        """
        保存隔离存储

        Args:
            store: 隔离存储对象

        Returns:
            存储操作结果
        """
        result = StorageResult()

        try:
            import json

            # 序列化
            data = self._serialize_quarantine_store(store)

            with open(self.quarantine_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)

            result.message = f"隔离存储已保存到: {self.quarantine_file}"

        except Exception as e:
            result.add_error(f"保存隔离存储失败: {str(e)}")

        return result

    def _serialize_quarantine_store(self, store: QuarantineStore) -> Dict[str, Any]:
        """序列化隔离存储"""
        return {
            "store_name": store.store_name,
            "version": store.version,
            "created_at": store.created_at.isoformat() if store.created_at else None,
            "last_updated": store.last_updated.isoformat() if store.last_updated else None,
            "project_name": store.project_name,
            "exercise_name": store.exercise_name,
            "entries": [
                self._serialize_quarantine_entry(entry)
                for entry in store.entries
            ],
            "reviews": [
                self._serialize_review_record(review)
                for review in store.reviews
            ],
            "statistics": store.get_statistics(),
        }

    def _serialize_quarantine_entry(self, entry: QuarantineEntry) -> Dict[str, Any]:
        """序列化隔离条目"""
        return {
            "entry_id": entry.entry_id,
            "source_type": entry.source_type,
            "source_file": entry.source_file,
            "line_number": entry.line_number,
            "raw_data": entry.raw_data,
            "violations": [
                self._serialize_violation(v)
                for v in entry.violations
            ],
            "quarantine_reason": entry.quarantine_reason,
            "quarantined_at": entry.quarantined_at.isoformat() if entry.quarantined_at else None,
            "quarantine_note": entry.quarantine_note,
            "status": entry.status,
            "reviewed_by": entry.reviewed_by,
            "reviewed_at": entry.reviewed_at.isoformat() if entry.reviewed_at else None,
            "review_notes": entry.review_notes,
            "review_decision": entry.review_decision,
        }

    def _serialize_violation(self, violation: Violation) -> Dict[str, Any]:
        """序列化违规记录"""
        evidence = None
        if violation.evidence:
            evidence = {
                "field_name": violation.evidence.field_name,
                "expected_value": violation.evidence.expected_value,
                "actual_value": violation.evidence.actual_value,
                "context": violation.evidence.context,
                "related_entries": violation.evidence.related_entries,
            }

        return {
            "violation_id": violation.violation_id,
            "violation_type": violation.violation_type,
            "severity": violation.severity,
            "category": violation.category,
            "message": violation.message,
            "evidence": evidence,
            "source_file": violation.source_file,
            "line_number": violation.line_number,
            "entry_id": violation.entry_id,
            "call_sign": violation.call_sign,
            "channel_id": violation.channel_id,
            "date": violation.date,
            "time_start": violation.time_start,
            "time_end": violation.time_end,
            "detected_at": violation.detected_at.isoformat() if violation.detected_at else None,
            "status": violation.status,
            "reviewed_by": violation.reviewed_by,
            "reviewed_at": violation.reviewed_at.isoformat() if violation.reviewed_at else None,
            "review_notes": violation.review_notes,
            "review_decision": violation.review_decision,
        }

    def _serialize_review_record(self, review: ReviewRecord) -> Dict[str, Any]:
        """序列化复核记录"""
        return {
            "review_id": review.review_id,
            "entry_id": review.entry_id,
            "violation_id": review.violation_id,
            "reviewer": review.reviewer,
            "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
            "decision": review.decision,
            "notes": review.notes,
            "correction_applied": review.correction_applied,
            "correction_details": review.correction_details,
        }

    def _deserialize_quarantine_store(self, data: Dict[str, Any]) -> QuarantineStore:
        """反序列化隔离存储"""
        from dateutil.parser import parse as parse_date

        entries = []
        for entry_data in data.get("entries", []):
            entries.append(self._deserialize_quarantine_entry(entry_data))

        reviews = []
        for review_data in data.get("reviews", []):
            reviews.append(self._deserialize_review_record(review_data))

        return QuarantineStore(
            store_name=data.get("store_name", "频率排班守门员隔离存储"),
            version=data.get("version", "1.0"),
            created_at=parse_date(data["created_at"]) if data.get("created_at") else datetime.now(),
            last_updated=parse_date(data["last_updated"]) if data.get("last_updated") else datetime.now(),
            project_name=data.get("project_name"),
            exercise_name=data.get("exercise_name"),
            entries=entries,
            reviews=reviews,
        )

    def _deserialize_quarantine_entry(self, data: Dict[str, Any]) -> QuarantineEntry:
        """反序列化隔离条目"""
        from dateutil.parser import parse as parse_date

        violations = []
        for v_data in data.get("violations", []):
            violations.append(self._deserialize_violation(v_data))

        return QuarantineEntry(
            entry_id=data.get("entry_id", ""),
            source_type=data.get("source_type", "unknown"),
            source_file=data.get("source_file"),
            line_number=data.get("line_number"),
            raw_data=data.get("raw_data", {}),
            violations=violations,
            quarantine_reason=data.get("quarantine_reason", "数据验证失败"),
            quarantined_at=parse_date(data["quarantined_at"]) if data.get("quarantined_at") else datetime.now(),
            quarantine_note=data.get("quarantine_note"),
            status=data.get("status", "quarantined"),
            reviewed_by=data.get("reviewed_by"),
            reviewed_at=parse_date(data["reviewed_at"]) if data.get("reviewed_at") else None,
            review_notes=data.get("review_notes"),
            review_decision=data.get("review_decision"),
        )

    def _deserialize_violation(self, data: Dict[str, Any]) -> Violation:
        """反序列化违规记录"""
        from dateutil.parser import parse as parse_date

        from ..models.violation import ViolationEvidence, ViolationSeverity, ViolationType

        evidence = None
        if data.get("evidence"):
            e_data = data["evidence"]
            evidence = ViolationEvidence(
                field_name=e_data.get("field_name"),
                expected_value=e_data.get("expected_value"),
                actual_value=e_data.get("actual_value"),
                context=e_data.get("context"),
                related_entries=e_data.get("related_entries", []),
            )

        # 解析枚举类型
        violation_type = data.get("violation_type")
        if isinstance(violation_type, str):
            try:
                violation_type = ViolationType(violation_type)
            except ValueError:
                pass

        severity = data.get("severity")
        if isinstance(severity, str):
            try:
                severity = ViolationSeverity(severity)
            except ValueError:
                severity = ViolationSeverity.MEDIUM

        return Violation(
            violation_id=data.get("violation_id"),
            violation_type=violation_type,
            severity=severity,
            category=data.get("category"),
            message=data.get("message", ""),
            evidence=evidence,
            source_file=data.get("source_file"),
            line_number=data.get("line_number"),
            entry_id=data.get("entry_id"),
            call_sign=data.get("call_sign"),
            channel_id=data.get("channel_id"),
            date=data.get("date"),
            time_start=data.get("time_start"),
            time_end=data.get("time_end"),
            detected_at=parse_date(data["detected_at"]) if data.get("detected_at") else datetime.now(),
            status=data.get("status", "open"),
            reviewed_by=data.get("reviewed_by"),
            reviewed_at=parse_date(data["reviewed_at"]) if data.get("reviewed_at") else None,
            review_notes=data.get("review_notes"),
            review_decision=data.get("review_decision"),
        )

    def _deserialize_review_record(self, data: Dict[str, Any]) -> ReviewRecord:
        """反序列化复核记录"""
        from dateutil.parser import parse as parse_date

        return ReviewRecord(
            review_id=data.get("review_id", ""),
            entry_id=data.get("entry_id", ""),
            violation_id=data.get("violation_id"),
            reviewer=data.get("reviewer", ""),
            reviewed_at=parse_date(data["reviewed_at"]) if data.get("reviewed_at") else datetime.now(),
            decision=data.get("decision", "confirm"),
            notes=data.get("notes"),
            correction_applied=data.get("correction_applied", False),
            correction_details=data.get("correction_details"),
        )

    def add_quarantine_entry(self, entry: QuarantineEntry) -> StorageResult:
        """
        添加隔离条目

        Args:
            entry: 隔离条目

        Returns:
            存储操作结果
        """
        result = StorageResult()

        try:
            store = self.load_quarantine_store()
            store.add_entry(entry)
            save_result = self.save_quarantine_store(store)

            if save_result.success:
                result.message = f"隔离条目已添加: {entry.entry_id}"
            else:
                result.success = False
                result.errors = save_result.errors

        except Exception as e:
            result.add_error(f"添加隔离条目失败: {str(e)}")

        return result

    def add_violation_to_quarantine(
        self,
        violation: Violation,
        source_type: str,
        raw_data: Optional[Dict[str, Any]] = None,
        source_file: Optional[str] = None,
        line_number: Optional[int] = None,
    ) -> StorageResult:
        """
        将违规记录添加到隔离区

        Args:
            violation: 违规记录
            source_type: 来源类型
            raw_data: 原始数据
            source_file: 源文件
            line_number: 行号

        Returns:
            存储操作结果
        """
        entry = QuarantineEntry(
            source_type=source_type,
            source_file=source_file,
            line_number=line_number,
            raw_data=raw_data or {},
            violations=[violation],
            quarantine_reason=f"违规: {violation.message}",
        )

        return self.add_quarantine_entry(entry)

    def add_review(self, review: ReviewRecord) -> StorageResult:
        """
        添加复核记录

        Args:
            review: 复核记录

        Returns:
            存储操作结果
        """
        result = StorageResult()

        try:
            store = self.load_quarantine_store()
            store.add_review(review)

            # 更新相关隔离条目的状态
            entry = store.get_entry_by_id(review.entry_id)
            if entry:
                entry.status = "reviewed"
                entry.reviewed_by = review.reviewer
                entry.reviewed_at = review.reviewed_at
                entry.review_notes = review.notes
                entry.review_decision = review.decision

            save_result = self.save_quarantine_store(store)

            if save_result.success:
                result.message = f"复核记录已添加: {review.review_id}"
            else:
                result.success = False
                result.errors = save_result.errors

        except Exception as e:
            result.add_error(f"添加复核记录失败: {str(e)}")

        return result

    def get_quarantine_statistics(self) -> Dict[str, Any]:
        """
        获取隔离统计信息

        Returns:
            统计信息字典
        """
        store = self.load_quarantine_store()
        return store.get_statistics()

    def get_entries_by_status(self, status: str) -> List[QuarantineEntry]:
        """
        按状态获取隔离条目

        Args:
            status: 状态

        Returns:
            隔离条目列表
        """
        store = self.load_quarantine_store()
        return store.get_entries_by_status(status)

    def get_entries_by_source_type(self, source_type: str) -> List[QuarantineEntry]:
        """
        按来源类型获取隔离条目

        Args:
            source_type: 来源类型

        Returns:
            隔离条目列表
        """
        store = self.load_quarantine_store()
        return store.get_entries_by_source_type(source_type)

    def clear_quarantine(self) -> StorageResult:
        """
        清空隔离存储

        Returns:
            存储操作结果
        """
        result = StorageResult()

        try:
            if self.quarantine_file.exists():
                self.quarantine_file.unlink()

            result.message = "隔离存储已清空"

        except Exception as e:
            result.add_error(f"清空隔离存储失败: {str(e)}")

        return result
