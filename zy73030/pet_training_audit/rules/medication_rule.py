from ..auditor import Anomaly, register_rule


SENSITIVE_KEYWORDS = [
    "用药", "吃药", "滴剂", "喷剂", "外敷",
    "疫苗", "驱虫", "过敏", "抗生素", "止疼",
    "心脏病", "肾病", "糖尿病", "癫痫",
]


@register_rule(rule_id="R003", rule_name="用药提醒完整性检查", severity="error")
def medication_reminder_check(record: dict) -> list:
    anomalies = []

    handwritten = str(record.get("handwritten_note") or "")
    medication = str(record.get("medication_reminder") or "")

    hint_found = False
    for kw in SENSITIVE_KEYWORDS:
        if kw in handwritten:
            hint_found = True
            break

    if hint_found and (not medication or medication.strip() == ""):
        anomalies.append(Anomaly(
            rule_id="R003",
            rule_name="用药提醒完整性检查",
            severity="error",
            field_name="medication_reminder",
            anomaly_reason=(
                "手写病历备注中出现了用药/病情相关描述，"
                "但结构化的「用药提醒」字段为空，"
                "前台口头提醒容易遗漏，必须将注意事项录入 medication_reminder 字段"
            ),
            current_value="(空)",
            expected_value="手写备注中涉及的用药/病情要点需要显式填入此字段",
        ))

    if medication and len(medication.strip()) < 5:
        anomalies.append(Anomaly(
            rule_id="R003",
            rule_name="用药提醒完整性检查",
            severity="warning",
            field_name="medication_reminder",
            anomaly_reason="用药提醒填写过短，建议至少写明「药名+频次+提醒对象」，避免歧义",
            current_value=medication,
            expected_value="例如: '饭后半粒速诺，每日2次，提醒主人连续7天'",
        ))

    return anomalies
