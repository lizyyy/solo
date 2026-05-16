from datetime import datetime, timedelta
from models import RepairOrder, FieldRevision, ProcessingError


def create_sample_orders() -> list:
    orders = []
    
    order1 = RepairOrder(
        order_id="WYBX-2026-0515-001",
        report_date="2026-05-15",
        property_company="华润置地物业服务有限公司",
        building="橡树湾三期12栋",
        unit="2单元1502室",
        repair_type="水电维修",
        description="客厅空调插座短路，导致跳闸，需要更换插座并检查线路",
        reporter_name="张明华",
        reporter_phone="13800138001",
        report_time=datetime(2026, 5, 15, 23, 45, 0),
        arrival_time=datetime(2026, 5, 16, 8, 30, 0),
        completion_time=datetime(2026, 5, 16, 9, 15, 0),
        status="已完成",
        cost=180.0,
        is_cross_day=True,
        raw_input={
            "order_id": "WYBX-2026-0515-001",
            "report_date": "2026-05-15",
            "property_company": "华润置地物业服务有限公司",
            "building": "橡树湾三期12栋",
            "unit": "2单元1502室",
            "repair_type": "水电维修",
            "description": "客厅空调插座短路，导致跳闸，需要更换插座并检查线路",
            "reporter_name": "张明华",
            "reporter_phone": "13800138001",
            "report_time": "2026-05-15 23:45:00",
            "arrival_time": "2026-05-16 08:30:00",
            "completion_time": "2026-05-16 09:15:00",
            "status": "已完成",
            "cost": "180.00"
        }
    )
    orders.append(order1)
    
    order2 = RepairOrder(
        order_id="WYBX-2026-0515-002",
        report_date="2026-05-15",
        property_company="万科物业服务有限公司",
        building="金域华府5栋",
        unit="1单元301室",
        repair_type="给排水",
        description="卫生间主管道堵塞反水，导致地板被浸泡，需要疏通管道并检查防水",
        reporter_name="李淑芬",
        reporter_phone="13900139002",
        report_time=datetime(2026, 5, 15, 22, 15, 0),
        arrival_time=datetime(2026, 5, 16, 7, 0, 0),
        completion_time=datetime(2026, 5, 16, 11, 30, 0),
        status="已完成",
        cost=450.0,
        is_cross_day=True,
        raw_input={
            "order_id": "WYBX-2026-0515-002",
            "report_date": "2026-05-15",
            "property_company": "万科物业服务有限公司",
            "building": "金域华府5栋",
            "unit": "1单元301室",
            "repair_type": "给排水",
            "description": "卫生间主管道堵塞反水，导致地板被浸泡，需要疏通管道并检查防水，用户反映该问题已出现多次，希望彻底解决管道设计问题，避免再次发生类似情况，同时要求对地板损失进行评估",
            "reporter_name": "李淑芬",
            "reporter_phone": "13900139002",
            "report_time": "2026-05-15 22:15:00",
            "arrival_time": "2026-05-16 07:00:00",
            "completion_time": "2026-05-16 11:30:00",
            "status": "已完成",
            "cost": "450.00"
        },
        has_truncated_fields=True,
        truncated_fields=["description"],
        revisions=[
            FieldRevision(
                field_path="description",
                original_value="卫生间主管道堵塞反水，导致地板被浸泡，需要疏通管道并检查防水，用户反映该问题已出现多次，希望彻底解决管道设计问题，避免再次发生类似情况，同时要求对地板损失进行评估",
                revised_value="卫生间主管道堵塞反水，导致地板被浸泡，需要疏通管道并检查防水",
                revision_reason="字段长度超过数据库字段最大限制(100字符)，系统自动截断",
                revised_by="system",
                revised_at=datetime(2026, 5, 16, 0, 5, 0),
                source="数据导入自动处理"
            )
        ]
    )
    orders.append(order2)
    
    order3 = RepairOrder(
        order_id="WYBX-2026-0515-003",
        report_date="2026-05-15",
        property_company="绿城物业服务有限公司",
        building="蓝色钱江8栋",
        unit="3单元2801室",
        repair_type="电梯故障",
        description="电梯停运，困人求救",
        reporter_name="紧急呼叫",
        reporter_phone="INVALID_PHONE",
        report_time=datetime(2026, 5, 15, 23, 59, 59),
        status="处理失败",
        is_cross_day=True,
        raw_input={
            "order_id": "WYBX-2026-0515-003",
            "report_date": "2026-05-15",
            "property_company": "绿城物业服务有限公司",
            "building": "蓝色钱江8栋",
            "unit": "3单元2801室",
            "repair_type": "电梯故障",
            "description": "电梯停运，困人求救",
            "reporter_name": "紧急呼叫",
            "reporter_phone": "INVALID_PHONE",
            "report_time": "2026-05-15 23:59:59",
            "arrival_time": "",
            "completion_time": "",
            "status": "处理中"
        },
        processing_errors=[
            ProcessingError(
                error_code="VALIDATION_ERROR_001",
                error_message="联系电话格式无效",
                error_details={
                    "expected_pattern": "^1[3-9]\\d{9}$",
                    "actual_value": "INVALID_PHONE",
                    "severity": "critical"
                },
                field_path="reporter_phone"
            ),
            ProcessingError(
                error_code="DATA_MISSING_002",
                error_message="到达时间不能为空",
                error_details={
                    "severity": "high"
                },
                field_path="arrival_time"
            )
        ]
    )
    orders.append(order3)
    
    order4 = RepairOrder(
        order_id="WYBX-2026-0515-004",
        report_date="2026-05-15",
        property_company="保利物业服务有限公司",
        building="保利中央公园3栋",
        unit="2单元101室",
        repair_type="公共设施",
        description="小区儿童乐园滑梯损坏，有安全隐患，需要紧急维修",
        reporter_name="王建国",
        reporter_phone="13700137004",
        report_time=datetime(2026, 5, 15, 20, 30, 0),
        arrival_time=datetime(2026, 5, 16, 9, 0, 0),
        completion_time=datetime(2026, 5, 16, 15, 0, 0),
        status="已完成",
        cost=1200.0,
        is_cross_day=True,
        raw_input={
            "order_id": "WYBX-2026-0515-004",
            "report_date": "2026-05-15",
            "property_company": "保利物业服务有限公司",
            "building": "保利中央公园3栋",
            "unit": "2单元101室",
            "repair_type": "公共设施",
            "description": "小区儿童乐园滑梯损坏，有安全隐患，需要紧急维修",
            "reporter_name": "王建国",
            "reporter_phone": "13700137004",
            "report_time": "2026-05-15 20:30:00",
            "arrival_time": "2026-05-16 09:00:00",
            "completion_time": "2026-05-16 15:00:00",
            "status": "已完成",
            "cost": "1500.00"
        },
        revisions=[
            FieldRevision(
                field_path="cost",
                original_value=1500.0,
                revised_value=1200.0,
                revision_reason="灰度发布期间费用计算规则调整，原规则未扣除物业年度维修预算抵扣",
                revised_by="运维部-李晓东",
                revised_at=datetime(2026, 5, 16, 16, 30, 0),
                source="灰度发布v2.3.1-费用模块人工修正",
                handling_basis="《关于2026年度物业维修费用结算规则调整的通知》(保利物字[2026]12号) 第三条第二款：公共区域维修费用单次5000元以下可抵扣年度预算30%"
            )
        ]
    )
    orders.append(order4)
    
    order5 = RepairOrder(
        order_id="WYBX-2026-0515-005",
        report_date="2026-05-15",
        property_company="龙湖物业服务有限公司",
        building="龙湖天街公寓2栋",
        unit="A座2205室",
        repair_type="门窗维修",
        description="阳台玻璃窗密封胶条老化，下雨时漏水严重，需要更换胶条并做防水处理",
        reporter_name="赵雪梅",
        reporter_phone="13600136005",
        report_time=datetime(2026, 5, 15, 21, 10, 0),
        arrival_time=datetime(2026, 5, 16, 10, 0, 0),
        completion_time=datetime(2026, 5, 16, 12, 0, 0),
        status="已完成",
        cost=280.0,
        is_cross_day=True,
        raw_input={
            "order_id": "WYBX-2026-0515-005",
            "report_date": "2026-05-15",
            "property_company": "龙湖物业服务有限公司",
            "building": "龙湖天街公寓2栋",
            "unit": "A座2205室",
            "repair_type": "门窗维修",
            "description": "阳台玻璃窗密封胶条老化，下雨时漏水严重，需要更换胶条并做防水处理",
            "reporter_name": "赵雪梅",
            "reporter_phone": "13600136005",
            "report_time": "2026-05-15 21:10:00",
            "arrival_time": "2026-05-16 10:00:00",
            "completion_time": "2026-05-16 12:00:00",
            "status": "已完成",
            "cost": "280.00"
        }
    )
    orders.append(order5)
    
    return orders
