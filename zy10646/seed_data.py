from sqlalchemy.orm import Session
from database import (
    engine, Base, Employee, Destination, PolicyClause,
    ExceptionRequest, AuditLog, ExceptionStatus, ExceptionType, ApprovalAction
)
from services import ExceptionService
from datetime import datetime, timedelta
import uuid

Base.metadata.create_all(bind=engine)

db = Session(bind=engine)


def seed_employees():
    employees = [
        Employee(id="EMP001", name="张三", email="zhangsan@company.com", department="研发部", level="P6", manager_id="EMP003"),
        Employee(id="EMP002", name="李四", email="lisi@company.com", department="市场部", level="P5", manager_id="EMP003"),
        Employee(id="EMP003", name="王经理", email="wangmanager@company.com", department="管理层", level="M2", manager_id="EMP004"),
        Employee(id="EMP004", name="赵总监", email="zhaodirector@company.com", department="管理层", level="D1", manager_id=None),
    ]
    for emp in employees:
        existing = db.query(Employee).filter(Employee.id == emp.id).first()
        if not existing:
            db.add(emp)
    db.commit()
    print("员工数据已初始化")


def seed_destinations():
    destinations = [
        Destination(id="DEST001", city_code="BJS", city_name="北京", country="中国", region="华北", hotel_tier="Tier1", flight_class_allowed="经济舱"),
        Destination(id="DEST002", city_code="SHA", city_name="上海", country="中国", region="华东", hotel_tier="Tier1", flight_class_allowed="经济舱"),
        Destination(id="DEST003", city_code="SZX", city_name="深圳", country="中国", region="华南", hotel_tier="Tier2", flight_class_allowed="经济舱"),
        Destination(id="DEST004", city_code="CAN", city_name="广州", country="中国", region="华南", hotel_tier="Tier2", flight_class_allowed="经济舱"),
    ]
    for dest in destinations:
        existing = db.query(Destination).filter(Destination.id == dest.id).first()
        if not existing:
            db.add(dest)
    db.commit()
    print("目的地数据已初始化")


def seed_policy_clauses():
    policies = [
        PolicyClause(
            id="POL001", clause_code="HOTEL-T1-BJ", category="HOTEL",
            title="北京酒店标准", description="北京地区酒店最高标准",
            max_hotel_rate=500.0, is_active=True
        ),
        PolicyClause(
            id="POL002", clause_code="HOTEL-T1-SH", category="HOTEL",
            title="上海酒店标准", description="上海地区酒店最高标准",
            max_hotel_rate=480.0, is_active=True
        ),
        PolicyClause(
            id="POL003", clause_code="FLIGHT-ECON-ADV", category="FLIGHT",
            title="机票提前预订折扣", description="需提前至少7天预订，折扣不低于7折",
            max_flight_discount=70.0, allowed_advance_days=7, is_active=True
        ),
        PolicyClause(
            id="POL004", clause_code="FLIGHT-PEAK", category="FLIGHT",
            title="旺季机票折扣", description="旺季机票折扣不低于8折",
            max_flight_discount=80.0, is_active=True
        ),
    ]
    for policy in policies:
        existing = db.query(PolicyClause).filter(PolicyClause.id == policy.id).first()
        if not existing:
            db.add(policy)
    db.commit()
    print("政策条款数据已初始化")


def seed_complete_flow_scenario():
    """场景1：完整流转 - 住宿+机票同时例外"""
    print("\n=== 场景1：完整流转（住宿+机票同时例外） ===")
    
    service = ExceptionService(db)
    
    request_idempotency_key = "TRIP-BJ-20240520-001-FLOW"
    
    from schemas import ExceptionRequestCreate
    create_data = ExceptionRequestCreate(
        idempotency_key=request_idempotency_key,
        trip_id="TRIP-BJ-20240520-001",
        employee_id="EMP001",
        destination_id="DEST001",
        exception_type=ExceptionType.BOTH,
        hotel_policy_clause_id="POL001",
        hotel_actual_rate=680.0,
        hotel_justification="北京展会期间酒店涨价，周边酒店最低也要680元",
        flight_policy_clause_id="POL003",
        flight_actual_discount=85.0,
        flight_justification="展会最后一天机票紧张，只有全价票可选",
        combined_justification="北京国际车展出差，住宿和机票均超出政策标准"
    )
    
    exception, errors = service.create_exception(create_data)
    if errors:
        print(f"创建异常: {errors}")
    else:
        print(f"例外申请已创建，ID: {exception.id}")
        print(f"当前状态: {exception.status}")
        print(f"例外类型: {exception.exception_type}")
    
    print("\n--- 步骤1：王经理审批，升级到例外审核 ---")
    from schemas import ApprovalActionRequest
    exception, errors = service.process_approval(
        exception.id,
        ApprovalActionRequest(
            actor_id="EMP003",
            action=ApprovalAction.ESCALATE,
            comment="情况属实，确属展会旺季，请总监审批",
            ip_address="192.168.1.100"
        )
    )
    print(f"状态变更: {ExceptionStatus.PENDING_APPROVAL} -> {exception.status}")
    
    print("\n--- 步骤2：赵总监审批，最终通过 ---")
    exception, errors = service.process_approval(
        exception.id,
        ApprovalActionRequest(
            actor_id="EMP004",
            action=ApprovalAction.APPROVE,
            comment="重要展会，同意例外",
            ip_address="192.168.1.101"
        )
    )
    print(f"状态变更: {ExceptionStatus.EXCEPTION_REVIEW} -> {exception.status}")
    print(f"审核历史条数: {len(exception.audit_logs)}")
    
    return exception


def seed_conflict_scenario():
    """场景2：冲突记录 - 同一出差单重复提交"""
    print("\n=== 场景2：冲突记录（同一出差单重复提交） ===")
    
    service = ExceptionService(db)
    
    from schemas import ExceptionRequestCreate
    
    create_data1 = ExceptionRequestCreate(
        idempotency_key="TRIP-SH-20240615-CONFLICT-1",
        trip_id="TRIP-SH-20240615-002",
        employee_id="EMP002",
        destination_id="DEST002",
        exception_type=ExceptionType.HOTEL,
        hotel_policy_clause_id="POL002",
        hotel_actual_rate=600.0,
        hotel_justification="上海进博会期间酒店紧张"
    )
    
    exception1, errors = service.create_exception(create_data1)
    print(f"第一个申请创建成功，ID: {exception1.id}")
    print(f"状态: {exception1.status}")
    
    print("\n尝试为同一出差单创建第二个申请...")
    create_data2 = ExceptionRequestCreate(
        idempotency_key="TRIP-SH-20240615-CONFLICT-2",
        trip_id="TRIP-SH-20240615-002",
        employee_id="EMP002",
        destination_id="DEST002",
        exception_type=ExceptionType.FLIGHT,
        flight_policy_clause_id="POL003",
        flight_actual_discount=90.0,
        flight_justification="机票紧张"
    )
    
    exception2, errors = service.create_exception(create_data2)
    if errors:
        print(f"预期冲突发生: {errors[0].message}")
        print(f"错误码: {errors[0].code}")
        print(f"修复建议: {errors[0].suggestion}")
    
    return exception1


def seed_bad_import_row():
    """场景3：导入坏行 - 各种错误数据"""
    print("\n=== 场景3：导入坏行（行级校验） ===")
    
    from services import ImportService
    service = ImportService(db)
    
    bad_rows = [
        {
            "idempotency_key": "",
            "trip_id": "TRIP-SZ-20240701-003",
            "employee_id": "EMP001",
            "exception_type": "hotel"
        },
        {
            "idempotency_key": "IMPORT-BAD-002",
            "trip_id": "",
            "employee_id": "EMP001",
            "exception_type": "hotel"
        },
        {
            "idempotency_key": "IMPORT-BAD-003",
            "trip_id": "TRIP-SZ-20240701-003",
            "employee_id": "EMP-NOT-EXIST",
            "exception_type": "hotel"
        },
        {
            "idempotency_key": "IMPORT-BAD-004",
            "trip_id": "TRIP-SZ-20240701-003",
            "employee_id": "EMP001",
            "exception_type": "INVALID_TYPE"
        },
        {
            "idempotency_key": "IMPORT-GOOD-001",
            "trip_id": "TRIP-SZ-20240701-VALID",
            "employee_id": "EMP002",
            "exception_type": "both",
            "destination_id": "DEST003",
            "hotel_policy_clause_id": "POL001",
            "hotel_actual_rate": "550",
            "hotel_justification": "展会期间酒店价格高",
            "flight_policy_clause_id": "POL003",
            "flight_actual_discount": "80",
            "flight_justification": "临近日期预订"
        }
    ]
    
    batch_id, results = service.import_batch(bad_rows)
    print(f"导入批次ID: {batch_id}")
    print(f"总行数: {len(results)}")
    print(f"成功行数: {sum(1 for r in results if r.is_valid)}")
    print(f"失败行数: {sum(1 for r in results if not r.is_valid)}")
    print("\n详细结果:")
    for r in results:
        if r.is_valid:
            print(f"  行{r.row_number}: ✓ 成功 - 请求ID: {r.request_id}")
        else:
            print(f"  行{r.row_number}: ✗ 失败 - {r.error_code} - {r.error_message}")
            if r.suggestion:
                print(f"           建议: {r.suggestion}")
    
    return results


if __name__ == "__main__":
    print("=" * 60)
    print("商旅审批服务 - 种子数据初始化")
    print("=" * 60)
    
    seed_employees()
    seed_destinations()
    seed_policy_clauses()
    
    complete_flow = seed_complete_flow_scenario()
    conflict = seed_conflict_scenario()
    bad_rows = seed_bad_import_row()
    
    print("\n" + "=" * 60)
    print("种子数据初始化完成！")
    print("=" * 60)
    print("\n验收检查清单：")
    print("✓ 完整流转：住宿+机票同时例外，历史记录可追踪")
    print("✓ 冲突记录：同一出差单重复提交被拦截")
    print("✓ 导入坏行：行级校验返回详细错误和修复建议")
    print("\n请验证：")
    print("1. 列表接口能看到所有申请")
    print("2. 详情接口包含完整的住宿和机票例外信息")
    print("3. 历史接口显示完整的审批流程")
    print("4. 导出结果与列表/详情一致")
    
    db.close()