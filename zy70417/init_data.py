from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.models import Rule, Batch, EdgeNode, CheckResult, IoTReceipt, ManualChange
from app.services.rule_engine import rule_engine
from datetime import datetime

Base.metadata.create_all(bind=engine)


def init_rules(db: Session):
    existing_rules = db.query(Rule).count()
    if existing_rules > 0:
        print("规则已存在，跳过初始化")
        return

    rules = [
        {
            "name": "软件版本过旧风险",
            "code": "R001",
            "description": "软件版本低于1.2.0存在安全漏洞",
            "risk_type": "版本风险",
            "condition": {
                "field": "software_version",
                "operator": "lt",
                "value": "1.2.0"
            }
        },
        {
            "name": "测试环境非法IP段风险",
            "code": "R002",
            "description": "生产环境不允许使用192.168测试网段",
            "risk_type": "配置风险",
            "condition": {
                "field": "ip_address",
                "operator": "startswith",
                "value": "192.168."
            }
        },
        {
            "name": "高危区域硬件型号风险",
            "code": "R003",
            "description": "华北区域禁止使用HW-200型号硬件",
            "risk_type": "硬件风险",
            "condition": {
                "logic": "and",
                "conditions": [
                    {
                        "field": "region",
                        "operator": "eq",
                        "value": "华北"
                    },
                    {
                        "field": "hardware_model",
                        "operator": "eq",
                        "value": "HW-200"
                    }
                ]
            }
        },
        {
            "name": "黑名单组风险",
            "code": "R004",
            "description": "Alpha和Beta组处于高风险状态",
            "risk_type": "分组风险",
            "condition": {
                "field": "group",
                "operator": "in",
                "value": ["Alpha", "Beta"]
            }
        }
    ]

    for rule_data in rules:
        rule = Rule(
            name=rule_data["name"],
            code=rule_data["code"],
            description=rule_data["description"],
            risk_type=rule_data["risk_type"],
            condition=rule_data["condition"],
            version=1,
            is_active=True
        )
        db.add(rule)

    db.commit()
    print(f"已初始化 {len(rules)} 条规则")


def init_sample_batch(db: Session):
    existing_batch = db.query(Batch).filter(Batch.batch_no == "SAMPLE-001").first()
    if existing_batch:
        print("样例批次已存在，跳过初始化")
        return

    nodes_data = [
        {
            "node_id": "NODE-001",
            "node_name": "北京边缘计算节点-A",
            "region": "华北",
            "group": "Gamma",
            "hardware_model": "HW-100",
            "software_version": "1.3.0",
            "ip_address": "10.0.1.10",
            "responsible_team": "团队A"
        },
        {
            "node_id": "NODE-002",
            "node_name": "上海边缘计算节点-B",
            "region": "华东",
            "group": "Alpha",
            "hardware_model": "HW-200",
            "software_version": "1.1.5",
            "ip_address": "192.168.1.20",
            "responsible_team": "团队B"
        },
        {
            "node_id": "NODE-003",
            "node_name": "广州边缘计算节点-C",
            "region": "华南",
            "group": "Beta",
            "hardware_model": "HW-300",
            "software_version": "1.2.5",
            "ip_address": "172.16.0.30",
            "responsible_team": "团队A"
        },
        {
            "node_id": "NODE-004",
            "node_name": "天津边缘计算节点-D",
            "region": "华北",
            "group": "Delta",
            "hardware_model": "HW-200",
            "software_version": "1.0.0",
            "ip_address": "192.168.2.40",
            "responsible_team": "团队C"
        }
    ]

    batch = Batch(
        batch_no="SAMPLE-001",
        operator="系统管理员",
        status="processing",
        total_count=len(nodes_data)
    )
    batch.data_hash = batch.generate_data_hash(nodes_data)
    db.add(batch)
    db.flush()

    for node_data in nodes_data:
        node = EdgeNode(
            batch_id=batch.id,
            **node_data
        )
        db.add(node)

    db.flush()

    active_rules = db.query(Rule).filter(Rule.is_active == True).all()
    rule_snapshot = rule_engine.get_rule_snapshot(active_rules)
    batch.rule_version_snapshot = rule_snapshot

    all_nodes = db.query(EdgeNode).filter(EdgeNode.batch_id == batch.id).all()
    risk_count = 0

    for node in all_nodes:
        results = rule_engine.check_node(node, active_rules)
        for result in results:
            result.batch_id = batch.id
            result.node_id = node.id
            db.add(result)
            if result.is_blocked:
                risk_count += 1

    batch.risk_count = risk_count
    batch.status = "completed"
    batch.completed_at = datetime.now()

    db.commit()
    print(f"已初始化样例批次，共 {risk_count} 个风险项")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        init_rules(db)
        init_sample_batch(db)
        print("数据初始化完成")
    finally:
        db.close()
