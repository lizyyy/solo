from datetime import datetime, timedelta
from hydraulic_lift.database import db
from hydraulic_lift.models import CalculationRecord, Parameter, Screenshot, AuditEntry
from hydraulic_lift.engine import HydraulicLiftEngine
from hydraulic_lift.audit import log_audit


BASE_TIME = datetime(2026, 5, 28, 21, 30)


def load_demo_data():
    _clean_existing()
    record = _step1_import_screenshot()
    _step2_manual_override_without_reason(record)
    _step3_supplement_interval(record)
    _step4_engineer_review(record)
    _step5_rerun(record)
    return record


def _clean_existing():
    for tbl in [AuditEntry, Screenshot, Parameter, CalculationRecord]:
        tbl.query.delete()
    db.session.commit()


def _step1_import_screenshot():
    record = CalculationRecord(
        name="3号液压升降台2026年5月载荷试算",
        status="draft",
        created_at=BASE_TIME,
        updated_at=BASE_TIME,
    )
    db.session.add(record)
    db.session.commit()

    audit1 = AuditEntry(
        record_id=record.id,
        action="create",
        operator="训练教练老唐",
        role="training_coach",
        note="晚上设备工程师催结果，从维修群截图导入3号升降台维修数据",
        created_at=BASE_TIME,
    )
    db.session.add(audit1)

    screenshot = Screenshot(
        record_id=record.id,
        filename="维修群_3号升降台_20260528.png",
        description="3号液压升降台月度维保记录，含系统压力、液压缸参数",
        source_chat="厂区维修群",
        extracted_summary="系统压力16MPa，液压缸内径80mm×2，额定载荷50kN，平台自重12kN",
        imported_at=BASE_TIME + timedelta(minutes=2),
    )
    db.session.add(screenshot)

    audit2 = AuditEntry(
        record_id=record.id,
        action="import_screenshot",
        operator="训练教练老唐",
        role="training_coach",
        note="从厂区维修群导入截图：3号液压升降台月度维保记录",
        created_at=BASE_TIME + timedelta(minutes=2),
    )
    db.session.add(audit2)

    input_data = {
        "rated_load": {"display_name": "额定载荷", "value": 50.0, "unit": "kN"},
        "platform_weight": {"display_name": "平台自重", "value": 12.0, "unit": "kN"},
        "cylinder_bore": {"display_name": "液压缸内径", "value": 80.0, "unit": "mm"},
        "cylinder_count": {"display_name": "液压缸数量", "value": 2, "unit": "个"},
        "system_pressure": {"display_name": "系统压力", "value": 16.0, "unit": "MPa"},
        "safety_factor": {"display_name": "安全系数", "value": 2.0, "unit": ""},
        "lifting_stroke": {"display_name": "升降行程", "value": 3000.0, "unit": "mm"},
        "sampling_interval": {"display_name": "采样间隔", "value": 200, "unit": "ms"},
    }

    for key, meta in input_data.items():
        p = Parameter(
            record_id=record.id,
            name=key,
            display_name=meta["display_name"],
            value=meta["value"],
            unit=meta["unit"],
            category="input",
            source="screenshot_import",
            created_at=BASE_TIME + timedelta(minutes=3),
            updated_at=BASE_TIME + timedelta(minutes=3),
        )
        db.session.add(p)

    db.session.commit()

    _do_calculate(record, BASE_TIME + timedelta(minutes=3))

    return record


def _step2_manual_override_without_reason(record):
    t = BASE_TIME + timedelta(minutes=15)

    param = Parameter.query.filter_by(record_id=record.id, name="safety_factor").first()
    old_value = param.value
    param.original_value = old_value
    param.value = 1.5
    param.is_manual_override = True
    param.override_by = "训练教练老唐"
    param.override_reason = None
    param.source = "manual_override"
    param.updated_at = t
    db.session.commit()

    audit = AuditEntry(
        record_id=record.id,
        parameter_id=param.id,
        action="manual_override",
        operator="训练教练老唐",
        role="training_coach",
        old_value=str(old_value),
        new_value=str(1.5),
        reason=None,
        note="人工修正安全系数：2.0→1.5（⚠ 未写原因——维修群里有人提了一嘴但不清楚依据）",
        created_at=t,
    )
    db.session.add(audit)
    db.session.commit()

    record.status = "needs_engineer_review"
    record.updated_at = t
    db.session.commit()

    _do_calculate(record, t)


def _step3_supplement_interval(record):
    t = BASE_TIME + timedelta(minutes=40)

    param = Parameter.query.filter_by(record_id=record.id, name="sampling_interval").first()
    old_note = param.sampling_interval_note
    param.sampling_interval_note = "设备运行稳定后采集，采样间隔200ms，连续采集30秒，取稳态均值"
    param.updated_at = t
    db.session.commit()

    audit = AuditEntry(
        record_id=record.id,
        parameter_id=param.id,
        action="supplement_interval",
        operator="训练教练老唐",
        role="training_coach",
        old_value=old_note,
        new_value=param.sampling_interval_note,
        note="补录采样间隔说明：设备运行稳定后采集，采样间隔200ms，连续采集30秒，取稳态均值",
        created_at=t,
    )
    db.session.add(audit)
    db.session.commit()


def _step4_engineer_review(record):
    t = BASE_TIME + timedelta(hours=2, minutes=10)

    param = Parameter.query.filter_by(record_id=record.id, name="safety_factor").first()
    param.override_reason = "根据现场实测，3号升降台最大偏载工况下安全系数1.5已满足GB/T 15706要求，详见5月15日偏载测试报告"
    param.updated_at = t
    db.session.commit()

    audit = AuditEntry(
        record_id=record.id,
        parameter_id=param.id,
        action="add_override_reason",
        operator="设备工程师小王",
        role="equipment_engineer",
        reason=param.override_reason,
        note="补充修正原因：安全系数——根据现场实测，3号升降台最大偏载工况下安全系数1.5已满足GB/T 15706要求",
        created_at=t,
    )
    db.session.add(audit)

    record.status = "under_review"
    record.updated_at = t
    db.session.commit()


def _step5_rerun(record):
    t = BASE_TIME + timedelta(hours=2, minutes=20)

    _do_calculate(record, t)

    audit = AuditEntry(
        record_id=record.id,
        action="rerun",
        operator="训练教练老唐",
        role="training_coach",
        note="重跑载荷试算，安全系数修正原因已由设备工程师确认，结论：{}".format(record.conclusion),
        created_at=t,
    )
    db.session.add(audit)

    record.status = "approved"
    record.updated_at = t
    db.session.commit()


def _do_calculate(record, timestamp):
    params = Parameter.query.filter_by(record_id=record.id, category="input").all()
    params_dict = {p.name: p.value for p in params}

    results, conclusion, _ = HydraulicLiftEngine.calculate(params_dict)

    existing = {p.name: p for p in Parameter.query.filter_by(record_id=record.id, category="output").all()}

    for key, meta in results.items():
        if key in existing:
            p = existing[key]
            p.value = meta["value"]
            p.updated_at = timestamp
        else:
            p = Parameter(
                record_id=record.id,
                name=key,
                display_name=meta["display_name"],
                value=meta["value"],
                unit=meta["unit"],
                category="output",
                source="calculated",
                created_at=timestamp,
                updated_at=timestamp,
            )
            db.session.add(p)

    record.conclusion = conclusion
    record.updated_at = timestamp
    db.session.commit()
