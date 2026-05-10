#!/usr/bin/env python3
"""
农产品溯源码发放服务 - 功能测试脚本
普通用户可以通过运行此脚本来验证系统功能
"""

import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000"


def request(method, path, data=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    if data:
        req.data = json.dumps(data, ensure_ascii=False).encode('utf-8')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))


def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)


def main():
    print("农产品溯源码发放服务 - 功能验证")
    print(f"服务地址: {BASE_URL}")
    
    print_section("1. 服务健康检查")
    status, resp = request("GET", "/health")
    print(f"状态码: {status}")
    print(f"响应: {json.dumps(resp, ensure_ascii=False, indent=2)}")
    assert status == 200, "服务健康检查失败"
    print("✓ 服务运行正常")

    print_section("2. 生成溯源码 (码池管理)")
    status, codes = request("POST", "/api/codes/generate", {"count": 3, "cooperative_id": "coop_demo"})
    print(f"状态码: {status}")
    print(f"生成了 {len(codes)} 个溯源码")
    for c in codes:
        print(f"  - {c['code']} (状态: {c['status']})")
    assert status == 200 and len(codes) == 3, "生成溯源码失败"
    code_list = [c['code'] for c in codes]
    print("✓ 溯源码生成成功，状态为 available")

    print_section("3. 发放溯源码给农户")
    status, resp = request("POST", "/api/codes/issue", {
        "codes": code_list,
        "farmer_id": "farmer_zhangsan",
        "cooperative_id": "coop_demo"
    })
    print(f"状态码: {status}")
    print(f"发放成功: {resp['issued_count']} 个")
    print(f"失败: {resp['invalid_count']} 个")
    assert status == 200 and resp['issued_count'] == 3, "发放溯源码失败"
    print("✓ 溯源码发放成功，状态变为 issued")

    print_section("4. 创建采摘批次")
    status, batch = request("POST", "/api/batches", {
        "batch_number": "BATCH-2026-05-10-001",
        "cooperative_id": "coop_demo",
        "farmer_id": "farmer_zhangsan",
        "product_name": "有机苹果",
        "harvest_date": "2026-05-10T08:00:00",
        "quantity": 500,
        "unit": "kg"
    })
    print(f"状态码: {status}")
    print(f"批次号: {batch['batch_number']}")
    print(f"产品: {batch['product_name']}")
    print(f"数量: {batch['quantity']} {batch['unit']}")
    batch_id = batch['id']
    assert status == 200, "创建批次失败"
    print("✓ 批次创建成功")

    print_section("5. 绑定溯源码到批次")
    status, resp = request("POST", "/api/batches/bind", {
        "codes": code_list,
        "batch_id": batch_id
    })
    print(f"状态码: {status}")
    print(f"绑定成功: {resp['bound_count']} 个")
    print(f"失败: {resp['invalid_count']} 个")
    assert status == 200 and resp['bound_count'] == 3, "绑定批次失败"
    print("✓ 溯源码与批次绑定成功")

    print_section("6. 创建检测报告并关联批次")
    status, report = request("POST", f"/api/batches/{batch_id}/reports", {
        "report_number": "REPORT-2026-001",
        "inspector": "李检测员",
        "inspection_date": "2026-05-10T10:00:00",
        "result": "合格",
        "details": "农药残留检测合格，符合国家标准"
    })
    print(f"状态码: {status}")
    print(f"报告编号: {report['report_number']}")
    print(f"检测员: {report['inspector']}")
    print(f"检测结果: {report['result']}")
    assert status == 200, "创建检测报告失败"
    print("✓ 检测报告创建成功并关联批次")

    print_section("7. 扫码查询 (消费者视角)")
    test_code = code_list[0]
    status, result = request("GET", f"/api/scan/{test_code}")
    print(f"状态码: {status}")
    print(f"溯源码: {result['code']}")
    print(f"码状态: {result['code_status']}")
    if result['batch']:
        print(f"关联批次: {result['batch']['batch_number']}")
        print(f"产品: {result['batch']['product_name']}")
    if result['reports']:
        print(f"检测报告数: {len(result['reports'])}")
        for r in result['reports']:
            print(f"  - {r['report_number']}: {r['result']}")
    assert status == 200, "扫码查询失败"
    print("✓ 扫码查询成功，可以看到完整溯源信息")

    print_section("8. 解绑溯源码 (支持批次和报告解绑)")
    unbind_codes = [code_list[0]]
    status, resp = request("POST", "/api/batches/unbind", {"codes": unbind_codes})
    print(f"状态码: {status}")
    print(f"解绑成功: {resp['unbound_count']} 个")
    print(f"失败: {resp['invalid_count']} 个")
    assert status == 200 and resp['unbound_count'] == 1, "解绑失败"
    print("✓ 溯源码解绑成功，可以重新绑定其他批次")

    print_section("9. 验证解绑后的扫码结果")
    status, result = request("GET", f"/api/scan/{unbind_codes[0]}")
    print(f"码状态: {result['code_status']}")
    print(f"关联批次: {result['batch']}")
    assert result['batch'] is None, "解绑后批次信息应为空"
    print("✓ 解绑后码已不再关联批次")

    print_section("10. 防伪报表统计")
    status, report = request("GET", "/api/reports/anticounterfeiting")
    print(f"状态码: {status}")
    print(f"总码数: {report['total_codes']}")
    print(f"可用码: {report['available_codes']}")
    print(f"已发放: {report['issued_codes']}")
    print(f"已绑定: {report['bound_codes']}")
    print(f"已回收: {report['recycled_codes']}")
    print(f"总批次: {report['total_batches']}")
    print(f"总报告: {report['total_reports']}")
    print(f"扫码次数: {report['total_scans']}")
    print(f"待处理任务: {report['pending_tasks']}")
    print(f"未解决异常: {report['unresolved_exceptions']}")
    assert status == 200, "获取防伪报表失败"
    print("✓ 防伪报表统计正常")

    print_section("11. 测试边界数据 - 发放不存在的码 (应该进入异常记录)")
    invalid_codes = ["TS-INVALID-001", "TS-INVALID-002"]
    status, resp = request("POST", "/api/codes/issue", {
        "codes": invalid_codes,
        "farmer_id": "farmer_test",
        "cooperative_id": "coop_demo"
    })
    print(f"状态码: {status}")
    print(f"发放成功: {resp['issued_count']}")
    print(f"失败: {resp['invalid_count']}")
    print(f"失败的码: {resp['invalid_codes']}")
    assert resp['invalid_count'] == 2, "无效码应被记录"
    print("✓ 无效码已被捕获")

    print_section("12. 查询异常记录 (验证边界数据未被静默吞掉)")
    status, resp = request("GET", "/api/exceptions?resolved=false")
    print(f"状态码: {status}")
    print(f"未解决异常数: {resp['total']}")
    if resp['records']:
        print("最近异常:")
        for r in resp['records'][:3]:
            print(f"  - [{r['exception_type']}] {r['operation']}: {r['error_message'][:60]}...")
    assert resp['total'] > 0, "应该有异常记录"
    print("✓ 异常记录可查询，边界数据没有被吞掉")

    print_section("13. 查询待处理列表")
    status, resp = request("GET", "/api/pending-tasks")
    print(f"状态码: {status}")
    print(f"待处理任务数: {resp['total']}")
    if resp['tasks']:
        print("待处理任务:")
        for t in resp['tasks'][:3]:
            print(f"  - [{t['task_type']}] {t['title']}")
    print("✓ 待处理列表可查询")

    print_section("14. 回收溯源码 (用已解绑的码)")
    recycle_codes_list = [code_list[0]]
    status, resp = request("POST", "/api/codes/recycle", {"codes": recycle_codes_list})
    print(f"状态码: {status}")
    print(f"回收成功: {resp['recycled_count']} 个")
    print(f"失败: {resp['invalid_count']} 个")
    assert status == 200 and resp['recycled_count'] == 1, "回收失败"
    print("✓ 溯源码回收成功")

    print_section("15. 查询所有码的状态")
    status, resp = request("GET", "/api/codes?limit=10")
    print(f"状态码: {status}")
    print(f"总码数: {resp['total']}")
    for c in resp['codes']:
        print(f"  {c['code']}: {c['status']}")
    print("✓ 可以查询所有码的状态")

    print("\n" + "="*60)
    print("  所有功能验证通过！")
    print("="*60)
    print("\n普通用户验证方式:")
    print("1. 生成码 -> 列表查看状态为 available")
    print("2. 发放码 -> 状态变为 issued, 有 farmer_id")
    print("3. 创批次 -> 列表能查到新批次")
    print("4. 绑定码 -> 码状态变为 bound")
    print("5. 扫  码 -> 能查到批次和检测报告")
    print("6. 解  绑 -> 码变回 issued, 扫码查不到批次")
    print("7. 无效操作 -> 查异常列表和待处理列表能看到记录")


if __name__ == "__main__":
    main()
