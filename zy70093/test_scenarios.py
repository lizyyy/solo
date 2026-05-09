#!/usr/bin/env python3
"""
快充站故障派单系统测试脚本

覆盖以下场景：
1. 正常故障处理流程
2. 预约冻结和解冻
3. 计费截断
4. 派单流程
5. SLA 计时
6. 异常拦截（重复操作、状态冲突）
7. 超时处理和重试
"""

import json
from datetime import datetime, timedelta
from database import SessionLocal
from models import ChargingPile, FaultEvent, Reservation, ChargingSession
from schemas import (
    FaultEventCreate, ReservationCreate, ChargingSessionCreate,
    DispatchOrderCreate, RecoveryReportCreate
)
from services import (
    FaultEventService, ReservationService, ChargingSessionService,
    DispatchService, SLAService, RecoveryReportService
)


def print_header(title):
    print("\n" + "=" * 70)
    print(f"📌 {title}")
    print("=" * 70)


def print_result(result, success):
    status = "✅ 成功" if success else "❌ 失败"
    print(f"  {status}")
    print(f"  📝 消息: {result['message']}")
    if result.get('data'):
        print(f"  📊 数据: {json.dumps(result['data'], ensure_ascii=False, indent=4)}")


def scenario_1_normal_fault_flow():
    """场景1: 正常故障处理流程"""
    print_header("场景1: 正常故障处理流程")
    db = SessionLocal()
    
    try:
        print("\n1️⃣ 上报充电桩P001的故障（充电桩通信中断）")
        fault_data = FaultEventCreate(
            pile_code="P001",
            fault_type="通信中断",
            fault_level="HIGH",
            description="充电桩无法与后台通信，心跳超时",
            source="AUTOMATIC"
        )
        result, success = FaultEventService.create_fault_event(db, fault_data)
        print_result(result, success)
        
        if not success:
            db.close()
            return
        
        fault_code = result['data']['fault_code']
        frozen_count = result['data']['frozen_reservations']
        truncated_count = result['data']['truncated_sessions']
        
        print(f"\n   🔍 影响分析:")
        print(f"      - 冻结预约数: {frozen_count}")
        print(f"      - 截断会话数: {truncated_count}")
        
        print("\n2️⃣ 确认故障接收")
        result, success = FaultEventService.acknowledge_fault(db, fault_code)
        print_result(result, success)
        
        print("\n3️⃣ 创建派单给工程师张工")
        dispatch_data = DispatchOrderCreate(
            fault_code=fault_code,
            engineer_id="E001",
            engineer_name="张工",
            engineer_phone="13900139001",
            priority="HIGH"
        )
        result, success = DispatchService.create_dispatch(db, dispatch_data)
        print_result(result, success)
        order_code = result['data']['order_code']
        
        print("\n4️⃣ 工程师接单")
        result, success = DispatchService.accept_dispatch(db, order_code)
        print_result(result, success)
        
        print("\n5️⃣ 工程师到达现场")
        result, success = DispatchService.arrive_on_site(db, order_code)
        print_result(result, success)
        
        print("\n6️⃣ 完成现场处理")
        result, success = DispatchService.complete_dispatch(db, order_code)
        print_result(result, success)
        
        print("\n7️⃣ 提交恢复报告")
        report_data = RecoveryReportCreate(
            fault_code=fault_code,
            root_cause="通信模块松动，重新插拔后恢复",
            solution="重新插拔通信模块，测试通信正常",
            preventive_measures="定期检查通信线缆连接",
            recovery_time_minutes=25.0,
            parts_replaced="无"
        )
        result, success = RecoveryReportService.create_report(db, report_data)
        print_result(result, success)
        report_code = result['data']['report_code']
        
        print("\n8️⃣ 验证恢复报告")
        result, success = RecoveryReportService.verify_report(db, report_code, "李主管")
        print_result(result, success)
        
        print("\n9️⃣ 解决故障事件")
        result, success = FaultEventService.resolve_fault(db, fault_code)
        print_result(result, success)
        
        print("\n🔍 查询故障详情")
        result, success = FaultEventService.get_fault_detail(db, fault_code)
        print_result(result, success)
        
    finally:
        db.close()


def scenario_2_duplicate_fault():
    """场景2: 重复上报故障（异常拦截）"""
    print_header("场景2: 重复上报故障（异常拦截）")
    db = SessionLocal()
    
    try:
        print("\n1️⃣ 上报充电桩P003的故障")
        fault_data = FaultEventCreate(
            pile_code="P003",
            fault_type="枪头故障",
            fault_level="MEDIUM",
            description="充电枪无法正常锁定",
            source="USER_REPORT"
        )
        result, success = FaultEventService.create_fault_event(db, fault_data)
        print_result(result, success)
        
        print("\n2️⃣ 🔴 尝试重复上报同一充电桩故障")
        result, success = FaultEventService.create_fault_event(db, fault_data)
        print_result(result, success)
        
    finally:
        db.close()


def scenario_3_reservation_conflict():
    """场景3: 预约冲突检测"""
    print_header("场景3: 预约冲突检测")
    db = SessionLocal()
    
    try:
        now = datetime.utcnow()
        
        print("\n1️⃣ 创建P003的预约（未来2小时）")
        res_data = ReservationCreate(
            pile_code="P003",
            user_id="U005",
            user_name="赵六",
            phone="13800138005",
            reserved_start=now + timedelta(hours=2),
            reserved_end=now + timedelta(hours=3)
        )
        result, success = ReservationService.create_reservation(db, res_data)
        print_result(result, success)
        
        print("\n2️⃣ 🔴 尝试创建时间冲突的预约")
        conflict_data = ReservationCreate(
            pile_code="P003",
            user_id="U006",
            user_name="孙七",
            phone="13800138006",
            reserved_start=now + timedelta(hours=2, minutes=30),
            reserved_end=now + timedelta(hours=3, minutes=30)
        )
        result, success = ReservationService.create_reservation(db, conflict_data)
        print_result(result, success)
        
    finally:
        db.close()


def scenario_4_fault_during_charging():
    """场景4: 充电中发生故障（计费截断）"""
    print_header("场景4: 充电中发生故障（计费截断）")
    db = SessionLocal()
    
    try:
        print("\n1️⃣ 开始P003的充电会话")
        session_data = ChargingSessionCreate(
            pile_code="P003",
            user_id="U007",
            start_kwh=50.0
        )
        result, success = ChargingSessionService.start_session(db, session_data)
        print_result(result, success)
        session_code = result['data']['session_code']
        
        print("\n2️⃣ 上报P003的故障（过温保护）")
        fault_data = FaultEventCreate(
            pile_code="P003",
            fault_type="过温保护",
            fault_level="CRITICAL",
            description="充电桩温度过高，触发过温保护",
            source="AUTOMATIC"
        )
        result, success = FaultEventService.create_fault_event(db, fault_data)
        print_result(result, success)
        
        print(f"\n   🔍 检查充电会话状态")
        from services import get_session_by_code
        session = get_session_by_code(db, session_code)
        print(f"      会话状态: {session.status}")
        print(f"      是否截断: {session.is_truncated}")
        print(f"      截断原因: {session.truncation_reason}")
        print(f"      充电电量: {session.charged_kwh} kWh")
        print(f"      费用金额: ¥{session.total_amount}")
        
    finally:
        db.close()


def scenario_5_dispatch_timeout():
    """场景5: 派单超时处理（重试和转单）"""
    print_header("场景5: 派单超时处理（重试和转单）")
    db = SessionLocal()
    
    try:
        print("\n1️⃣ 上报P002的故障（枪头无法拔出）")
        fault_data = FaultEventCreate(
            pile_code="P002",
            fault_type="机械故障",
            fault_level="HIGH",
            description="枪头锁止机构故障，无法拔出",
            source="USER_REPORT"
        )
        result, success = FaultEventService.create_fault_event(db, fault_data)
        print_result(result, success)
        fault_code = result['data']['fault_code']
        
        print("\n2️⃣ 创建派单给工程师王工")
        dispatch_data = DispatchOrderCreate(
            fault_code=fault_code,
            engineer_id="E002",
            engineer_name="王工",
            engineer_phone="13900139002",
            priority="HIGH"
        )
        result, success = DispatchService.create_dispatch(db, dispatch_data)
        print_result(result, success)
        order_code = result['data']['order_code']
        
        print("\n3️⃣ ⏱️ 模拟第一次超时（手动触发）")
        dispatch = db.query(FaultEvent).filter(FaultEvent.fault_code == fault_code).first()
        dispatches = db.query(FaultEvent).filter(FaultEvent.fault_code == fault_code).first().dispatches
        if dispatches:
            # 手动修改派单时间为超时
            dispatch_order = dispatches[0]
            dispatch_order.dispatched_at = datetime.utcnow() - timedelta(minutes=15)
            db.commit()
        
        result, success = DispatchService.handle_timeout(db, order_code)
        print_result(result, success)
        
        print("\n4️⃣ ⏱️ 模拟第二次超时")
        from services import get_dispatch_by_code
        dispatch_order = get_dispatch_by_code(db, order_code)
        dispatch_order.dispatched_at = datetime.utcnow() - timedelta(minutes=15)
        db.commit()
        
        result, success = DispatchService.handle_timeout(db, order_code)
        print_result(result, success)
        
        print("\n5️⃣ 🔄 转单给刘工")
        result, success = DispatchService.reassign_dispatch(
            db, order_code,
            "E003", "刘工",
            "王工繁忙，刘工更靠近现场"
        )
        print_result(result, success)
        
    finally:
        db.close()


def scenario_6_cancel_fault():
    """场景6: 撤销故障事件"""
    print_header("场景6: 撤销故障事件")
    db = SessionLocal()
    
    try:
        print("\n1️⃣ 上报P001的故障（疑似故障）")
        fault_data = FaultEventCreate(
            pile_code="P001",
            fault_type="疑似故障",
            fault_level="LOW",
            description="用户报告充电异常，但可能是误报",
            source="USER_REPORT"
        )
        result, success = FaultEventService.create_fault_event(db, fault_data)
        print_result(result, success)
        fault_code = result['data']['fault_code']
        
        print("\n2️⃣ 确认故障")
        result, success = FaultEventService.acknowledge_fault(db, fault_code)
        print_result(result, success)
        
        print("\n3️⃣ 调查发现是误报，撤销故障")
        result, success = FaultEventService.cancel_fault(db, fault_code, "经调查为用户操作不当导致，充电桩实际正常")
        print_result(result, success)
        
    finally:
        db.close()


def scenario_7_sla_monitoring():
    """场景7: SLA监控和告警"""
    print_header("场景7: SLA监控和告警")
    db = SessionLocal()
    
    try:
        print("\n1️⃣ 上报P002的严重故障（CRITICAL级别）")
        fault_data = FaultEventCreate(
            pile_code="P002",
            fault_type="急停按钮故障",
            fault_level="CRITICAL",
            description="急停按钮无法复位，存在安全隐患",
            source="AUTOMATIC"
        )
        result, success = FaultEventService.create_fault_event(db, fault_data)
        print_result(result, success)
        fault_code = result['data']['fault_code']
        
        print("\n2️⃣ 🔍 检查SLA告警（当前无告警）")
        warnings = SLAService.check_sla_warnings(db)
        if warnings:
            for w in warnings:
                print(f"      [{w['severity']}] {w['message']}")
        else:
            print("      ✅ 当前没有 SLA 告警")
        
        print("\n3️⃣ ⏰ 模拟SLA即将过期")
        fault = db.query(FaultEvent).filter(FaultEvent.fault_code == fault_code).first()
        fault.sla_expires_at = datetime.utcnow() + timedelta(minutes=5)
        db.commit()
        
        warnings = SLAService.check_sla_warnings(db)
        if warnings:
            for w in warnings:
                print(f"      [{w['severity']}] {w['message']}")
        else:
            print("      ✅ 当前没有 SLA 告警")
        
        print("\n4️⃣ ⏰ 模拟SLA已过期")
        fault.sla_expires_at = datetime.utcnow() - timedelta(minutes=5)
        db.commit()
        
        warnings = SLAService.check_sla_warnings(db)
        if warnings:
            for w in warnings:
                print(f"      [{w['severity']}] {w['message']}")
        else:
            print("      ✅ 当前没有 SLA 告警")
        
    finally:
        db.close()


def main():
    print("\n" + "#" * 70)
    print("#  快充站故障派单系统测试脚本")
    print("#  覆盖场景：正常流程、异常拦截、重复操作、超时重试")
    print("#" * 70)
    
    scenarios = [
        ("场景1: 正常故障处理流程", scenario_1_normal_fault_flow),
        ("场景2: 重复上报故障（异常拦截）", scenario_2_duplicate_fault),
        ("场景3: 预约冲突检测", scenario_3_reservation_conflict),
        ("场景4: 充电中发生故障（计费截断）", scenario_4_fault_during_charging),
        ("场景5: 派单超时处理（重试和转单）", scenario_5_dispatch_timeout),
        ("场景6: 撤销故障事件", scenario_6_cancel_fault),
        ("场景7: SLA监控和告警", scenario_7_sla_monitoring),
    ]
    
    for name, func in scenarios:
        try:
            func()
        except Exception as e:
            print(f"\n❌ 执行出错: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 70)
    print("🎉 所有测试场景执行完成")
    print("=" * 70)


if __name__ == "__main__":
    main()
