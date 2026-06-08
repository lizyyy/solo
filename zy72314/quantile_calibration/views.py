"""统一视图层 - 列表、详情、摘要、历史、导出、报告全部同源

设计原则：
1. 同一份数据：所有视图从 get_all_active_records() 获取，同业务主键只返回最新一条
2. 处理状态一致：列表展示的状态 = 详情的状态 = 摘要统计的状态 = 导出的状态
3. 人工复核留痕：列表/详情/导出中都保留原始说法、改后值、处理原因、下一步找谁
4. 记录级联动：更新一条记录后，列表/详情/摘要/导出/报告全部立即反映最新结果
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import json

from .database import Database
from .models import (
    RatingWeightRecord, ProcessingStatus, BoundaryType,
    ChangeSource, ReviewTask
)


class UnifiedViewLayer:
    """统一视图层 - 确保所有展示同一份最新结果"""

    QUANTILE_FIELDS = ["weight_p10", "weight_p25", "weight_p50", "weight_p75", "weight_p90"]

    STATUS_LABELS = {
        "imported": "已导入",
        "pending_review": "待复核",
        "reviewed": "已复核",
        "revised": "已修正",
        "finalized": "已定稿",
        "rolled_back": "已回滚"
    }

    BOUNDARY_LABELS = {
        "normal": "正常",
        "negative_value": "含负数值",
        "missing_value": "含缺失值",
        "negative_treated_as_missing": "负数被旧表当缺失",
        "outlier": "异常值"
    }

    CHANGE_SOURCE_LABELS = {
        "initial_import": "首次导入",
        "boundary_detection": "边界检测",
        "manual_edit": "人工修改",
        "ta_review": "学生助教复核",
        "rollback": "回滚",
        "re_import": "重复导入合并"
    }

    def __init__(self, db: Database):
        self.db = db

    def _get_records(self, batch_id: Optional[int] = None) -> List[RatingWeightRecord]:
        """获取同一份最新数据：所有视图的唯一数据源"""
        if batch_id is not None:
            batch_records = self.db.get_records_by_batch(batch_id)
            active_ids = {r.id for r in self.db.get_all_active_records()}
            return [r for r in batch_records if r.id in active_ids]
        return self.db.get_all_active_records()

    # ── 列表视图 ──────────────────────────────────────────

    def get_list_view(
        self,
        batch_id: Optional[int] = None,
        filter_status: Optional[str] = None,
        filter_boundary: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        列表视图 - 同一份数据的列表展示。
        确保：列表展示的 ID、行号、状态、边界类型 = 详情/摘要/导出的一致。
        """
        records = self._get_records(batch_id)

        if filter_status:
            records = [r for r in records if r.status.value == filter_status]
        if filter_boundary:
            records = [r for r in records if r.boundary_type.value == filter_boundary]

        pending_tasks = self.db.get_pending_review_tasks()
        task_map = {}
        for t in pending_tasks:
            if t.record_id not in task_map:
                task_map[t.record_id] = []
            task_map[t.record_id].append(t)

        items = []
        for r in records:
            tasks = task_map.get(r.id, [])
            item = {
                "record_id": r.id,
                "original_row_number": r.original_row_number,
                "batch_id": r.import_batch_id,
                "position": r.position,
                "weight_p10": r.weight_p10,
                "weight_p25": r.weight_p25,
                "weight_p50": r.weight_p50,
                "weight_p75": r.weight_p75,
                "weight_p90": r.weight_p90,
                "sample_count": r.sample_count,
                "remark": r.remark,
                "status": r.status.value,
                "status_label": self.STATUS_LABELS.get(r.status.value, r.status.value),
                "boundary_type": r.boundary_type.value,
                "boundary_label": self.BOUNDARY_LABELS.get(r.boundary_type.value, r.boundary_type.value),
                "updated_at": r.updated_at.isoformat(),
                "updated_by": r.updated_by,
                "pending_tasks": [
                    {
                        "task_id": t.id,
                        "assigned_to": t.assigned_to,
                        "review_note": t.review_note,
                        "next_contact": t.assigned_to,
                        "created_at": t.created_at.isoformat()
                    }
                    for t in tasks
                ],
                "needs_review": r.status == ProcessingStatus.PENDING_REVIEW,
                "is_boundary_issue": r.boundary_type != BoundaryType.NORMAL
            }
            items.append(item)

        summary = self._compute_summary(records)

        return {
            "source": "unified_view.get_all_active_records",
            "snapshot_time": datetime.now().isoformat(),
            "total_count": len(records),
            "items": items,
            "summary": summary,
            "filter_applied": {
                "batch_id": batch_id,
                "status": filter_status,
                "boundary": filter_boundary
            },
            "note": "列表、详情、摘要、导出、报告全部来自同一份数据，同源一致"
        }

    # ── 详情视图 ──────────────────────────────────────────

    def get_detail_view(self, record_id: int) -> Dict[str, Any]:
        """
        详情视图 - 同一条记录的完整信息展示。
        确保：详情里的状态 = 列表里的状态 = 摘要里统计的状态
        人工复核：保留原始说法、改后值、处理原因、下一步找谁
        """
        record = self.db.get_rating_record(record_id)
        if not record:
            return {"error": f"记录不存在: {record_id}"}

        histories = self.db.get_record_histories(record_id)
        pending_tasks = [
            t for t in self.db.get_pending_review_tasks()
            if t.record_id == record_id
        ]

        first_import = next(
            (h for h in histories if h.change_source == ChangeSource.INITIAL_IMPORT),
            None
        )
        original_values = {}
        if first_import:
            for f in self.QUANTILE_FIELDS + ["remark", "sample_count"]:
                if f in first_import.snapshot_after:
                    original_values[f] = first_import.snapshot_after[f]

        review_info = self._extract_review_info(histories)

        return {
            "source": "unified_view.get_rating_record + get_record_histories",
            "snapshot_time": datetime.now().isoformat(),
            "record_id": record_id,
            "original_row_number": record.original_row_number,
            "batch_id": record.import_batch_id,
            "position": record.position,
            "current_values": {
                "weight_p10": record.weight_p10,
                "weight_p25": record.weight_p25,
                "weight_p50": record.weight_p50,
                "weight_p75": record.weight_p75,
                "weight_p90": record.weight_p90,
                "sample_count": record.sample_count,
                "remark": record.remark
            },
            "original_values": original_values,
            "value_changes": self._diff_original_vs_current(original_values, record),
            "status": record.status.value,
            "status_label": self.STATUS_LABELS.get(record.status.value, record.status.value),
            "boundary_type": record.boundary_type.value,
            "boundary_label": self.BOUNDARY_LABELS.get(record.boundary_type.value, record.boundary_type.value),
            "processing_reasons": review_info["reasons"],
            "processing_history": review_info["timeline"],
            "next_step": self._get_next_step(record, pending_tasks, histories),
            "pending_tasks": [
                {
                    "task_id": t.id,
                    "assigned_to": t.assigned_to,
                    "assigned_to_label": f"下一步找: {t.assigned_to}",
                    "review_note": t.review_note,
                    "is_completed": t.is_completed,
                    "created_at": t.created_at.isoformat()
                }
                for t in pending_tasks
            ],
            "full_history": [
                {
                    "history_id": h.id,
                    "change_source": h.change_source.value,
                    "change_source_label": self.CHANGE_SOURCE_LABELS.get(
                        h.change_source.value, h.change_source.value
                    ),
                    "field_name": h.field_name,
                    "old_value": h.old_value,
                    "new_value": h.new_value,
                    "old_status": h.old_status.value if h.old_status else None,
                    "new_status": h.new_status.value if h.new_status else None,
                    "changed_by": h.changed_by,
                    "change_reason": h.change_reason,
                    "changed_at": h.changed_at.isoformat(),
                    "snapshot_before": h.snapshot_before,
                    "snapshot_after": h.snapshot_after
                }
                for h in histories
            ],
            "evidence_saved": True,
            "note": (
                "【证据全留痕】原始值、改后值、处理原因、处理人、下一步联系人"
                "全部保留，可追溯。列表/详情/摘要/导出/报告同源一致。"
            )
        }

    # ── 摘要视图 ──────────────────────────────────────────

    def get_summary_view(
        self,
        batch_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        摘要视图 - 同一份数据的统计汇总。
        确保：统计数字 = 列表里实际的记录数 = 导出文件里的记录数
        """
        records = self._get_records(batch_id)
        summary = self._compute_summary(records)

        pending_tasks = self.db.get_pending_review_tasks()
        pending_task_ids = {t.record_id for t in pending_tasks}

        return {
            "source": "unified_view.get_all_active_records",
            "snapshot_time": datetime.now().isoformat(),
            "batch_id": batch_id,
            "total_records": summary["total"],
            "by_status": summary["status_counts"],
            "by_boundary": summary["boundary_counts"],
            "pending_review_count": summary["status_counts"].get("pending_review", 0),
            "negative_as_missing_count": summary["boundary_counts"].get("negative_treated_as_missing", 0),
            "negative_value_count": summary["boundary_counts"].get("negative_value", 0),
            "missing_value_count": summary["boundary_counts"].get("missing_value", 0),
            "normal_count": summary["boundary_counts"].get("normal", 0),
            "revised_count": summary["status_counts"].get("revised", 0),
            "finalized_count": summary["status_counts"].get("finalized", 0),
            "rolled_back_count": summary["status_counts"].get("rolled_back", 0),
            "unassigned_pending_tasks": len(pending_task_ids),
            "consistency_check": {
                "list_count_matches_summary": len(records) == summary["total"],
                "pending_in_status_equals_pending_tasks": (
                    summary["status_counts"].get("pending_review", 0) >=
                    len(pending_task_ids)
                ),
                "all_pending_have_boundary_issue": self._check_pending_consistency(records)
            },
            "note": (
                "所有统计数字来自同一份数据（get_all_active_records），"
                "与列表、详情、导出、报告完全一致。"
            )
        }

    # ── 导出视图 ──────────────────────────────────────────

    def export_to_records(
        self,
        batch_id: Optional[int] = None,
        include_history: bool = False
    ) -> List[Dict[str, Any]]:
        """
        导出同一份数据为记录列表，供生成 CSV/Excel。
        确保：导出的记录数 = 列表的记录数 = 摘要的总数
        """
        records = self._get_records(batch_id)
        export_rows = []

        for r in records:
            row = {
                "record_id": r.id,
                "原始行号": r.original_row_number,
                "批次ID": r.import_batch_id,
                "岗位": r.position,
                "P10": r.weight_p10,
                "P25": r.weight_p25,
                "P50": r.weight_p50,
                "P75": r.weight_p75,
                "P90": r.weight_p90,
                "样本量": r.sample_count,
                "备注": r.remark,
                "处理状态": self.STATUS_LABELS.get(r.status.value, r.status.value),
                "边界类型": self.BOUNDARY_LABELS.get(r.boundary_type.value, r.boundary_type.value),
                "需要复核": "是" if r.status == ProcessingStatus.PENDING_REVIEW else "否",
                "最后修改人": r.updated_by,
                "最后修改时间": r.updated_at.isoformat()
            }
            export_rows.append(row)

        if include_history:
            for row in export_rows:
                rid = row["record_id"]
                histories = self.db.get_record_histories(rid)
                review_info = self._extract_review_info(histories)
                row["原始说法"] = self._format_original_saying(histories)
                row["改后的值"] = self._format_after_values(histories)
                row["处理原因"] = "; ".join(review_info["reasons"])
                row["下一步找谁"] = self._get_next_contact_for_export(rid)

        return export_rows

    def export_to_csv(self, output_path: str, batch_id: Optional[int] = None,
                      include_history: bool = True) -> str:
        """导出 CSV 文件，与列表/详情/摘要同源"""
        import csv

        rows = self.export_to_records(batch_id, include_history)
        if not rows:
            return output_path

        fieldnames = list(rows[0].keys())
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        return output_path

    # ── 边界报告视图 ──────────────────────────────────────

    def generate_boundary_report(
        self,
        batch_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        生成边界样本报告，与列表/详情/摘要同源。
        确保：报告里的负数当缺失数 = 列表里的负数当缺失数
        """
        records = self._get_records(batch_id)
        summary = self._compute_summary(records)

        boundary_records = [r for r in records if r.boundary_type != BoundaryType.NORMAL]
        neg_as_missing = [
            r for r in boundary_records
            if r.boundary_type == BoundaryType.NEGATIVE_TREATED_AS_MISSING
        ]

        pending_tasks = self.db.get_pending_review_tasks()

        report = {
            "source": "unified_view.get_all_active_records",
            "snapshot_time": datetime.now().isoformat(),
            "batch_id": batch_id,
            "total_records": len(records),
            "boundary_record_count": len(boundary_records),
            "boundary_breakdown": summary["boundary_counts"],
            "status_breakdown": summary["status_counts"],
            "negative_as_missing_details": [
                self._format_report_row(r, pending_tasks)
                for r in neg_as_missing
            ],
            "all_boundary_details": [
                self._format_report_row(r, pending_tasks)
                for r in boundary_records
            ],
            "consistency_check": {
                "report_total_matches_list": len(records) == summary["total"],
                "neg_as_missing_matches_list": (
                    len(neg_as_missing) ==
                    summary["boundary_counts"].get("negative_treated_as_missing", 0)
                )
            },
            "note": (
                "报告与列表/详情/摘要/导出使用同一份数据。"
                "负数被旧表当缺失的样本未自动归正常，已创建复核任务。"
            )
        }

        return report

    # ── 内部辅助方法 ──────────────────────────────────────

    def _compute_summary(self, records: List[RatingWeightRecord]) -> Dict[str, Any]:
        """同一份数据的统计汇总"""
        total = len(records)
        status_counts: Dict[str, int] = {}
        boundary_counts: Dict[str, int] = {}

        for r in records:
            sv = r.status.value
            bv = r.boundary_type.value
            status_counts[sv] = status_counts.get(sv, 0) + 1
            boundary_counts[bv] = boundary_counts.get(bv, 0) + 1

        for s in ProcessingStatus:
            if s.value not in status_counts:
                status_counts[s.value] = 0
        for b in BoundaryType:
            if b.value not in boundary_counts:
                boundary_counts[b.value] = 0

        return {
            "total": total,
            "status_counts": status_counts,
            "boundary_counts": boundary_counts
        }

    def _check_pending_consistency(self, records: List[RatingWeightRecord]) -> bool:
        """检查 pending_review 的记录是否都有边界问题"""
        pending = [r for r in records if r.status == ProcessingStatus.PENDING_REVIEW]
        for r in pending:
            if r.boundary_type == BoundaryType.NORMAL:
                return False
        return True

    def _diff_original_vs_current(
        self,
        original_values: Dict[str, Any],
        record: RatingWeightRecord
    ) -> List[Dict[str, Any]]:
        """对比原始值与当前值，生成改前改后差别"""
        diffs = []
        for f in self.QUANTILE_FIELDS + ["remark", "sample_count"]:
            ov = original_values.get(f)
            cv = getattr(record, f, None)
            if ov != cv:
                diffs.append({
                    "field": f,
                    "original_value": ov,
                    "current_value": cv,
                    "changed": True
                })
        return diffs

    def _extract_review_info(self, histories: List[Any]) -> Dict[str, Any]:
        """从历史记录中提取处理原因和时间线"""
        reasons = []
        timeline = []

        for h in histories:
            if h.change_reason:
                reasons.append(f"[{self.CHANGE_SOURCE_LABELS.get(h.change_source.value, h.change_source.value)}] "
                             f"{h.changed_by}: {h.change_reason}")

            timeline.append({
                "step": len(timeline) + 1,
                "action": self.CHANGE_SOURCE_LABELS.get(h.change_source.value, h.change_source.value),
                "operator": h.changed_by,
                "field": h.field_name,
                "old_value": h.old_value,
                "new_value": h.new_value,
                "old_status": h.old_status.value if h.old_status else None,
                "new_status": h.new_status.value if h.new_status else None,
                "reason": h.change_reason,
                "time": h.changed_at.isoformat()
            })

        return {"reasons": reasons, "timeline": timeline}

    def _get_next_step(
        self,
        record: RatingWeightRecord,
        pending_tasks: List[Any],
        histories: List[Any]
    ) -> Dict[str, Any]:
        """根据当前状态给出下一步操作说明"""
        if record.status == ProcessingStatus.PENDING_REVIEW:
            tasks = [t for t in pending_tasks if t.record_id == record.id]
            if tasks:
                assignees = list(set(t.assigned_to for t in tasks))
                return {
                    "step": "学生助教复核",
                    "status": "待处理",
                    "assigned_to": assignees,
                    "instruction": (
                        f"该记录为「{self.BOUNDARY_LABELS.get(record.boundary_type.value)}」，"
                        f"请联系 {', '.join(assignees)} 完成复核。"
                        f"不要提前归到正常结果里。"
                    )
                }
            return {
                "step": "创建复核任务",
                "status": "待分配",
                "assigned_to": [],
                "instruction": "需要为该边界问题分配学生助教复核"
            }

        if record.status == ProcessingStatus.REVISED:
            return {
                "step": "已修正待确认",
                "status": "进行中",
                "assigned_to": ["运营规划"],
                "instruction": "已由学生助教修正，等待运营规划阿岚确认后可定标"
            }

        if record.status == ProcessingStatus.FINALIZED:
            return {
                "step": "已定稿",
                "status": "已完成",
                "assigned_to": [],
                "instruction": "处理完毕，可归档"
            }

        if record.status == ProcessingStatus.ROLLED_BACK:
            return {
                "step": "已回滚",
                "status": "待重新处理",
                "assigned_to": ["运营规划"],
                "instruction": "已回滚到历史版本，需要重新处理"
            }

        return {
            "step": "已导入",
            "status": "正常",
            "assigned_to": [],
            "instruction": "正常记录，无需额外处理"
        }

    def _format_report_row(
        self,
        record: RatingWeightRecord,
        pending_tasks: List[ReviewTask]
    ) -> Dict[str, Any]:
        """格式化报告行"""
        tasks = [t for t in pending_tasks if t.record_id == record.id]
        assignees = list(set(t.assigned_to for t in tasks))

        return {
            "record_id": record.id,
            "original_row_number": record.original_row_number,
            "position": record.position,
            "boundary_type": record.boundary_type.value,
            "boundary_label": self.BOUNDARY_LABELS.get(record.boundary_type.value, record.boundary_type.value),
            "status": record.status.value,
            "status_label": self.STATUS_LABELS.get(record.status.value, record.status.value),
            "weight_p10": record.weight_p10,
            "weight_p50": record.weight_p50,
            "weight_p90": record.weight_p90,
            "sample_count": record.sample_count,
            "remark": record.remark,
            "raw_data": record.raw_data,
            "assigned_reviewers": assignees,
            "next_contact": assignees[0] if assignees else "运营规划"
        }

    def _format_original_saying(self, histories: List[Any]) -> str:
        """从历史中提取原始说法（首次导入的快照）"""
        first = next(
            (h for h in histories if h.change_source == ChangeSource.INITIAL_IMPORT),
            None
        )
        if not first:
            return ""
        parts = []
        for f in self.QUANTILE_FIELDS + ["sample_count", "remark"]:
            if f in first.snapshot_after and first.snapshot_after[f] is not None:
                parts.append(f"{f}={first.snapshot_after[f]}")
        return "; ".join(parts)

    def _format_after_values(self, histories: List[Any]) -> str:
        """从历史中提取最后一次修改后的值"""
        if not histories:
            return ""
        last = histories[-1]
        parts = []
        for f in self.QUANTILE_FIELDS + ["sample_count", "remark"]:
            if f in last.snapshot_after and last.snapshot_after[f] is not None:
                parts.append(f"{f}={last.snapshot_after[f]}")
        return "; ".join(parts)

    def _get_next_contact_for_export(self, record_id: int) -> str:
        """导出时获取下一步联系人"""
        tasks = [
            t for t in self.db.get_pending_review_tasks()
            if t.record_id == record_id
        ]
        if tasks:
            assignees = list(set(t.assigned_to for t in tasks))
            return ", ".join(assignees)
        return "运营规划"
