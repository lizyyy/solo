import time
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Tuple
from collections import defaultdict

from .models import PathRecord, PathStatus, IssueType, MergeResult


class PathMerger:
    def __init__(self):
        self.issues_found = []
        self.execution_times = []

    def merge_paths(self, record: PathRecord) -> PathRecord:
        start_time = time.time()
        record.processed_time = datetime.now()

        try:
            self._validate_record(record)
            self._detect_cross_day_boundary(record)
            merged = self._merge_algorithm(record.permission_path, record.actual_path)
            record.merged_path = merged
            self._detect_permission_over_grant(record)
            self._detect_path_mismatch(record)

            high_risk_issues = {
                IssueType.PERMISSION_OVER_GRANT,
                IssueType.MISSING_DATA,
                IssueType.FORMAT_ERROR,
                IssueType.DUPLICATE_RECORD
            }

            has_high_risk = any(issue.get('type') in high_risk_issues for issue in record.issues)
            if has_high_risk:
                record.status = PathStatus.FAILED
            else:
                record.status = PathStatus.SUCCESS

        except Exception as e:
            record.status = PathStatus.FAILED
            record.issues.append({
                'type': IssueType.FORMAT_ERROR,
                'message': str(e),
                'severity': 'high'
            })

        record.execution_time_ms = (time.time() - start_time) * 1000
        self.execution_times.append(record.execution_time_ms)
        return record

    def _validate_record(self, record: PathRecord) -> None:
        if not record.permission_path:
            record.issues.append({
                'type': IssueType.MISSING_DATA,
                'message': 'permission_path is empty',
                'severity': 'high',
                'field': 'permission_path'
            })
        if not record.actual_path:
            record.issues.append({
                'type': IssueType.MISSING_DATA,
                'message': 'actual_path is empty',
                'severity': 'high',
                'field': 'actual_path'
            })

    def _detect_cross_day_boundary(self, record: PathRecord) -> None:
        start_date = record.start_time.date()
        end_date = record.end_time.date()
        if start_date != end_date:
            record.issues.append({
                'type': IssueType.CROSS_DAY_BOUNDARY,
                'message': f'Recording crosses day boundary: {start_date} -> {end_date}',
                'severity': 'medium',
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            })

    def _detect_permission_over_grant(self, record: PathRecord) -> None:
        if not record.merged_path:
            return

        permission_set = set(record.permission_path)
        merged_set = set(record.merged_path)

        over_granted = merged_set - permission_set
        if over_granted:
            record.issues.append({
                'type': IssueType.PERMISSION_OVER_GRANT,
                'message': f'Permission was over-granted for paths: {sorted(over_granted)}',
                'severity': 'high',
                'over_granted_paths': sorted(over_granted),
                'permission_count': len(permission_set),
                'actual_count': len(merged_set)
            })

    def _detect_path_mismatch(self, record: PathRecord) -> None:
        if len(record.permission_path) != len(record.actual_path):
            record.issues.append({
                'type': IssueType.PATH_MISMATCH,
                'message': f'Path length mismatch: permission({len(record.permission_path)}) vs actual({len(record.actual_path)})',
                'severity': 'low'
            })

    def _merge_algorithm(self, permission_path: List[str], actual_path: List[str]) -> List[str]:
        if not permission_path and not actual_path:
            return []
        if not permission_path:
            return actual_path
        if not actual_path:
            return permission_path

        merged = []
        i = j = 0

        while i < len(permission_path) and j < len(actual_path):
            p_node = permission_path[i]
            a_node = actual_path[j]

            if p_node == a_node:
                merged.append(p_node)
                i += 1
                j += 1
            else:
                if self._is_parent_path(p_node, a_node):
                    merged.append(a_node)
                    j += 1
                elif self._is_parent_path(a_node, p_node):
                    merged.append(p_node)
                    i += 1
                else:
                    merged.append(a_node)
                    j += 1

        while i < len(permission_path):
            merged.append(permission_path[i])
            i += 1
        while j < len(actual_path):
            merged.append(actual_path[j])
            j += 1

        return self._deduplicate_path(merged)

    def _is_parent_path(self, parent: str, child: str) -> bool:
        parent_parts = parent.split('/')
        child_parts = child.split('/')

        if len(parent_parts) > len(child_parts):
            return False

        for i in range(len(parent_parts)):
            if parent_parts[i] != child_parts[i]:
                return False
        return True

    def _deduplicate_path(self, path: List[str]) -> List[str]:
        seen = set()
        result = []
        for node in path:
            if node not in seen:
                seen.add(node)
                result.append(node)
        return result

    def process_batch(self, records: List[PathRecord], batch_id: str) -> MergeResult:
        start_time = time.time()
        start_datetime = datetime.now()

        processed_records = []
        for record in records:
            processed = self.merge_paths(record)
            processed_records.append(processed)

        success_count = sum(1 for r in processed_records if r.status == PathStatus.SUCCESS)
        failed_count = sum(1 for r in processed_records if r.status == PathStatus.FAILED)
        conflict_count = sum(1 for r in processed_records if r.status == PathStatus.CONFLICT)
        skipped_count = sum(1 for r in processed_records if r.status == PathStatus.SKIPPED)
        manual_fix_count = sum(1 for r in processed_records if r.status == PathStatus.MANUAL_FIX)

        suggestions = self._generate_suggestions(processed_records)

        end_time = time.time()
        end_datetime = datetime.now()

        return MergeResult(
            batch_id=batch_id,
            total_records=len(processed_records),
            success_count=success_count,
            failed_count=failed_count,
            conflict_count=conflict_count,
            skipped_count=skipped_count,
            manual_fix_count=manual_fix_count,
            execution_time_ms=(end_time - start_time) * 1000,
            start_time=start_datetime,
            end_time=end_datetime,
            records=processed_records,
            suggestions=suggestions
        )

    def _generate_suggestions(self, records: List[PathRecord]) -> List[str]:
        suggestions = []
        issue_counts = defaultdict(int)

        for record in records:
            for issue in record.issues:
                issue_type = issue.get('type')
                if issue_type:
                    issue_counts[issue_type] += 1

        if issue_counts.get(IssueType.PERMISSION_OVER_GRANT, 0) > 0:
            suggestions.append(
                f"发现 {issue_counts[IssueType.PERMISSION_OVER_GRANT]} 条权限放大记录，建议审计权限配置"
            )

        if issue_counts.get(IssueType.CROSS_DAY_BOUNDARY, 0) > 0:
            suggestions.append(
                f"发现 {issue_counts[IssueType.CROSS_DAY_BOUNDARY]} 条跨天录音，建议检查会话分割逻辑"
            )

        if issue_counts.get(IssueType.MISSING_DATA, 0) > 0:
            suggestions.append(
                f"发现 {issue_counts[IssueType.MISSING_DATA]} 条数据缺失记录，建议检查数据源完整性"
            )

        avg_time = sum(self.execution_times) / len(self.execution_times) if self.execution_times else 0
        if avg_time > 100:
            suggestions.append(
                f"平均处理时间 {avg_time:.1f}ms，建议优化路径归并算法性能"
            )

        if len(records) > 0 and len(suggestions) == 0:
            suggestions.append("所有记录处理正常，无特别建议")

        return suggestions

    @staticmethod
    def compute_record_hash(record: PathRecord) -> str:
        content = f"{record.record_id}:{record.recording_id}:{record.start_time.isoformat()}"
        content += f":{'-'.join(record.permission_path)}:{'-'.join(record.actual_path)}"
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    @staticmethod
    def apply_manual_fix(record: PathRecord, fixed_path: List[str], reason: str) -> PathRecord:
        record.merged_path = fixed_path
        record.is_manual_fix = True
        record.fix_reason = reason
        record.fix_time = datetime.now()
        record.status = PathStatus.MANUAL_FIX
        return record
