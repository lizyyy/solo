#!/usr/bin/env python3
import requests
import json
import sys
import time
from datetime import datetime
from sample_data import SAMPLE_JOURNEYS, SAMPLE_FAILURES

BASE_URL = "http://localhost:8000"


def print_header(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_success(message):
    print(f"  ✅ {message}")


def print_failure(message):
    print(f"  ❌ {message}")


def check_health():
    print_header("1. 健康检查")
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if response.status_code == 200:
            print_success("API 服务运行正常")
            return True
        else:
            print_failure(f"API 返回异常状态码: {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"无法连接 API: {str(e)}")
        print("\n  提示: 请先运行 'python main.py' 启动服务")
        return False


def test_create_journeys():
    print_header("2. 创建示例旅程")
    created_ids = []
    
    for journey in SAMPLE_JOURNEYS:
        try:
            response = requests.post(f"{BASE_URL}/api/journeys", json=journey, timeout=10)
            if response.status_code == 200:
                data = response.json()
                created_ids.append(data["id"])
                status_icon = "✅" if data["status"] == "valid" else "⚠️"
                print(f"  {status_icon} {journey['name']} - ID: {data['id']}, 状态: {data['status']}")
            elif response.status_code == 409:
                print(f"  ⚠️  {journey['name']} - 已存在 (跳过)")
            else:
                print_failure(f"{journey['name']} - 创建失败 (状态码: {response.status_code})")
        except Exception as e:
            print_failure(f"{journey['name']} - 错误: {str(e)}")
    
    return created_ids


def test_list_journeys():
    print_header("3. 查询旅程列表")
    try:
        response = requests.get(f"{BASE_URL}/api/journeys", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print_success(f"成功获取 {len(data)} 个旅程")
            for journey in data:
                print(f"     - {journey['name']} (ID: {journey['id']})")
            return data
        else:
            print_failure(f"查询失败 (状态码: {response.status_code})")
            return []
    except Exception as e:
        print_failure(f"查询错误: {str(e)}")
        return []


def test_get_journey_detail(journey_id):
    print_header("4. 获取旅程详情")
    try:
        response = requests.get(f"{BASE_URL}/api/journeys/{journey_id}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print_success(f"成功获取旅程 {journey_id} 详情")
            print(f"     名称: {data['name']}")
            print(f"     步骤数: {len(data['steps'])}")
            print(f"     依赖服务数: {len(data.get('dependent_services', []))}")
            print(f"     验证状态: {data['step_validation_status']['overall_status']}")
            return True
        else:
            print_failure(f"获取详情失败 (状态码: {response.status_code})")
            return False
    except Exception as e:
        print_failure(f"获取详情错误: {str(e)}")
        return False


def test_add_failure_samples(journey_id):
    print_header("5. 添加失败样本")
    success_count = 0
    
    for failure in SAMPLE_FAILURES:
        try:
            sample_with_time = {
                **failure,
                "timestamp": datetime.utcnow().isoformat()
            }
            response = requests.post(
                f"{BASE_URL}/api/journeys/{journey_id}/failure-sample",
                json=sample_with_time,
                timeout=10
            )
            if response.status_code == 200:
                success_count += 1
            else:
                print(f"  ⚠️  添加样本失败: {failure['error_type']}")
        except Exception as e:
            print(f"  ⚠️  添加样本错误: {str(e)}")
    
    print_success(f"成功添加 {success_count}/{len(SAMPLE_FAILURES)} 个失败样本")
    return success_count


def test_manual_correction(journey_id):
    print_header("6. 人工修正流程测试")
    
    try:
        response = requests.get(f"{BASE_URL}/api/journeys/{journey_id}", timeout=10)
        if response.status_code != 200:
            print_failure("无法获取旅程信息")
            return False
        
        original_data = response.json()
        original_steps = original_data["steps"]
        
        if not original_steps:
            print_failure("旅程没有步骤数据")
            return False
        
        modified_steps = [
            {**step, "name": step["name"] + " (已修正)"} 
            for step in original_steps
        ]
        
        correction = {
            "correction_type": "step_renaming",
            "field": "steps",
            "old_value": original_steps,
            "new_value": modified_steps,
            "reason": "测试人工修正功能",
            "corrected_by": "self_check_script"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/journeys/{journey_id}/manual-correction",
            json=correction,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success("人工修正成功")
            print(f"     修正后状态: {data['status']}")
            print(f"     修正记录数: {len(data['manual_corrections'])}")
            return True
        else:
            print_failure(f"人工修正失败 (状态码: {response.status_code})")
            return False
            
    except Exception as e:
        print_failure(f"人工修正错误: {str(e)}")
        return False


def test_export_journey(journey_id):
    print_header("7. 导出旅程数据")
    try:
        response = requests.get(f"{BASE_URL}/api/journeys/{journey_id}/export", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print_success("旅程导出成功")
            print(f"     导出格式: {data['export_metadata']['export_format']}")
            print(f"     导出时间: {data['export_metadata']['export_time'][:19]}")
            
            with open(f"journey_export_{journey_id}.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print_success(f"已保存到 journey_export_{journey_id}.json")
            
            return True
        else:
            print_failure(f"导出失败 (状态码: {response.status_code})")
            return False
    except Exception as e:
        print_failure(f"导出错误: {str(e)}")
        return False


def test_frequency_conflict():
    print_header("8. 频率冲突检测测试")
    
    conflict_journey = {
        "name": f"频率冲突测试_{int(time.time())}",
        "description": "测试频率冲突检测",
        "steps": [{
            "step_id": "test_001",
            "name": "测试步骤",
            "action": "test_action",
            "timeout": 10
        }],
        "run_frequency": "hourly"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/journeys", json=conflict_journey, timeout=10)
        if response.status_code == 200:
            data = response.json()
            conflicts = data.get("frequency_conflicts", [])
            
            if len(conflicts) > 0:
                print_success(f"成功检测到 {len(conflicts)} 个频率冲突")
                for conflict in conflicts:
                    print(f"     - 冲突旅程: {conflict['journey_name']}")
            else:
                print("  ⚠️  未检测到频率冲突 (可能是第一个 hourly 旅程)")
            
            return True
        else:
            print_failure(f"创建失败 (状态码: {response.status_code})")
            return False
    except Exception as e:
        print_failure(f"频率冲突测试错误: {str(e)}")
        return False


def test_update_status(journey_id):
    print_header("9. 状态推进测试")
    
    try:
        response = requests.put(f"{BASE_URL}/api/journeys/{journey_id}/status?new_status=suspended", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print_success(f"状态更新成功: {data['status']}")
            return True
        else:
            print_failure(f"状态更新失败 (状态码: {response.status_code})")
            return False
    except Exception as e:
        print_failure(f"状态更新错误: {str(e)}")
        return False


def run_all_checks():
    print("\n" + "🚀" * 30)
    print("  合成旅程注册 API - 自检程序启动")
    print("🚀" * 30)
    
    results = {}
    
    results["health"] = check_health()
    if not results["health"]:
        print("\n" + "=" * 70)
        print("  ❌ API 服务不可用，请先启动服务: python main.py")
        print("=" * 70 + "\n")
        sys.exit(1)
    
    created_ids = test_create_journeys()
    results["create"] = len(created_ids) > 0
    
    journeys = test_list_journeys()
    results["list"] = len(journeys) > 0
    
    if journeys:
        first_id = journeys[0]["id"]
        results["detail"] = test_get_journey_detail(first_id)
        results["failures"] = test_add_failure_samples(first_id) > 0
        results["correction"] = test_manual_correction(first_id)
        results["export"] = test_export_journey(first_id)
        results["conflict"] = test_frequency_conflict()
        results["status_update"] = test_update_status(first_id)
    
    print_header("自检结果汇总")
    
    total_tests = len(results)
    passed = sum(1 for v in results.values() if v)
    
    for test_name, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {test_name:20s}: {status}")
    
    print(f"\n  总计: {passed}/{total_tests} 测试通过")
    
    if passed == total_tests:
        print("\n" + "🎉" * 20)
        print("  所有测试通过！API 运行正常！")
        print("🎉" * 20 + "\n")
        print("  下一步:")
        print("    1. 访问 http://localhost:8000/docs 查看 API 文档")
        print("    2. 运行 'pytest test_journey_api.py -v' 执行完整单元测试")
        print("    3. 开始注册您的端到端巡检旅程！\n")
    else:
        print("\n" + "⚠️  " * 10)
        print("  部分测试失败，请检查 API 服务和日志")
        print("⚠️  " * 10 + "\n")


if __name__ == "__main__":
    run_all_checks()
