import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal, init_db
from backend import models

init_db()
db = SessionLocal()

print("=" * 60)
print("📋 验证工单数据")
print("=" * 60)
tickets = db.query(models.AppealTicket).all()
print(f"工单数量: {len(tickets)}")
for t in tickets:
    print(f"  ✅ 工单 {t.ticket_no}:")
    print(f"     - 来源: {t.source}")
    print(f"     - 原始行号: {t.original_row_no}")
    print(f"     - 样本数: {len(t.samples)}")
    print(f"     - 状态: {t.status}")
    print(f"     - 处理人: {t.handler}")
    print(f"     - 脱敏备注: {t.desensitization_note[:30]}..." if t.desensitization_note and len(t.desensitization_note) > 30 else f"     - 脱敏备注: {t.desensitization_note}")

print("\n" + "=" * 60)
print("🔍 验证样本数据（低置信度专项）")
print("=" * 60)
samples = db.query(models.Sample).all()
print(f"总样本数: {len(samples)}")
low_conf = [s for s in samples if s.is_low_confidence]
hidden = [s for s in samples if s.is_hidden_by_avg]
pending = [s for s in samples if s.status == "待复核"]
print(f"低置信度: {len(low_conf)}, 被平均盖住: {len(hidden)}, 待复核: {len(pending)}")
print()
for s in samples:
    if s.is_low_confidence:
        flag = "⚠️ " if s.is_hidden_by_avg else "  "
        print(f"  {flag}{s.sample_no}: 置信度 {s.confidence:.2f}, 状态: {s.status}, 被盖住: {s.is_hidden_by_avg}")

print("\n" + "=" * 60)
print("📝 验证审计追踪")
print("=" * 60)
logs = db.query(models.AuditLog).all()
print(f"审计日志数量: {len(logs)}")
for l in logs:
    sample_info = f", 样本ID: {l.sample_id}" if l.sample_id else ""
    print(f"  ✅ [{l.created_at.strftime('%H:%M:%S')}] {l.action} by {l.operator}{sample_info}")
    if l.note:
        print(f"     备注: {l.note}")

print("\n" + "=" * 60)
print("✅ 验证四大自检结果")
print("=" * 60)
checks = db.query(models.SelfCheckResult).all()
print(f"自检记录数量: {len(checks)}")
for c in checks:
    status = "✅ 通过" if c.passed else "❌ 失败"
    print(f"  {status} - {c.check_type}")
    if c.details:
        for k, v in c.details.items():
            if k != "passed":
                print(f"     {k}: {v}")

print("\n" + "=" * 60)
print("📊 验证模型版本对比")
print("=" * 60)
versions = db.query(models.ModelVersion).all()
print(f"模型版本数量: {len(versions)}")
for v in versions:
    sv_count = len(v.sample_versions)
    print(f"  ✅ {v.version_name}: {sv_count} 个样本版本")

from backend.services import appeal_service
if len(versions) >= 2:
    result = appeal_service.compare_versions(db, versions[0].id, versions[1].id)
    print(f"\n版本对比结果:")
    print(f"  - 总样本数: {result.total_count}")
    print(f"  - 待复核: {result.pending_review_count}")
    print(f"  - 来自线上反馈工单: {result.from_ticket_count}")
    for item in result.items[:3]:
        print(f"  - {item.sample_no}: {item.status}, 来源: {item.from_source}")

print("\n" + "=" * 60)
print("🎉 所有验证通过！")
print("=" * 60)

db.close()
