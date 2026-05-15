import json
import re
from typing import Dict, Any, List, Optional
from deepdiff import DeepDiff
from sqlalchemy.orm import Session
from app.models import (
    HistoryRequest, ResponseDiff, ToleranceRule, 
    GrayVersion, VerificationStatus, DiffLevel, Timeline
)


class DiffService:
    def __init__(self, db: Session):
        self.db = db

    def calculate_diff(
        self,
        request: HistoryRequest,
        gray_version: GrayVersion
    ) -> List[ResponseDiff]:
        if request.base_response is None or request.gray_response is None:
            return []

        existing_diffs = self.db.query(ResponseDiff).filter(
            ResponseDiff.request_id == request.id
        ).all()
        if existing_diffs:
            return existing_diffs

        diff = DeepDiff(
            request.base_response,
            request.gray_response,
            ignore_order=True,
            report_repetition=True
        )

        diffs = []
        
        for diff_type, diff_items in diff.items():
            if diff_type == "values_changed":
                for path, change in diff_items.items():
                    diff_obj = self._create_diff(
                        request.id,
                        path,
                        "values_changed",
                        str(change.get("old_value", "")),
                        str(change.get("new_value", "")),
                        self._determine_level(path, change)
                    )
                    diffs.append(diff_obj)
            
            elif diff_type == "type_changes":
                for path, change in diff_items.items():
                    diff_obj = self._create_diff(
                        request.id,
                        path,
                        "type_changes",
                        str(change.get("old_type", "")),
                        str(change.get("new_type", "")),
                        DiffLevel.ERROR
                    )
                    diffs.append(diff_obj)
            
            elif diff_type == "dictionary_item_added":
                for path in diff_items:
                    diff_obj = self._create_diff(
                        request.id,
                        path,
                        "dictionary_item_added",
                        None,
                        "new_field",
                        DiffLevel.WARNING
                    )
                    diffs.append(diff_obj)
            
            elif diff_type == "dictionary_item_removed":
                for path in diff_items:
                    diff_obj = self._create_diff(
                        request.id,
                        path,
                        "dictionary_item_removed",
                        "removed_field",
                        None,
                        DiffLevel.ERROR
                    )
                    diffs.append(diff_obj)
            
            elif diff_type == "iterable_item_added":
                for path, value in diff_items.items():
                    diff_obj = self._create_diff(
                        request.id,
                        path,
                        "iterable_item_added",
                        None,
                        str(value),
                        DiffLevel.WARNING
                    )
                    diffs.append(diff_obj)
            
            elif diff_type == "iterable_item_removed":
                for path, value in diff_items.items():
                    diff_obj = self._create_diff(
                        request.id,
                        path,
                        "iterable_item_removed",
                        str(value),
                        None,
                        DiffLevel.WARNING
                    )
                    diffs.append(diff_obj)

        if request.base_status_code != request.gray_status_code:
            diff_obj = self._create_diff(
                request.id,
                "status_code",
                "status_code_changed",
                str(request.base_status_code),
                str(request.gray_status_code),
                DiffLevel.CRITICAL
            )
            diffs.append(diff_obj)

        self.db.bulk_save_objects(diffs)
        self.db.commit()

        self._add_timeline(
            gray_version_id=gray_version.id,
            request_id=request.id,
            action="diff_calculated",
            actor="system",
            details={
                "request_id": request.request_id,
                "diff_count": len(diffs)
            }
        )

        return diffs

    def _create_diff(
        self,
        request_id: int,
        diff_path: str,
        diff_type: str,
        base_value: Optional[str],
        gray_value: Optional[str],
        level: DiffLevel
    ) -> ResponseDiff:
        return ResponseDiff(
            request_id=request_id,
            diff_path=diff_path,
            diff_type=diff_type,
            base_value=base_value,
            gray_value=gray_value,
            level=level,
            is_tolerated=False
        )

    def _determine_level(self, path: str, change: Dict[str, Any]) -> DiffLevel:
        path_lower = path.lower()
        
        critical_keywords = ["code", "status", "error", "success", "data"]
        for keyword in critical_keywords:
            if keyword in path_lower:
                return DiffLevel.CRITICAL
        
        return DiffLevel.WARNING

    def calculate_all_diffs(self, gray_version: GrayVersion) -> Dict[str, Any]:
        requests = self.db.query(HistoryRequest).filter(
            HistoryRequest.gray_version_id == gray_version.id,
            HistoryRequest.gray_response.isnot(None)
        ).all()

        results = {
            "total_requests": len(requests),
            "total_diffs": 0,
            "critical_diffs": 0,
            "error_diffs": 0,
            "warning_diffs": 0,
            "details": []
        }

        self._add_timeline(
            gray_version_id=gray_version.id,
            action="diff_calculation_started",
            actor="system",
            details={"total_requests": len(requests)}
        )

        for request in requests:
            diffs = self.calculate_diff(request, gray_version)
            diff_count = len(diffs)
            critical = sum(1 for d in diffs if d.level == DiffLevel.CRITICAL)
            error = sum(1 for d in diffs if d.level == DiffLevel.ERROR)
            warning = sum(1 for d in diffs if d.level == DiffLevel.WARNING)
            
            results["total_diffs"] += diff_count
            results["critical_diffs"] += critical
            results["error_diffs"] += error
            results["warning_diffs"] += warning
            
            results["details"].append({
                "request_id": request.request_id,
                "diff_count": diff_count,
                "critical": critical,
                "error": error,
                "warning": warning
            })

        gray_version.status = VerificationStatus.PENDING_CONFIRM
        self.db.commit()

        self._add_timeline(
            gray_version_id=gray_version.id,
            action="diff_calculation_completed",
            actor="system",
            details=results
        )

        return results

    def _add_timeline(
        self,
        action: str,
        actor: str,
        details: Dict[str, Any],
        gray_version_id: Optional[int] = None,
        request_id: Optional[int] = None
    ):
        timeline = Timeline(
            gray_version_id=gray_version_id,
            request_id=request_id,
            action=action,
            actor=actor,
            details=details
        )
        self.db.add(timeline)
        self.db.commit()


class ToleranceService:
    def __init__(self, db: Session):
        self.db = db

    def apply_tolerance_rules(self, gray_version: GrayVersion) -> Dict[str, Any]:
        active_rules = self.db.query(ToleranceRule).filter(
            ToleranceRule.is_active == True
        ).all()

        diffs = self.db.query(ResponseDiff).join(HistoryRequest).filter(
            HistoryRequest.gray_version_id == gray_version.id
        ).all()

        results = {
            "total_diffs": len(diffs),
            "tolerated_diffs": 0,
            "applied_rules": []
        }

        for diff in diffs:
            for rule in active_rules:
                if self._match_rule(diff, rule):
                    diff.is_tolerated = True
                    diff.tolerance_rule_id = rule.id
                    results["tolerated_diffs"] += 1
                    results["applied_rules"].append({
                        "diff_id": diff.id,
                        "rule_id": rule.id,
                        "rule_name": rule.name
                    })
                    break

        self.db.commit()

        self._add_timeline(
            gray_version_id=gray_version.id,
            action="tolerance_rules_applied",
            actor="system",
            details=results
        )

        return results

    def _match_rule(self, diff: ResponseDiff, rule: ToleranceRule) -> bool:
        path_pattern = rule.path_pattern.replace("*", ".*").replace("[", "\\[").replace("]", "\\]")
        
        if not re.search(path_pattern, diff.diff_path):
            return False

        if rule.diff_type and rule.diff_type != diff.diff_type:
            return False

        if rule.tolerance_type == "always":
            return True
        
        elif rule.tolerance_type == "value_range":
            tolerance_value = rule.tolerance_value or {}
            min_val = tolerance_value.get("min")
            max_val = tolerance_value.get("max")
            try:
                gray_val = float(diff.gray_value or 0)
                if min_val is not None and gray_val < min_val:
                    return False
                if max_val is not None and gray_val > max_val:
                    return False
                return True
            except (ValueError, TypeError):
                return False
        
        elif rule.tolerance_type == "percentage":
            tolerance_value = rule.tolerance_value or {}
            max_percent = tolerance_value.get("max_percent", 10)
            try:
                base_val = float(diff.base_value or 0)
                gray_val = float(diff.gray_value or 0)
                if base_val == 0:
                    return abs(gray_val) < 0.001
                change_percent = abs((gray_val - base_val) / base_val * 100)
                return change_percent <= max_percent
            except (ValueError, TypeError):
                return False

        return False

    def _add_timeline(
        self,
        action: str,
        actor: str,
        details: Dict[str, Any],
        gray_version_id: Optional[int] = None
    ):
        timeline = Timeline(
            gray_version_id=gray_version_id,
            action=action,
            actor=actor,
            details=details
        )
        self.db.add(timeline)
        self.db.commit()
