import json
import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

print("=" * 70)
print("测试完整诊断流程 API")
print("=" * 70)

print("\n1. 创建诊断记录...")
resp = requests.post(
    f"{BASE_URL}/api/diagnosis",
    json={"queue_name": "order_service_queue"}
)
diagnosis = resp.json()
diagnosis_id = diagnosis["id"]
print(f"   ✓ 诊断ID: {diagnosis_id}")
print(f"   ✓ 状态: {diagnosis['status']}")

print("\n2. 添加60分钟的指标数据...")
base_time = datetime.utcnow() - timedelta(hours=1)
metrics = []
for i in range(60):
    timestamp = base_time + timedelta(minutes=i)
    prod_rate = 100 if i < 30 else 400
    cons_rate = 150
    backlog = 1000 + int(max(0, (prod_rate - cons_rate) * 60 * (i - 29) if i >= 30 else 0))

    metrics.append({
        "queue_name": "order_service_queue",
        "timestamp": timestamp.isoformat(),
        "backlog_count": backlog,
        "backlog_growth_rate": prod_rate - cons_rate,
        "production_rate": prod_rate,
        "production_rate_avg_1h": 120,
        "production_rate_avg_24h": 100,
        "consumption_rate": cons_rate,
        "consumption_rate_avg_1h": 145,
        "consumption_rate_avg_24h": 150,
        "dead_letter_count": 50,
        "dead_letter_increment": 0,
        "consumer_count": 5,
        "active_consumer_count": 5
    })

resp = requests.post(
    f"{BASE_URL}/api/diagnosis/{diagnosis_id}/metrics",
    json=metrics
)
added = resp.json()
print(f"   ✓ 已添加 {len(added)} 条指标")

print("\n3. 执行诊断处理...")
resp = requests.post(
    f"{BASE_URL}/api/diagnosis/{diagnosis_id}/process"
)
result = resp.json()
print(f"   ✓ 状态: {result['status']}")
print(f"   ✓ 告警级别: {result['alert_level']}")
print(f"   ✓ 主要原因: {result['primary_cause']}")
print(f"   ✓ 综合评分: {result['overall_score']}")
print(f"   ✓ 检测到边缘情况: {len(result['edge_cases'])} 项")

print("\n4. 获取带可解释性的诊断结果...")
resp = requests.get(
    f"{BASE_URL}/api/diagnosis/{diagnosis_id}/explain"
)
explained = resp.json()
print(f"   ✓ 评分项数量: {len(explained['score_breakdown'])}")
print(f"   ✓ 处理建议数量: {len(explained['processing_suggestions'])}")
print(f"   ✓ 归因贡献度:")
attr = explained['backlog_attribution']
print(f"      - 生产暴涨: {attr['production_contribution']*100:.1f}%")
print(f"      - 消费变慢: {attr['consumption_contribution']*100:.1f}%")
print(f"      - 死信堆积: {attr['dead_letter_contribution']*100:.1f}%")
print(f"      - 消费者掉线: {attr['consumer_offline_contribution']*100:.1f}%")

print("\n5. 查询 'production_surge_score' 的详细解释...")
resp = requests.get(
    f"{BASE_URL}/api/diagnosis/{diagnosis_id}/explain/production_surge_score"
)
metric_explain = resp.json()
print(f"   ✓ 指标名: {metric_explain['metric_name']}")
print(f"   ✓ 分值: {metric_explain['value']:.2f}")
print(f"   ✓ 阈值: {metric_explain['threshold']}")
print(f"   ✓ 计算公式: {metric_explain['formula_used']}")
print(f"   ✓ 解释: {metric_explain['explanation'][:100]}...")

print("\n6. 添加人工复核意见...")
resp = requests.put(
    f"{BASE_URL}/api/diagnosis/{diagnosis_id}/review",
    json={
        "status": "review",
        "manual_review_notes": "已核实为促销活动导致的生产暴涨，正在扩容消费者。建议后续配置弹性伸缩自动处理此类场景。",
        "manual_reviewer": "值班工程师-张三",
        "manual_correction_applied": True
    }
)
review_result = resp.json()
print(f"   ✓ 复核人: {review_result['manual_reviewer']}")
print(f"   ✓ 已应用人工修正: {review_result['manual_correction_applied']}")

print("\n7. 导出Excel诊断报告...")
resp = requests.post(
    f"{BASE_URL}/api/diagnosis/{diagnosis_id}/export",
    json={
        "diagnosis_id": diagnosis_id,
        "format": "excel",
        "include_raw_data": True
    }
)
export_result = resp.json()
print(f"   ✓ 导出格式: {export_result['format']}")
print(f"   ✓ 文件路径: {export_result['file_path']}")
print(f"   ✓ 下载链接: {export_result['download_url']}")

print("\n8. 获取诊断列表...")
resp = requests.get(f"{BASE_URL}/api/diagnosis")
diagnoses = resp.json()
print(f"   ✓ 系统中共有 {len(diagnoses)} 条诊断记录")
for d in diagnoses[:3]:
    alert = d.get('alert_level') or 'N/A'
    cause = d.get('primary_cause') or 'N/A'
    print(f"      - #{d['id']} {d['queue_name']}: {d['status']} ({alert}) - {cause}")

print("\n" + "=" * 70)
print("✓ 所有 API 测试通过！")
print("=" * 70)
