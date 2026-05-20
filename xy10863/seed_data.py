#!/usr/bin/env python3
import sys
from datetime import datetime, timedelta
from database import engine, Base, SessionLocal, BackupPoint, RestoreRecord, Approval, ExecutionStep, VerificationResult, ChangeLog
from sqlalchemy.orm import Session

def seed_backup_points(db: Session):
    print("创建备份点...")
    backups = [
        {
            "backup_id": "prod-db-20240515-01",
            "environment": "production",
            "backup_time": datetime.now() - timedelta(hours=2),
            "size": "2.5GB",
            "databases": ["main_db", "logs_db"],
            "tables": {"main_db": ["users", "orders", "products"]},
            "storage_path": "/backup/prod-db-20240515-01.sql",
            "description": "生产环境日常备份"
        },
        {
            "backup_id": "prod-db-20240514-01",
            "environment": "production",
            "backup_time": datetime.now() - timedelta(days=1),
            "size": "2.4GB",
            "databases": ["main_db", "logs_db"],
            "tables": {"main_db": ["users", "orders", "products"]},
            "storage_path": "/backup/prod-db-20240514-01.sql",
            "description": "生产环境日常备份"
        },
        {
            "backup_id": "staging-db-20240515-01",
            "environment": "staging",
            "backup_time": datetime.now() - timedelta(hours=5),
            "size": "800MB",
            "databases": ["main_db"],
            "tables": {"main_db": ["users", "orders"]},
            "storage_path": "/backup/staging-db-20240515-01.sql",
            "description": "演练环境备份"
        }
    ]
    
    for b in backups:
        existing = db.query(BackupPoint).filter(BackupPoint.backup_id == b["backup_id"]).first()
        if not existing:
            bp = BackupPoint(**b, status="available")
            db.add(bp)
    db.commit()
    print(f"备份点创建完成")

def create_success_case(db: Session):
    print("\n创建【成功案例】: 完整流程 - 申请→审批→演练→执行→验证→完成")
    bp = db.query(BackupPoint).first()
    
    record = RestoreRecord(
        title="用户数据误删除恢复",
        description="恢复2024年5月14日用户表数据",
        status="pending_approval",
        backup_point_id=bp.backup_id,
        backup_point_time=bp.backup_time,
        source_environment=bp.environment,
        target_environment="staging",
        restore_scope={"databases": ["main_db"], "tables": ["users"], "point_in_time": "2024-05-14 23:59:59"},
        applicant="张三",
        applicant_email="zhangsan@example.com",
        reason="开发人员误操作删除了部分用户数据，需要恢复到演练环境验证",
        created_at=datetime.now() - timedelta(hours=3)
    )
    db.add(record)
    db.commit()
    
    auto_approval = Approval(
        record_id=record.id,
        approver="system_auto",
        approval_type="auto_check",
        status="approved",
        comment="系统自动检查通过",
        approved_at=datetime.now() - timedelta(hours=2, minutes=50)
    )
    db.add(auto_approval)
    
    change_log1 = ChangeLog(
        record_id=record.id,
        action="create",
        changed_by="张三",
        comment="创建恢复申请"
    )
    db.add(change_log1)
    db.commit()
    
    main_approval = Approval(
        record_id=record.id,
        approver="李四",
        approval_type="main",
        status="approved",
        comment="同意恢复，请注意数据一致性",
        approved_at=datetime.now() - timedelta(hours=2)
    )
    db.add(main_approval)
    
    change_log2 = ChangeLog(
        record_id=record.id,
        action="status_change",
        previous_status="pending_approval",
        new_status="approved",
        changed_by="李四",
        comment="审批通过"
    )
    db.add(change_log2)
    db.commit()
    
    record.status = "drill_started"
    db.commit()
    
    drill_steps = [
        {"step_number": 1, "step_name": "[演练] 环境检查", "description": "检查目标环境可用性", "status": "completed", "result": "环境正常，资源充足"},
        {"step_number": 2, "step_name": "[演练] 备份验证", "description": "验证备份文件完整性", "status": "completed", "result": "备份文件完整，校验通过"},
        {"step_number": 3, "step_name": "[演练] 数据准备", "description": "准备恢复所需资源", "status": "completed", "result": "临时资源已就绪"},
        {"step_number": 4, "step_name": "[演练] 执行恢复", "description": "执行数据库恢复", "status": "completed", "result": "恢复成功，耗时12分钟"},
        {"step_number": 5, "step_name": "[演练] 数据校验", "description": "校验恢复后数据一致性", "status": "completed", "result": "数据一致性校验通过，用户表恢复记录数与备份一致"},
    ]
    
    for s in drill_steps:
        step = ExecutionStep(
            record_id=record.id,
            **s,
            started_at=datetime.now() - timedelta(hours=1, minutes=45),
            completed_at=datetime.now() - timedelta(hours=1, minutes=30)
        )
        db.add(step)
    
    record.status = "drill_completed"
    db.commit()
    
    change_log3 = ChangeLog(
        record_id=record.id,
        action="status_change",
        previous_status="drill_started",
        new_status="drill_completed",
        changed_by="王五",
        comment="演练完成，数据一致"
    )
    db.add(change_log3)
    db.commit()
    
    record.status = "execution_in_progress"
    db.commit()
    
    exec_steps = [
        {"step_number": 1, "step_name": "环境检查", "description": "检查目标环境可用性和资源配置", "status": "completed", "result": "目标环境正常"},
        {"step_number": 2, "step_name": "备份验证", "description": "验证备份文件完整性和可用性", "status": "completed", "result": "备份验证通过"},
        {"step_number": 3, "step_name": "数据准备", "description": "准备恢复所需的临时资源", "status": "completed", "result": "准备完成"},
        {"step_number": 4, "step_name": "执行恢复", "description": "执行数据库恢复操作", "status": "completed", "result": "恢复成功，影响12500条记录"},
        {"step_number": 5, "step_name": "数据校验", "description": "校验恢复后的数据一致性", "status": "completed", "result": "数据校验通过"},
    ]
    
    for s in exec_steps:
        step = ExecutionStep(
            record_id=record.id,
            **s,
            started_at=datetime.now() - timedelta(minutes=40),
            completed_at=datetime.now() - timedelta(minutes=20)
        )
        db.add(step)
    db.commit()
    
    record.status = "verification_in_progress"
    db.commit()
    
    verifications = [
        {"verification_type": "data_count", "description": "数据行数校验", "expected_value": "12500 rows", "actual_value": "12500 rows", "passed": True, "verified_by": "赵六", "status": "completed"},
        {"verification_type": "data_integrity", "description": "关键数据完整性校验", "expected_value": "全部通过", "actual_value": "字段完整，外键关联正常", "passed": True, "verified_by": "赵六", "status": "completed"},
        {"verification_type": "schema_check", "description": "数据库结构校验", "expected_value": "结构一致", "actual_value": "表结构、索引、约束一致", "passed": True, "verified_by": "赵六", "status": "completed"},
        {"verification_type": "application_connect", "description": "应用连接测试", "expected_value": "连接成功", "actual_value": "应用连接正常，业务功能可用", "passed": True, "verified_by": "赵六", "status": "completed"},
    ]
    
    for v in verifications:
        verification = VerificationResult(
            record_id=record.id,
            **v,
            verified_at=datetime.now() - timedelta(minutes=5)
        )
        db.add(verification)
    db.commit()
    
    record.status = "completed"
    record.completed_at = datetime.now()
    record.rollback_available = True
    db.commit()
    
    change_log4 = ChangeLog(
        record_id=record.id,
        action="status_change",
        previous_status="verification_in_progress",
        new_status="completed",
        changed_by="赵六",
        comment="验证通过，恢复完成"
    )
    db.add(change_log4)
    db.commit()
    
    print(f"成功案例创建完成，记录ID: {record.id}")
    return record.id

def create_failure_case(db: Session):
    print("\n创建【失败案例】: 执行失败→待回滚")
    bp = db.query(BackupPoint).offset(1).first()
    
    record = RestoreRecord(
        title="订单数据恢复",
        description="恢复订单表到指定时间点",
        status="execution_failed",
        backup_point_id=bp.backup_id,
        backup_point_time=bp.backup_time,
        source_environment=bp.environment,
        target_environment="production",
        restore_scope={"databases": ["main_db"], "tables": ["orders"], "point_in_time": "2024-05-14 18:00:00"},
        applicant="孙七",
        applicant_email="sunqi@example.com",
        reason="订单数据出现异常，需要回滚恢复",
        created_at=datetime.now() - timedelta(hours=1),
        rollback_available=True
    )
    db.add(record)
    db.commit()
    
    steps = [
        {"step_number": 1, "step_name": "环境检查", "description": "检查目标环境可用性", "status": "completed", "result": "环境正常"},
        {"step_number": 2, "step_name": "备份验证", "description": "验证备份文件完整性", "status": "completed", "result": "验证通过"},
        {"step_number": 3, "step_name": "数据准备", "description": "准备恢复所需的临时资源", "status": "completed", "result": "准备完成"},
        {"step_number": 4, "step_name": "执行恢复", "description": "执行数据库恢复操作", "status": "failed", "result": None, "error_message": "存储空间不足，恢复过程中断，部分表空间不足，无法继续，无法继续执行，影响5000条记录"},
        {"step_number": 5, "step_name": "数据校验", "description": "校验恢复后的数据一致性", "status": "pending"},
    ]
    
    for s in steps:
        step = ExecutionStep(
            record_id=record.id,
            **s,
            started_at=datetime.now() - timedelta(minutes=30),
            completed_at=datetime.now() - timedelta(minutes=15) if s["status"] != "pending" else None
        )
        db.add(step)
    db.commit()
    
    change_log = ChangeLog(
        record_id=record.id,
        action="status_change",
        previous_status="execution_in_progress",
        new_status="execution_failed",
        changed_by="系统",
        comment="执行失败：存储空间不足",
        details={"error": "disk full", "failed_step": 4}
    )
    db.add(change_log)
    db.commit()
    
    print(f"失败案例创建完成，记录ID: {record.id}")
    return record.id

def create_pending_approval_case(db: Session):
    print("\n创建【待审批案例】: 新建申请等待审批")
    bp = db.query(BackupPoint).first()
    
    record = RestoreRecord(
        title="产品表数据修复",
        description="修复产品表数据异常",
        status="pending_approval",
        backup_point_id=bp.backup_id,
        backup_point_time=bp.backup_time,
        source_environment=bp.environment,
        target_environment="staging",
        restore_scope={"databases": ["main_db"], "tables": ["products"]},
        applicant="周八",
        applicant_email="zhouba@example.com",
        reason="产品价格字段出现异常，需要恢复验证",
        created_at=datetime.now() - timedelta(minutes=10)
    )
    db.add(record)
    db.commit()
    
    auto_approval = Approval(
        record_id=record.id,
        approver="system_auto",
        approval_type="auto_check",
        status="approved",
        comment="系统自动检查通过"
    )
    db.add(auto_approval)
    
    change_log = ChangeLog(
        record_id=record.id,
        action="create",
        changed_by="周八",
        comment="创建恢复申请，等待审批"
    )
    db.add(change_log)
    db.commit()
    
    print(f"待审批案例创建完成，记录ID: {record.id}")
    return record.id

def create_duplicate_submit_case(db: Session):
    print("\n创建【重复提交检测】: 同备份点在目标环境已有进行中的申请")
    bp = db.query(BackupPoint).first()
    
    record = RestoreRecord(
        title="重复提交测试 - 已批准",
        description="用于测试重复提交检测",
        status="approved",
        backup_point_id=bp.backup_id,
        backup_point_time=bp.backup_time,
        source_environment=bp.environment,
        target_environment="testing",
        restore_scope={"databases": ["main_db"]},
        applicant="测试用户",
        reason="测试重复提交功能",
        created_at=datetime.now() - timedelta(minutes=5)
    )
    db.add(record)
    db.commit()
    
    print(f"重复提交测试案例创建完成，记录ID: {record.id}")
    return record.id, bp.backup_id

def main():
    print("=" * 60)
    print("备份恢复申请台 - 样例数据初始化")
    print("=" * 60)
    
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        seed_backup_points(db)
        
        success_id = create_success_case(db)
        failure_id = create_failure_case(db)
        pending_id = create_pending_approval_case(db)
        dup_id, dup_backup_id = create_duplicate_submit_case(db)
        
        print("\n" + "=" * 60)
        print("样例数据创建完成！")
        print(f"- 成功案例 (ID:", success_id)
        print(f"- 失败案例 (ID:", failure_id)
        print(f"- 待审批案例 (ID:", pending_id)
        print(f"- 重复提交测试案例 (ID:", dup_id)
        print(f"  重复提交测试备份点:", dup_backup_id)
        print("\n现在可以运行: python main.py 启动服务")
        print("访问 http://localhost:8000 查看系统")
        print("=" * 60)
        
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
