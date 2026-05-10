import json
import uuid
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime

from models import (
    Route,
    Hold,
    ClimbFeedback,
    Issue,
    OperationLog,
    DifficultyLevel,
    HoldType,
    RouteStatus,
)
from rules import (
    DifficultyCalibrationEngine,
    ValidationRules,
    DifficultyConversionRules,
    WallAngleRules,
    HoldDifficultyRules,
)


class RouteCalibrationManager:
    def __init__(self):
        self.routes: Dict[str, Route] = {}
        self.feedbacks: Dict[str, List[ClimbFeedback]] = {}
        self.issues: List[Issue] = []
        self.operation_logs: List[OperationLog] = []
        self.calibration_engine = DifficultyCalibrationEngine()

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def _log_operation(
        self,
        operation: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        success: bool,
        error_reason: Optional[str] = None,
    ) -> OperationLog:
        log = OperationLog(
            id=self._generate_id(),
            operation=operation,
            input_data=input_data,
            output_data=output_data,
            success=success,
            error_reason=error_reason,
        )
        self.operation_logs.append(log)
        return log

    def _create_issue(
        self,
        issue_type: str,
        source: str,
        data: Dict[str, Any],
        reason: str,
    ) -> Issue:
        issue = Issue(
            id=self._generate_id(),
            type=issue_type,
            source=source,
            data=data,
            reason=reason,
        )
        self.issues.append(issue)
        return issue

    def add_route(
        self,
        name: str,
        wall_section: str,
        angle: float,
        holds_data: List[Dict[str, Any]],
        notes: Optional[str] = None,
    ) -> Tuple[Optional[Route], Dict[str, Any]]:
        input_data = {
            "name": name,
            "wall_section": wall_section,
            "angle": angle,
            "holds_count": len(holds_data),
            "notes": notes,
        }

        holds = []
        invalid_holds = []

        for hold_idx, hold_data in enumerate(holds_data):
            try:
                hold = self._parse_hold_data(hold_data)
                errors = ValidationRules.validate_hold(hold)
                if errors:
                    invalid_holds.append({"index": hold_idx, "data": hold_data, "errors": errors})
                    self._create_issue(
                        issue_type="invalid_hold",
                        source=f"add_route_hold_{hold_idx}",
                        data=hold_data,
                        reason="; ".join(errors),
                    )
                else:
                    holds.append(hold)
            except Exception as e:
                invalid_holds.append({"index": hold_idx, "data": hold_data, "error": str(e)})
                self._create_issue(
                    issue_type="hold_parsing_error",
                    source=f"add_route_hold_{hold_idx}",
                    data=hold_data,
                    reason=str(e),
                )

        route = Route(
            id=self._generate_id(),
            name=name,
            wall_section=wall_section,
            angle=angle,
            holds=holds,
            notes=notes,
        )

        errors = ValidationRules.validate_route(route)

        if errors:
            error_reason = "; ".join(errors)
            self._create_issue(
                issue_type="invalid_route",
                source="add_route",
                data={"name": name, "wall_section": wall_section, "angle": angle},
                reason=error_reason,
            )
            self._log_operation(
                operation="add_route",
                input_data=input_data,
                output_data={"valid_holds_count": len(holds), "invalid_holds": invalid_holds},
                success=False,
                error_reason=error_reason,
            )
            return None, {
                "success": False,
                "errors": errors,
                "invalid_holds": invalid_holds,
            }

        self.routes[route.id] = route

        base_score = self.calibration_engine.calculate_route_base_score(route)
        proposed_difficulty = DifficultyConversionRules.score_to_difficulty(base_score)
        route.proposed_difficulty = proposed_difficulty
        route.updated_at = datetime.now()

        output_data = {
            "route_id": route.id,
            "base_score": base_score,
            "proposed_difficulty": proposed_difficulty.value,
            "angle_multiplier": WallAngleRules.get_angle_multiplier(angle),
            "holds_count": len(holds),
            "invalid_holds": invalid_holds,
        }

        self._log_operation(
            operation="add_route",
            input_data=input_data,
            output_data=output_data,
            success=True,
        )

        return route, {
            "success": True,
            "route_id": route.id,
            "proposed_difficulty": proposed_difficulty.value,
            "base_score": round(base_score, 4),
            "angle_multiplier": round(WallAngleRules.get_angle_multiplier(angle), 4),
            "invalid_holds": invalid_holds,
        }

    def _parse_hold_data(self, hold_data: Dict[str, Any]) -> Hold:
        return Hold(
            id=hold_data.get("id", self._generate_id()),
            type=HoldType(hold_data.get("type", "jug").lower()),
            position=hold_data.get("position", {"x": 0, "y": 0}),
            size=hold_data.get("size", 1.0),
            difficulty_contribution=hold_data.get("difficulty_contribution", 1.0),
            is_start=hold_data.get("is_start", False),
            is_end=hold_data.get("is_end", False),
        )

    def update_route(
        self,
        route_id: str,
        updates: Dict[str, Any],
    ) -> Tuple[Optional[Route], Dict[str, Any]]:
        if route_id not in self.routes:
            return None, {
                "success": False,
                "error": f"线路不存在: {route_id}",
            }

        route = self.routes[route_id]
        input_data = {"route_id": route_id, "updates": updates}

        if "name" in updates:
            route.name = updates["name"]
        if "wall_section" in updates:
            route.wall_section = updates["wall_section"]
        if "angle" in updates:
            route.angle = updates["angle"]
        if "notes" in updates:
            route.notes = updates["notes"]

        if "holds" in updates:
            new_holds = []
            invalid_holds = []
            for hold_idx, hold_data in enumerate(updates["holds"]):
                try:
                    hold = self._parse_hold_data(hold_data)
                    errors = ValidationRules.validate_hold(hold)
                    if errors:
                        invalid_holds.append({"index": hold_idx, "data": hold_data, "errors": errors})
                        self._create_issue(
                            issue_type="invalid_hold",
                            source=f"update_route_hold_{hold_idx}",
                            data=hold_data,
                            reason="; ".join(errors),
                        )
                    else:
                        new_holds.append(hold)
                except Exception as e:
                    invalid_holds.append({"index": hold_idx, "data": hold_data, "error": str(e)})
                    self._create_issue(
                        issue_type="hold_parsing_error",
                        source=f"update_route_hold_{hold_idx}",
                        data=hold_data,
                        reason=str(e),
                    )
            route.holds = new_holds

        errors = ValidationRules.validate_route(route)
        if errors:
            error_reason = "; ".join(errors)
            self._create_issue(
                issue_type="invalid_route_update",
                source=f"update_route_{route_id}",
                data=updates,
                reason=error_reason,
            )
            self._log_operation(
                operation="update_route",
                input_data=input_data,
                output_data={},
                success=False,
                error_reason=error_reason,
            )
            return None, {
                "success": False,
                "errors": errors,
            }

        base_score = self.calibration_engine.calculate_route_base_score(route)
        proposed_difficulty = DifficultyConversionRules.score_to_difficulty(base_score)
        route.proposed_difficulty = proposed_difficulty
        route.updated_at = datetime.now()

        feedbacks = self.feedbacks.get(route_id, [])
        if feedbacks:
            calibrated_difficulty, breakdown = self.calibration_engine.calibrate_difficulty(
                route, feedbacks
            )
        else:
            calibrated_difficulty = proposed_difficulty
            breakdown = {"base_score": base_score, "feedback_score": 0.0, "final_score": base_score}

        output_data = {
            "base_score": base_score,
            "proposed_difficulty": proposed_difficulty.value,
            "calibrated_difficulty": calibrated_difficulty.value,
            "breakdown": breakdown,
        }

        self._log_operation(
            operation="update_route",
            input_data=input_data,
            output_data=output_data,
            success=True,
        )

        return route, {
            "success": True,
            "proposed_difficulty": proposed_difficulty.value,
            "base_score": round(base_score, 4),
            "calibrated_difficulty": calibrated_difficulty.value,
        }

    def add_feedback(
        self,
        route_id: str,
        climber_name: str,
        climber_experience_level: str,
        completed: bool,
        perceived_difficulty: Optional[str] = None,
        number_of_attempts: int = 1,
        time_taken: Optional[float] = None,
        comments: Optional[str] = None,
    ) -> Tuple[Optional[ClimbFeedback], Dict[str, Any]]:
        if route_id not in self.routes:
            return None, {
                "success": False,
                "error": f"线路不存在: {route_id}",
            }

        input_data = {
            "route_id": route_id,
            "climber_name": climber_name,
            "climber_experience_level": climber_experience_level,
            "completed": completed,
            "perceived_difficulty": perceived_difficulty,
            "attempts": number_of_attempts,
        }

        try:
            difficulty_enum = None
            if perceived_difficulty:
                difficulty_enum = DifficultyLevel(perceived_difficulty.upper())

            feedback = ClimbFeedback(
                id=self._generate_id(),
                route_id=route_id,
                climber_name=climber_name,
                climber_experience_level=climber_experience_level,
                completed=completed,
                perceived_difficulty=difficulty_enum,
                number_of_attempts=number_of_attempts,
                time_taken=time_taken,
                comments=comments,
            )
        except Exception as e:
            error_reason = f"无效的难度等级: {perceived_difficulty}"
            self._create_issue(
                issue_type="invalid_feedback",
                source="add_feedback",
                data=input_data,
                reason=error_reason,
            )
            self._log_operation(
                operation="add_feedback",
                input_data=input_data,
                output_data={},
                success=False,
                error_reason=error_reason,
            )
            return None, {"success": False, "error": error_reason}

        errors = ValidationRules.validate_feedback(feedback)
        if errors:
            error_reason = "; ".join(errors)
            self._create_issue(
                issue_type="invalid_feedback",
                source="add_feedback",
                data=input_data,
                reason=error_reason,
            )
            self._log_operation(
                operation="add_feedback",
                input_data=input_data,
                output_data={},
                success=False,
                error_reason=error_reason,
            )
            return None, {"success": False, "errors": errors}

        if route_id not in self.feedbacks:
            self.feedbacks[route_id] = []
        self.feedbacks[route_id].append(feedback)

        route = self.routes[route_id]
        all_feedbacks = self.feedbacks[route_id]
        calibrated_difficulty, breakdown = self.calibration_engine.calibrate_difficulty(
            route, all_feedbacks
        )

        route.proposed_difficulty = calibrated_difficulty
        route.updated_at = datetime.now()

        output_data = {
            "feedback_id": feedback.id,
            "total_feedbacks": len(all_feedbacks),
            "calibrated_difficulty": calibrated_difficulty.value,
            "breakdown": breakdown,
        }

        self._log_operation(
            operation="add_feedback",
            input_data=input_data,
            output_data=output_data,
            success=True,
        )

        return feedback, {
            "success": True,
            "feedback_id": feedback.id,
            "calibrated_difficulty": calibrated_difficulty.value,
            "feedback_count": len(all_feedbacks),
            "breakdown": {k: round(v, 4) if isinstance(v, float) else v for k, v in breakdown.items()},
        }

    def submit_for_review(self, route_id: str) -> Dict[str, Any]:
        if route_id not in self.routes:
            return {"success": False, "error": f"线路不存在: {route_id}"}

        route = self.routes[route_id]
        input_data = {"route_id": route_id}

        if route.status == RouteStatus.DRAFT:
            route.status = RouteStatus.PENDING_REVIEW
            route.updated_at = datetime.now()

            output_data = {
                "route_name": route.name,
                "proposed_difficulty": route.proposed_difficulty.value if route.proposed_difficulty else None,
                "new_status": RouteStatus.PENDING_REVIEW.value,
            }

            self._log_operation(
                operation="submit_for_review",
                input_data=input_data,
                output_data=output_data,
                success=True,
            )

            return {
                "success": True,
                "route_name": route.name,
                "proposed_difficulty": route.proposed_difficulty.value if route.proposed_difficulty else None,
                "status": RouteStatus.PENDING_REVIEW.value,
            }
        else:
            error_reason = f"线路状态不允许提交审核: {route.status.value}"
            self._log_operation(
                operation="submit_for_review",
                input_data=input_data,
                output_data={},
                success=False,
                error_reason=error_reason,
            )
            return {"success": False, "error": error_reason}

    def confirm_route(self, route_id: str, confirmed_difficulty: Optional[str] = None) -> Dict[str, Any]:
        if route_id not in self.routes:
            return {"success": False, "error": f"线路不存在: {route_id}"}

        route = self.routes[route_id]
        input_data = {
            "route_id": route_id,
            "confirmed_difficulty": confirmed_difficulty,
        }

        if route.status not in [RouteStatus.PENDING_REVIEW, RouteStatus.DRAFT]:
            error_reason = f"线路状态不允许确认: {route.status.value}"
            self._log_operation(
                operation="confirm_route",
                input_data=input_data,
                output_data={},
                success=False,
                error_reason=error_reason,
            )
            return {"success": False, "error": error_reason}

        try:
            if confirmed_difficulty:
                difficulty = DifficultyLevel(confirmed_difficulty.upper())
            else:
                difficulty = route.proposed_difficulty
        except Exception as e:
            error_reason = f"无效的难度等级: {confirmed_difficulty}"
            self._create_issue(
                issue_type="invalid_difficulty",
                source="confirm_route",
                data=input_data,
                reason=error_reason,
            )
            self._log_operation(
                operation="confirm_route",
                input_data=input_data,
                output_data={},
                success=False,
                error_reason=error_reason,
            )
            return {"success": False, "error": error_reason}

        route.confirmed_difficulty = difficulty
        route.status = RouteStatus.CONFIRMED
        route.updated_at = datetime.now()

        output_data = {
            "route_name": route.name,
            "confirmed_difficulty": difficulty.value,
            "new_status": RouteStatus.CONFIRMED.value,
        }

        self._log_operation(
            operation="confirm_route",
            input_data=input_data,
            output_data=output_data,
            success=True,
        )

        return {
            "success": True,
            "route_name": route.name,
            "confirmed_difficulty": difficulty.value,
            "status": RouteStatus.CONFIRMED.value,
        }

    def reject_route(self, route_id: str, reason: str) -> Dict[str, Any]:
        if route_id not in self.routes:
            return {"success": False, "error": f"线路不存在: {route_id}"}

        route = self.routes[route_id]
        input_data = {"route_id": route_id, "reason": reason}

        if route.status != RouteStatus.PENDING_REVIEW:
            error_reason = f"线路状态不允许拒绝: {route.status.value}"
            self._log_operation(
                operation="reject_route",
                input_data=input_data,
                output_data={},
                success=False,
                error_reason=error_reason,
            )
            return {"success": False, "error": error_reason}

        route.status = RouteStatus.REJECTED
        route.updated_at = datetime.now()
        route.notes = (route.notes or "") + f"\n[拒绝原因] {reason}"

        self._create_issue(
            issue_type="route_rejected",
            source="reject_route",
            data={"route_id": route_id, "route_name": route.name},
            reason=reason,
        )

        output_data = {
            "route_name": route.name,
            "new_status": RouteStatus.REJECTED.value,
            "rejection_reason": reason,
        }

        self._log_operation(
            operation="reject_route",
            input_data=input_data,
            output_data=output_data,
            success=True,
        )

        return {
            "success": True,
            "route_name": route.name,
            "status": RouteStatus.REJECTED.value,
            "rejection_reason": reason,
        }

    def get_route(self, route_id: str) -> Optional[Dict[str, Any]]:
        if route_id not in self.routes:
            return None

        route = self.routes[route_id]
        feedbacks = self.feedbacks.get(route_id, [])

        breakdown = None
        if feedbacks:
            _, breakdown = self.calibration_engine.calibrate_difficulty(route, feedbacks)

        return {
            "id": route.id,
            "name": route.name,
            "wall_section": route.wall_section,
            "angle": route.angle,
            "status": route.status.value,
            "proposed_difficulty": route.proposed_difficulty.value if route.proposed_difficulty else None,
            "confirmed_difficulty": route.confirmed_difficulty.value if route.confirmed_difficulty else None,
            "holds_count": len(route.holds),
            "feedbacks_count": len(feedbacks),
            "base_score": self.calibration_engine.calculate_route_base_score(route),
            "breakdown": breakdown,
            "notes": route.notes,
        }

    def list_routes(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        routes = []
        for route in self.routes.values():
            if status and route.status.value != status:
                continue
            routes.append(self.get_route(route.id))
        return routes

    def get_issues(self, unresolved_only: bool = True) -> List[Dict[str, Any]]:
        issues = []
        for issue in self.issues:
            if unresolved_only and issue.resolved:
                continue
            issues.append({
                "id": issue.id,
                "type": issue.type,
                "source": issue.source,
                "data": issue.data,
                "reason": issue.reason,
                "created_at": issue.created_at.isoformat(),
                "resolved": issue.resolved,
            })
        return issues

    def get_operation_logs(self, operation: Optional[str] = None) -> List[Dict[str, Any]]:
        logs = []
        for log in reversed(self.operation_logs):
            if operation and log.operation != operation:
                continue
            logs.append({
                "id": log.id,
                "operation": log.operation,
                "input_data": log.input_data,
                "output_data": log.output_data,
                "success": log.success,
                "error_reason": log.error_reason,
                "timestamp": log.timestamp.isoformat(),
            })
        return logs

    def export_routes(self, filepath: str) -> Dict[str, Any]:
        export_data = {
            "export_time": datetime.now().isoformat(),
            "routes": [],
            "summary": {
                "total_routes": len(self.routes),
                "by_difficulty": {},
                "by_status": {},
            },
        }

        for route in self.routes.values():
            feedbacks = self.feedbacks.get(route.id, [])
            breakdown = None
            if feedbacks:
                _, breakdown = self.calibration_engine.calibrate_difficulty(route, feedbacks)

            route_data = {
                "id": route.id,
                "name": route.name,
                "wall_section": route.wall_section,
                "angle": route.angle,
                "status": route.status.value,
                "proposed_difficulty": route.proposed_difficulty.value if route.proposed_difficulty else None,
                "confirmed_difficulty": route.confirmed_difficulty.value if route.confirmed_difficulty else None,
                "holds": [
                    {
                        "id": h.id,
                        "type": h.type.value,
                        "position": h.position,
                        "size": h.size,
                        "difficulty_contribution": h.difficulty_contribution,
                        "is_start": h.is_start,
                        "is_end": h.is_end,
                        "base_difficulty": HoldDifficultyRules.get_hold_base_difficulty(h.type),
                        "calculated_difficulty": HoldDifficultyRules.calculate_hold_difficulty(h),
                    }
                    for h in route.holds
                ],
                "feedbacks_count": len(feedbacks),
                "angle_multiplier": WallAngleRules.get_angle_multiplier(route.angle),
                "base_score": self.calibration_engine.calculate_route_base_score(route),
                "breakdown": breakdown,
                "notes": route.notes,
                "created_at": route.created_at.isoformat(),
                "updated_at": route.updated_at.isoformat(),
            }
            export_data["routes"].append(route_data)

            diff = route.confirmed_difficulty or route.proposed_difficulty
            if diff:
                key = diff.value
                export_data["summary"]["by_difficulty"][key] = (
                    export_data["summary"]["by_difficulty"].get(key, 0) + 1
                )

            status_key = route.status.value
            export_data["summary"]["by_status"][status_key] = (
                export_data["summary"]["by_status"].get(status_key, 0) + 1
            )

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        self._log_operation(
            operation="export_routes",
            input_data={"filepath": filepath},
            output_data=export_data["summary"],
            success=True,
        )

        return {
            "success": True,
            "filepath": filepath,
            "summary": export_data["summary"],
        }

    def resolve_issue(self, issue_id: str, resolution: str) -> Dict[str, Any]:
        for issue in self.issues:
            if issue.id == issue_id:
                issue.resolved = True
                issue.resolution = resolution
                self._log_operation(
                    operation="resolve_issue",
                    input_data={"issue_id": issue_id, "resolution": resolution},
                    output_data={
                        "issue_type": issue.type,
                        "issue_source": issue.source,
                    },
                    success=True,
                )
                return {
                    "success": True,
                    "issue_id": issue_id,
                    "resolved": True,
                }

        return {"success": False, "error": f"问题不存在: {issue_id}"}
