import uuid
from datetime import datetime, timedelta
from typing import List

from models import InspectionRecord, RecordSource


def generate_test_records() -> List[InspectionRecord]:
    records = []
    base_time = datetime(2026, 5, 30, 8, 0, 0)
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-001",
        device_name="1号逆变器",
        metric_name="直流输入电压",
        metric_value=650.0,
        unit="V",
        collect_time=base_time,
        receive_time=base_time + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-001",
        device_name="1号逆变器",
        metric_name="交流输出功率",
        metric_value=85.0,
        unit="kW",
        collect_time=base_time,
        receive_time=base_time + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-001",
        device_name="1号逆变器",
        metric_name="逆变器温度",
        metric_value=45.0,
        unit="℃",
        collect_time=base_time,
        receive_time=base_time + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-001",
        device_name="1号逆变器",
        metric_name="发电效率",
        metric_value=97.5,
        unit="%",
        collect_time=base_time,
        receive_time=base_time + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-001",
        device_name="1号逆变器",
        metric_name="电网频率",
        metric_value=50.02,
        unit="Hz",
        collect_time=base_time,
        receive_time=base_time + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    time2 = base_time + timedelta(minutes=15)
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-001",
        device_name="1号逆变器",
        metric_name="直流输入电压",
        metric_value=320.0,
        unit="V",
        collect_time=time2,
        receive_time=time2 + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-001",
        device_name="1号逆变器",
        metric_name="交流输出功率",
        metric_value=0.5,
        unit="kW",
        collect_time=time2,
        receive_time=time2 + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    time3 = base_time + timedelta(minutes=30)
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-002",
        device_name="2号逆变器",
        metric_name="逆变器温度",
        metric_value=82.0,
        unit="℃",
        collect_time=time3,
        receive_time=time3 + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-002",
        device_name="2号逆变器",
        metric_name="逆变器温度",
        metric_value=50.0,
        unit="℃",
        collect_time=time3 + timedelta(minutes=5),
        receive_time=time3 + timedelta(minutes=6),
        source=RecordSource.AUTO
    ))
    
    time4 = base_time + timedelta(minutes=45)
    dup_id = str(uuid.uuid4())
    records.append(InspectionRecord(
        record_id=dup_id,
        device_id="INV-003",
        device_name="3号逆变器",
        metric_name="直流输入电压",
        metric_value=720.0,
        unit="V",
        collect_time=time4,
        receive_time=time4 + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-003",
        device_name="3号逆变器",
        metric_name="直流输入电压",
        metric_value=720.0,
        unit="V",
        collect_time=time4,
        receive_time=time4 + timedelta(minutes=3),
        source=RecordSource.AUTO
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-003",
        device_name="3号逆变器",
        metric_name="直流输入电压",
        metric_value=720.0,
        unit="V",
        collect_time=time4,
        receive_time=time4 + timedelta(minutes=5),
        source=RecordSource.ATTACHMENT,
        attachment_name="手工补录数据.xlsx"
    ))
    
    late_time = base_time - timedelta(days=2)
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-004",
        device_name="4号逆变器",
        metric_name="交流输出功率",
        metric_value=45.0,
        unit="kW",
        collect_time=late_time,
        receive_time=base_time + timedelta(hours=1),
        source=RecordSource.ATTACHMENT,
        attachment_name="通信恢复后补传.zip",
        remarks="通信模块故障，数据积压后补传"
    ))
    
    time5 = base_time + timedelta(hours=1)
    orig_id = str(uuid.uuid4())
    records.append(InspectionRecord(
        record_id=orig_id,
        device_id="INV-001",
        device_name="1号逆变器",
        metric_name="发电效率",
        metric_value=85.0,
        unit="%",
        collect_time=time5,
        receive_time=time5 + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-001",
        device_name="1号逆变器",
        metric_name="发电效率",
        metric_value=96.0,
        unit="%",
        collect_time=time5,
        receive_time=time5 + timedelta(minutes=30),
        source=RecordSource.CORRECTED,
        original_record_id=orig_id,
        operator="张工",
        remarks="传感器校准后重新录入，原数据偏低是因为校准参数错误"
    ))
    
    time6 = base_time + timedelta(hours=2)
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-002",
        device_name="2号逆变器",
        metric_name="发电效率",
        metric_value=65.0,
        unit="%",
        collect_time=time6,
        receive_time=time6 + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-002",
        device_name="2号逆变器",
        metric_name="发电效率",
        metric_value=92.0,
        unit="%",
        collect_time=time6 + timedelta(minutes=10),
        receive_time=time6 + timedelta(minutes=11),
        source=RecordSource.AUTO
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-002",
        device_name="2号逆变器",
        metric_name="发电效率",
        metric_value=78.0,
        unit="%",
        collect_time=time6 + timedelta(minutes=20),
        receive_time=time6 + timedelta(minutes=21),
        source=RecordSource.AUTO
    ))
    
    time7 = base_time + timedelta(hours=3)
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-005",
        device_name="5号逆变器",
        metric_name="交流输出功率",
        metric_value=95.0,
        unit="kW",
        collect_time=time7,
        receive_time=time7 + timedelta(minutes=1),
        source=RecordSource.MANUAL,
        operator="李工",
        remarks="现场巡检手工录入"
    ))
    
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-005",
        device_name="5号逆变器",
        metric_name="交流输出功率",
        metric_value=15.0,
        unit="kW",
        collect_time=time7 + timedelta(minutes=10),
        receive_time=time7 + timedelta(minutes=11),
        source=RecordSource.AUTO
    ))
    
    time8 = base_time + timedelta(hours=4)
    records.append(InspectionRecord(
        record_id=str(uuid.uuid4()),
        device_id="INV-001",
        device_name="1号逆变器",
        metric_name="直流输入电压",
        metric_value=1050.0,
        unit="V",
        collect_time=time8,
        receive_time=time8 + timedelta(minutes=1),
        source=RecordSource.AUTO
    ))
    
    return records
