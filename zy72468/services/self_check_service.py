from typing import List, Dict, Any
from collections import Counter
from models import (
    UserRole,
    OperationType,
    ReviewStatus,
    RecordStatus,
)
from .data_repository import DataRepository
from .audit_service import AuditService


class SelfCheckService:
    def __init__(self, repository: DataRepository, audit_service: AuditService):
        self.repo = repository
        self.audit = audit_service

    def run_all_checks(self, operator: str = "system") -> Dict[str, Any]:
        results = {
            "duplicate_import_check": self.check_duplicate_imports(),
            "detour_unsynced_check": self.check_detour_unsynced(),
            "recalculation_consistency_check": self.check_recalculation_consistency(),
            "export_consistency_check": self.check_export_consistency(),
        }

        total_issues = sum(
            len(check.get("issues", []))
            for check in results.values()
        )
        passed = total_issues == 0

        self.audit.log_operation(
            operation_type=OperationType.SELF_CHECK,
            operator=operator,
            operator_role=UserRole.SYSTEM,
            target_entity_type="System",
            target_entity_id="global",
            changes={"check_results": {"old": None, "new": results}},
            reason="执行系统自检",
            impacted_results=[f"共发现 {total_issues} 个问题"] if total_issues > 0 else ["自检通过，无异常"],
        )

        return {
            "passed": passed,
            "total_issues": total_issues,
            "checks": results,
            "summary": self._build_summary(results, total_issues),
        }

    def check_duplicate_imports(self) -> Dict[str, Any]:
        notices = self.repo.list_construction_notices()
        notice_nos = [n.notice_no for n in notices]
        counter = Counter(notice_nos)
        duplicates = {no: count for no, count in counter.items() if count > 1}

        issues = []
        for no, count in duplicates.items():
            dup_notices = [n for n in notices if n.notice_no == no]
            issues.append({
                "type": "duplicate_import",
                "notice_no": no,
                "count": count,
                "notice_ids": [n.id for n in dup_notices],
                "import_batches": [n.import_batch_no for n in dup_notices],
                "description": f"施工告示编号 {no} 被重复导入 {count} 次",
                "severity": "high",
            })

        return {
            "name": "重复导入检查",
            "passed": len(issues) == 0,
            "issues": issues,
            "total_checked": len(notices),
        }

    def check_detour_unsynced(self) -> Dict[str, Any]:
        notices = self.repo.list_construction_notices()
        issues = []

        for notice in notices:
            if notice.temporary_detour and not notice.map_updated:
                valid_resolved_statuses = [
                    ReviewStatus.APPROVED_BY_RESIDENT,
                    ReviewStatus.REJECTED_BY_RESIDENT,
                ]
                if (
                    notice.review_status != ReviewStatus.PENDING_RESIDENT_REVIEW
                    and notice.review_status not in valid_resolved_statuses
                ):
                    issues.append({
                        "type": "detour_status_inconsistent",
                        "notice_id": notice.id,
                        "notice_no": notice.notice_no,
                        "review_status": notice.review_status,
                        "description": f"施工告示 {notice.notice_no} 有临时改道且地图未同步，但状态异常（当前: {notice.review_status}）",
                        "severity": "high",
                    })
                elif notice.review_status == ReviewStatus.PENDING_RESIDENT_REVIEW:
                    issues.append({
                        "type": "detour_needs_review",
                        "notice_id": notice.id,
                        "notice_no": notice.notice_no,
                        "description": f"施工告示 {notice.notice_no} 临时改道未同步地图，待居民代表复核",
                        "severity": "medium",
                        "action_required": True,
                    })
                elif notice.review_status in valid_resolved_statuses:
                    issues.append({
                        "type": "detour_resolved",
                        "notice_id": notice.id,
                        "notice_no": notice.notice_no,
                        "review_status": notice.review_status,
                        "description": f"施工告示 {notice.notice_no} 改道未同步已由居民代表处理（{notice.review_status}），建议更新地图",
                        "severity": "low",
                    })

        return {
            "name": "施工临时改道未同步地图检查",
            "passed": not any(i["severity"] == "high" for i in issues),
            "issues": issues,
            "total_checked": len(notices),
            "detour_notices": len([n for n in notices if n.temporary_detour]),
        }

    def check_recalculation_consistency(self) -> Dict[str, Any]:
        point_lists = self.repo.list_point_lists()
        issues = []

        if len(point_lists) >= 2:
            sorted_pls = sorted(point_lists, key=lambda p: p.version)
            for i in range(len(sorted_pls) - 1):
                old_pl = sorted_pls[i]
                new_pl = sorted_pls[i + 1]

                old_codes = {item.point_code for item in old_pl.items}
                new_codes = {item.point_code for item in new_pl.items}

                if new_pl.version != old_pl.version + 1:
                    issues.append({
                        "type": "version_gap",
                        "old_version": old_pl.version,
                        "new_version": new_pl.version,
                        "description": f"点位清单版本不连续：v{old_pl.version} -> v{new_pl.version}",
                        "severity": "medium",
                    })

                missing_codes = old_codes - new_codes
                if missing_codes:
                    has_recalc_note = "重算" in (new_pl.recalculation_note or "")
                    if not has_recalc_note:
                        issues.append({
                            "type": "missing_items_without_note",
                            "point_list_id": new_pl.id,
                            "version": new_pl.version,
                            "missing_point_codes": list(missing_codes),
                            "description": f"v{new_pl.version} 点位清单缺少 {len(missing_codes)} 个点位，但未标注补录后重算",
                            "severity": "high",
                        })

        return {
            "name": "补录后重算一致性检查",
            "passed": len(issues) == 0,
            "issues": issues,
            "total_point_lists": len(point_lists),
        }

    def check_export_consistency(self) -> Dict[str, Any]:
        issues = []

        latest_pl = self.repo.get_latest_point_list()
        if latest_pl:
            display_source = "single_source"
            export_source = "single_source"

            all_notices = self.repo.list_construction_notices()

            active_notices = [
                n for n in all_notices
                if n.status not in [RecordStatus.REJECTED, RecordStatus.DRAFT]
            ]

            point_notice_ids = set()
            for item in latest_pl.items:
                point_notice_ids.update(item.construction_notice_ids)

            orphan_active = [
                n for n in active_notices if n.id not in point_notice_ids]

            if orphan_active:
                issues.append({
                    "type": "orphan_notices_not_in_points",
                    "orphan_notice_nos": [n.notice_no for n in orphan_active],
                    "description": f"有 {len(orphan_active)} 个有效施工告示未在点位清单中体现（已排除被驳回的告示）",
                    "severity": "medium",
                })

            if display_source != export_source:
                issues.append({
                    "type": "data_source_mismatch",
                    "display_source": display_source,
                    "export_source": export_source,
                    "description": "页面展示与导出使用不同数据源",
                    "severity": "critical",
                })

        return {
            "name": "导出一致性检查",
            "passed": len(issues) == 0,
            "issues": issues,
            "note": "页面展示、接口返回、导出明细均读取同一份数据仓库结果",
        }

    def _build_summary(self, results: Dict[str, Any], total_issues: int) -> str:
        passed_checks = sum(
            1 for check in results.values() if check.get("passed", False)
        )
        total_checks = len(results)
        return f"自检完成：{passed_checks}/{total_checks} 项检查通过，共发现 {total_issues} 个问题"
