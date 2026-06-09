from datetime import datetime

from ..auditor import Anomaly, register_rule


REQUIRED_FIELDS = [
    ("training_date", "训练日期"),
    ("course_type", "课程类型"),
]

VALID_COURSE_TYPES = [
    "基础服从",
    "行为纠正",
    "敏捷训练",
    "寄养训练营",
    "集体课程",
    "一对一私教",
    "幼犬社交",
]


@register_rule(rule_id="R002", rule_name="训练课必填项与逻辑检查", severity="warning")
def training_session_check(record: dict) -> list:
    anomalies = []

    for field, label in REQUIRED_FIELDS:
        val = record.get(field)
        if not val or str(val).strip() == "":
            anomalies.append(Anomaly(
                rule_id="R002",
                rule_name="训练课必填项与逻辑检查",
                severity="error",
                field_name=field,
                anomaly_reason=f"{label}字段为空，手写病历单未填写，无法纳入训练统计",
                current_value="(空)",
                expected_value="必填项",
            ))

    course_type = record.get("course_type") or ""
    if course_type and course_type not in VALID_COURSE_TYPES:
        anomalies.append(Anomaly(
            rule_id="R002",
            rule_name="训练课必填项与逻辑检查",
            severity="warning",
            field_name="course_type",
            anomaly_reason=f"课程类型 '{course_type}' 不在标准字典里，请确认是新类型还是录入笔误",
            current_value=course_type,
            expected_value=f"标准取值之一: {', '.join(VALID_COURSE_TYPES)}",
        ))

    trainer = record.get("trainer")
    if not trainer or str(trainer).strip() == "":
        anomalies.append(Anomaly(
            rule_id="R002",
            rule_name="训练课必填项与逻辑检查",
            severity="warning",
            field_name="trainer",
            anomaly_reason="训练师姓名未填写，后续客户回访无法对应到人",
            current_value="(空)",
            expected_value="训练师姓名",
        ))

    training_date = record.get("training_date")
    if training_date:
        try:
            dt = datetime.strptime(str(training_date).strip(), "%Y-%m-%d")
            if dt > datetime.now():
                anomalies.append(Anomaly(
                    rule_id="R002",
                    rule_name="训练课必填项与逻辑检查",
                    severity="warning",
                    field_name="training_date",
                    anomaly_reason=f"训练日期 {training_date} 在未来，疑似录入错误或预开单未标注",
                    current_value=str(training_date),
                    expected_value="不晚于今天",
                ))
        except ValueError:
            anomalies.append(Anomaly(
                rule_id="R002",
                rule_name="训练课必填项与逻辑检查",
                severity="warning",
                field_name="training_date",
                anomaly_reason=f"训练日期格式不合法: '{training_date}'",
                current_value=str(training_date),
                expected_value="格式: YYYY-MM-DD",
            ))

    return anomalies
