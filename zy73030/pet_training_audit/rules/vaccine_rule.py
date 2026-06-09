from ..auditor import Anomaly, register_rule


@register_rule(rule_id="R001", rule_name="疫苗日期缺失检查", severity="error")
def vaccine_date_check(record: dict) -> list:
    anomalies = []
    vaccine_date = record.get("vaccine_date")
    course_type = record.get("course_type", "")

    needs_vaccine = any(
        k in course_type for k in ["寄养", "集体", "训练", "训练营", "寄宿"]
    ) or True

    if not vaccine_date or str(vaccine_date).strip() == "":
        anomalies.append(Anomaly(
            rule_id="R001",
            rule_name="疫苗日期缺失检查",
            severity="error",
            field_name="vaccine_date",
            anomaly_reason="训练课记录必须包含最近一次疫苗接种日期，手写病历单漏填，前台无法确认免疫状态",
            current_value="(空)",
            expected_value="格式: YYYY-MM-DD，且不早于1年前",
        ))
    else:
        from datetime import datetime, timedelta
        try:
            dt = datetime.strptime(str(vaccine_date).strip(), "%Y-%m-%d")
            one_year_ago = datetime.now() - timedelta(days=365)
            if dt < one_year_ago:
                anomalies.append(Anomaly(
                    rule_id="R001",
                    rule_name="疫苗日期缺失检查",
                    severity="warning",
                    field_name="vaccine_date",
                    anomaly_reason=f"疫苗接种日期距今已超过365天({dt.date()})，可能已失效，需要确认补打",
                    current_value=str(vaccine_date),
                    expected_value=f"不早于 {one_year_ago.date().isoformat()}",
                ))
        except ValueError:
            anomalies.append(Anomaly(
                rule_id="R001",
                rule_name="疫苗日期缺失检查",
                severity="warning",
                field_name="vaccine_date",
                anomaly_reason=f"疫苗日期格式不合法: '{vaccine_date}'，需要按 YYYY-MM-DD 重新录入",
                current_value=str(vaccine_date),
                expected_value="格式: YYYY-MM-DD",
            ))
    return anomalies
