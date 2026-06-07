from typing import List, Tuple, Dict, Any
from datetime import datetime

from models import (
    NightSamplingPoint,
    ServiceRadiusResult,
    PointStatus,
    AbnormalType,
)
from storage import store


class SelfChecker:
    @staticmethod
    def check_duplicate_import(batch_id: str = None) -> List[Tuple[NightSamplingPoint, str]]:
        issues = []
        duplicates_groups = store.get_duplicate_points()
        for group in duplicates_groups:
            for point in group:
                if batch_id and point.import_batch_id != batch_id:
                    continue
                if AbnormalType.DUPLICATE_IMPORT not in point.abnormal_types:
                    point.abnormal_types.append(AbnormalType.DUPLICATE_IMPORT)
                    point.status = PointStatus.ABNORMAL
                issues.append(
                    (point, f"点位重复: 同名同地址点位共{len(group)}个")
                )
        return issues

    @staticmethod
    def check_construction_not_synced(point: NightSamplingPoint) -> bool:
        has_construction_note = bool(point.construction_note)
        has_detour_keywords = False
        if point.construction_note:
            keywords = ["施工", "改道", "绕行", "临时", "封路", "修路"]
            has_detour_keywords = any(k in point.construction_note for k in keywords)

        if has_construction_note and has_detour_keywords:
            if AbnormalType.CONSTRUCTION_NOT_SYNCED not in point.abnormal_types:
                point.abnormal_types.append(AbnormalType.CONSTRUCTION_NOT_SYNCED)
            point.status = PointStatus.RESIDENT_REVIEW
            return True
        return False

    @staticmethod
    def check_all_construction_issues() -> List[Tuple[NightSamplingPoint, str]]:
        issues = []
        for point in store.get_all_points():
            if SelfChecker.check_construction_not_synced(point):
                issues.append(
                    (point, f"施工临时改道未同步到地图: {point.construction_note}")
                )
        return issues

    @staticmethod
    def recalculate_radius_after_supplement(
        point_id: str, operator: str, mark_abnormal: bool = True
    ) -> ServiceRadiusResult:
        point = store.get_point(point_id)
        if not point:
            raise ValueError(f"点位{point_id}不存在")

        old_result = store.get_radius_result(point_id)
        original_radius = old_result.original_radius if old_result else point.service_radius

        calculated_radius = SelfChecker._calculate_radius(point, original_radius)
        final_radius = calculated_radius

        result = ServiceRadiusResult(
            point_id=point.id,
            point_name=point.name,
            original_radius=original_radius,
            calculated_radius=calculated_radius,
            final_radius=final_radius,
            is_abnormal=False,
        )

        if old_result and abs(old_result.final_radius - final_radius) > 0.01 and mark_abnormal:
            result.is_abnormal = True
            result.abnormal_reason = f"补录后半径变化: {old_result.final_radius} -> {final_radius}"
            if AbnormalType.RADIUS_MISMATCH not in point.abnormal_types:
                point.abnormal_types.append(AbnormalType.RADIUS_MISMATCH)
            point.status = PointStatus.ABNORMAL

        point.service_radius = final_radius
        point.is_manual_modified = True
        store.add_radius_result(result)
        return result

    @staticmethod
    def _calculate_radius(point: NightSamplingPoint, base_radius: float = None) -> float:
        if base_radius is None:
            base_radius = point.service_radius
        if point.construction_note:
            base_radius *= 0.85
        if point.complaint_id:
            base_radius *= 1.1
        return round(base_radius, 2)

    @staticmethod
    def check_export_consistency() -> Tuple[bool, List[str]]:
        issues = []
        points = store.get_all_points()
        results = store.get_all_radius_results()

        point_ids = {p.id for p in points}
        result_ids = {r.point_id for r in results}
        missing_results = point_ids - result_ids
        if missing_results:
            issues.append(f"缺少{len(missing_results)}个点位的计算结果")

        for point in points:
            result = store.get_radius_result(point.id)
            if not result:
                continue
            if abs(point.service_radius - result.final_radius) > 0.01:
                issues.append(
                    f"点位{point.name}数据不一致: 点位表={point.service_radius}, 结果表={result.final_radius}"
                )
                if AbnormalType.EXPORT_INCONSISTENT not in point.abnormal_types:
                    point.abnormal_types.append(AbnormalType.EXPORT_INCONSISTENT)
                point.status = PointStatus.ABNORMAL

        return len(issues) == 0, issues

    @staticmethod
    def run_full_check(batch_id: str = None) -> Dict[str, Any]:
        report = {
            "check_time": datetime.now().isoformat(),
            "total_points": len(store.get_all_points()),
            "issues": [],
            "summary": {},
        }

        duplicate_issues = SelfChecker.check_duplicate_import(batch_id)
        construction_issues = SelfChecker.check_all_construction_issues()
        export_ok, export_issues = SelfChecker.check_export_consistency()

        report["issues"].extend([f"[重复导入] {p[1]}" for p in duplicate_issues])
        report["issues"].extend([f"[施工未同步] {p[1]}" for p in construction_issues])
        report["issues"].extend([f"[导出不一致] {i}" for i in export_issues])

        report["summary"] = {
            "duplicate_count": len(duplicate_issues),
            "construction_count": len(construction_issues),
            "export_inconsistent_count": len(export_issues),
        }

        return report
