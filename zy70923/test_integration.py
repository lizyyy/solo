#!/usr/bin/env python3
"""集成测试脚本"""
import json
import sys
from app import create_app

app = create_app()
client = app.test_client()


def check(name, resp, expected_status=200, condition=None):
    data = resp.get_json() or {}
    ok = resp.status_code == expected_status
    if condition:
        ok = ok and condition(data)
    tag = "PASS" if ok else "FAIL"
    print(f"[{tag}] {name} (HTTP {resp.status_code})")
    if not ok:
        print(f"     响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
    return ok


results = []

# 1. 健康检查
results.append(check("健康检查", client.get("/health")))

# 2. 正常样本
results.append(check("提交正常样本", client.post("/api/samples", json={
    "sample_batch": "BATCH-001",
    "cooperative": "阳光合作社",
    "product_name": "菠菜",
    "product_type": "叶菜",
    "origin": "山东",
    "sample_weight": "5kg",
    "send_date": "2026-05-20",
    "receiver": "李接样",
    "testing_items": ["敌敌畏", "乐果"],
    "remark": "新鲜",
    "operator": "李接样",
}), 201, condition=lambda d: d["classification"]["category"] == "normal"))

# 3. 待补充样本（缺 product_name）
results.append(check("提交待补充样本", client.post("/api/samples", json={
    "sample_batch": "BATCH-002",
    "cooperative": "丰收合作社",
    "product_name": "",
    "testing_items": ["吡虫啉"],
    "receiver": "王接样",
}), 201, condition=lambda d: d["classification"]["category"] == "supplement"))

# 4. 已拦截样本（高风险）
results.append(check("提交已拦截样本", client.post("/api/samples", json={
    "sample_batch": "BATCH-003",
    "cooperative": "绿野合作社",
    "product_name": "白菜",
    "testing_items": ["甲胺磷", "克百威"],
    "receiver": "赵接样",
    "operator": "赵接样",
}), 201, condition=lambda d: d["classification"]["category"] == "blocked"))

# 5. 全局统计
results.append(check("全局统计", client.get("/api/stats"),
                     condition=lambda d: d["total_samples"] == 3))

# 6. 列表查询
results.append(check("列表查询", client.get("/api/samples"),
                     condition=lambda d: len(d["samples"]) == 3))

# 7. 新增复检记录
results.append(check("新增复检记录", client.post("/api/samples/1/rechecks", json={
    "item": "敌敌畏",
    "original_result": "0.05 mg/kg",
    "recheck_result": "0.02 mg/kg",
    "final_result": "0.02 mg/kg",
    "operator": "张检测",
}), 201))

# 8. 人工确认任务
results.append(check("人工确认任务", client.post("/api/tasks/1/confirm", json={
    "new_status": "processing",
    "operator": "主管-陈",
    "detail": "材料审核通过",
}), condition=lambda d: d["task"]["last_handler"] == "主管-陈"))

# 9. 导出预览
results.append(check("导出预览", client.get("/api/export/preview"),
                     condition=lambda d: len(d["rows"]) == 3))

# 10. 导出CSV
r = client.get("/api/export")
csv_text = r.data.decode("utf-8-sig")
results.append(check("导出CSV", r,
                     condition=lambda d: "送样批次" in csv_text and "BATCH-001" in csv_text))

# 11. 导出后状态核对
results.append(check("导出后统计一致", client.get("/api/stats"),
                     condition=lambda d: d["by_task_status"].get("exported") == 3))

# 12. 单条详情
results.append(check("单条详情", client.get("/api/samples/1"),
                     condition=lambda d: d.get("sample") is not None and d.get("rechecks")))

print()
if all(results):
    print("全部测试通过 ✅")
    sys.exit(0)
else:
    print("存在失败测试 ❌")
    sys.exit(1)
