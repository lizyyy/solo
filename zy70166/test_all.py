import requests
import json
import time

BASE_URL = "http://localhost:8000"

def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def print_result(label, response):
    try:
        data = response.json()
        print(f"\n{label}:")
        print(f"  HTTP 状态码: {response.status_code}")
        print(f"  业务状态: {data.get('业务状态', 'N/A')}")
        if '消息' in data:
            print(f"  消息: {data['消息']}")
        if '建议' in data:
            print(f"  建议: {data['建议']}")
        return data
    except Exception as e:
        print(f"  响应解析失败: {e}")
        print(f"  原始响应: {response.text}")
        return {}

def test_smoke():
    print_header("1. 烟雾测试 - 确认系统正常运行")
    r = requests.get(f"{BASE_URL}/health")
    data = print_result("健康检查", r)
    assert r.status_code == 200, "系统应该正常响应"
    assert data.get('业务状态') == '运行正常', "业务状态应为运行正常"
    print("  ✓ 系统运行正常")

def test_package_management():
    print_header("2. 包版本管理 - 登记、查询、状态变更")
    
    print("\n【场景一】登记新包版本（正常路径）")
    r = requests.post(f"{BASE_URL}/api/packages/register", json={
        "package_name": "log-sdk",
        "version": "3.0.0",
        "description": "新版日志 SDK"
    })
    data = print_result("登记结果", r)
    assert r.status_code == 200, "登记应该成功"
    assert '登记成功' in data.get('业务状态', ''), "业务状态应包含登记成功"
    print("  ✓ 新包版本登记成功")
    
    print("\n【场景二】重复登记同一版本（冲突场景）")
    r = requests.post(f"{BASE_URL}/api/packages/register", json={
        "package_name": "log-sdk",
        "version": "3.0.0"
    })
    data = print_result("重复登记结果", r)
    assert r.status_code == 409, "重复登记应返回冲突"
    assert '冲突' in data.get('业务状态', ''), "应提示冲突"
    print("  ✓ 冲突检测正常，禁止重复登记")
    
    print("\n【场景三】查询所有包版本")
    r = requests.get(f"{BASE_URL}/api/packages/list")
    data = print_result("查询结果", r)
    assert r.status_code == 200
    assert data.get('包版本总数', 0) > 0, "应能查到示例数据"
    print(f"  ✓ 共查到 {data['包版本总数']} 个包版本")
    
    print("\n【场景四】更新包废弃状态")
    r = requests.post(f"{BASE_URL}/api/packages/status", json={
        "package_name": "log-sdk",
        "version": "3.0.0",
        "new_status": "即将废弃",
        "operator": "系统管理员"
    })
    data = print_result("状态更新结果", r)
    assert r.status_code == 200
    assert data.get('新状态') == '即将废弃', "状态应已更新"
    print("  ✓ 包版本状态更新成功")

def test_caller_scanning():
    print_header("3. 调用方扫描 - 登记、更新、查询")
    
    print("\n【场景一】登记调用方（正常路径）")
    r = requests.post(f"{BASE_URL}/api/callers/register", json={
        "service_name": "消息推送服务",
        "package_name": "user-auth-sdk",
        "version": "1.0.0",
        "contact_person": "赵六",
        "department": "消息事业部"
    })
    data = print_result("登记结果", r)
    assert r.status_code == 200
    print("  ✓ 调用方登记成功")
    
    print("\n【场景二】扫描所有调用方")
    r = requests.get(f"{BASE_URL}/api/callers/scan")
    data = print_result("扫描结果", r)
    assert r.status_code == 200
    assert '状态分布' in data, "应包含状态分布统计"
    print(f"  ✓ 共扫描到 {data['总调用方数量']} 个调用方")
    print(f"  ✓ 状态分布: {data['状态分布']}")
    
    print("\n【场景三】更新调用方迁移状态")
    r = requests.post(f"{BASE_URL}/api/callers/status", json={
        "service_name": "消息推送服务",
        "package_name": "user-auth-sdk",
        "version": "1.0.0",
        "new_status": "迁移中",
        "notes": "已开始评估迁移方案",
        "operator": "赵六"
    })
    data = print_result("状态更新结果", r)
    assert r.status_code == 200
    assert data.get('新状态') == '迁移中'
    print("  ✓ 迁移状态更新成功")

def test_deprecation_plan():
    print_header("4. 废弃计划 - 创建、查询、冲突检测")
    
    print("\n【场景一】创建废弃计划（正常路径）")
    r = requests.post(f"{BASE_URL}/api/plans/create", json={
        "package_name": "log-sdk",
        "version": "3.0.0",
        "phase": "告警期",
        "deadline_days": 15,
        "description": "开始推送告警日志"
    })
    data = print_result("计划创建结果", r)
    assert r.status_code == 200
    assert data.get('剩余天数') == 15
    print("  ✓ 废弃计划创建成功")
    
    print("\n【场景二】重复创建同一阶段计划（冲突场景）")
    r = requests.post(f"{BASE_URL}/api/plans/create", json={
        "package_name": "log-sdk",
        "version": "3.0.0",
        "phase": "告警期",
        "deadline_days": 30
    })
    data = print_result("重复创建结果", r)
    assert r.status_code == 409
    assert '计划冲突' in data.get('业务状态', '')
    print("  ✓ 计划冲突检测正常")
    
    print("\n【场景三】查询所有废弃计划")
    r = requests.get(f"{BASE_URL}/api/plans/list")
    data = print_result("查询结果", r)
    assert r.status_code == 200
    print(f"  ✓ 共查到 {data['计划总数']} 个废弃计划")

def test_exemption_workflow():
    print_header("5. 豁免申请 - 完整流程（申请、审批、冲突、撤销、重试）")
    
    print("\n【场景一】申请豁免（正常路径）")
    r = requests.post(f"{BASE_URL}/api/exemptions/apply", json={
        "service_name": "订单系统",
        "package_name": "user-auth-sdk",
        "version": "1.0.0",
        "reason": "年底大促期间不适合变更，需延后迁移",
        "requested_by": "李四",
        "extension_days": 30
    })
    data = print_result("申请结果", r)
    assert r.status_code == 200
    assert data.get('业务状态') == '申请已提交'
    exemption_id = data['申请编号']
    print(f"  ✓ 豁免申请提交成功，编号: {exemption_id}")
    
    print("\n【场景二】同一调用方重复申请（冲突场景）")
    r = requests.post(f"{BASE_URL}/api/exemptions/apply", json={
        "service_name": "订单系统",
        "package_name": "user-auth-sdk",
        "version": "1.0.0",
        "reason": "再申请一次",
        "requested_by": "李四"
    })
    data = print_result("重复申请结果", r)
    assert r.status_code == 409
    assert '申请冲突' in data.get('业务状态', '')
    print("  ✓ 重复申请被正确拦截")
    
    print("\n【场景三】审批通过豁免")
    r = requests.post(f"{BASE_URL}/api/exemptions/approve", json={
        "exemption_id": exemption_id,
        "approved_by": "架构师老王",
        "approve": True
    })
    data = print_result("审批结果", r)
    assert r.status_code == 200
    assert data.get('业务状态') == '审批通过'
    print("  ✓ 豁免审批通过")
    
    print("\n【场景四】已通过的豁免再次审批（冲突场景）")
    r = requests.post(f"{BASE_URL}/api/exemptions/approve", json={
        "exemption_id": exemption_id,
        "approved_by": "架构师老王",
        "approve": True
    })
    data = print_result("重复审批结果", r)
    assert r.status_code == 409
    assert '审批冲突' in data.get('业务状态', '')
    print("  ✓ 重复审批被正确拦截")
    
    print("\n【场景五】查询豁免列表验证状态")
    r = requests.get(f"{BASE_URL}/api/exemptions/list")
    data = print_result("查询结果", r)
    assert r.status_code == 200
    approved_count = sum(1 for e in data['列表'] if e['状态'] == '已通过')
    assert approved_count > 0, "应能查到已通过的豁免"
    print(f"  ✓ 查询到 {data['申请总数']} 条豁免申请")
    
    print("\n【场景六】撤销已通过的豁免")
    r = requests.post(f"{BASE_URL}/api/exemptions/revoke?exemption_id={exemption_id}&revoked_by=李四")
    data = print_result("撤销结果", r)
    assert r.status_code == 200
    assert data.get('业务状态') == '撤销成功'
    print("  ✓ 豁免撤销成功")
    
    print("\n【场景七】已撤销的豁免再次撤销（冲突场景）")
    r = requests.post(f"{BASE_URL}/api/exemptions/revoke?exemption_id={exemption_id}&revoked_by=李四")
    data = print_result("重复撤销结果", r)
    assert r.status_code == 409
    print("  ✓ 重复撤销被正确拦截")

def test_migration_confirmation():
    print_header("6. 迁移确认 - 确认、撤销、冲突检测")
    
    print("\n【场景一】确认迁移（正常路径）")
    r = requests.post(f"{BASE_URL}/api/migrations/confirm", json={
        "service_name": "用户中心",
        "package_name": "user-auth-sdk",
        "old_version": "1.0.0",
        "new_version": "2.0.0",
        "confirmed_by": "张三",
        "notes": "已完成测试并上线"
    })
    data = print_result("确认结果", r)
    assert r.status_code == 200
    assert data.get('业务状态') == '迁移已确认'
    print("  ✓ 迁移确认成功")
    
    print("\n【场景二】重复确认同一迁移（冲突场景）")
    r = requests.post(f"{BASE_URL}/api/migrations/confirm", json={
        "service_name": "用户中心",
        "package_name": "user-auth-sdk",
        "old_version": "1.0.0",
        "new_version": "2.0.0",
        "confirmed_by": "张三"
    })
    data = print_result("重复确认结果", r)
    assert r.status_code == 409
    assert '确认冲突' in data.get('业务状态', '')
    print("  ✓ 重复确认被正确拦截")
    
    print("\n【场景三】撤销迁移确认")
    r = requests.post(f"{BASE_URL}/api/migrations/revoke", json={
        "service_name": "用户中心",
        "package_name": "user-auth-sdk",
        "old_version": "1.0.0",
        "revoked_by": "张三",
        "reason": "发现兼容性问题，需要回滚"
    })
    data = print_result("撤销结果", r)
    assert r.status_code == 200
    assert data.get('业务状态') == '撤销成功'
    print("  ✓ 迁移确认撤销成功")
    
    print("\n【场景四】查询迁移记录")
    r = requests.get(f"{BASE_URL}/api/migrations/list")
    data = print_result("查询结果", r)
    assert r.status_code == 200
    print(f"  ✓ 共查到 {data['记录总数']} 条迁移记录")

def test_risk_export():
    print_header("7. 风险导出 - 完整风险分析报告")
    
    print("\n【场景】导出全量风险分析")
    r = requests.post(f"{BASE_URL}/api/risks/export", json={})
    data = print_result("导出结果", r)
    assert r.status_code == 200
    assert '整体判断' in data
    assert '风险统计' in data
    
    stats = data['风险统计']
    print(f"  ✓ 整体判断: {data['整体判断']}")
    print(f"  ✓ 高风险包: {stats['高风险包数量']} 个")
    print(f"  ✓ 中风险包: {stats['中风险包数量']} 个")
    print(f"  ✓ 低风险包: {stats['低风险包数量']} 个")
    
    if data['高风险包']:
        pkg = data['高风险包'][0]
        print(f"  ✓ 高风险包示例: {pkg['包名']} {pkg['版本']}")
        print(f"    - 风险等级: {pkg['风险等级']}")
        print(f"    - 风险说明: {pkg['风险说明']}")

def test_operation_logs():
    print_header("8. 操作日志 - 完整审计轨迹")
    
    r = requests.get(f"{BASE_URL}/api/logs?limit=20")
    data = print_result("日志查询结果", r)
    assert r.status_code == 200
    assert data.get('日志数量', 0) > 0, "应有操作日志"
    
    print(f"  ✓ 共查到 {data['日志数量']} 条操作记录")
    if data['日志列表']:
        recent = data['日志列表'][-1]
        print(f"  ✓ 最近操作: {recent['操作类型']} - {recent['操作人']}")

def test_edge_cases():
    print_header("9. 异常场景 - 边界情况处理")
    
    print("\n【场景一】查询不存在的包")
    r = requests.post(f"{BASE_URL}/api/packages/status", json={
        "package_name": "nonexistent-pkg",
        "version": "9.9.9",
        "new_status": "即将废弃",
        "operator": "测试员"
    })
    data = print_result("查询结果", r)
    assert r.status_code == 404
    assert '包不存在' in data.get('业务状态', '')
    print("  ✓ 不存在的包返回正确提示")
    
    print("\n【场景二】调用方状态与豁免冲突")
    r = requests.post(f"{BASE_URL}/api/exemptions/apply", json={
        "service_name": "商品详情",
        "package_name": "payment-gateway",
        "version": "0.9.0",
        "reason": "需要更多时间迁移",
        "requested_by": "王五",
        "extension_days": 15
    })
    data = print_result("申请结果", r)
    assert r.status_code == 200
    temp_id = data['申请编号']
    
    r = requests.post(f"{BASE_URL}/api/exemptions/approve", json={
        "exemption_id": temp_id,
        "approved_by": "架构师老王",
        "approve": True
    })
    
    r = requests.post(f"{BASE_URL}/api/callers/status", json={
        "service_name": "商品详情",
        "package_name": "payment-gateway",
        "version": "0.9.0",
        "new_status": "已完成",
        "operator": "王五"
    })
    data = print_result("状态更新结果", r)
    assert r.status_code == 409
    assert '状态冲突' in data.get('业务状态', '')
    print("  ✓ 有豁免时无法标记为已完成（冲突检测正常）")

def main():
    print("\n" + "="*60)
    print("  内部包版本废弃管理系统 - 功能验证测试")
    print("="*60)
    
    time.sleep(1)
    
    tests = [
        test_smoke,
        test_package_management,
        test_caller_scanning,
        test_deprecation_plan,
        test_exemption_workflow,
        test_migration_confirmation,
        test_risk_export,
        test_operation_logs,
        test_edge_cases,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            failed += 1
            print(f"\n  ✗ 测试失败: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*60)
    print(f"  测试汇总: {passed} 通过, {failed} 失败")
    print("="*60)
    
    if failed == 0:
        print("\n" + "🎉 所有测试通过！系统功能验证完成。")
        print("\n普通用户怎么确认功能可用？看看这些现象：")
        print("  1. 打开 http://localhost:8000/docs 能看到交互式 API 文档")
        print("  2. 访问 http://localhost:8000/health 返回「业务状态：运行正常」")
        print("  3. 在 API 文档中点击 /api/packages/list 的「Try it out」，能看到 3 个示例包")
        print("  4. 在 API 文档中点击 /api/callers/scan 的「Try it out」，能看到 4 个调用方")
        print("  5. 在 API 文档中点击 /api/risks/export 的「Try it out」，能看到风险分析报告")
        print("\n提示：所有接口返回都用中文业务语言，非开发人员也能看懂结果含义。")
    else:
        print("\n❌ 部分测试失败，请检查错误信息。")

if __name__ == "__main__":
    main()
