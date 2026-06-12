from datetime import datetime
from typing import List, Tuple, Dict, Any
from models import (
    DepositRefundOrder, SignInPhoto, TicketExportRecord,
    LessonVerification, ConflictEvidence, CalculationParam,
    RefundStatus, DataSource
)


class DepositRefundProcessor:
    """乐器租赁押金退款处理器 - 实现三步流程：导入签到→店长复核→更新核销单"""

    CALCULATION_VERSION = "v2.1.0"
    DEPOSIT_REFUND_RATE = 1.0
    LESSON_FEE_PER_HOUR = 200.0

    def __init__(self):
        self.calculation_params = self._init_calculation_params()

    def _init_calculation_params(self) -> List[CalculationParam]:
        return [
            CalculationParam(
                param_name="押金退款比例",
                param_version=self.CALCULATION_VERSION,
                param_value=self.DEPOSIT_REFUND_RATE,
                trade_off_reason="采用全额退款策略，根据合同条款，完成全部课时后押金全额退还"
            ),
            CalculationParam(
                param_name="单课时费用",
                param_version=self.CALCULATION_VERSION,
                param_value=self.LESSON_FEE_PER_HOUR,
                trade_off_reason="2026年Q2统一课时费标准，一线城市统一价"
            ),
            CalculationParam(
                param_name="授权地区校验开关",
                param_version=self.CALCULATION_VERSION,
                param_value=True,
                trade_off_reason="开启地区校验，异常情况留待店长人工复核，不自动归一化"
            )
        ]

    def step1_import_sign_in_photos(self, order: DepositRefundOrder) -> str:
        """
        第一步：课时签到照片第一次导入
        检测授权地区是否匹配，但不自动归正常，留待店长复核
        """
        order.current_step = 1
        order.add_history(
            operator="系统",
            action="第一步：导入课时签到照片",
            detail=f"成功导入 {len(order.sign_in_photos)} 张签到照片",
            data_source=DataSource.SIGN_IN_PHOTO
        )

        area_issues = self._check_authorized_areas(order)
        if area_issues:
            order.status = RefundStatus.AREA_MISMATCH
            issue_detail = "；".join(area_issues)
            order.add_history(
                operator="系统",
                action="授权地区校验",
                detail=f"检测到地区异常：{issue_detail}，已标记待店长复核，未自动归一化",
                data_source=DataSource.SIGN_IN_PHOTO
            )
            return f"第一步完成：已导入签到照片，检测到地区异常，状态：{order.status.value}"
        else:
            order.add_history(
                operator="系统",
                action="授权地区校验",
                detail="所有签到照片的城市均在授权范围内",
                data_source=DataSource.SIGN_IN_PHOTO
            )
            return f"第一步完成：已导入签到照片，地区校验通过"

    def _check_authorized_areas(self, order: DepositRefundOrder) -> List[str]:
        """检查签到照片中的城市是否都在授权列表中"""
        issues = []
        for photo in order.sign_in_photos:
            if photo.authorized_city not in order.authorized_cities:
                issues.append(
                    f"照片[{photo.photo_id}]城市「{photo.authorized_city}」"
                    f"不在授权列表{order.authorized_cities}中"
                )
        return issues

    def step2_store_manager_review_tickets(self, order: DepositRefundOrder) -> str:
        """
        第二步：琴行店长老周补看票务导出表
        检测签到照片与票务导出表是否矛盾，列出冲突证据，不自动拍板
        """
        order.current_step = 2
        order.add_history(
            operator="店长-老周",
            action="第二步：店长查看票务导出表",
            detail=f"查看 {len(order.ticket_records)} 条票务导出记录",
            data_source=DataSource.TICKET_EXPORT
        )

        conflicts = self._detect_conflicts(order)
        order.conflicts = conflicts

        old_caliber_count = sum(1 for t in order.ticket_records if t.is_old_caliber)

        if conflicts:
            order.status = RefundStatus.CALIBER_CONFLICT
            conflict_detail = "；".join([c.description for c in conflicts])
            order.add_history(
                operator="系统",
                action="冲突检测",
                detail=f"检测到 {len(conflicts)} 处矛盾：{conflict_detail}，请店长确认或驳回",
                data_source=DataSource.TICKET_EXPORT
            )
            return (f"第二步完成：已查看票务表，检测到 {len(conflicts)} 处冲突，"
                    f"旧口径记录 {old_caliber_count} 条，状态：{order.status.value}")
        elif old_caliber_count > 0:
            order.status = RefundStatus.SUPPLEMENTED
            order.add_history(
                operator="系统",
                action="旧口径检测",
                detail=f"发现 {old_caliber_count} 条票务导出表补来的旧口径记录，已标记补录来源",
                data_source=DataSource.TICKET_EXPORT
            )
            return (f"第二步完成：已查看票务表，发现 {old_caliber_count} 条旧口径补录记录，"
                    f"状态：{order.status.value}")
        else:
            order.add_history(
                operator="系统",
                action="一致性校验",
                detail="签到照片与票务导出表数据一致，无冲突",
                data_source=DataSource.TICKET_EXPORT
            )
            return "第二步完成：已查看票务表，数据一致无冲突"

    def _detect_conflicts(self, order: DepositRefundOrder) -> List[ConflictEvidence]:
        """检测签到照片与票务导出表之间的矛盾"""
        conflicts = []
        photo_map = {p.lesson_id: p for p in order.sign_in_photos}
        ticket_map = {t.lesson_id: t for t in order.ticket_records}

        all_lesson_ids = set(photo_map.keys()) | set(ticket_map.keys())
        conflict_idx = 1

        for lesson_id in all_lesson_ids:
            photo = photo_map.get(lesson_id)
            ticket = ticket_map.get(lesson_id)

            if not photo or not ticket:
                continue

            if photo.authorized_city != ticket.city:
                conflicts.append(ConflictEvidence(
                    conflict_id=f"CON-{conflict_idx:03d}",
                    field_name="上课城市",
                    photo_value=photo.authorized_city,
                    ticket_value=ticket.city,
                    photo_source=photo.photo_id,
                    ticket_source=ticket.ticket_id,
                    description=f"课时{lesson_id}：照片显示城市「{photo.authorized_city}」，票务表显示「{ticket.city}」"
                ))
                conflict_idx += 1

            if photo.check_in_status == "已签到" and ticket.ticket_status == "未使用":
                conflicts.append(ConflictEvidence(
                    conflict_id=f"CON-{conflict_idx:03d}",
                    field_name="签到状态",
                    photo_value=photo.check_in_status,
                    ticket_value=ticket.ticket_status,
                    photo_source=photo.photo_id,
                    ticket_source=ticket.ticket_id,
                    description=f"课时{lesson_id}：照片显示「{photo.check_in_status}」，票务表显示「{ticket.ticket_status}」"
                ))
                conflict_idx += 1

            photo_date = photo.sign_time.date()
            ticket_date = ticket.class_date.date()
            if photo_date != ticket_date:
                conflicts.append(ConflictEvidence(
                    conflict_id=f"CON-{conflict_idx:03d}",
                    field_name="上课日期",
                    photo_value=photo_date.strftime("%Y-%m-%d"),
                    ticket_value=ticket_date.strftime("%Y-%m-%d"),
                    photo_source=photo.photo_id,
                    ticket_source=ticket.ticket_id,
                    description=f"课时{lesson_id}：照片日期「{photo_date}」，票务表日期「{ticket_date}」"
                ))
                conflict_idx += 1

        return conflicts

    def resolve_conflict(self, order: DepositRefundOrder, conflict_id: str,
                         confirm: bool, manager_note: str = "") -> str:
        """店长解决冲突：确认或驳回"""
        conflict = next((c for c in order.conflicts if c.conflict_id == conflict_id), None)
        if not conflict:
            return f"未找到冲突记录：{conflict_id}"

        action = "确认采纳" if confirm else "驳回"
        source = conflict.photo_source if confirm else conflict.ticket_source
        order.add_history(
            operator="店长-老周",
            action=f"冲突处理：{action}",
            detail=f"冲突{conflict_id}：{action}「{conflict.field_name}」字段，以{source}为准。备注：{manager_note}",
            data_source=DataSource.MANUAL_SUPPLEMENT
        )

        order.conflicts = [c for c in order.conflicts if c.conflict_id != conflict_id]
        if not order.conflicts and order.status == RefundStatus.CALIBER_CONFLICT:
            order.status = RefundStatus.CONFIRMED

        return f"冲突{conflict_id}已{action}"

    def step3_update_verification(self, order: DepositRefundOrder) -> str:
        """
        第三步：课时核销单更新
        根据签到照片和票务记录生成核销单，附带参数版本和取舍理由
        【修复】先确定最终订单状态，再创建核销单，确保三者（订单状态/核销单状态/历史记录）一致
        """
        order.current_step = 3

        verified_lessons = self._get_consistent_lessons(order)
        total_verified = len(verified_lessons)
        total_fee = total_verified * self.LESSON_FEE_PER_HOUR
        refund_amount = order.deposit_amount * self.DEPOSIT_REFUND_RATE

        if order.status == RefundStatus.AREA_MISMATCH:
            final_status = "待店长确认后核销"
            verification_status = "待确认"
        elif order.status == RefundStatus.CALIBER_CONFLICT:
            final_status = "待解决冲突后核销"
            verification_status = "待确认"
        else:
            if order.status == RefundStatus.PENDING_REVIEW:
                order.status = RefundStatus.NORMAL
            elif order.status not in [RefundStatus.NORMAL, RefundStatus.CONFIRMED, RefundStatus.SUPPLEMENTED]:
                order.status = RefundStatus.NORMAL
            final_status = "已完成核销"
            verification_status = "已核销"

        verification = LessonVerification(
            verification_id=f"VER-{order.refund_id}",
            lesson_id=verified_lessons[0] if verified_lessons else "NONE",
            student_name=order.student_name,
            verified_count=total_verified,
            total_fee=total_fee,
            deposit_refund_amount=refund_amount,
            verification_time=datetime.now(),
            status=verification_status,
            params=self.calculation_params.copy()
        )

        order.lesson_verifications = [verification]

        order.add_history(
            operator="系统",
            action="第三步：更新课时核销单",
            detail=f"核销课时{total_verified}节，总课时费{total_fee}元，应退押金{refund_amount}元。{final_status}",
            data_source=None
        )

        return f"第三步完成：课时核销单已更新，{final_status}"

    def _get_consistent_lessons(self, order: DepositRefundOrder) -> List[str]:
        """获取数据一致的课时ID列表"""
        photo_map = {p.lesson_id: p for p in order.sign_in_photos}
        ticket_map = {t.lesson_id: t for t in order.ticket_records}
        consistent = []

        for lesson_id in set(photo_map.keys()) & set(ticket_map.keys()):
            photo = photo_map[lesson_id]
            ticket = ticket_map[lesson_id]
            if (photo.authorized_city == ticket.city and
                photo.check_in_status == "已签到" and
                ticket.ticket_status == "已使用"):
                consistent.append(lesson_id)

        for ticket in order.ticket_records:
            if ticket.is_old_caliber and ticket.lesson_id not in consistent:
                consistent.append(ticket.lesson_id)

        return consistent

    def process_full_workflow(self, order: DepositRefundOrder) -> Dict[str, Any]:
        """执行完整的三步流程，返回每步结果"""
        results = {}
        results["step1"] = self.step1_import_sign_in_photos(order)
        results["step2"] = self.step2_store_manager_review_tickets(order)
        results["step3"] = self.step3_update_verification(order)
        results["final_status"] = order.status.value
        results["conflict_count"] = len(order.conflicts)
        results["history_count"] = len(order.history_records)
        results["verification"] = order.lesson_verifications[0] if order.lesson_verifications else None
        return results
