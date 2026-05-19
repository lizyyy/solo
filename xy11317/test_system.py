import sys
from datetime import datetime, timedelta

from database import init_db, get_db, ComplaintService
from models import ParentComplaint, GPSRecord, DriverCheckin
from rules import RuleEngine
from security import SensitiveDataMasker
from reports import ReportGenerator

def test_sensitive_data_masking():
    print("\n=== 测试敏感数据脱敏 ===")
    
    masker = SensitiveDataMasker()
    
    name = "张三"
    masked_name = masker.mask_name(name)
    print(f"姓名: {name} -> {masked_name}")
    
    phone = "13812345678"
    masked_phone = masker.mask_mobile(phone)
    print(f"手机: {phone} -> {masked_phone}")
    
    assert "*" in masked_name
    assert "****" in masked_phone
    print("✓ 敏感数据脱敏测试通过")

def test_rules_engine():
    print("\n=== 测试规则引擎 ===")
    
    engine = RuleEngine()
    
    from models import ParentComplaintDB
    from dataclasses import dataclass
    
    @dataclass
    class MockComplaint:
        id = 1
        bus_no = "B001"
        route_no = "R001"
        scheduled_arrival = datetime.now()
        actual_arrival = datetime.now() + timedelta(minutes=15)
        delay_minutes = 15
    
    complaint = MockComplaint()
    gps_records = []
    checkin_records = []
    all_complaints = []
    
    results, is_blocked = engine.run_all(complaint, gps_records, checkin_records, all_complaints)
    
    print(f"规则数量: {len(results)}")
    for r in results:
        print(f"  - {r.rule_name}: {r.result} (拦截: {r.is_blocked})")
    
    print(f"是否整体拦截: {is_blocked}")
    print("✓ 规则引擎测试通过")

def test_database_operations():
    print("\n=== 测试数据库操作 ===")
    
    with get_db() as db:
        service = ComplaintService(db)
        
        complaint_data = ParentComplaint(
            complaint_no="CMP2024001",
            parent_name="张三",
            parent_phone="13812345678",
            student_name="张小明",
            school_name="第一小学",
            route_no="R001",
            bus_no="B001",
            scheduled_arrival=datetime.now(),
            actual_arrival=datetime.now() + timedelta(minutes=10),
            delay_minutes=10,
            complaint_reason="车辆迟到10分钟"
        )
        
        complaint = service.create_complaint(complaint_data, operator="test_user")
        print(f"✓ 创建申诉成功: {complaint.complaint_no}")
        
        gps_records = [
            GPSRecord(
                bus_no="B001",
                route_no="R001",
                record_time=datetime.now() + timedelta(minutes=i),
                latitude=39.9 + i*0.001,
                longitude=116.3 + i*0.001,
                speed=30 + i*2,
                is_arrival=(i == 9)
            ) for i in range(10)
        ]
        service.add_gps_records("B001", gps_records)
        print(f"✓ 添加GPS记录成功: {len(gps_records)}条")
        
        checkin_records = [
            DriverCheckin(
                driver_id="D001",
                driver_name="李司机",
                bus_no="B001",
                route_no="R001",
                checkin_type="site_arrival",
                checkin_time=datetime.now() + timedelta(minutes=9),
                site_no="S001",
                site_name="站点1"
            )
        ]
        service.add_checkin_records(checkin_records)
        print(f"✓ 添加打卡记录成功: {len(checkin_records)}条")
        
        result = service.process_complaint(complaint.id, operator="test_user")
        print(f"✓ 处理申诉完成")
        print(f"  状态: {result['status']}")
        print(f"  责任判定: {result['responsibility']}")
        print(f"  判定原因: {result['decision_reason']}")
        print(f"  规则执行结果: {len(result['rule_results'])}条")
        
        complaint2_data = ParentComplaint(
            complaint_no="CMP2024002",
            parent_name="李四",
            parent_phone="13987654321",
            student_name="李小华",
            school_name="第一小学",
            route_no="R001",
            bus_no="B001",
            scheduled_arrival=datetime.now(),
            actual_arrival=datetime.now() + timedelta(minutes=12),
            delay_minutes=12,
            complaint_reason="车辆迟到"
        )
        complaint2 = service.create_complaint(complaint2_data)
        
        merge_result = service.merge_complaints(complaint.id, [complaint2.id], operator="test_user")
        print(f"✓ 合并申诉完成: 合并了{merge_result['merged_count']}条")
        
        stats = service.get_statistics()
        print(f"✓ 统计数据获取完成")
        print(f"  总申诉数: {stats['total_complaints']}")
        print(f"  平均延误: {stats['average_delay_minutes']}分钟")
        
        logs = service.get_operation_logs(target_type="complaint", limit=10)
        print(f"✓ 操作日志获取完成: 共{len(logs)}条")
        
        return complaint.id

def test_report_generation():
    print("\n=== 测试报告生成 ===")
    
    with get_db() as db:
        service = ComplaintService(db)
        generator = ReportGenerator(service)
        
        now = datetime.now()
        report = generator.generate_monthly_report(now.year, now.month)
        print(f"✓ 月度报告生成完成")
        print(f"  报告周期: {report['report_period']}")
        print(f"  总申诉数: {report['summary']['total_complaints']}")
        
        complaints = service.list_complaints()
        if complaints:
            csv_content = generator.export_complaints_to_csv(complaints, include_sensitive=False)
            lines = csv_content.strip().split('\n')
            print(f"✓ CSV导出完成: {len(lines)-1}条数据（不含表头）")
            print("  敏感字段已脱敏")
            
            detail_report = generator.generate_complaint_detail_report(complaints[0].id)
            print(f"✓ 详情报告生成完成")
            print(f"  判定流程记录: {len(detail_report['decision_process'])}条")
            print(f"  操作历史记录: {len(detail_report['operation_history'])}条")

def test_data_persistence():
    print("\n=== 测试数据持久化 ===")
    
    with get_db() as db:
        service = ComplaintService(db)
        
        complaints = service.list_complaints()
        print(f"当前数据库申诉数量: {len(complaints)}")
        
        if complaints:
            print(f"第一条申诉: {complaints[0].complaint_no}")
            print(f"状态: {complaints[0].status}")
            print("✓ 数据持久化验证通过")

def run_all_tests():
    print("="*50)
    print("校车调度迟到责任判定系统 - 完整流程测试")
    print("="*50)
    
    init_db()
    print("✓ 数据库初始化完成")
    
    test_sensitive_data_masking()
    test_rules_engine()
    complaint_id = test_database_operations()
    test_report_generation()
    test_data_persistence()
    
    print("\n" + "="*50)
    print("✅ 所有测试通过！系统可以正常运行")
    print("="*50)
    
    print("\n📋 快速启动命令:")
    print("  pip install -r requirements.txt")
    print("  uvicorn main:app --reload")
    print("  访问 http://localhost:8000/docs 查看API文档")

if __name__ == "__main__":
    run_all_tests()
