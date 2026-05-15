import sys
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import RuleVersion, WorkOrder, OperationLog, SourceSystem, RiskType, OperationType
from services import JudgmentService
import random

Base.metadata.create_all(bind=engine)


def init_rules(db: Session):
    print("初始化规则版本...")
    
    old_rule = db.query(RuleVersion).filter(RuleVersion.version == "v1.0").first()
    if not old_rule:
        old_rule = RuleVersion(
            version="v1.0",
            rule_content={
                "timezone_normal_range": [-480, 480],
                "risk_threshold": 30,
                "high_risk_threshold": 80
            },
            description="初始版本规则 - 时区范围±8小时",
            effective_time=datetime.now() - timedelta(days=30),
            expire_time=datetime.now() - timedelta(days=15),
            is_active=False,
            created_by="system"
        )
        db.add(old_rule)
    
    active_rule = db.query(RuleVersion).filter(RuleVersion.version == "v2.0").first()
    if not active_rule:
        active_rule = RuleVersion(
            version="v2.0",
            rule_content={
                "timezone_normal_range": [-300, 600],
                "risk_threshold": 20,
                "high_risk_threshold": 70
            },
            description="当前生效规则 - 放宽时区范围",
            effective_time=datetime.now() - timedelta(days=15),
            expire_time=None,
            is_active=True,
            created_by="system"
        )
        db.add(active_rule)
    
    db.commit()
    print(f"规则初始化完成: v1.0 (已过期), v2.0 (生效中)")


def init_work_orders(db: Session, batch_no: str, count: int = 10, use_old_rule: bool = False):
    print(f"初始化批次 {batch_no} 的工单数据...")
    
    if use_old_rule:
        rule = db.query(RuleVersion).filter(RuleVersion.version == "v1.0").first()
        created_at_base = datetime.now() - timedelta(days=20)
    else:
        rule = db.query(RuleVersion).filter(RuleVersion.version == "v2.0").first()
        created_at_base = datetime.now()
    
    for i in range(count):
        is_abnormal = i < 3
        is_timezone_abnormal = is_abnormal and i < 2
        
        if is_timezone_abnormal:
            offset_minutes = random.choice([-600, 720, -720, 840])
        else:
            offset_minutes = random.randint(-300, 600)
        
        ts = created_at_base + timedelta(hours=i, minutes=offset_minutes)
        
        original_input = {
            "ticket_id": f"TICKET-{batch_no}-{i:03d}",
            "timestamp": ts.isoformat(),
            "customer_phone": f"138{random.randint(10000000, 99999999)}",
            "user_agent": f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "client_ip": f"{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}",
            "issue_type": random.choice(["账户问题", "订单问题", "技术支持", "投诉建议"]),
            "description": f"客户反馈问题详情 #{i}",
            "timezone_offset": offset_minutes
        }
        
        work_order = WorkOrder(
            order_no=f"WO-{batch_no}-{i:03d}",
            batch_no=batch_no,
            source_system=SourceSystem.CUSTOMER_SERVICE,
            customer_id=f"CUST-{random.randint(1000, 9999)}",
            customer_name=f"客户{i}",
            service_type=original_input["issue_type"],
            priority=random.choice(["low", "medium", "high"]),
            title=f"工单标题 - {original_input['issue_type']}",
            description=original_input["description"],
            original_input=original_input,
            created_at=created_at_base + timedelta(hours=i),
            created_by="cs_agent_" + str(random.randint(1, 10))
        )
        
        db.add(work_order)
        db.flush()
        
        JudgmentService.judge_work_order(db, work_order, rule)
        
        create_log = OperationLog(
            work_order_id=work_order.id,
            batch_no=batch_no,
            operation_type=OperationType.CREATE,
            operator=work_order.created_by,
            operation_remark="创建工单",
            after_data={"order_no": work_order.order_no, "status": work_order.status},
            source_system=SourceSystem.CUSTOMER_SERVICE
        )
        db.add(create_log)
    
    db.commit()
    print(f"批次 {batch_no} 工单初始化完成: {count} 条")


def init_cloud_resource_update(db: Session):
    print("初始化云资源申请单补改记录...")
    
    batch_no = "CLOUD-202401"
    
    work_order = WorkOrder(
        order_no="WO-CLOUD-001",
        batch_no=batch_no,
        source_system=SourceSystem.CLOUD_RESOURCE,
        customer_id="CUST-8888",
        customer_name="云服务客户A",
        service_type="云资源申请",
        priority="high",
        title="云服务器规格升级申请",
        description="申请将服务器从2核4G升级到8核16G",
        original_input={
            "request_id": "REQ-CLOUD-202401001",
            "timestamp": datetime.now().isoformat(),
            "resource_type": "ecs",
            "current_spec": "2c4g",
            "target_spec": "8c16g",
            "region": "cn-shanghai"
        },
        created_by="cloud_user_001"
    )
    
    db.add(work_order)
    db.flush()
    JudgmentService.judge_work_order(db, work_order)
    
    log = OperationLog(
        work_order_id=work_order.id,
        batch_no=batch_no,
        operation_type=OperationType.UPDATE,
        operator="cloud_operator_001",
        operation_remark="补充申请信息",
        before_data={"target_spec": "8c16g"},
        after_data={"target_spec": "16c32g"},
        source_system=SourceSystem.CLOUD_RESOURCE,
        change_reason="业务需求变更，需要更高配置"
    )
    db.add(log)
    
    db.commit()
    print("云资源申请单补改记录初始化完成")


def add_manual_correction(db: Session):
    print("添加人工修正示例...")
    
    abnormal_order = db.query(WorkOrder).filter(
        WorkOrder.timezone_abnormal == True
    ).first()
    
    if abnormal_order:
        before_data = {
            "manual_judgment": abnormal_order.manual_judgment,
            "final_judgment": abnormal_order.final_judgment
        }
        
        abnormal_order.manual_judgment = "经核实，该时区偏移为员工海外出差正常场景"
        abnormal_order.judgment_remark = "员工工号: EMP8888, 出差地: 美国硅谷, 审批流程已归档"
        abnormal_order.final_judgment = "经核实，该时区偏移为员工海外出差正常场景"
        abnormal_order.judged_by = "risk_audit_001"
        abnormal_order.judged_at = datetime.now()
        abnormal_order.status = "manual_corrected"
        
        log = OperationLog(
            work_order_id=abnormal_order.id,
            batch_no=abnormal_order.batch_no,
            operation_type=OperationType.MANUAL_CORRECT,
            operator="risk_audit_001",
            operation_remark="人工修正判断结果",
            before_data=before_data,
            after_data={
                "manual_judgment": abnormal_order.manual_judgment,
                "final_judgment": abnormal_order.final_judgment
            },
            source_system=SourceSystem.ADMIN_PORTAL
        )
        db.add(log)
        
        db.commit()
        print(f"已为工单 {abnormal_order.order_no} 添加人工修正记录")


def main():
    db = SessionLocal()
    
    try:
        init_rules(db)
        init_work_orders(db, "BATCH-202401", count=10, use_old_rule=True)
        init_work_orders(db, "BATCH-202402", count=12, use_old_rule=False)
        init_cloud_resource_update(db)
        add_manual_correction(db)
        
        print("\n数据初始化完成!")
        print(f"总工单数量: {db.query(WorkOrder).count()}")
        print(f"异常工单数量: {db.query(WorkOrder).filter(WorkOrder.is_abnormal == True).count()}")
        print(f"时区异常工单: {db.query(WorkOrder).filter(WorkOrder.timezone_abnormal == True).count()}")
        print(f"人工修正工单: {db.query(WorkOrder).filter(WorkOrder.status == 'manual_corrected').count()}")
        print(f"操作日志数量: {db.query(OperationLog).count()}")
        
    except Exception as e:
        print(f"初始化失败: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
