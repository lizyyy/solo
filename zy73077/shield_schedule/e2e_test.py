import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from engine import run_schedule, run_diff
from storage import load_records, update_record, resolve_anomaly, load_sample_input
from models import _now

def section(title):
    print(f"\n{'='*60}\n  {title}\n{'='*60}")

# ==== 第1次排程：默认参数，运营主管白班版 ====
section("第1次排程：默认参数（运营主管-白班 v1）")
samples = load_sample_input()
params1 = {"photo_window_days": 7, "min_quantity": 1, "priority": "default", "urgent_categories": ["滚刀","主轴承密封"]}
v1 = run_schedule(samples, params1, "运营白班-v1 默认参数", "运营主管-白班", "周一早会前基线版", source_tag="运营主管Excel导入")
print(f"✅ 版本ID: {v1.version_id}")
print(f"   记录数={v1.record_count}  异常数={v1.anomaly_count}")
rs1 = load_records(v1.version_id)
for r in rs1:
    print(f"   [{r.part_id}] {r.part_name:12s} | 状态={r.status:10s} | 异常={len(r.anomalies)}项 | 字段映射={len(r.field_mapping_log)}次")

# ==== 第2次排程：改参数（调小照片窗口+关键件优先），夜班版 ====
section("第2次排程：换参数（照片窗口=3天 + 关键件优先） 运营夜班 v2")
params2 = {"photo_window_days": 3, "min_quantity": 2, "priority": "urgent", "urgent_categories": ["滚刀","主轴承密封","主驱动"]}
v2 = run_schedule(samples, params2, "运营夜班-v2 收紧参数", "运营主管-夜班", "上一班调整参数后重跑：窗口收紧+阈值提高", source_tag="运营主管Excel导入")
print(f"✅ 版本ID: {v2.version_id}")
print(f"   记录数={v2.record_count}  异常数={v2.anomaly_count}")

# ==== 版本对比：看清哪一步让结果变化 ====
section("版本对比：v1 → v2（运营主管一眼看出变化根源）")
d = run_diff(v1.version_id, v2.version_id)
print(f"📊 对比摘要: {json.dumps(d.summary, ensure_ascii=False)}")
print(f"\n🔧 参数变化（驱动因素）：")
for p in d.param_changes:
    print(f"   ✗ {p['key']}: {json.dumps(p['old'])} → {json.dumps(p['new'])}")
print(f"\n📦 记录变化：")
for rc in d.record_changes:
    print(f"   [{rc['change_type']}] {rc['part_id']} {rc['part_name']} 状态 {rc['old_status']}→{rc['new_status']}")
    for fd in rc.get("field_deltas", []):
        print(f"      · {fd['field']}: {json.dumps(fd['old'])} → {json.dumps(fd['new'])}")

# ==== 人工修改 + 审计链 ====
section("人工修改：现场调度小宋改口径 → 强制记录旧值/新值/原因")
rs2 = load_records(v2.version_id)
r0 = rs2[0]
print(f"操作对象: [{r0.part_id}] {r0.part_name} 当前状态={r0.status}")
r = update_record(
    v2.version_id, r0.record_id,
    {"status": "优先排产", "scheduled_date": "2026-06-11", "quantity": 4},
    "现场调度-小宋",
    "实测磨损4mm需提前换；与白班主管电话确认加订1件；今早调度会指令优先排产"
)
print(f"✅ 已修改，审计链长度={len(r.audit_log)}")
for a in r.audit_log:
    print(f"   📌 [{a['timestamp']}] {a['operator']} 改 {a['field']}")
    print(f"      旧值={json.dumps(a['old_value'], ensure_ascii=False)}")
    print(f"      新值={json.dumps(a['new_value'], ensure_ascii=False)}")
    print(f"      原因={a['reason']}")

# ==== 处理异常 ====
section("异常处理+解决标记（保留处理轨迹）")
for r in rs2[:2]:
    for a in r.anomalies[:1]:
        ra = resolve_anomaly(v2.version_id, r.record_id, a.anomaly_id,
                             f"已与维修组核对，{a.anomaly_type}情况属实，已纳入当日工单",
                             "现场调度-小宋")
        print(f"✅ 已处理异常 {r.part_id}/{a.anomaly_type}: {ra.resolved_note}")

# ==== 钻取异常原因：展示"为什么没按正常记录走" ====
section("异常原因透明化（照片时间错位为何标记）")
rs2 = load_records(v2.version_id)
for r in rs2:
    for a in r.anomalies:
        if "时间错位" in a.anomaly_type:
            print(f"   [{r.part_id}] {r.part_name}")
            print(f"      照片时间={r.photo_time}  排程日期={r.scheduled_date}")
            print(f"      判定: {a.description}")
            print(f"      （保住来源：原始字段={r.source_fields}）")

section("✅ 端到端测试全部通过")
print(f"   版本1: {v1.version_id}  版本2: {v2.version_id}")
print(f"   数据目录: {os.path.join(os.path.dirname(__file__), 'data')}")
print(f"   接下来执行: cd shield_schedule && bash run.sh  启动可视化前端")
