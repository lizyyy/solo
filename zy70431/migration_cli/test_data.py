import uuid
from datetime import datetime, timedelta
from .models import Attachment, Status
from .service import create_migration_record, add_manual_correction, add_material_summary, add_contract_supplement

def create_normal_materials():
    """创建一组正常材料的记录"""
    attachments = [
        Attachment(
            id=str(uuid.uuid4()),
            name="设备验收报告.pdf",
            upload_date=datetime.now() - timedelta(days=30),
            expire_date=datetime.now() + timedelta(days=365),
            is_expired=False
        ),
        Attachment(
            id=str(uuid.uuid4()),
            name="质量检测证书.pdf",
            upload_date=datetime.now() - timedelta(days=25),
            expire_date=datetime.now() + timedelta(days=180),
            is_expired=False
        )
    ]

    original_input = {
        "设备序列号": "SN-2024-001234",
        "安装位置": "A栋3层机房",
        "验收结论": "合格",
        "验收人员签字": "张三",
        "备注": "首次安装验收"
    }

    record = create_migration_record(
        device_id="DEV-001",
        device_name="温度传感器-001",
        receipt_type="设备安装验收回执",
        operator="张三",
        original_input=original_input,
        attachments=attachments
    )

    add_material_summary(
        receipt_id=record.receipt.receipt_id,
        summary_text="该设备为2024年新采购的温度传感器，已完成现场安装验收，验收合格，附件齐全且在有效期内。"
    )

    attachments2 = [
        Attachment(
            id=str(uuid.uuid4()),
            name="设备校准证书.pdf",
            upload_date=datetime.now() - timedelta(days=15),
            expire_date=datetime.now() + timedelta(days=90),
            is_expired=False
        )
    ]

    original_input2 = {
        "设备序列号": "SN-2024-005678",
        "安装位置": "B栋2层配电室",
        "校准结果": "偏差在允许范围内",
        "校准人员": "李四",
        "下次校准日期": (datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')
    }

    record2 = create_migration_record(
        device_id="DEV-002",
        device_name="湿度传感器-002",
        receipt_type="设备校准回执",
        operator="李四",
        original_input=original_input2,
        attachments=attachments2
    )

    add_material_summary(
        receipt_id=record2.receipt.receipt_id,
        summary_text="该设备完成定期校准，校准结果合格，偏差在允许范围内，校准证书有效。"
    )

    attachments3 = [
        Attachment(
            id=str(uuid.uuid4()),
            name="设备巡检记录.pdf",
            upload_date=datetime.now() - timedelta(days=5),
            expire_date=None,
            is_expired=False
        )
    ]

    original_input3 = {
        "设备序列号": "SN-2024-009012",
        "巡检位置": "C栋1层监控室",
        "运行状态": "正常",
        "巡检人员": "王五",
        "异常情况": "无"
    }

    record3 = create_migration_record(
        device_id="DEV-003",
        device_name="压力传感器-003",
        receipt_type="日常巡检回执",
        operator="王五",
        original_input=original_input3,
        attachments=attachments3
    )

    add_material_summary(
        receipt_id=record3.receipt.receipt_id,
        summary_text="设备日常巡检，运行状态正常，无异常情况记录。"
    )

    return [record, record2, record3]

def create_expired_material():
    """创建一个附件过期的异常记录"""
    attachments = [
        Attachment(
            id=str(uuid.uuid4()),
            name="设备保修卡.pdf",
            upload_date=datetime.now() - timedelta(days=400),
            expire_date=datetime.now() - timedelta(days=35),
            is_expired=True
        ),
        Attachment(
            id=str(uuid.uuid4()),
            name="合同补充协议.pdf",
            upload_date=datetime.now() - timedelta(days=100),
            expire_date=datetime.now() + timedelta(days=200),
            is_expired=False
        )
    ]

    original_input = {
        "设备序列号": "SN-2023-000999",
        "安装位置": "D栋地下室设备间",
        "保修状态": "已过期",
        "登记人员": "赵六",
        "备注": "设备已过保修期，需签订新的维保合同"
    }

    record = create_migration_record(
        device_id="DEV-004",
        device_name="门禁控制器-004",
        receipt_type="设备保修登记回执",
        operator="赵六",
        original_input=original_input,
        attachments=attachments
    )

    add_material_summary(
        receipt_id=record.receipt.receipt_id,
        summary_text="该设备保修卡已过期35天，需尽快办理新的维保合同续签手续。合同补充协议仍在有效期内。"
    )

    add_manual_correction(
        receipt_id=record.receipt.receipt_id,
        operator="审核员-陈七",
        correction_note="系统判断附件过期属实，已通知业务部门跟进维保合同续签事宜，预计10个工作日内完成。",
        corrected_status=Status.NORMAL
    )

    add_contract_supplement(
        receipt_id=record.receipt.receipt_id,
        operator="业务专员-周八",
        change_reason="补签合同补充页，延长设备保修期12个月",
        resource_scope="合同条款-保修期",
        previous_value="已过期",
        new_value="有效期至2025年"
    )

    return record

def init_test_data():
    """初始化测试数据"""
    records = create_normal_materials()
    expired_record = create_expired_material()
    records.append(expired_record)
    return records
