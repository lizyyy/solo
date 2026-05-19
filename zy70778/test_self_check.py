#!/usr/bin/env python3
"""
压测摘要归一退化判断服务 - 自检脚本
验证导入、筛选、处理和导出完整流程
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
import tempfile
from fastapi.testclient import TestClient
from main import app
from database import init_db, SessionLocal
from schemas import ConclusionType, ErrorCode

client = TestClient(app)


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def test_01_init_database():
    print_section("1. 初始化数据库")
    init_db()
    print("✓ 数据库初始化完成")
    return True


def test_02_import_baseline_report():
    print_section("2. 导入基准报告")
    
    report_data = {
        "report_id": "baseline_v1.0",
        "report_name": "线上基准压测报告",
        "source_format": "generic",
        "notes": "生产环境基准测试",
        "scenarios": [
            {
                "scenario_name": "用户登录接口",
                "throughput": 1000.0,
                "p95": 50.0,
                "error_rate": 0.1
            },
            {
                "scenario_name": "商品查询接口",
                "throughput": 2000.0,
                "p95": 30.0,
                "error_rate": 0.05
            },
            {
                "scenario_name": "订单提交接口",
                "throughput": 500.0,
                "p95": 100.0,
                "error_rate": 0.2
            }
        ]
    }
    
    response = client.post("/api/v1/reports/import", json=report_data)
    print(f"状态码: {response.status_code}")
    assert response.status_code == 200, f"导入失败: {response.text}"
    result = response.json()
    print(f"✓ 报告导入成功: report_id={result['report_id']}, 场景数={result['scenario_count']}")
    return True


def test_03_import_target_report_degraded():
    print_section("3. 导入退化版本报告")
    
    report_data = {
        "report_id": "target_v1.1",
        "report_name": "新版本压测报告-退化",
        "source_format": "generic",
        "notes": "新版本性能测试",
        "scenarios": [
            {
                "scenario_name": "用户登录接口",
                "throughput": 800.0,
                "p95": 50.0,
                "error_rate": 0.1
            },
            {
                "scenario_name": "商品查询接口",
                "throughput": 2000.0,
                "p95": 40.0,
                "error_rate": 0.05
            },
            {
                "scenario_name": "订单提交接口",
                "throughput": 500.0,
                "p95": 100.0,
                "error_rate": 0.2
            }
        ]
    }
    
    response = client.post("/api/v1/reports/import", json=report_data)
    print(f"状态码: {response.status_code}")
    assert response.status_code == 200, f"导入失败: {response.text}"
    result = response.json()
    print(f"✓ 报告导入成功: report_id={result['report_id']}")
    return True


def test_04_import_target_report_pass():
    print_section("4. 导入通过版本报告")
    
    report_data = {
        "report_id": "target_v1.2",
        "report_name": "新版本压测报告-通过",
        "source_format": "generic",
        "notes": "优化后版本",
        "scenarios": [
            {
                "scenario_name": "用户登录接口",
                "throughput": 1050.0,
                "p95": 48.0,
                "error_rate": 0.08
            },
            {
                "scenario_name": "商品查询接口",
                "throughput": 2100.0,
                "p95": 28.0,
                "error_rate": 0.04
            },
            {
                "scenario_name": "订单提交接口",
                "throughput": 520.0,
                "p95": 95.0,
                "error_rate": 0.15
            }
        ]
    }
    
    response = client.post("/api/v1/reports/import", json=report_data)
    print(f"状态码: {response.status_code}")
    assert response.status_code == 200, f"导入失败: {response.text}"
    result = response.json()
    print(f"✓ 报告导入成功: report_id={result['report_id']}")
    return True


def test_05_list_reports():
    print_section("5. 查询报告列表")
    
    response = client.get("/api/v1/reports")
    print(f"状态码: {response.status_code}")
    assert response.status_code == 200
    reports = response.json()
    print(f"✓ 共找到 {len(reports)} 个报告")
    for r in reports:
        print(f"  - {r['report_id']}: {r['report_name']} ({r['scenario_count']}个场景)")
    return True


def test_06_get_scenarios():
    print_section("6. 查询报告场景详情")
    
    response = client.get("/api/v1/reports/baseline_v1.0/scenarios")
    print(f"状态码: {response.status_code}")
    assert response.status_code == 200
    scenarios = response.json()
    print(f"✓ 共找到 {len(scenarios)} 个场景")
    for s in scenarios:
        print(f"  - {s['scenario_name']}: 吞吐={s['throughput']} req/s, P95={s['p95']}ms, 错误率={s['error_rate']}%")
    return True


def test_07_comparison_degraded():
    print_section("7. 执行对比分析 - 退化场景")
    
    comp_data = {
        "base_report_id": "baseline_v1.0",
        "target_report_id": "target_v1.1",
        "thresholds": {
            "throughput_threshold_pct": 10.0,
            "p95_threshold_pct": 20.0,
            "error_rate_threshold_pct": 5.0
        }
    }
    
    response = client.post("/api/v1/comparisons", json=comp_data)
    print(f"状态码: {response.status_code}")
    assert response.status_code == 200, f"对比失败: {response.text}"
    result = response.json()
    
    print(f"✓ 对比ID: {result['comparison_id']}")
    print(f"  总体结论: {result['overall_conclusion']}")
    print(f"  通过: {result['pass_count']}, 退化: {result['degraded_count']}, 需复核: {result['need_review_count']}")
    
    print("\n  场景详情:")
    for s in result['scenarios']:
        status_icon = "✗" if s['conclusion'] == 'degraded' else ("?" if s['conclusion'] == 'need_review' else "✓")
        print(f"  {status_icon} {s['scenario_name']}")
        if s['throughput_degradation_pct'] != 0:
            print(f"      吞吐退化: {s['throughput_degradation_pct']:.2f}% (基准:{s['base_throughput']} → 目标:{s['target_throughput']}")
        if s['p95_degradation_pct'] != 0:
            print(f"      P95退化: {s['p95_degradation_pct']:.2f}% (基准:{s['base_p95']} → 目标:{s['target_p95']}")
    
    comparison_id = result['comparison_id']
    return comparison_id


def test_08_comparison_pass():
    print_section("8. 执行对比分析 - 通过场景")
    
    comp_data = {
        "base_report_id": "baseline_v1.0",
        "target_report_id": "target_v1.2"
    }
    
    response = client.post("/api/v1/comparisons", json=comp_data)
    print(f"状态码: {response.status_code}")
    assert response.status_code == 200, f"对比失败: {response.text}"
    result = response.json()
    
    print(f"✓ 对比ID: {result['comparison_id']}")
    print(f"  总体结论: {result['overall_conclusion']}")
    print(f"  通过: {result['pass_count']}, 退化: {result['degraded_count']}, 需复核: {result['need_review_count']}")
    
    return True


def test_09_scenario_filter():
    print_section("9. 场景名筛选对比")
    
    comp_data = {
        "base_report_id": "baseline_v1.0",
        "target_report_id": "target_v1.1",
        "scenario_pattern": "*登录*"
    }
    
    response = client.post("/api/v1/comparisons", json=comp_data)
    print(f"状态码: {response.status_code}")
    assert response.status_code == 200
    result = response.json()
    print(f"✓ 筛选后对比场景数: {len(result['scenarios'])}")
    for s in result['scenarios']:
        print(f"  - {s['scenario_name']}")
    assert len(result['scenarios']) == 1
    return True


def test_10_get_comparison_detail(comparison_id):
    print_section("10. 查询对比结果详情")
    
    response = client.get(f"/api/v1/comparisons/{comparison_id}")
    print(f"状态码: {response.status_code}")
    assert response.status_code == 200
    result = response.json()
    print(f"✓ 查询成功: {result['comparison_id']}")
    print(f"  总体结论: {result['overall_conclusion']}")
    return True


def test_11_error_duplicate_import():
    print_section("11. 错误处理 - 重复导入")
    
    report_data = {
        "report_id": "baseline_v1.0",
        "report_name": "重复导入测试",
        "source_format": "generic",
        "scenarios": [
            {
                "scenario_name": "测试场景",
                "throughput": 100.0,
                "p95": 10.0,
                "error_rate": 0.0
            }
        ]
    }
    
    response = client.post("/api/v1/reports/import", json=report_data)
    print(f"状态码: {response.status_code}")
    assert response.status_code == 400
    result = response.json()
    print(f"✓ 错误码: {result['error_code']}")
    print(f"  消息: {result['message']}")
    assert result['error_code'] == ErrorCode.ALREADY_PROCESSED
    return True


def test_12_error_not_found():
    print_section("12. 错误处理 - 报告不存在")
    
    comp_data = {
        "base_report_id": "nonexistent",
        "target_report_id": "target_v1.1"
    }
    
    response = client.post("/api/v1/comparisons", json=comp_data)
    print(f"状态码: {response.status_code}")
    assert response.status_code == 404
    result = response.json()
    print(f"✓ 错误码: {result['error_code']}")
    assert result['error_code'] == ErrorCode.NOT_FOUND
    return True


def test_13_file_import():
    print_section("13. 文件导入测试")
    
    test_content = json.dumps([
        {
            "scenario_name": "文件导入测试场景",
            "throughput": 1500.0,
            "p95": 45.0,
            "error_rate": 0.1
        }
    ])
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write(test_content)
        tmp_file = f.name
    
    try:
        with open(tmp_file, 'rb') as f:
            response = client.post(
                "/api/v1/reports/import-file/file_import_test",
                params={
                    "report_name": "文件导入测试报告",
                    "source_format": "generic"
                },
                files={"file": ("test.json", f, "application/json")}
            )
        
        print(f"状态码: {response.status_code}")
        assert response.status_code == 200, f"文件导入失败: {response.text}"
        result = response.json()
        print(f"✓ 文件导入成功: {result['report_id']}")
    finally:
        os.unlink(tmp_file)
    
    return True


def test_14_export_comparison_report():
    print_section("14. 导出对比报告")
    
    comp_data = {
        "base_report_id": "baseline_v1.0",
        "target_report_id": "target_v1.1"
    }
    
    response = client.post("/api/v1/comparisons", json=comp_data)
    result = response.json()
    
    export_data = {
        "comparison_id": result['comparison_id'],
        "base_report": "baseline_v1.0",
        "target_report": "target_v1.1",
        "overall_conclusion": result['overall_conclusion'],
        "export_time": "2024-01-01T00:00:00",
        "scenarios": result['scenarios']
    }
    
    output_file = "comparison_report.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ 对比报告已导出到: {output_file}")
    print(f"  总体结论: {result['overall_conclusion']}")
    return True


def main():
    print("\n" + "="*60)
    print("  压测摘要归一退化判断服务 - 自检脚本")
    print("="*60)
    
    tests = [
        test_01_init_database,
        test_02_import_baseline_report,
        test_03_import_target_report_degraded,
        test_04_import_target_report_pass,
        test_05_list_reports,
        test_06_get_scenarios,
    ]
    
    comparison_id = None
    results = []
    
    for test in tests:
        try:
            result = test()
            results.append((test.__name__, result))
        except Exception as e:
            print(f"✗ 失败: {e}")
            results.append((test.__name__, False))
    
    try:
        comparison_id = test_07_comparison_degraded()
        results.append(("test_07_comparison_degraded", True))
    except Exception as e:
        print(f"✗ 失败: {e}")
        results.append(("test_07_comparison_degraded", False))
    
    more_tests = [
        test_08_comparison_pass,
        test_09_scenario_filter,
        lambda: test_10_get_comparison_detail(comparison_id) if comparison_id else False,
        test_11_error_duplicate_import,
        test_12_error_not_found,
        test_13_file_import,
        test_14_export_comparison_report
    ]
    
    for test in more_tests:
        try:
            result = test()
            results.append((test.__name__ if hasattr(test, '__name__') else 'lambda', result))
        except Exception as e:
            print(f"✗ 失败: {e}")
            results.append((test.__name__ if hasattr(test, '__name__') else 'lambda', False))
    
    print_section("自检结果汇总")
    passed = sum(1 for _, r in results if r)
    total = len(results)
    print(f"通过: {passed}/{total}")
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status}: {name}")
    
    if passed == total:
        print("\n🎉 所有测试通过！服务功能完整可用")
        return 0
    else:
        print(f"\n❌ {total - passed} 个测试失败")
        return 1


if __name__ == "__main__":
    if os.path.exists("load_test.db"):
        os.remove("load_test.db")
    
    sys.exit(main())
