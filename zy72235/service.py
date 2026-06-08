from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from models import (
    HolidayExtension, TailAdjustment, LoanRenewalScore, BusinessDetail,
    ChangeRecord, ReviewRecord, DifferenceItem, BusinessStatus,
    ReviewAction, NextStepRole, MaterialType
)


class LoanRenewalScoreService:
    def __init__(self):
        self.scores: Dict[str, LoanRenewalScore] = {}
        self._holiday_keys: set = set()

    def import_holiday_extensions(
        self,
        holidays: List[HolidayExtension],
        import_batch_no: str,
        operator: str = "投研助理小周"
    ) -> Tuple[int, int]:
        imported_count = 0
        skipped_count = 0

        for holiday in holidays:
            holiday.import_batch_no = import_batch_no
            holiday.imported_at = datetime.now()
            holiday.imported_by = operator

            key = holiday.get_key()
            business_no = holiday.business_no

            if business_no not in self.scores:
                self.scores[business_no] = LoanRenewalScore(business_no=business_no)

            score = self.scores[business_no]

            existing = None
            for h in score.holiday_extensions:
                if h.get_key() == key:
                    existing = h
                    break

            if existing:
                if holiday.remark and holiday.remark != existing.remark:
                    old_remark = existing.remark
                    existing.remark = holiday.remark
                    existing.version += 1
                    existing.import_batch_no = import_batch_no

                    change = ChangeRecord(
                        entity_type="HolidayExtension",
                        entity_id=existing.id,
                        field_name="remark",
                        old_value=old_remark,
                        new_value=holiday.remark,
                        changed_by=operator,
                        change_reason="导入时备注更新"
                    )
                    score.change_history.append(change)
                    score.updated_at = datetime.now()
                    self._update_differences(score)
                skipped_count += 1
            else:
                score.holiday_extensions.append(holiday)
                self._holiday_keys.add(key)
                score.updated_at = datetime.now()

                self._generate_business_details(score, holiday)
                self._update_differences(score)
                imported_count += 1

        return imported_count, skipped_count

    def import_tail_adjustments(
        self,
        adjustments: List[TailAdjustment],
        import_batch_no: str,
        operator: str = "投研助理小周"
    ) -> Tuple[int, int]:
        imported_count = 0
        skipped_count = 0

        for adj in adjustments:
            adj.import_batch_no = import_batch_no
            adj.imported_at = datetime.now()
            adj.imported_by = operator

            business_no = adj.business_no

            if business_no not in self.scores:
                self.scores[business_no] = LoanRenewalScore(business_no=business_no)

            score = self.scores[business_no]

            existing = None
            for a in score.tail_adjustments:
                if (a.business_no == adj.business_no and
                    a.adjustment_type == adj.adjustment_type and
                    abs(a.amount - adj.amount) < 0.001):
                    existing = a
                    break

            if existing:
                if adj.remark and adj.remark != existing.remark:
                    old_remark = existing.remark
                    existing.remark = adj.remark
                    existing.version += 1

                    change = ChangeRecord(
                        entity_type="TailAdjustment",
                        entity_id=existing.id,
                        field_name="remark",
                        old_value=old_remark,
                        new_value=adj.remark,
                        changed_by=operator,
                        change_reason="尾差调整条备注更新"
                    )
                    score.change_history.append(change)
                    score.updated_at = datetime.now()
                skipped_count += 1
            else:
                score.tail_adjustments.append(adj)
                score.updated_at = datetime.now()
                imported_count += 1

            self._link_tail_to_details(score, adj)
            self._update_differences(score)

        return imported_count, skipped_count

    def _link_tail_to_details(self, score: LoanRenewalScore, adj: TailAdjustment):
        for detail in score.business_details:
            if detail.business_no == adj.business_no and detail.related_tail_id is None:
                detail.related_tail_id = adj.id

    def _generate_business_details(self, score: LoanRenewalScore, holiday: HolidayExtension):
        has_split = any(
            d.detail_type in ["手续费", "本金"]
            for d in score.business_details
        )

        if has_split:
            return

        fee_detail = BusinessDetail(
            business_no=score.business_no,
            detail_type="手续费",
            amount=0.0,
            related_holiday_id=holiday.id,
            status=BusinessStatus.PENDING_REVIEW
        )
        principal_detail = BusinessDetail(
            business_no=score.business_no,
            detail_type="本金",
            amount=0.0,
            related_holiday_id=holiday.id,
            status=BusinessStatus.PENDING_REVIEW
        )
        score.business_details.append(fee_detail)
        score.business_details.append(principal_detail)

    def update_remark(
        self,
        business_no: str,
        material_type: MaterialType,
        material_id: str,
        new_remark: str,
        operator: str = "投研助理小周",
        reason: str = ""
    ) -> bool:
        if business_no not in self.scores:
            return False

        score = self.scores[business_no]
        target = None
        entity_type = ""

        if material_type == MaterialType.HOLIDAY_EXTENSION:
            entity_type = "HolidayExtension"
            for h in score.holiday_extensions:
                if h.id == material_id:
                    target = h
                    break
        else:
            entity_type = "TailAdjustment"
            for a in score.tail_adjustments:
                if a.id == material_id:
                    target = a
                    break

        if not target or target.remark == new_remark:
            return False

        old_remark = target.remark
        target.remark = new_remark
        target.version += 1

        change = ChangeRecord(
            entity_type=entity_type,
            entity_id=material_id,
            field_name="remark",
            old_value=old_remark,
            new_value=new_remark,
            changed_by=operator,
            change_reason=reason or "手动修改备注"
        )
        score.change_history.append(change)
        score.updated_at = datetime.now()

        self._update_differences(score)

        return True

    def get_change_history(self, business_no: str) -> List[Dict]:
        if business_no not in self.scores:
            return []

        score = self.scores[business_no]
        return [c.to_dict() for c in score.change_history]

    def review_by_settlement_supervisor(
        self,
        business_no: str,
        detail_ids: List[str],
        action: ReviewAction,
        comment: str,
        reviewer: str = "结算主管"
    ) -> bool:
        if business_no not in self.scores:
            return False

        score = self.scores[business_no]

        for detail in score.business_details:
            if detail.id in detail_ids:
                if action == ReviewAction.APPROVE:
                    detail.status = BusinessStatus.NORMAL
                elif action == ReviewAction.REJECT:
                    detail.status = BusinessStatus.DISPUTED
                elif action == ReviewAction.NEEDS_INFO:
                    detail.status = BusinessStatus.NEEDS_MATERIAL

        review = ReviewRecord(
            business_no=business_no,
            reviewer=reviewer,
            review_action=action,
            review_comment=comment,
            affected_details=detail_ids
        )
        score.review_records.append(review)
        score.updated_at = datetime.now()

        self._update_differences(score)

        return True

    def _update_differences(self, score: LoanRenewalScore):
        score.differences = []

        pending_details = [
            d for d in score.business_details
            if d.status == BusinessStatus.PENDING_REVIEW
        ]
        if pending_details:
            diff = DifferenceItem(
                business_no=score.business_no,
                description=f"业务号 {score.business_no} 存在待复核明细（{len(pending_details)}条）",
                reason_kept="同一业务号拆分为手续费和本金两行，需结算主管确认拆分合理性",
                missing_materials=["结算主管复核意见"],
                next_step_role=NextStepRole.SETTLEMENT_SUPERVISOR,
                next_step_action="请结算主管复核手续费本金拆分是否合理"
            )
            if pending_details and pending_details[0].related_holiday_id:
                diff.related_holiday_id = pending_details[0].related_holiday_id
            score.differences.append(diff)

        needs_material = [
            d for d in score.business_details
            if d.status == BusinessStatus.NEEDS_MATERIAL
        ]
        if needs_material:
            diff = DifferenceItem(
                business_no=score.business_no,
                description=f"业务号 {score.business_no} 需要补充材料",
                reason_kept="结算主管要求补充信息",
                missing_materials=["补充说明材料", "相关凭证"],
                next_step_role=NextStepRole.RESEARCH_ASSISTANT,
                next_step_action="请投研助理小周联系业务经理补充材料"
            )
            score.differences.append(diff)

        disputed = [
            d for d in score.business_details
            if d.status == BusinessStatus.DISPUTED
        ]
        if disputed:
            diff = DifferenceItem(
                business_no=score.business_no,
                description=f"业务号 {score.business_no} 存在争议",
                reason_kept="结算主管驳回，存在争议需要进一步核实",
                missing_materials=["争议说明", "沟通记录"],
                next_step_role=NextStepRole.BUSINESS_MANAGER,
                next_step_action="请业务经理核实情况并反馈"
            )
            score.differences.append(diff)

        if not score.holiday_extensions:
            diff = DifferenceItem(
                business_no=score.business_no,
                description=f"业务号 {score.business_no} 缺少节假日顺延说明",
                reason_kept="未导入节假日顺延说明，无法完成评分",
                missing_materials=["节假日顺延说明"],
                next_step_role=NextStepRole.RESEARCH_ASSISTANT,
                next_step_action="请投研助理小周导入节假日顺延说明"
            )
            score.differences.append(diff)

        if not score.tail_adjustments:
            diff = DifferenceItem(
                business_no=score.business_no,
                description=f"业务号 {score.business_no} 缺少尾差调整条",
                reason_kept="未导入尾差调整条，评分可能不准确",
                missing_materials=["尾差调整条"],
                next_step_role=NextStepRole.RESEARCH_ASSISTANT,
                next_step_action="请投研助理小周补看并导入尾差调整条"
            )
            score.differences.append(diff)

    def navigate_to_source_material(
        self,
        business_no: str,
        detail_id: str
    ) -> Optional[Dict]:
        if business_no not in self.scores:
            return None

        score = self.scores[business_no]

        detail = None
        for d in score.business_details:
            if d.id == detail_id:
                detail = d
                break

        if not detail:
            return None

        result = {
            "detail": detail,
            "holiday_extension": None,
            "tail_adjustment": None
        }

        if detail.related_holiday_id:
            for h in score.holiday_extensions:
                if h.id == detail.related_holiday_id:
                    result["holiday_extension"] = h
                    break

        if detail.related_tail_id:
            for a in score.tail_adjustments:
                if a.id == detail.related_tail_id:
                    result["tail_adjustment"] = a
                    break

        return result

    def get_all_scores(self) -> List[LoanRenewalScore]:
        return list(self.scores.values())

    def get_score(self, business_no: str) -> Optional[LoanRenewalScore]:
        return self.scores.get(business_no)
