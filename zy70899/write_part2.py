import textwrap
import sys

part2 = """

class DataClassifier:
    @staticmethod
    def classify(handover, db):
        errors = []
        missing_fields = []

        data_dict = {
            "branch_id": handover.branch_id,
            "handover_date": handover.handover_date,
            "box_no": handover.box_no,
            "box_amount": handover.box_amount,
            "handler1_id": handover.handler1_id,
            "handler1_name": handover.handler1_name,
            "handler2_id": handover.handler2_id,
            "handler2_name": handover.handler2_name,
        }

        missing = DataValidator.check_missing_fields(data_dict)
        if missing:
            missing_fields.extend(missing)

        if DataValidator.check_time_conflict(handover.handover_date, handover.branch_id, db, handover.id):
            errors.append("时间冲突")

        if DataValidator.check_duplicate_box_no(handover.box_no, handover.handover_date, db, handover.id):
            errors.append("尾箱编号重复")

        if not DataValidator.check_double_confirmation(handover.handler1_id, handover.handler2_id):
            errors.append("双人确认失败")

        cross_day_ok, cross_day_msg = DataValidator.check_cross_day_requirements(
            handover.is_cross_day, handover.previous_unclosed_reason
        )
        if not cross_day_ok:
            errors.append(cross_day_msg)

        if handover.box_amount < 0:
            errors.append("尾箱金额不能为负数")

        if missing_fields:
            return ProcessingResult(
                category=DataCategory.PENDING_SUPPLEMENT,
                category_reason="缺少必填字段",
                subsequent_action="请补充缺失字段后重新提交",
                error_details="原始材料位置"
            )

        if errors:
            return ProcessingResult(
                category=DataCategory.BLOCKED,
                category_reason="; ".join(errors),
                subsequent_action="数据存在严重问题",
                error_details="错误明细"
            )

        return ProcessingResult(
            category=DataCategory.NORMAL,
            category_reason="数据校验通过",
            subsequent_action="进入正常处理流程"
        )
"""

with open("services.py", "a") as f:
    f.write(part2)

print("Part 2 written")
sys.exit(0)

