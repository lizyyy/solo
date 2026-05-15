import sys
from datetime import datetime
from sqlalchemy.orm import Session

sys.path.append(".")

from app.database import SessionLocal, engine, Base
from app.models import TaskBatch, TaskResult, EdgeNode, IoTReceipt, TaskStatus, RiskType
from app.services.rule_engine import initialize_default_rules, RuleEngine


def init_sample_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    initialize_default_rules(db)

    print("创建边缘节点清册...")
    edge_nodes = [
        {"node_id": "NODE-001", "node_name": "北京边缘节点1", "ip_address": "192.168.1.10",
         "location": "北京机房A", "responsibility_team": "运维一组"},
        {"node_id": "NODE-002", "node_name": "上海边缘节点2", "ip_address": "192.168.1.11",
         "location": "上海机房B", "responsibility_team": "运维二组"},
        {"node_id": "NODE-003", "node_name": "广州边缘节点3", "ip_address": "192.168.1.12",
         "location": "广州机房C", "responsibility_team": "运维一组"},
        {"node_id": "NODE-004", "node_name": "深圳边缘节点4", "ip_address": "192.168.1.13",
         "location": "深圳机房D", "responsibility_team": "运维三组"},
    ]

    for node_data in edge_nodes:
        existing = db.query(EdgeNode).filter(EdgeNode.node_id == node_data["node_id"]).first()
        if not existing:
            db_node = EdgeNode(**node_data)
            db.add(db_node)

    db.commit()
    print(f"创建了 {len(edge_nodes)} 个边缘节点")

    print("创建任务批次...")
    batch_id = "BATCH-2024-001"
    batch_data = {
        "batch_id": batch_id,
        "batch_name": "边缘节点配置更新任务",
        "operator": "张三",
        "status": TaskStatus.RUNNING,
        "risk_type": RiskType.UNKNOWN,
        "remarks": "批量更新边缘节点安全配置"
    }

    existing_batch = db.query(TaskBatch).filter(TaskBatch.batch_id == batch_id).first()
    if not existing_batch:
        batch = TaskBatch(**batch_data)
        db.add(batch)
        db.commit()
        db.refresh(batch)
    else:
        batch = existing_batch

    print(f"创建批次: {batch_id}")

    print("创建任务结果（包含2条提前终止记录）...")
    task_results = [
        {
            "task_id": "TASK-001",
            "batch_id": batch_id,
            "node_id": "NODE-001",
            "status": TaskStatus.SUCCESS,
            "is_early_terminated": False,
            "error_code": None,
            "error_message": None,
            "raw_output": "配置更新成功"
        },
        {
            "task_id": "TASK-002",
            "batch_id": batch_id,
            "node_id": "NODE-002",
            "status": TaskStatus.EARLY_TERMINATED,
            "is_early_terminated": True,
            "error_code": "SEC-001",
            "error_message": "设备安全认证失败，密钥无效",
            "raw_output": "Authentication failed: invalid security key"
        },
        {
            "task_id": "TASK-003",
            "batch_id": batch_id,
            "node_id": "NODE-003",
            "status": TaskStatus.SUCCESS,
            "is_early_terminated": False,
            "error_code": None,
            "error_message": None,
            "raw_output": "配置更新成功"
        },
        {
            "task_id": "TASK-004",
            "batch_id": batch_id,
            "node_id": "NODE-004",
            "status": TaskStatus.EARLY_TERMINATED,
            "is_early_terminated": True,
            "error_code": "NET-001",
            "error_message": "网络连接超时，无法建立通信",
            "raw_output": "Connection timeout after 30 seconds"
        },
    ]

    for task_data in task_results:
        existing = db.query(TaskResult).filter(TaskResult.task_id == task_data["task_id"]).first()
        if not existing:
            task = TaskResult(**task_data)
            db.add(task)

    db.commit()
    print(f"创建了 {len(task_results)} 条任务记录")

    print("创建IoT回执原始记录...")
    iot_receipts = [
        {
            "receipt_id": "RECEIPT-001",
            "node_id": "NODE-001",
            "task_id": "TASK-001",
            "receipt_type": "success",
            "raw_data": '{"timestamp": "2024-01-15T10:00:00Z", "status": "success", "details": "配置已应用"}',
            "responsibility_team": "运维一组"
        },
        {
            "receipt_id": "RECEIPT-002",
            "node_id": "NODE-002",
            "task_id": "TASK-002",
            "receipt_type": "error",
            "raw_data": '{"timestamp": "2024-01-15T10:01:00Z", "status": "error", "code": "SEC-001", "message": "认证失败，密钥无效", "stack_trace": "..."}',
            "responsibility_team": "运维二组"
        },
        {
            "receipt_id": "RECEIPT-003",
            "node_id": "NODE-003",
            "task_id": "TASK-003",
            "receipt_type": "success",
            "raw_data": '{"timestamp": "2024-01-15T10:02:00Z", "status": "success", "details": "配置已应用"}',
            "responsibility_team": "运维一组"
        },
        {
            "receipt_id": "RECEIPT-004",
            "node_id": "NODE-004",
            "task_id": "TASK-004",
            "receipt_type": "error",
            "raw_data": '{"timestamp": "2024-01-15T10:03:00Z", "status": "error", "code": "NET-001", "message": "连接超时", "retry_count": 3}',
            "responsibility_team": "运维三组"
        },
    ]

    for receipt_data in iot_receipts:
        existing = db.query(IoTReceipt).filter(IoTReceipt.receipt_id == receipt_data["receipt_id"]).first()
        if not existing:
            receipt = IoTReceipt(**receipt_data)
            db.add(receipt)

    db.commit()
    print(f"创建了 {len(iot_receipts)} 条IoT回执记录")

    print("完成批次并更新统计...")
    batch = db.query(TaskBatch).filter(TaskBatch.batch_id == batch_id).first()
    task_results = db.query(TaskResult).filter(TaskResult.batch_id == batch_id).all()
    batch.total_tasks = len(task_results)
    batch.success_count = sum(1 for t in task_results if t.status == TaskStatus.SUCCESS)
    batch.failed_count = sum(1 for t in task_results if t.status != TaskStatus.SUCCESS)

    if batch.success_count == batch.total_tasks:
        batch.status = TaskStatus.SUCCESS
    elif batch.failed_count == batch.total_tasks:
        batch.status = TaskStatus.FAILED
    else:
        batch.status = TaskStatus.PARTIAL_SUCCESS

    batch.completed_at = datetime.now()
    db.commit()
    print(f"批次统计更新完成: 总数={batch.total_tasks}, 成功={batch.success_count}, 失败={batch.failed_count}, 状态={batch.status.value}")

    print("执行归因分析...")
    rule_engine = RuleEngine(db)
    attribution_results = rule_engine.analyze_batch(batch_id)
    print(f"归因分析完成: 共 {len(attribution_results)} 条归因记录")

    risk_types = [r.risk_type for r in attribution_results if r.risk_type != RiskType.UNKNOWN]
    if risk_types:
        batch.risk_type = max(set(risk_types), key=risk_types.count)
        db.commit()
        print(f"批次风险类型更新为: {batch.risk_type.value}")

    db.close()
    print("\n样例数据初始化完成！")
    print(f"\n测试批次: {batch_id}")
    print("TASK-002: 安全认证失败，将被 SEC_001 规则拦截")
    print("TASK-004: 网络连接超时，将被 NET_001 规则拦截")
    print("访问 /api/v1/output/BATCH-2024-001/json 可查看完整归因结果")


if __name__ == "__main__":
    init_sample_data()
