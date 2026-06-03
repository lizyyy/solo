from typing import List, Dict, Any
from datetime import datetime

from .models import ResurveyProject, MeasurementRecord, ProcessingStatus
from .processor import RouteLengthCalculator


class SelfChecker:
    def __init__(self, project: ResurveyProject):
        self.project = project

    def run_all_checks(self) -> List[Dict[str, Any]]:
        results = []
        results.append(self.check_duplicate_imports())
        results.append(self.check_length_not_recalculated())
        results.append(self.check_supplement_then_recalculate())
        results.append(self.check_export_consistency())

        self.project.self_check_results = results
        return results

    def check_duplicate_imports(self) -> Dict[str, Any]:
        check_name = "重复导入检测"
        duplicates = []
        seen_keys = {}

        for record_id, record in self.project.records.items():
            key = (
                record.building_a,
                record.building_b,
                record.community_name,
            )
            if key in seen_keys:
                duplicates.append({
                    "record_id": record_id,
                    "original_record_id": seen_keys[key],
                    "key": f"{key[0]}-{key[1]}-{key[2]}",
                    "line_number": record.obstacle_remark.original_line_number if record.obstacle_remark else None,
                })
            else:
                seen_keys[key] = record_id

        passed = len(duplicates) == 0
        return {
            "check_name": check_name,
            "passed": passed,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_records": len(self.project.records),
            "duplicate_count": len(duplicates),
            "duplicates": duplicates,
            "message": f"检测通过，无重复记录" if passed else f"发现 {len(duplicates)} 条重复记录",
        }

    def check_length_not_recalculated(self) -> Dict[str, Any]:
        check_name = "补录路线未重算检测"
        issues = []

        for record_id, record in self.project.records.items():
            if record.is_supplementary and not record.length_recalculated:
                issues.append({
                    "record_id": record_id,
                    "buildings": f"{record.building_a}-{record.building_b}",
                    "status": record.obstacle_remark.processing_status.value if record.obstacle_remark else "未知",
                    "needs_customer_review": record.obstacle_remark.needs_customer_review if record.obstacle_remark else False,
                    "point_count": len(record.route_points),
                    "current_length": record.route_length,
                    "original_length": record.obstacle_remark.original_route_length if record.obstacle_remark else None,
                    "manual_changes": record.obstacle_remark.manual_changes if record.obstacle_remark else [],
                })

        passed = len(issues) == 0
        return {
            "check_name": check_name,
            "passed": passed,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "supplementary_count": sum(1 for r in self.project.records.values() if r.is_supplementary),
            "not_recalculated_count": len(issues),
            "issues": issues,
            "message": f"所有补录记录均已重算" if passed else f"发现 {len(issues)} 条补录记录未重算路线长度",
        }

    def check_supplement_then_recalculate(self) -> Dict[str, Any]:
        check_name = "补录后重算验证"
        issues = []
        validated = []

        for record_id, record in self.project.records.items():
            if record.is_supplementary and record.length_recalculated:
                expected_length = RouteLengthCalculator.calculate(record.route_points)
                if abs(record.route_length - expected_length) > 0.01:
                    issues.append({
                        "record_id": record_id,
                        "buildings": f"{record.building_a}-{record.building_b}",
                        "stored_length": record.route_length,
                        "expected_length": expected_length,
                        "diff": abs(record.route_length - expected_length),
                    })
                else:
                    validated.append({
                        "record_id": record_id,
                        "buildings": f"{record.building_a}-{record.building_b}",
                        "length": record.route_length,
                        "point_count": len(record.route_points),
                    })

        passed = len(issues) == 0
        return {
            "check_name": check_name,
            "passed": passed,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "validated_count": len(validated),
            "mismatch_count": len(issues),
            "validated": validated,
            "issues": issues,
            "message": f"已验证 {len(validated)} 条补录记录重算正确" if passed else f"发现 {len(issues)} 条记录重算结果不一致",
        }

    def check_export_consistency(self) -> Dict[str, Any]:
        check_name = "导出一致性检测"
        unified_view = self.project.get_unified_view()
        issues = []

        for view_data in unified_view:
            record_id = view_data.get("record_id")
            record = self.project.records.get(record_id)
            if not record:
                continue

            if view_data.get("route_length") != record.route_length:
                issues.append({
                    "record_id": record_id,
                    "field": "route_length",
                    "view_value": view_data.get("route_length"),
                    "source_value": record.route_length,
                })

            if view_data.get("is_supplementary") != record.is_supplementary:
                issues.append({
                    "record_id": record_id,
                    "field": "is_supplementary",
                    "view_value": view_data.get("is_supplementary"),
                    "source_value": record.is_supplementary,
                })

            remark_view = view_data.get("obstacle_remark", {})
            if record.obstacle_remark:
                if remark_view.get("路线长度") != record.obstacle_remark.route_length:
                    issues.append({
                        "record_id": record_id,
                        "field": "obstacle_remark.route_length",
                        "view_value": remark_view.get("路线长度"),
                        "source_value": record.obstacle_remark.route_length,
                    })
                if remark_view.get("当前处理状态") != record.obstacle_remark.processing_status.value:
                    issues.append({
                        "record_id": record_id,
                        "field": "obstacle_remark.processing_status",
                        "view_value": remark_view.get("当前处理状态"),
                        "source_value": record.obstacle_remark.processing_status.value,
                    })

        passed = len(issues) == 0
        return {
            "check_name": check_name,
            "passed": passed,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "checked_records": len(unified_view),
            "inconsistency_count": len(issues),
            "issues": issues,
            "message": f"所有记录导出视图一致" if passed else f"发现 {len(issues)} 处数据不一致",
        }

    def get_records_needing_customer_review(self) -> List[Dict[str, Any]]:
        records = []
        for record_id, record in self.project.records.items():
            if record.obstacle_remark and record.obstacle_remark.needs_customer_review:
                records.append({
                    "record_id": record_id,
                    "buildings": f"{record.building_a}-{record.building_b}",
                    "status": record.obstacle_remark.processing_status.value,
                    "evidence": record.obstacle_remark.to_evidence_summary(),
                    "sketches": [s.to_evidence_summary() for s in record.floor_sketches],
                })
        return records

    def get_summary(self) -> Dict[str, Any]:
        all_checks = self.run_all_checks()
        return {
            "project_name": self.project.project_name,
            "total_records": len(self.project.records),
            "supplementary_records": sum(1 for r in self.project.records.values() if r.is_supplementary),
            "needs_customer_review": sum(
                1 for r in self.project.records.values()
                if r.obstacle_remark and r.obstacle_remark.needs_customer_review
            ),
            "length_not_recalculated": sum(
                1 for r in self.project.records.values()
                if r.is_supplementary and not r.length_recalculated
            ),
            "checks_passed": sum(1 for c in all_checks if c["passed"]),
            "checks_total": len(all_checks),
            "checks": all_checks,
        }
