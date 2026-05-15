import sys
sys.path.append(".")

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root():
    print("1. 测试根路由...")
    response = client.get("/")
    assert response.status_code == 200
    print(f"   ✓ 根路由访问成功: {response.json()['message']}")


def test_health():
    print("\n2. 测试健康检查...")
    response = client.get("/health")
    assert response.status_code == 200
    print(f"   ✓ 健康检查通过")


def test_get_rules():
    print("\n3. 测试规则列表接口（修复 NameError）...")
    response = client.get("/api/v1/rules/")
    assert response.status_code == 200
    rules = response.json()
    print(f"   ✓ 成功获取 {len(rules)} 条规则")
    for rule in rules:
        print(f"     - {rule['rule_code']}: {rule['rule_name']}")


def test_output_json():
    print("\n4. 测试 JSON 输出接口...")
    response = client.get("/api/v1/output/BATCH-2024-001/json")
    assert response.status_code == 200
    data = response.json()

    print(f"   ✓ 批次状态: {data['batch_status']}")
    print(f"   ✓ 总任务数: {data['total_tasks']}")
    print(f"   ✓ 成功数: {data['success_count']}")
    print(f"   ✓ 失败数: {data['failed_count']}")

    assert data["batch_status"] == "partial_success"
    assert data["total_tasks"] == 4
    assert data["success_count"] == 2
    assert data["failed_count"] == 2

    print("\n5. 验证 attribution 字段...")
    early_terminated_tasks = [t for t in data["tasks"] if t["is_early_terminated"]]
    print(f"   提前终止任务数: {len(early_terminated_tasks)}")

    for task in early_terminated_tasks:
        assert "attribution" in task, f"任务 {task['task_id']} 缺少 attribution 字段"
        attr = task["attribution"]
        print(f"   ✓ {task['task_id']}:")
        print(f"     - 拦截规则: {attr['blocked_by_rule']} ({attr['blocked_by_rule_code']})")
        print(f"     - 拦截原因: {attr['block_reason']}")
        print(f"     - 置信度: {attr['confidence_score']:.2%}")


def test_attribution_history():
    print("\n6. 测试历史查询接口（带操作者过滤）...")
    response = client.get("/api/v1/attribution/history?operator=张三")
    assert response.status_code == 200
    results = response.json()
    print(f"   ✓ 按操作者 '张三' 过滤: 找到 {len(results)} 条记录")

    for result in results:
        print(f"   - {result['task_id']}: {result['blocked_by_rule']} ({result['blocked_by_rule_code']})")


def test_markdown_output():
    print("\n7. 测试 Markdown 输出接口...")
    response = client.get("/api/v1/output/BATCH-2024-001/markdown")
    assert response.status_code == 200
    assert "任务失败归因报告" in response.text
    print(f"   ✓ Markdown 报告生成成功 (长度: {len(response.text)} 字符)")


def run_all_tests():
    print("=" * 60)
    print("开始验证修复后的功能")
    print("=" * 60)

    try:
        test_root()
        test_health()
        test_get_rules()
        test_output_json()
        test_attribution_history()
        test_markdown_output()

        print("\n" + "=" * 60)
        print("所有测试通过！")
        print("=" * 60)
        print("\n修复内容总结:")
        print("1. ✓ 修复了 api/routes.py 缺少 AttributionRule 导入导致的 NameError")
        print("2. ✓ 历史查询接口新增了操作者过滤支持")
        print("3. ✓ 修复了样例数据初始化的 DetachedInstanceError")
        print("4. ✓ 数据初始化时自动完成批次并执行归因分析")
        print("5. ✓ 提前终止任务的 attribution 字段正确显示拦截规则信息")

    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()
