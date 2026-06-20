import sys
import os
import pandas as pd
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal, init_db
from backend import models
from backend.services import appeal_service


def init_demo_data():
    from backend.database import BASE_DIR
    db_path = os.path.join(BASE_DIR, "appeal.db")
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"🗑️  已删除旧数据库: {db_path}")

    init_db()
    db = SessionLocal()

    print("🚀 开始初始化演示数据...")

    v_old = models.ModelVersion(version_name="v2024.01.01", description="基线版本")
    db.add(v_old)
    db.flush()
    time.sleep(0.05)

    v_new = models.ModelVersion(version_name="v2024.02.01", description="优化低置信度样本后版本")
    db.add(v_new)
    db.flush()
    time.sleep(0.05)
    print(f"✅ 创建模型版本: #{v_old.id}={v_old.version_name} (基线), #{v_new.id}={v_new.version_name} (最新)")

    sample_path = os.path.join(os.path.dirname(__file__), "samples", "sample_ticket.csv")
    df = pd.read_csv(sample_path)
    ticket, warnings = appeal_service.import_ticket_from_df(
        db, df, "FEEDBACK-2024-001", 1, "demo_script"
    )
    print(f"✅ 导入工单: {ticket.ticket_no}, 样本数: {len(ticket.samples)}")
    for w in warnings:
        print(f"  ⚠️  {w}")

    ranks_v1_old = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    ranks_v2_new = [1, 3, 2, 4, 6, 5, 7, 8, 9, 10]
    scores = [0.95, 0.88, 0.45, 0.80, 0.38, 0.90, 0.52, 0.93, 0.83, 0.42]

    for i, sample in enumerate(ticket.samples):
        sv1 = models.SampleVersion(
            sample_id=sample.id,
            model_version_id=v_old.id,
            rank=ranks_v1_old[i],
            score=scores[i],
            is_manual_modified=False
        )
        db.add(sv1)
        db.flush()
    time.sleep(0.05)

    for i, sample in enumerate(ticket.samples):
        sv2 = models.SampleVersion(
            sample_id=sample.id,
            model_version_id=v_new.id,
            rank=ranks_v2_new[i],
            score=scores[i] + 0.02 if i in [2, 4, 6, 9] else scores[i],
            is_manual_modified=False
        )
        db.add(sv2)
        db.flush()

    print(f"✅ 创建版本对比数据 (共 {len(ticket.samples) * 2} 条 SampleVersion)")

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

    result = appeal_service.recalculate_ranks(db, ticket.id, "周姐")
    print(f"✅ 完成补录重算: {result}")

    check = appeal_service.check_recalculate_consistency(db, ticket.id)
    print(f"✅ 重算后自检一致性: passed={check['passed']}, 不一致={len(check['inconsistencies'])} 条")
    for item in check['inconsistencies']:
        print(f"   ❌ {item}")

    appeal_service.run_self_check(db, ticket.id)
    print(f"✅ 完成完整自检")

    db.refresh(ticket)
    hidden_count = sum(1 for s in ticket.samples if s.is_hidden_by_avg)
    print(f"\n📊 数据统计:")
    print(f"   - 总工单数: 1")
    print(f"   - 总样本数: {len(ticket.samples)}")
    print(f"   - 低置信度样本: {sum(1 for s in ticket.samples if s.is_low_confidence)}")
    print(f"   - 被平均指标盖住: {hidden_count}")
    print(f"   - 待复核样本: {sum(1 for s in ticket.samples if s.status == '待复核')}")
    print(f"   - 模型版本数: 2")
    print(f"\n   排名对齐情况 (current_rank vs 最新版本 v2024.02.01):")
    for s in ticket.samples:
        latest_sv = next((sv for sv in s.versions if sv.model_version_id == v_new.id), None)
        sv_rank = latest_sv.rank if latest_sv else "N/A"
        match = "✅" if s.current_rank == sv_rank else "❌"
        special = ""
        if s.is_low_confidence:
            special = " [低置信度]"
        if s.is_hidden_by_avg:
            special += " [被平均盖住]"
        print(f"   {match} {s.sample_no}: current={s.current_rank}, v2024.02.01={sv_rank}, status={s.status}{special}")

    db.close()
    print(f"\n🎉 演示数据初始化完成！")
    print(f"   启动服务后访问: http://localhost:8000")


if __name__ == "__main__":
    init_demo_data()
