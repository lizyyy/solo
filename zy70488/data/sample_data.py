import uuid
from datetime import datetime
from typing import List

from models import (
    DeviceLedger,
    MeetingAttachment,
    ApprovalNode,
    ReportCaliber,
)


def generate_normal_samples() -> List[DeviceLedger]:
    samples = []
    
    stores = [
        ("GF001", "高峰中心店"),
        ("GF002", "高峰广场店"),
        ("GF003", "高峰社区店"),
        ("GF004", "高峰旗舰店"),
        ("GF005", "高峰大学城店"),
    ]
    
    devices = [
        {"type": "POS机", "brand": "海信", "model": "HK850"},
        {"type": "空调", "brand": "格力", "model": "KFR-72LW"},
        {"type": "冰箱", "brand": "海尔", "model": "BCD-520WD"},
        {"type": "打印机", "brand": "爱普生", "model": "LQ-630KII"},
        {"type": "扫码枪", "brand": "斑马", "model": "DS2208"},
    ]
    
    suppliers = ["北京盛达设备有限公司", "上海恒信商贸", "深圳创新科技", "广州通达设备"]
    operators = ["张三", "李四", "王五", "赵六", "钱七"]
    
    for i, (store_code, store_name) in enumerate(stores):
        for j, device in enumerate(devices):
            device_idx = i * len(devices) + j
            meeting_attachments = [
                MeetingAttachment(
                    id=str(uuid.uuid4()),
                    file_name=f"采购会议纪要_{device_idx}.pdf",
                    original_value=f"采购金额：{15000 + device_idx * 500}元",
                    corrected_value=f"采购金额：{15500 + device_idx * 500}元" if j % 2 == 0 else None,
                    upload_time=datetime.now(),
                    uploader=operators[device_idx % len(operators)],
                )
            ]
            
            raw_data = {
                "门店编号": store_code,
                "门店名称": store_name,
                "设备编号": f"DEV{device_idx:06d}",
                "设备名称": f"{device['brand']}{device['type']}",
                "设备类型": device["type"],
                "品牌": device["brand"],
                "型号": device["model"],
                "序列号": f"SN{device_idx:08d}",
                "采购日期": f"2024-{1 + device_idx % 12:02d}-{1 + device_idx % 28:02d}",
                "采购金额": 15000 + device_idx * 500,
                "收据编号": f"RCP{device_idx:08d}",
                "收据日期": f"2024-{1 + device_idx % 12:02d}-{5 + device_idx % 23:02d}",
                "供应商": suppliers[device_idx % len(suppliers)],
                "经办人": operators[device_idx % len(operators)],
            }
            
            samples.append(
                DeviceLedger(
                    id=str(uuid.uuid4()),
                    original_id=f"ORIG{device_idx:06d}",
                    source_file=f"高峰门店设备台账_{store_name}_2024.xlsx",
                    row_number=device_idx + 2,
                    store_code=store_code,
                    store_name=store_name,
                    device_code=f"DEV{device_idx:06d}",
                    device_name=f"{device['brand']}{device['type']}",
                    device_type=device["type"],
                    brand=device["brand"],
                    model=device["model"],
                    serial_number=f"SN{device_idx:08d}",
                    purchase_date=f"2024-{1 + device_idx % 12:02d}-{1 + device_idx % 28:02d}",
                    purchase_amount=15000 + device_idx * 500,
                    receipt_number=f"RCP{device_idx:08d}",
                    receipt_date=f"2024-{1 + device_idx % 12:02d}-{5 + device_idx % 23:02d}",
                    supplier=suppliers[device_idx % len(suppliers)],
                    operator=operators[device_idx % len(operators)],
                    approval_node=list(ApprovalNode)[device_idx % len(ApprovalNode)],
                    approval_status="已通过" if device_idx % 3 == 0 else "待审批",
                    report_caliber=ReportCaliber.NEW,
                    meeting_attachments=meeting_attachments,
                    raw_data=raw_data,
                )
            )
    
    return samples


def generate_caliber_changed_samples() -> List[DeviceLedger]:
    samples = []
    
    store_code = "GF001"
    store_name = "高峰中心店"
    suppliers = ["北京盛达设备有限公司", "上海恒信商贸"]
    operators = ["张三", "李四"]
    
    for i in range(5):
        device_idx = 100 + i
        
        meeting_attachments = [
            MeetingAttachment(
                id=str(uuid.uuid4()),
                file_name=f"口径变更会议纪要_{i}.pdf",
                original_value=f"旧口径计算：{20000 + i * 1000}元",
                corrected_value=f"新口径计算：{18000 + i * 900}元",
                upload_time=datetime.now(),
                uploader=operators[i % len(operators)],
            )
        ]
        
        raw_data = {
            "门店编号": store_code,
            "门店名称": store_name,
            "设备编号": f"DEV{device_idx:06d}",
            "设备名称": f"变更设备{i}",
            "设备类型": "电子设备",
            "品牌": "测试品牌",
            "型号": f"TEST{i}",
            "序列号": f"SN{device_idx:08d}",
            "采购日期": f"2024-06-{10 + i:02d}",
            "采购金额": 20000 + i * 1000,
            "收据编号": f"RCP{device_idx:08d}",
            "收据日期": f"2024-06-{15 + i:02d}",
            "供应商": suppliers[i % len(suppliers)],
            "经办人": operators[i % len(operators)],
            "备注": "此记录触发报告口径变化",
        }
        
        report_caliber = ReportCaliber.OLD if i < 3 else ReportCaliber.NEW
        
        samples.append(
            DeviceLedger(
                id=str(uuid.uuid4()),
                original_id=f"ORIG_CALIBER{i:03d}",
                source_file=f"高峰中心店口径变更批次.xlsx",
                row_number=i + 2,
                store_code=store_code,
                store_name=store_name,
                device_code=f"DEV{device_idx:06d}",
                device_name=f"变更设备{i}",
                device_type="电子设备",
                brand="测试品牌",
                model=f"TEST{i}",
                serial_number=f"SN{device_idx:08d}",
                purchase_date=f"2024-06-{10 + i:02d}",
                purchase_amount=20000 + i * 1000,
                receipt_number=f"RCP{device_idx:08d}",
                receipt_date=f"2024-06-{15 + i:02d}",
                supplier=suppliers[i % len(suppliers)],
                operator=operators[i % len(operators)],
                approval_node=ApprovalNode.FINANCE_AUDIT,
                approval_status="待复核",
                report_caliber=report_caliber,
                meeting_attachments=meeting_attachments,
                raw_data=raw_data,
            )
        )
    
    return samples


def generate_duplicate_samples() -> List[DeviceLedger]:
    samples = []
    
    store_code = "GF002"
    store_name = "高峰广场店"
    
    for i in range(2):
        meeting_attachments = [
            MeetingAttachment(
                id=str(uuid.uuid4()),
                file_name=f"重复采购记录_{i}.pdf",
                original_value="采购申请已提交",
                corrected_value=None,
                upload_time=datetime.now(),
                uploader="王五",
            )
        ]
        
        raw_data = {
            "门店编号": store_code,
            "门店名称": store_name,
            "设备编号": "DEV000099",
            "设备名称": "海信POS机",
            "设备类型": "POS机",
            "品牌": "海信",
            "型号": "HK850",
            "序列号": "SN00000099",
            "采购日期": "2024-03-15",
            "采购金额": 12500,
            "收据编号": "RCP00000099",
            "收据日期": "2024-03-20",
            "供应商": "北京盛达设备有限公司",
            "经办人": "王五",
        }
        
        samples.append(
            DeviceLedger(
                id=str(uuid.uuid4()),
                original_id=f"ORIG_DUP{i:03d}",
                source_file=f"高峰广场店重复上报.xlsx",
                row_number=i + 2,
                store_code=store_code,
                store_name=store_name,
                device_code="DEV000099",
                device_name="海信POS机",
                device_type="POS机",
                brand="海信",
                model="HK850",
                serial_number="SN00000099",
                purchase_date="2024-03-15",
                purchase_amount=12500,
                receipt_number="RCP00000099",
                receipt_date="2024-03-20",
                supplier="北京盛达设备有限公司",
                operator="王五",
                approval_node=ApprovalNode.STORE_MANAGER,
                approval_status="待审批",
                report_caliber=ReportCaliber.NEW,
                meeting_attachments=meeting_attachments,
                raw_data=raw_data,
            )
        )
    
    return samples


def generate_all_samples() -> List[DeviceLedger]:
    normal = generate_normal_samples()
    caliber_changed = generate_caliber_changed_samples()
    duplicates = generate_duplicate_samples()
    
    return normal + caliber_changed + duplicates
