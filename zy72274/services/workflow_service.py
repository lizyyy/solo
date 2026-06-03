import json
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from models import RescueProfile, InspectionPhoto, CADLayer, ChangeHistory
from config import settings
from boundary_rules import BoundaryRuleEngine, BoundaryCheckResult
from services.display_service import DisplayService


class WorkflowService:
    """
    三步工作流服务
    ======================================
    步骤:
    1. photo_import - 巡检照片编号第一次导入
    2. cad_layer_review - 设备工程师许工补看CAD图层名
    3. export_screenshot - 导出截图更新

    核心约束:
    - 碰到 length_mismatch 别急着归正常，留给客户复核
    - 每步推进前检查 RULE_004（不能跳步）
    - 导出前检查 RULE_005（必须复核完成）
    """

    STEPS = settings.WORKFLOW_STEPS

    def __init__(self, db: Session):
        self.db = db
        self.display_service = DisplayService(db)

    def get_workflow_status(self, profile_id: int) -> Dict:
        profile = self.db.query(RescueProfile).filter(
            RescueProfile.id == profile_id
        ).first()

        if not profile:
            raise ValueError(f"剖面 {profile_id} 不存在")

        current_idx = self.STEPS.index(profile.workflow_step) if profile.workflow_step in self.STEPS else -1

        steps_status = []
        for i, step in enumerate(self.STEPS):
            steps_status.append({
                "step_code": step,
                "step_name": self._get_step_name(step),
                "completed": i < current_idx,
                "current": i == current_idx,
                "pending": i > current_idx
            })

        return {
            "profile_id": profile.id,
            "photo_number": profile.photo.photo_number,
            "current_step": profile.workflow_step,
            "current_step_name": self._get_step_name(profile.workflow_step),
            "status": profile.status,
            "length_mismatch": profile.length_mismatch,
            "needs_review": profile.needs_review,
            "steps": steps_status,
            "can_advance": self._can_advance(profile),
            "blocked_reason": self._get_blocked_reason(profile)
        }

    def _get_step_name(self, step_code: str) -> str:
        names = {
            "photo_import": "巡检照片导入",
            "cad_layer_review": "CAD图层补看",
            "export_screenshot": "导出截图更新"
        }
        return names.get(step_code, step_code)

    def _can_advance(self, profile: RescueProfile) -> bool:
        if profile.length_mismatch and profile.workflow_step != "photo_import":
            return False
        if profile.needs_review and profile.workflow_step == "export_screenshot":
            return False
        return True

    def _get_blocked_reason(self, profile: RescueProfile) -> Optional[str]:
        if profile.length_mismatch:
            return "存在补录路线未重新计算长度，请先复核或修正"
        if profile.needs_review and profile.workflow_step == "export_screenshot":
            return "存在待复核项，需客户复核完成后才能导出"
        return None

    def advance_step(
        self,
        profile_id: int,
        operator: str,
        cad_data: Optional[Dict] = None,
        screenshot_path: Optional[str] = None
    ) -> Tuple[RescueProfile, List[BoundaryCheckResult]]:
        """推进工作流到下一步"""
        profile = self.db.query(RescueProfile).filter(
            RescueProfile.id == profile_id
        ).first()

        if not profile:
            raise ValueError(f"剖面 {profile_id} 不存在")

        check_results: List[BoundaryCheckResult] = []

        current_idx = self.STEPS.index(profile.workflow_step)
        if current_idx >= len(self.STEPS) - 1:
            raise ValueError("已到达最终步骤，无法继续推进")

        target_step = self.STEPS[current_idx + 1]

        step_result = BoundaryRuleEngine.check_workflow_step(
            profile.workflow_step, target_step, self.STEPS
        )
        check_results.append(step_result)

        if not step_result.passed:
            profile.needs_review = True
            self.db.commit()
            return profile, check_results

        if target_step == "cad_layer_review":
            photo = profile.photo
            if cad_data and "layers" in cad_data:
                for layer_data in cad_data["layers"]:
                    layer = CADLayer(
                        photo_id=photo.id,
                        layer_name=layer_data.get("layer_name", ""),
                        layer_name_clean=self._clean_layer_name(layer_data.get("layer_name", "")),
                        layer_remark=layer_data.get("layer_remark"),
                        layer_material=layer_data.get("layer_material"),
                        layer_thickness=layer_data.get("layer_thickness"),
                        has_remark=bool(layer_data.get("layer_remark")),
                        reviewed_by=operator,
                        reviewed_at=datetime.utcnow()
                    )
                    self.db.add(layer)

            photo.updated_at = datetime.utcnow()

        elif target_step == "export_screenshot":
            export_check = BoundaryRuleEngine.check_export_allowed(
                needs_review=profile.needs_review,
                length_mismatch=profile.length_mismatch
            )
            check_results.append(export_check)

            if not export_check.passed:
                return profile, check_results

            if screenshot_path:
                profile.screenshot_path = screenshot_path

            profile.status = "reviewed" if not profile.length_mismatch else "pending"

        profile.workflow_step = target_step
        profile.updated_at = datetime.utcnow()

        self.db.commit()
        return profile, check_results

    def _clean_layer_name(self, full_name: str) -> str:
        """仅提取干净的图层名用于展示，原始全名保留在 layer_name"""
        import re
        cleaned = re.sub(r'[（(【\[].*?[）)】\]]', '', full_name)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

    def flag_for_review(
        self,
        profile_id: int,
        flagged_by: str,
        reason: str
    ) -> RescueProfile:
        """标记为待客户复核"""
        profile = self.db.query(RescueProfile).filter(
            RescueProfile.id == profile_id
        ).first()

        if not profile:
            raise ValueError(f"剖面 {profile_id} 不存在")

        profile.needs_review = True
        profile.status = "pending"

        self.db.commit()
        return profile

    def resolve_length_mismatch(
        self,
        profile_id: int,
        new_length: float,
        resolved_by: str,
        recalculated: bool = True
    ) -> Tuple[RescueProfile, List[BoundaryCheckResult]]:
        """
        解决长度不匹配问题
        核心: 别急着归 normal，留给客户复核
        """
        profile = self.db.query(RescueProfile).filter(
            RescueProfile.id == profile_id
        ).first()

        if not profile:
            raise ValueError(f"剖面 {profile_id} 不存在")

        photo = profile.photo
        check_results: List[BoundaryCheckResult] = []

        old_length = photo.route_length

        photo.route_length = new_length
        photo.has_recalculated_length = recalculated
        photo.updated_at = datetime.utcnow()

        if recalculated:
            length_result = BoundaryRuleEngine.check_route_length({
                "has_recalculated_length": True,
                "route_length": new_length,
                "historical_route_length": old_length
            })
            check_results.append(length_result)

            profile.length_mismatch = not length_result.passed
            if length_result.passed:
                profile.needs_review = False
                profile.status = "normal"
            else:
                profile.status = "pending"
                profile.needs_review = True
        else:
            profile.length_mismatch = True
            profile.needs_review = True
            profile.status = "pending"

        history = ChangeHistory(
            photo_id=photo.id,
            profile_id=profile.id,
            field_name="route_length",
            old_value=str(old_length) if old_length else "",
            new_value=str(new_length),
            changed_by=resolved_by,
            change_reason="重新计算路线长度" if recalculated else "手动设置路线长度",
            rollback_possible=True
        )
        self.db.add(history)

        self.db.commit()
        return profile, check_results

    def complete_customer_review(
        self,
        profile_id: int,
        reviewed_by: str,
        review_result: str,
        remarks: Optional[str] = None
    ) -> RescueProfile:
        """
        客户复核完成
        只有客户复核通过，才能解除 needs_review
        """
        profile = self.db.query(RescueProfile).filter(
            RescueProfile.id == profile_id
        ).first()

        if not profile:
            raise ValueError(f"剖面 {profile_id} 不存在")

        if review_result == "accepted":
            profile.needs_review = False
            if profile.length_mismatch:
                profile.status = "abnormal"
            else:
                profile.status = "normal"
        elif review_result == "rejected":
            profile.needs_review = True
            profile.status = "pending"
        elif review_result == "needs_recalculation":
            profile.needs_review = True
            profile.length_mismatch = True
            profile.status = "pending"

        history = ChangeHistory(
            photo_id=profile.photo_id,
            profile_id=profile.id,
            field_name="customer_review",
            old_value="",
            new_value=json.dumps({
                "result": review_result,
                "remarks": remarks
            }, ensure_ascii=False),
            changed_by=reviewed_by,
            change_reason="客户复核完成",
            rollback_possible=True
        )
        self.db.add(history)

        self.db.commit()
        return profile

    def run_complete_workflow(
        self,
        photo_data: Dict,
        cad_layers_data: List[Dict],
        operator: str,
        screenshot_path: Optional[str] = None
    ) -> Dict:
        """
        执行完整三步工作流（演示用）
        中间碰到异常不自动归正常，留给客户复核
        """
        from services.import_service import ImportService

        import_service = ImportService(self.db)

        batch, import_results = import_service.import_photos(
            [photo_data],
            source_file="workflow_demo",
            imported_by=operator
        )

        photo = self.db.query(InspectionPhoto).filter(
            InspectionPhoto.photo_number == photo_data["photo_number"]
        ).first()

        profile = self.db.query(RescueProfile).filter(
            RescueProfile.photo_id == photo.id
        ).first()

        workflow_log = []

        for _ in range(len(self.STEPS) - 1):
            status = self.get_workflow_status(profile.id)
            workflow_log.append({
                "step": status["current_step"],
                "step_name": status["current_step_name"],
                "length_mismatch": status["length_mismatch"],
                "needs_review": status["needs_review"],
                "blocked": status.get("blocked_reason")
            })

            if status["length_mismatch"] and not status["can_advance"]:
                workflow_log.append({
                    "action": "length_mismatch_detected",
                    "message": "检测到补录路线未重新计算长度，留待客户复核，不自动归为正常"
                })
                break

            cad_data = {"layers": cad_layers_data} if status["current_step"] == "photo_import" else None
            profile, step_results = self.advance_step(
                profile.id, operator, cad_data=cad_data, screenshot_path=screenshot_path
            )

        final_status = self.get_workflow_status(profile.id)

        return {
            "batch_id": batch.batch_id,
            "profile_id": profile.id,
            "photo_number": photo.photo_number,
            "workflow_log": workflow_log,
            "final_status": final_status,
            "needs_customer_review": final_status["needs_review"] or final_status["length_mismatch"]
        }
