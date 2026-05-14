from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.migration import MigrationScript, AffectedTable, ExecutionWindow, RollbackScript, MigrationStatus
from app.models.approval import ApprovalChain, ApprovalStep, ApprovalChainStatus, ApprovalStatus
from app.models.execution import ExecutionLog, ExecutionType, ExecutionStatus
from datetime import datetime, timedelta
import json

def init_db():
    db = SessionLocal()
    try:
        migration_count = db.query(MigrationScript).count()
        if migration_count > 0:
            return
        
        migration1 = MigrationScript(
            name="用户表结构优化",
            description="优化users表添加索引和新增字段",
            script_content="""ALTER TABLE users ADD INDEX idx_email (email);
ALTER TABLE users ADD COLUMN phone VARCHAR(20) AFTER email;
ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;""",
            database_type="mysql",
            status=MigrationStatus.DRAFT,
            created_by="developer1",
            version=1,
        )
        db.add(migration1)
        db.flush()

        table1 = AffectedTable(
            migration_id=migration1.id,
            table_name="users",
            operation_type="ALTER",
            estimated_rows=50000,
            has_backup=True,
            remarks="核心用户表"
        )
        db.add(table1)

        window1 = ExecutionWindow(
            migration_id=migration1.id,
            start_time=datetime.now() + timedelta(days=1),
            end_time=datetime.now() + timedelta(days=1, hours=2),
            timezone="Asia/Shanghai",
            is_enabled=True,
            remarks="凌晨低峰期执行"
        )
        db.add(window1)

        rollback1 = RollbackScript(
            migration_id=migration1.id,
            script_content="""ALTER TABLE users DROP INDEX idx_email;
ALTER TABLE users DROP COLUMN phone;
ALTER TABLE users DROP COLUMN created_at;""",
            version=1,
            is_valid=True,
            remarks="回滚脚本已验证"
        )
        db.add(rollback1)

        chain1 = ApprovalChain(
            migration_id=migration1.id,
            status=ApprovalChainStatus.NOT_STARTED,
            current_step_index=0,
            remarks="标准审批流程"
        )
        db.add(chain1)
        db.flush()

        step1_1 = ApprovalStep(
            chain_id=chain1.id,
            step_order=1,
            role="DBA",
            is_required=True,
            rules=json.dumps({"required_role": "DBA"})
        )
        step1_2 = ApprovalStep(
            chain_id=chain1.id,
            step_order=2,
            role="运维负责人",
            is_required=True,
            rules=json.dumps({"required_role": "运维负责人"})
        )
        step1_3 = ApprovalStep(
            chain_id=chain1.id,
            step_order=3,
            role="技术总监",
            is_required=False
        )
        db.add_all([step1_1, step1_2, step1_3])

        migration2 = MigrationScript(
            name="订单表分区",
            description="orders表按月份分区",
            script_content="""ALTER TABLE orders PARTITION BY RANGE (TO_DAYS(created_at)) (
    PARTITION p202401 VALUES LESS THAN (TO_DAYS('2024-02-01')) ENGINE = InnoDB,
    PARTITION p202402 VALUES LESS THAN (TO_DAYS('2024-03-01')) ENGINE = InnoDB
);""",
            database_type="mysql",
            status=MigrationStatus.APPROVED,
            created_by="dba1",
            version=2,
        )
        db.add(migration2)
        db.flush()

        table2 = AffectedTable(
            migration_id=migration2.id,
            table_name="orders",
            operation_type="ALTER",
            estimated_rows=1000000,
            has_backup=True,
            remarks="订单核心表"
        )
        db.add(table2)

        rollback2 = RollbackScript(
            migration_id=migration2.id,
            script_content="""ALTER TABLE orders REMOVE PARTITIONING;""",
            version=1,
            is_valid=True,
            remarks="移除分区"
        )
        db.add(rollback2)

        log1 = ExecutionLog(
            migration_id=migration2.id,
            execution_type=ExecutionType.MIGRATION,
            status=ExecutionStatus.SUCCESS,
            executed_by="dba1",
            started_at=datetime.now() - timedelta(hours=5),
            completed_at=datetime.now() - timedelta(hours=5, minutes=45),
            script_content=migration2.script_content,
            output="执行成功，2个分区已创建",
            affected_rows=1000000,
            duration_seconds=300,
            remarks="首次执行"
        )
        db.add(log1)

        migration3 = MigrationScript(
            name="商品表添加字段",
            description="products表添加description字段",
            script_content="""ALTER TABLE products ADD COLUMN description TEXT AFTER name;""",
            database_type="mysql",
            status=MigrationStatus.FAILED,
            created_by="developer2",
            version=1,
        )
        db.add(migration3)
        db.flush()

        table3 = AffectedTable(
            migration_id=migration3.id,
            table_name="products",
            operation_type="ALTER",
            estimated_rows=10000,
            has_backup=False,
            remarks="商品表"
        )
        db.add(table3)

        rollback3 = RollbackScript(
            migration_id=migration3.id,
            script_content="""ALTER TABLE products DROP COLUMN description;""",
            version=1,
            is_valid=False,
            validation_result="字段不存在，无法回滚",
            remarks="回滚脚本无效"
        )
        db.add(rollback3)

        log2 = ExecutionLog(
            migration_id=migration3.id,
            execution_type=ExecutionType.MIGRATION,
            status=ExecutionStatus.FAILED,
            executed_by="developer2",
            started_at=datetime.now() - timedelta(hours=2),
            completed_at=datetime.now() - timedelta(hours=2, minutes=2),
            script_content=migration3.script_content,
            error_message="1064 - You have an error in your SQL syntax;",
            duration_seconds=120,
            remarks="执行失败"
        )
        db.add(log2)

        db.commit()
        print("初始化数据完成")
    except Exception as e:
        db.rollback()
        print(f"初始化数据失败: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()