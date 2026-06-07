import sys
import os
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal, init_db
from backend import models
from backend.services import appeal_service


def init_demo_data():
    init_db()
    db = SessionLocal()

    print("🚀 开始初始化演示数据...")

    v1 = models.ModelVersion(version_name="v2024.01.01", description="基线版本")
    v2 = models.ModelVersion(version_name="v2024.02.01", description="优化低置信度样本后版本")
    db.add_all([v1, v2])
    db.flush()
    print(f"✅ 创建模型版本: {v1.version_name}, {v2.version_name}")

    sample_path = os.path.join(os.path.dirname(__file__), "samples", "sample_ticket.csv")
    df = pd.read_csv(sample_path)
    ticket, warnings = appeal_service.import_ticket_from_df(
        db, df, "FEEDBACK-2024-001", 1, "demo_script"
    )
    print(f"✅ 导入工单: {ticket.ticket_no}, 样本数: {len(ticket.samples)}")
    for w in warnings:
        print(f"  ⚠️  {w}")

    ranks_v1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    ranks_v2 = [1, 3, 2, 4, 6, 5, 5, 8, 9, 7]
    scores = [0.95, 0.88, 0.42, 0.80, 0.35, 0.90, 0.50, 0.93, 0.85, 0.40]

    for i, sample in enumerate(ticket.samples):
        sv1 = models.SampleVersion(
            sample_id=sample.id,
            model_version_id=v1.id,
            rank=ranks_v1[i],
            score=scores[i],
            is_manual_modified=False
        )
        sv2 = models.SampleVersion(
            sample_id=sample.id,
            model_version_id=v2.id,
            rank=ranks_v2[i],
            score=scores[i] + 0.02 if i in [2, 4, 6, 9] else scores[i],
            is_manual_modified=i in [2, 6]
        )
        db.add_all([sv1, sv2])

    print(f"✅ 创建版本对比数据")

    audit = models.AuditLog(
        ticket_id=ticket.id,
        action="补看脱敏规则备注",
        operator="周姐",
        after_value={"desensitization_note": "已核对脱敏规则，S003、S005、S007、S010 涉及员工敏感数据，需特殊处理"},
        note="标注负责人周姐完成第一次审阅"
    )
    db.add(audit)

    ticket.desensitization_note = "已核对脱敏规则，S003、S005、S007、S010 涉及员工敏感数据，需特殊处理"
    ticket.handler = "周姐"
    ticket.status = "处理中"
    db.commit()

    print(f"✅ 周姐补看脱敏规则备注完成")

    appeal_service.recalculate_ranks(db, ticket.id, "周姐")
    print(f"✅ 完成第一次重算")

    appeal_service.run_self_check(db, ticket.id)
    print(f"✅ 完成自检")

    db.refresh(ticket)
    hidden_count = sum(1 for s in ticket.samples if s.is_hidden_by_avg)
    print(f"\n📊 数据统计:")
    print(f"   - 总工单数: 1")
    print(f"   - 总样本数: {len(ticket.samples)}")
    print(f"   - 低置信度样本: {sum(1 for s in ticket.samples if s.is_low_confidence)}")
    print(f"   - 被平均指标盖住: {hidden_count}")
    print(f"   - 待复核样本: {sum(1 for s in ticket.samples if s.status == '待复核')}")
    print(f"   - 模型版本数: 2")

    db.close()
    print(f"\n🎉 演示数据初始化完成！")
    print(f"   启动服务后访问: http://localhost:8000")


if __name__ == "__main__":
    init_demo_data()
