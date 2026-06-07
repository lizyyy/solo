"""自检核心逻辑 - 重复检测、一致性校验"""

from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Tuple, Any

from .models import (
    TrackingRecord,
    RecordStatus,
    IssueType,
    EvidenceLog,
    ProcessingResult,
)
from .importer import generate_id


class SelfChecker:
    """自检器"""

    def __init__(self):
        self.check_history: List[Dict[str, Any]] = []

    def run_all_checks(
        self,
        records: Dict[str, TrackingRecord],
    ) -> ProcessingResult:
        """运行所有自检"""
        result = ProcessingResult()
        result.total_records = len(records)

        issues = []

        dup_import_issues = self._check_duplicate_imports(records)
        issues.extend(dup_import_issues)

        dup_feedback_issues = self._check_duplicate_user_feedback(records)
        issues.extend(dup_feedback_issues)

        result.issues = issues

        for issue in issues:
            record_id = issue["record_id"]
            if record_id in records:
                record = records[record_id]
                if issue["type"] == "duplicate_import":
                    result.duplicate_import_count += 1
                    record.issue_type = IssueType.DUPLICATE_IMPORT
                elif issue["type"] == "duplicate_user_feedback":
                    result.duplicate_user_feedback_count += 1
                    record.issue_type = IssueType.DUPLICATE_USER_FEEDBACK
                    record.is_duplicate_user_feedback = True
                    if not record.duplicate_group_id:
                        record.duplicate_group_id = issue.get("group_id")
                record.issue_note = issue["description"]
                if record.status not in [RecordStatus.REVIEWED, RecordStatus.REJECTED, RecordStatus.CONFIRMED]:
                    record.status = RecordStatus.REVIEW_REQUIRED

        for record in records.values():
            if record.status == RecordStatus.REVIEW_REQUIRED:
                result.review_required_count += 1
            elif record.status == RecordStatus.REVIEWED:
                result.reviewed_count += 1
            elif record.issue_type == IssueType.NORMAL:
                result.normal_count += 1

        result.export_consistent = self._check_export_consistency(records)

        self.check_history.append({
            "timestamp": datetime.now(),
            "total_records": result.total_records,
            "issues_found": len(issues),
            "result": result,
        })

        return result

    def _check_duplicate_imports(
        self,
        records: Dict[str, TrackingRecord],
    ) -> List[Dict[str, Any]]:
        """检测重复导入 - 同一模型输出片段被多次导入"""
        issues: List[Dict[str, Any]] = []

        kb_link_groups: Dict[str, List[TrackingRecord]] = defaultdict(list)
        for record in records.values():
            key = f"{record.user_feedback_id}:{record.kb_link}"
            kb_link_groups[key].append(record)

        for key, group in kb_link_groups.items():
            if len(group) > 1:
                batch_ids = set(r.initial_model_fragment.import_batch_id for r in group)
                if len(batch_ids) > 1:
                    for record in group:
                        issues.append({
                            "type": "duplicate_import",
                            "record_id": record.record_id,
                            "user_feedback_id": record.user_feedback_id,
                            "kb_link": record.kb_link,
                            "group_key": key,
                            "batch_ids": list(batch_ids),
                            "description": f"同一反馈+链接在{len(batch_ids)}个批次中重复导入: {', '.join(batch_ids)}",
                            "severity": "warning",
                        })

        return issues

    def _check_duplicate_user_feedback(
        self,
        records: Dict[str, TrackingRecord],
    ) -> List[Dict[str, Any]]:
        """检测同一用户反馈被重复计入"""
        issues: List[Dict[str, Any]] = []

        user_feedback_groups: Dict[str, List[TrackingRecord]] = defaultdict(list)
        for record in records.values():
            user_feedback_groups[record.user_feedback_id].append(record)

        for feedback_id, group in user_feedback_groups.items():
            if len(group) > 1:
                existing_group_ids = [r.duplicate_group_id for r in group if r.duplicate_group_id]
                group_id = existing_group_ids[0] if existing_group_ids else f"dup_grp_{generate_id('g')}"
                user_ids = set(r.user_id for r in group)
                kb_links = set(r.kb_link for r in group)

                for record in group:
                    existing_log = any(
                        log.action == "mark_duplicate_feedback"
                        for log in record.evidence_logs
                    )
                    if not existing_log:
                        log = EvidenceLog(
                            log_id=generate_id("log"),
                            record_id=record.record_id,
                            action="mark_duplicate_feedback",
                            operator="system_self_check",
                            before_status=record.status,
                            after_status=RecordStatus.REVIEW_REQUIRED,
                            reason=f"检测到同一用户反馈被重复计入，共{len(group)}条记录",
                            metadata={
                                "duplicate_count": len(group),
                                "group_id": group_id,
                                "user_ids": list(user_ids),
                                "kb_links": list(kb_links),
                            },
                        )
                        record.evidence_logs.append(log)

                    issues.append({
                        "type": "duplicate_user_feedback",
                        "record_id": record.record_id,
                        "user_feedback_id": feedback_id,
                        "user_id": record.user_id,
                        "group_id": group_id,
                        "duplicate_count": len(group),
                        "description": (
                            f"用户反馈{feedback_id}被重复计入{len(group)}次，"
                            f"涉及用户: {', '.join(user_ids)}，"
                            f"涉及链接数: {len(kb_links)}"
                        ),
                        "severity": "error",
                        "requires_review": True,
                        "review_note": "请标注负责人复核，确认是否保留该记录",
                    })

        return issues

    def _check_export_consistency(
        self,
        records: Dict[str, TrackingRecord],
    ) -> bool:
        """校验导出一致性 - 确保统一数据源"""
        record_list = list(records.values())
        dict_records = [r.to_dict() for r in record_list]

        status_counts_from_obj = defaultdict(int)
        for r in record_list:
            status_counts_from_obj[r.status.value] += 1

        status_counts_from_dict = defaultdict(int)
        for d in dict_records:
            status_counts_from_dict[d["status"]] += 1

        consistent = status_counts_from_obj == status_counts_from_dict

        issue_counts_from_obj = defaultdict(int)
        for r in record_list:
            issue_counts_from_obj[r.issue_type.value] += 1

        issue_counts_from_dict = defaultdict(int)
        for d in dict_records:
            issue_counts_from_dict[d["issue_type"]] += 1

        consistent = consistent and (issue_counts_from_obj == issue_counts_from_dict)

        return consistent

    def recalculate_after_supplement(
        self,
        records: Dict[str, TrackingRecord],
        updated_record_ids: List[str],
    ) -> ProcessingResult:
        """补录后重新计算"""
        for record_id in updated_record_ids:
            if record_id in records:
                record = records[record_id]
                log = EvidenceLog(
                    log_id=generate_id("log"),
                    record_id=record_id,
                    action="recalculate_after_supplement",
                    operator="system",
                    before_status=record.status,
                    after_status=RecordStatus.REVIEW_REQUIRED,
                    reason="补录人工改判后重新计算",
                )
                record.evidence_logs.append(log)
                record.updated_at = datetime.now()

        return self.run_all_checks(records)

    def get_duplicate_groups(
        self,
        records: Dict[str, TrackingRecord],
    ) -> Dict[str, List[TrackingRecord]]:
        """获取重复用户反馈分组"""
        groups: Dict[str, List[TrackingRecord]] = defaultdict(list)
        for record in records.values():
            if record.duplicate_group_id:
                groups[record.duplicate_group_id].append(record)
        return dict(groups)
