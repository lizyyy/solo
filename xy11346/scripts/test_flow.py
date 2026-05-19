#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8001"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"状态码: {response.status_code}")
    if response.status_code in [200, 201]:
        data = response.json()
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print(response.text)
    return response

def test_health_check():
    print("\n" + "="*60)
    print("1. 健康检查")
    print("="*60)
    response = requests.get(f"{BASE_URL}/api/health/")
    print_response("健康检查结果", response)
    return response.status_code == 200

def test_create_paper_batch():
    print("\n" + "="*60)
    print("2. 创建纸张批次")
    print("="*60)
    data = {
        "batch_number": "PAPER-TEST-001",
        "paper_type": "铜版纸157g",
        "supplier": "测试供应商",
        "notes": "测试批次"
    }
    response = requests.post(f"{BASE_URL}/api/paper-batches/", json=data)
    print_response("创建纸张批次结果", response)
    return response.status_code in [200, 201, 400]

def test_create_threshold():
    print("\n" + "="*60)
    print("3. 创建品控阈值")
    print("="*60)
    data = {
        "product_type": "包装彩盒",
        "color_name": "default",
        "l_min": 35.0,
        "l_max": 45.0,
        "a_min": 55.0,
        "a_max": 65.0,
        "b_min": 45.0,
        "b_max": 55.0,
        "delta_e_max": 2.0
    }
    response = requests.post(f"{BASE_URL}/api/quality-thresholds/", json=data)
    print_response("创建品控阈值结果", response)
    return response.status_code in [200, 201]

def test_create_quality_record_normal():
    print("\n" + "="*60)
    print("4. 创建合格品控记录（全部测点正常）")
    print("="*60)
    data = {
        "batch_number": "PRINT-TEST-001",
        "product_type": "包装彩盒",
        "paper_batch_id": 1,
        "inspector": "张三",
        "status": "已完成",
        "notes": "正常批次，无异常",
        "lab_measurements": [
            {"measurement_point": "左上", "l_value": 40.0, "a_value": 60.0, "b_value": 50.0},
            {"measurement_point": "右上", "l_value": 40.5, "a_value": 59.5, "b_value": 50.5},
            {"measurement_point": "左下", "l_value": 39.5, "a_value": 60.5, "b_value": 49.5},
            {"measurement_point": "右下", "l_value": 40.2, "a_value": 59.8, "b_value": 50.2},
            {"measurement_point": "中心", "l_value": 40.1, "a_value": 60.0, "b_value": 50.0}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/quality-records/", json=data)
    print_response("创建合格品控记录结果", response)
    return response.status_code in [200, 201]

def test_create_quality_record_conditional():
    print("\n" + "="*60)
    print("5. 创建有条件放行品控记录（少量测点异常）")
    print("="*60)
    data = {
        "batch_number": "PRINT-TEST-002",
        "product_type": "包装彩盒",
        "paper_batch_id": 1,
        "inspector": "李四",
        "status": "已完成",
        "notes": "左上测点略偏，经确认可放行",
        "lab_measurements": [
            {"measurement_point": "左上", "l_value": 48.0, "a_value": 60.0, "b_value": 50.0},
            {"measurement_point": "右上", "l_value": 40.5, "a_value": 59.5, "b_value": 50.5},
            {"measurement_point": "左下", "l_value": 39.5, "a_value": 60.5, "b_value": 49.5},
            {"measurement_point": "右下", "l_value": 40.2, "a_value": 59.8, "b_value": 50.2},
            {"measurement_point": "中心", "l_value": 40.1, "a_value": 60.0, "b_value": 50.0}
        ],
        "rework_records": [
            {
                "rework_type": "颜色调整",
                "rework_reason": "左上区域L值偏高",
                "operator": "王师傅",
                "result": "已调整",
                "notes": "微调墨量后符合要求"
            }
        ]
    }
    response = requests.post(f"{BASE_URL}/api/quality-records/", json=data)
    print_response("创建有条件放行品控记录结果", response)
    return response.status_code in [200, 201]

def test_create_quality_record_failed():
    print("\n" + "="*60)
    print("6. 创建不合格品控记录（多测点异常）")
    print("="*60)
    data = {
        "batch_number": "PRINT-TEST-003",
        "product_type": "包装彩盒",
        "paper_batch_id": 2,
        "inspector": "王五",
        "status": "待处理",
        "notes": "严重色差，需返工",
        "lab_measurements": [
            {"measurement_point": "左上", "l_value": 55.0, "a_value": 70.0, "b_value": 40.0},
            {"measurement_point": "右上", "l_value": 54.0, "a_value": 69.0, "b_value": 41.0},
            {"measurement_point": "左下", "l_value": 53.0, "a_value": 68.0, "b_value": 42.0},
            {"measurement_point": "右下", "l_value": 40.2, "a_value": 59.8, "b_value": 50.2},
            {"measurement_point": "中心", "l_value": 40.1, "a_value": 60.0, "b_value": 50.0}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/quality-records/", json=data)
    print_response("创建不合格品控记录结果", response)
    return response.status_code in [200, 201]

def test_query_records():
    print("\n" + "="*60)
    print("7. 查询品控记录（按检验员筛选）")
    print("="*60)
    params = {"inspector": "张三", "limit": 10}
    response = requests.get(f"{BASE_URL}/api/quality-records/", params=params)
    print_response("查询品控记录结果", response)
    return response.status_code == 200

def test_get_statistics():
    print("\n" + "="*60)
    print("8. 获取统计数据")
    print("="*60)
    response = requests.get(f"{BASE_URL}/api/statistics/")
    print_response("统计数据结果", response)
    return response.status_code == 200

def test_export_report():
    print("\n" + "="*60)
    print("9. 导出Excel报告")
    print("="*60)
    data = {}
    response = requests.post(f"{BASE_URL}/api/export/", json=data)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        filename = response.headers.get('content-disposition', '').split('filename=')[-1].strip('"')
        if not filename:
            filename = "quality_report.xlsx"
        with open(filename, 'wb') as f:
            f.write(response.content)
        print(f"报告已导出: {filename}")
        return True
    else:
        print(response.text)
        return False

def main():
    print("\n" + "#"*60)
    print("# 印刷车间品控管理系统 - 主流程测试")
    print("#"*60)
    
    tests = [
        test_health_check,
        test_create_paper_batch,
        test_create_threshold,
        test_create_quality_record_normal,
        test_create_quality_record_conditional,
        test_create_quality_record_failed,
        test_query_records,
        test_get_statistics,
        test_export_report
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append((test.__name__, result))
            time.sleep(0.5)
        except Exception as e:
            print(f"测试 {test.__name__} 异常: {e}")
            results.append((test.__name__, False))
    
    print("\n" + "="*60)
    print("测试汇总")
    print("="*60)
    passed = sum(1 for _, r in results if r)
    total = len(results)
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {name}: {status}")
    print(f"\n总计: {passed}/{total} 通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！系统运行正常。")
    else:
        print(f"\n⚠️  {total - passed} 个测试失败，请检查。")

if __name__ == "__main__":
    main()
