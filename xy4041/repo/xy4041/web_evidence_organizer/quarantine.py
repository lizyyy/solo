#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
隔离区模块
管理有问题的证据文件，生成 quarantine.json
"""

import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .config import CaseConfig, EvidenceRecord, QuarantineItem, ValidationIssue


class QuarantineManager:
    """隔离区管理器"""

    def __init__(self, config: CaseConfig, quarantine_dir: str = None):
        self.config = config
        self.quarantine_dir = Path(quarantine_dir or config.quarantine_dir)
        self._items: List[QuarantineItem] = []

    def _generate_item_id(self) -> str:
        """生成隔离区项目ID"""
        return f"Q-{uuid.uuid4().hex[:8].upper()}"

    def add_to_quarantine(
        self,
        issue: ValidationIssue,
        evidence_record: EvidenceRecord = None,
    ) -> QuarantineItem:
        """
        将有问题的证据添加到隔离区

        Args:
            issue: 校验问题
            evidence_record: 证据记录（可选）

        Returns:
            隔离区项目
        """
        item_id = self._generate_item_id()

        original_record = None
        if evidence_record:
            original_record = evidence_record.model_dump(mode="json")

        item = QuarantineItem(
            item_id=item_id,
            evidence_id=issue.evidence_id,
            file_path=issue.file_path or "",
            quarantine_reason=issue.description,
            quarantine_at=datetime.now(),
            severity=issue.severity,
            details={
                "issue_id": issue.issue_id,
                "issue_type": issue.issue_type,
                "suggested_action": issue.suggested_action,
                "issue_details": issue.details,
            },
            original_evidence_record=original_record,
        )

        self._items.append(item)

        if issue.file_path and evidence_record:
            self._move_to_quarantine(evidence_record, item)

        return item

    def _move_to_quarantine(
        self,
        evidence_record: EvidenceRecord,
        quarantine_item: QuarantineItem,
    ) -> bool:
        """
        将文件移动到隔离区

        Args:
            evidence_record: 证据记录
            quarantine_item: 隔离区项目

        Returns:
            是否成功
        """
        try:
            source = Path(evidence_record.file_path)
            if not source.exists():
                return False

            self.quarantine_dir.mkdir(parents=True, exist_ok=True)

            dest_filename = f"{quarantine_item.item_id}_{source.name}"
            dest = self.quarantine_dir / dest_filename

            shutil.move(str(source), str(dest))

            quarantine_item.file_path = str(dest.absolute())
            quarantine_item.details["original_file_path"] = evidence_record.file_path
            quarantine_item.details["quarantined_filename"] = dest_filename

            return True

        except Exception:
            return False

    def add_issues_to_quarantine(
        self,
        issues: List[ValidationIssue],
        evidence_records: List[EvidenceRecord] = None,
    ) -> List[QuarantineItem]:
        """
        批量添加问题到隔离区

        Args:
            issues: 问题列表
            evidence_records: 证据记录列表（可选，用于匹配）

        Returns:
            隔离区项目列表
        """
        evidence_map = {}
        if evidence_records:
            for record in evidence_records:
                evidence_map[record.evidence_id] = record
                evidence_map[record.file_path] = record

        quarantined_items = []

        for issue in issues:
            evidence_record = None
            if issue.evidence_id and issue.evidence_id in evidence_map:
                evidence_record = evidence_map[issue.evidence_id]
            elif issue.file_path and issue.file_path in evidence_map:
                evidence_record = evidence_map[issue.file_path]

            item = self.add_to_quarantine(issue, evidence_record)
            quarantined_items.append(item)

        return quarantined_items

    def get_quarantined_items(self) -> List[QuarantineItem]:
        """
        获取所有隔离区项目

        Returns:
            隔离区项目列表
        """
        return self._items.copy()

    def save_quarantine_json(self, output_path: str = None) -> None:
        """
        保存隔离区信息到 JSON 文件

        Args:
            output_path: 输出文件路径（可选）
        """
        if output_path is None:
            output_path = str(self.quarantine_dir / "quarantine.json")

        data = {
            "generated_at": datetime.now().isoformat(),
            "quarantine_dir": str(self.quarantine_dir.absolute()),
            "total_items": len(self._items),
            "severity_summary": self._get_severity_summary(),
            "items": [
                item.model_dump(mode="json")
                for item in self._items
            ],
        }

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def load_quarantine_json(self, input_path: str) -> List[QuarantineItem]:
        """
        从 JSON 文件加载隔离区信息

        Args:
            input_path: 输入文件路径

        Returns:
            隔离区项目列表
        """
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        items = []
        for item_data in data.get("items", []):
            item = QuarantineItem.model_validate(item_data)
            items.append(item)
            self._items.append(item)

        return items

    def _get_severity_summary(self) -> Dict[str, int]:
        """获取严重程度统计"""
        summary = {}
        for item in self._items:
            severity = item.severity
            summary[severity] = summary.get(severity, 0) + 1
        return summary

    def get_summary(self) -> Dict:
        """
        获取隔离区摘要

        Returns:
            摘要信息字典
        """
        type_counts = {}
        for item in self._items:
            issue_type = item.details.get("issue_type", "unknown")
            type_counts[issue_type] = type_counts.get(issue_type, 0) + 1

        return {
            "total_items": len(self._items),
            "severity_distribution": self._get_severity_summary(),
            "issue_type_distribution": type_counts,
            "quarantine_dir": str(self.quarantine_dir.absolute()),
        }

    def restore_item(
        self,
        item_id: str,
        target_path: str = None,
    ) -> bool:
        """
        恢复隔离区项目

        Args:
            item_id: 项目ID
            target_path: 目标路径（可选，默认恢复到原始位置）

        Returns:
            是否成功
        """
        item = None
        for i in self._items:
            if i.item_id == item_id:
                item = i
                break

        if not item:
            return False

        try:
            source = Path(item.file_path)
            if not source.exists():
                return False

            if target_path is None:
                target_path = item.details.get("original_file_path")

            if target_path:
                dest = Path(target_path)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(source), str(dest))
                return True

            return False

        except Exception:
            return False

    def remove_item(self, item_id: str, delete_file: bool = False) -> bool:
        """
        移除隔离区项目

        Args:
            item_id: 项目ID
            delete_file: 是否同时删除文件

        Returns:
            是否成功
        """
        item_index = None
        item = None

        for idx, i in enumerate(self._items):
            if i.item_id == item_id:
                item_index = idx
                item = i
                break

        if item_index is None:
            return False

        if delete_file and item:
            try:
                file_path = Path(item.file_path)
                if file_path.exists():
                    file_path.unlink()
            except Exception:
                pass

        del self._items[item_index]
        return True

    def clear(self, delete_files: bool = False) -> int:
        """
        清空隔离区

        Args:
            delete_files: 是否同时删除文件

        Returns:
            清除的项目数量
        """
        count = len(self._items)

        if delete_files:
            for item in self._items:
                try:
                    file_path = Path(item.file_path)
                    if file_path.exists():
                        file_path.unlink()
                except Exception:
                    pass

        self._items.clear()
        return count
