
import sys

# 读取前125行
with open("services.py", "r") as f:
    lines = f.readlines()[:125]

# 确保末尾有换行
if lines and not lines[-1].endswith("
"):
    lines[-1] += "
"

# 添加 HandoverService
lines.append("
")
lines.append("class HandoverService:
")
lines.append("    @staticmethod
")
lines.append("    def create_handover(db, handover_data):
")
lines.append("        task_id = generate_task_id()
")
lines.append("        raw_data = json.dumps(handover_data.model_dump(), ensure_ascii=False, default=json_serializer)
")
lines.append("        db_handover = TellerBoxHandover(
")
lines.append("            task_id=task_id,
")
lines.append("            branch_id=handover_data.branch_id,
")
lines.append("            branch_name=handover_data.branch_name,
")
lines.append("            handover_date=handover_data.handover_date,
")
lines.append("         lines.append("         lines.append("         lines.append("         lines.append("    ovlines.append("         lines.append("         box_amount=handover_data.box_amount,
")
lines.append("            error_no=handover_data.error_no,
")
lines.append("            handler1_id=handover_data.handler1_id,
")
lines.append("            handler1_name=handover_data.handler1_name,
")
lines.append("            handler2_id=handover_data.handler2_id,
")
lines.append("            handler2_name=handover_data.handler2_name,
")
lines.append("            is_cross_day=handover_data.is_cross_day,
")
lines.append("            previous_unclosed_reason=handover_data.previous_unclosed_reason,
")
lines.append("            raw_data=raw_data,
")
lines.append("            raw_data_position=handover_data.raw_data_position,
")
lines.append("            created_by=handover_data.created_by,
")
lines.append("            status=TaskStatus.PROCESSING
")
lines.append("        )
")
lines.append("        db.add(db_handover)
")
lines.append("        db.commit()
")
lines.append("        db.refresh(db_handover)
")
lines.append("        result = DataClassifier.classify(db_handover, db)
")
lines.append("        db_handover.category = result.category
")
lines.append("        db_handover.category_reason = result.category_reason
")
lines.append("        db_handover.subsequent_action = result.subsequent_action
")
lines.append("        db_handover.error_details = result.error_details
")
lines.append("        if result.category == DataCategory.BLOCKED:
")
lines.append("            db_handover.status = TaskStatus.FAILED
")
lines.append("        elif result.category == DataCategory.PENDING_SUPPLEMENT:
")
lines.append("            db_handover.status = TaskStatus.MANUAL_CONFIRM
")
lines.append("        db.commit()
")
lines.append("        db.refresh(db_handover)
")
lines.append("        HandoverService.create_field_traces(db, db_handover)
")
lines.append("        return db_handover
")

# 写入文件
with open("services.py", "w") as f:
    f.writelines(lines)

print("Done, total lines:", len(lines))

