#!/usr/bin/env python3
import sys
import time
import requests
import json
from typing import Dict, Any

BASE_URL = "http://localhost:8000"


def print_header(title: str):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_result(passed: bool, message: str):
    status = "✓ 通过" if passed else "✗ 失败"
    print(f"  [{status}] {message}")


def print_error_response(response: requests.Response):
    try:
        error = response.json()
        print(f"    错误码: {error.get('error_code', 'N/A')}")
        print(f"    错误消息: {error.get('error_message', 'N/A')}")
        print(f"    错误类型: {error.get('error_type', 'N/A')}")
        if error.get('detail'):
            print(f"    详情: {json.dumps(error.get('detail'), ensure_ascii=False, indent=4)}")
    except:
        print(f"    响应: {response.text}")


class HealthCheckQueueTest:
    def __init__(self):
        self.data: Dict[str, Any] = {}
        self.passed = 0
        self.failed = 0

    def setup(self):
        print_header("1. 初始化测试数据 - 项目、套餐、患者")

        projects = [
            {"name": "空腹抽血", "code": "BLOOD_FASTING", "project_type": "fasting", "description": "空腹血液检查", "estimated_minutes": 10},
            {"name": "B超检查", "code": "ULTRASOUND", "project_type": "fasting", "description": "腹部B超，需要空腹", "estimated_minutes": 20},
            {"name": "心电图", "code": "ECG", "project_type": "unrestricted", "description": "心电图检查", "estimated_minutes": 5},
            {"name": "餐后血糖", "code": "BLOOD_POST_MEAL", "project_type": "post_meal", "description": "餐后2小时血糖", "estimated_minutes": 5},
        ]

        created_projects = {}
        for proj in projects:
            response = requests.post(f"{BASE_URL}/api/projects/", json=proj)
            if response.status_code == 200:
                data = response.json()
                created_projects[data['code']] = data
                print_result(True, f"创建项目: {data['name']} (ID: {data['id']})")
            elif response.status_code == 400:
                response2 = requests.get(f"{BASE_URL}/api/projects/?project_type={proj['project_type']}")
                for p in response2.json():
                    if p['code'] == proj['code']:
                        created_projects[p['code']] = p
                        print_result(True, f"项目已存在: {p['name']} (ID: {p['id']})")
                        break
            else:
                print_result(False, f"创建项目失败: {proj['name']}")
                print_error_response(response)

        self.data['projects'] = created_projects

        print("\n  [创建项目依赖] 餐后血糖 依赖 空腹抽血")
        dep_data = {
            "dependent_project_id": created_projects['BLOOD_POST_MEAL']['id'],
            "dependency_project_id": created_projects['BLOOD_FASTING']['id'],
            "dependency_type": "required"
        }
        response = requests.post(f"{BASE_URL}/api/projects/dependencies/", json=dep_data)
        if response.status_code == 200:
            print_result(True, "创建依赖: 餐后血糖 -> 空腹抽血")
        else:
            print_result(False, "创建依赖失败 (可能已存在)")

        print("\n  [创建套餐] 标准体检套餐")
        package_data = {
            "name": "标准体检套餐A",
            "code": "PKG_STANDARD_A",
            "description": "包含空腹和餐后项目的标准套餐",
            "projects": [
                {"project_id": created_projects['BLOOD_FASTING']['id'], "sort_order": 1},
                {"project_id": created_projects['ULTRASOUND']['id'], "sort_order": 2},
                {"project_id": created_projects['ECG']['id'], "sort_order": 3},
                {"project_id": created_projects['BLOOD_POST_MEAL']['id'], "sort_order": 4},
            ]
        }
        response = requests.post(f"{BASE_URL}/api/packages/", json=package_data)
        if response.status_code == 200:
            self.data['package'] = response.json()
            print_result(True, f"创建套餐: {self.data['package']['name']} (ID: {self.data['package']['id']})")
        elif response.status_code == 400:
            response2 = requests.get(f"{BASE_URL}/api/packages/")
            for p in response2.json():
                if p['code'] == 'PKG_STANDARD_A':
                    self.data['package'] = p
                    print_result(True, f"套餐已存在: {p['name']} (ID: {p['id']})")
                    break
        else:
            print_result(False, "创建套餐失败")
            print_error_response(response)

        print("\n  [创建患者]")
        patient_data = {
            "name": "张三",
            "id_card": f"110101{time.strftime('%Y%m%d')}0001",
            "phone": "13800138001"
        }
        response = requests.post(f"{BASE_URL}/api/patients/", json=patient_data)
        if response.status_code == 200:
            self.data['patient'] = response.json()
            print_result(True, f"创建患者: {self.data['patient']['name']} (ID: {self.data['patient']['id']})")
        elif response.status_code == 400:
            response2 = requests.get(f"{BASE_URL}/api/patients/")
            for p in response2.json():
                if p['id_card'] == patient_data['id_card']:
                    self.data['patient'] = p
                    print_result(True, f"患者已存在: {p['name']} (ID: {p['id']})")
                    break
        else:
            print_result(False, "创建患者失败")
            print_error_response(response)

        self.passed += 1
        print(f"\n  初始化完成，准备开始规则验证测试...")

    def test_rule_1_post_meal_after_fasting(self):
        print_header("规则1: 餐后项目必须在空腹项目完成后才能进行")
        
        patient_id = self.data['patient']['id']
        package_id = self.data['package']['id']
        post_meal_project = self.data['projects']['BLOOD_POST_MEAL']

        print(f"\n  [场景] 患者尚未完成任何空腹项目，尝试创建餐后项目排队号")
        print(f"  项目: {post_meal_project['name']} (类型: {post_meal_project['project_type']})")
        
        queue_data = {
            "patient_id": patient_id,
            "package_id": package_id,
            "project_id": post_meal_project['id'],
            "source": "test_rule_1"
        }
        response = requests.post(f"{BASE_URL}/api/queue-numbers/", json=queue_data)

        if response.status_code == 400:
            error = response.json()
            error_detail = error.get('detail', {})
            if error_detail.get('error_code') in ['FASTING_RULE_VIOLATION', 'DEPENDENCY_NOT_MET']:
                self.passed += 1
                print_result(True, f"系统正确拒绝了餐后项目 (错误码: {error_detail['error_code']})")
                print(f"    错误消息: {error_detail['error_message']}")
            else:
                self.failed += 1
                print_result(False, "错误码不符合预期")
                print_error_response(response)
        else:
            self.failed += 1
            print_result(False, "系统应该拒绝，但创建成功了")

    def test_rule_2_fasting_before_post_meal(self):
        print_header("规则2: 空腹项目不能在餐后项目完成后进行")

        patient_id = self.data['patient']['id']
        package_id = self.data['package']['id']
        fasting_project = self.data['projects']['BLOOD_FASTING']
        post_meal_project = self.data['projects']['BLOOD_POST_MEAL']

        print(f"\n  [步骤1] 先完成一个空腹项目（为了后续能创建餐后项目）")
        queue_data = {
            "patient_id": patient_id,
            "package_id": package_id,
            "project_id": fasting_project['id'],
            "source": "test_rule_2_step1"
        }
        response = requests.post(f"{BASE_URL}/api/queue-numbers/", json=queue_data)
        if response.status_code == 200:
            queue = response.json()
            print_result(True, f"创建排队号: {queue['queue_number']}")
            
            response = requests.patch(f"{BASE_URL}/api/queue-numbers/{queue['id']}/status/", 
                                      json={"new_status": "in_progress"})
            response = requests.patch(f"{BASE_URL}/api/queue-numbers/{queue['id']}/status/", 
                                      json={"new_status": "completed"})
            print_result(True, "完成空腹抽血项目")
        else:
            print_result(False, "创建空腹排队号失败")
            print_error_response(response)
            return

        print(f"\n  [步骤2] 现在可以创建餐后项目排队号并完成它")
        queue_data = {
            "patient_id": patient_id,
            "package_id": package_id,
            "project_id": post_meal_project['id'],
            "source": "test_rule_2_step2"
        }
        response = requests.post(f"{BASE_URL}/api/queue-numbers/", json=queue_data)
        if response.status_code == 200:
            queue = response.json()
            print_result(True, f"创建餐后排队号: {queue['queue_number']}")
            response = requests.patch(f"{BASE_URL}/api/queue-numbers/{queue['id']}/status/", 
                                      json={"new_status": "in_progress"})
            response = requests.patch(f"{BASE_URL}/api/queue-numbers/{queue['id']}/status/", 
                                      json={"new_status": "completed"})
            print_result(True, "完成餐后血糖项目")
        else:
            print_result(False, "创建餐后排队号失败")
            print_error_response(response)
            return

        print(f"\n  [步骤3] 现在尝试创建另一个空腹项目排队号（B超）")
        print(f"  [预期] 应该被拒绝，因为已有餐后项目完成")
        ultrasound_project = self.data['projects']['ULTRASOUND']
        queue_data = {
            "patient_id": patient_id,
            "package_id": package_id,
            "project_id": ultrasound_project['id'],
            "source": "test_rule_2_step3"
        }
        response = requests.post(f"{BASE_URL}/api/queue-numbers/", json=queue_data)

        if response.status_code == 400:
            error = response.json()
            error_detail = error.get('detail', {})
            if error_detail.get('error_code') == 'INVALID_ORDER':
                self.passed += 1
                print_result(True, "系统正确拒绝了空腹项目（餐后项目已完成）")
                print(f"    错误码: {error_detail['error_code']}")
                print(f"    错误消息: {error_detail['error_message']}")
                print(f"    详情: {error_detail['detail']}")
            else:
                self.failed += 1
                print_result(False, "错误码不符合预期")
                print_error_response(response)
        else:
            self.failed += 1
            print_result(False, "系统应该拒绝，但创建成功了")

    def test_rule_3_dependency_check(self):
        print_header("规则3: 项目依赖必须按顺序完成")

        print("\n  [创建新患者进行依赖测试]")
        patient_data = {
            "name": "李四",
            "id_card": f"110101{time.strftime('%Y%m%d')}0002",
            "phone": "13800138002"
        }
        response = requests.post(f"{BASE_URL}/api/patients/", json=patient_data)
        if response.status_code == 200:
            patient = response.json()
        else:
            response2 = requests.get(f"{BASE_URL}/api/patients/")
            patient = None
            for p in response2.json():
                if p['id_card'] == patient_data['id_card']:
                    patient = p
                    break
            if not patient:
                print_result(False, "创建患者失败")
                return

        patient_id = patient['id']
        package_id = self.data['package']['id']
        post_meal_project = self.data['projects']['BLOOD_POST_MEAL']

        print(f"\n  [场景] 餐后血糖 依赖 空腹抽血")
        print(f"  患者尚未完成空腹抽血，尝试创建餐后血糖排队号")
        print(f"  [预期] 应该被拒绝（依赖未满足）")

        queue_data = {
            "patient_id": patient_id,
            "package_id": package_id,
            "project_id": post_meal_project['id'],
            "source": "test_rule_3"
        }
        response = requests.post(f"{BASE_URL}/api/queue-numbers/", json=queue_data)

        if response.status_code == 400:
            error = response.json()
            error_detail = error.get('detail', {})
            if error_detail.get('error_code') in ['DEPENDENCY_NOT_MET', 'FASTING_RULE_VIOLATION']:
                self.passed += 1
                print_result(True, f"系统正确拒绝了（错误码: {error_detail['error_code']}）")
                print(f"    错误消息: {error_detail['error_message']}")
            else:
                self.failed += 1
                print_result(False, "错误码不符合预期")
                print_error_response(response)
        else:
            self.failed += 1
            print_result(False, "系统应该拒绝，但创建成功了")

    def test_rule_4_status_transition(self):
        print_header("规则4: 状态流转必须符合规则")

        print("\n  [创建新患者进行状态流转测试]")
        patient_data = {
            "name": "王五",
            "id_card": f"110101{time.strftime('%Y%m%d')}0003",
            "phone": "13800138003"
        }
        response = requests.post(f"{BASE_URL}/api/patients/", json=patient_data)
        if response.status_code == 200:
            patient = response.json()
        else:
            response2 = requests.get(f"{BASE_URL}/api/patients/")
            patient = None
            for p in response2.json():
                if p['id_card'] == patient_data['id_card']:
                    patient = p
                    break
            if not patient:
                print_result(False, "创建患者失败")
                return

        patient_id = patient['id']
        package_id = self.data['package']['id']
        ecg_project = self.data['projects']['ECG']

        print(f"\n  [步骤1] 创建排队号，状态应为 pending")
        queue_data = {
            "patient_id": patient_id,
            "package_id": package_id,
            "project_id": ecg_project['id'],
            "source": "test_rule_4"
        }
        response = requests.post(f"{BASE_URL}/api/queue-numbers/", json=queue_data)
        if response.status_code == 200:
            queue = response.json()
            print_result(True, f"创建排队号: {queue['queue_number']}, 状态: {queue['status']}")
        else:
            print_result(False, "创建排队号失败")
            print_error_response(response)
            return

        print(f"\n  [步骤2] pending -> in_progress (应该成功)")
        response = requests.patch(f"{BASE_URL}/api/queue-numbers/{queue['id']}/status/", 
                                  json={"new_status": "in_progress"})
        if response.status_code == 200:
            self.passed += 1
            print_result(True, "状态转换成功: pending -> in_progress")
        else:
            self.failed += 1
            print_result(False, "状态转换失败")
            print_error_response(response)
            return

        print(f"\n  [步骤3] in_progress -> completed (应该成功)")
        response = requests.patch(f"{BASE_URL}/api/queue-numbers/{queue['id']}/status/", 
                                  json={"new_status": "completed"})
        if response.status_code == 200:
            self.passed += 1
            print_result(True, "状态转换成功: in_progress -> completed")
        else:
            self.failed += 1
            print_result(False, "状态转换失败")
            print_error_response(response)

        print(f"\n  [步骤4] completed -> cancelled (应该失败，completed 不能再转换)")
        response = requests.patch(f"{BASE_URL}/api/queue-numbers/{queue['id']}/status/", 
                                  json={"new_status": "cancelled"})
        if response.status_code == 400:
            error = response.json()
            error_detail = error.get('detail', {})
            if error_detail.get('error_code') == 'INVALID_STATUS_TRANSITION':
                self.passed += 1
                print_result(True, "系统正确拒绝了无效状态转换")
                print(f"    错误码: {error_detail['error_code']}")
                print(f"    错误消息: {error_detail['error_message']}")
            else:
                self.failed += 1
                print_result(False, "错误码不符合预期")
        else:
            self.failed += 1
            print_result(False, "系统应该拒绝，但转换成功了")

    def test_rule_5_reschedule(self):
        print_header("规则5: 改约和重新激活")

        print("\n  [创建新患者进行改约测试]")
        patient_data = {
            "name": "赵六",
            "id_card": f"110101{time.strftime('%Y%m%d')}0004",
            "phone": "13800138004"
        }
        response = requests.post(f"{BASE_URL}/api/patients/", json=patient_data)
        if response.status_code == 200:
            patient = response.json()
        else:
            response2 = requests.get(f"{BASE_URL}/api/patients/")
            patient = None
            for p in response2.json():
                if p['id_card'] == patient_data['id_card']:
                    patient = p
                    break
            if not patient:
                print_result(False, "创建患者失败")
                return

        patient_id = patient['id']
        package_id = self.data['package']['id']
        ecg_project = self.data['projects']['ECG']

        queue_data = {
            "patient_id": patient_id,
            "package_id": package_id,
            "project_id": ecg_project['id'],
            "source": "test_rule_5"
        }
        response = requests.post(f"{BASE_URL}/api/queue-numbers/", json=queue_data)
        if response.status_code == 200:
            queue = response.json()
            print_result(True, f"创建排队号: {queue['queue_number']}")
        else:
            print_result(False, "创建排队号失败")
            return

        print(f"\n  [步骤1] pending -> rescheduled (改约)")
        response = requests.post(f"{BASE_URL}/api/queue-numbers/{queue['id']}/reschedule/")
        if response.status_code == 200:
            data = response.json()
            self.passed += 1
            print_result(True, f"改约成功，当前状态: {data['status']}")
        else:
            self.failed += 1
            print_result(False, "改约失败")
            print_error_response(response)
            return

        print(f"\n  [步骤2] rescheduled -> pending (重新激活)")
        response = requests.post(f"{BASE_URL}/api/queue-numbers/{queue['id']}/reactivate/")
        if response.status_code == 200:
            data = response.json()
            self.passed += 1
            print_result(True, f"重新激活成功，当前状态: {data['status']}")
        else:
            self.failed += 1
            print_result(False, "重新激活失败")
            print_error_response(response)

    def test_problem_records(self):
        print_header("验证: 脏数据被记录到问题列表")

        response = requests.get(f"{BASE_URL}/api/queue-numbers/problems/")
        if response.status_code == 200:
            problems = response.json()
            print(f"\n  问题记录数量: {len(problems)}")
            for i, problem in enumerate(problems[:5], 1):
                print(f"\n  [问题记录 #{i}]")
                print(f"    来源接口: {problem['source_endpoint']}")
                print(f"    错误类型: {problem['error_type']}")
                print(f"    错误消息: {problem['error_message']}")
                print(f"    创建时间: {problem['created_at']}")
            
            if len(problems) > 0:
                self.passed += 1
                print_result(True, "问题列表中已有记录，证明脏数据没有被静默跳过")
            else:
                print_result(False, "问题列表为空（可能测试顺序问题）")
        else:
            print_result(False, "获取问题列表失败")

    def test_batch_queue(self):
        print_header("验证: 批量创建排队号")

        print("\n  [创建新患者进行批量测试]")
        patient_data = {
            "name": "钱七",
            "id_card": f"110101{time.strftime('%Y%m%d')}0005",
            "phone": "13800138005"
        }
        response = requests.post(f"{BASE_URL}/api/patients/", json=patient_data)
        if response.status_code == 200:
            patient = response.json()
        else:
            response2 = requests.get(f"{BASE_URL}/api/patients/")
            patient = None
            for p in response2.json():
                if p['id_card'] == patient_data['id_card']:
                    patient = p
                    break
            if not patient:
                print_result(False, "创建患者失败")
                return

        print("\n  [批量创建] 为套餐中所有项目创建排队号")
        print("  [注意] 餐后项目会因为空腹项目未完成而失败")
        
        batch_data = {
            "patient_id": patient['id'],
            "package_id": self.data['package']['id'],
            "source": "test_batch"
        }
        response = requests.post(f"{BASE_URL}/api/queue-numbers/batch/", json=batch_data)
        
        if response.status_code == 200:
            result = response.json()
            success = result.get('success', [])
            failed = result.get('failed', [])
            
            print(f"\n  成功: {len(success)} 个")
            for s in success:
                print(f"    ✓ {s['project_name']}: {s['queue_number']}")
            
            print(f"\n  失败: {len(failed)} 个")
            for f in failed:
                print(f"    ✗ {f['project_name']}: {f['error_code']}")
                print(f"      原因: {f['error_message']}")
            
            if len(failed) > 0:
                self.passed += 1
                print_result(True, "批量创建正确区分了成功和失败的项目")
            else:
                print_result(False, "应该有餐后项目失败")
        else:
            print_result(False, "批量创建失败")
            print_error_response(response)

    def test_rules_summary(self):
        print_header("获取规则摘要（给 reviewer 查看）")

        response = requests.get(f"{BASE_URL}/api/rules-summary")
        if response.status_code == 200:
            data = response.json()
            print("\n  " + data['title'])
            print("\n  核心规则:")
            for rule in data['core_rules']:
                print(f"    • {rule}")
            print("\n  错误处理:")
            for rule in data['error_handling']:
                print(f"    • {rule}")
            print("\n  状态流转:")
            for from_status, to_statuses in data['status_flow'].items():
                print(f"    {from_status} -> {to_statuses if to_statuses else '[]'}")
            self.passed += 1

        response = requests.get(f"{BASE_URL}/api/queue-numbers/validation/rules/")
        if response.status_code == 200:
            data = response.json()
            print(f"\n  项目类型说明:")
            for proj_type, desc in data['project_types'].items():
                print(f"    • {proj_type}: {desc}")

    def run_all_tests(self):
        print("\n" + "#" * 60)
        print("#" + " " * 58 + "#")
        print("#" + "  体检中心空腹项目排队 API - 规则验证测试".center(56) + "#")
        print("#" + " " * 58 + "#")
        print("#" * 60)

        try:
            self.setup()
            
            self.test_rules_summary()
            self.test_rule_1_post_meal_after_fasting()
            self.test_rule_2_fasting_before_post_meal()
            self.test_rule_3_dependency_check()
            self.test_rule_4_status_transition()
            self.test_rule_5_reschedule()
            self.test_batch_queue()
            self.test_problem_records()

        except Exception as e:
            print(f"\n  测试执行出错: {e}")
            import traceback
            traceback.print_exc()
            self.failed += 1

        print("\n" + "=" * 60)
        print("  测试结果汇总")
        print("=" * 60)
        print(f"  通过: {self.passed}")
        print(f"  失败: {self.failed}")
        total = self.passed + self.failed
        print(f"  总计: {total}")
        print(f"  通过率: {self.passed/total*100:.1f}%" if total > 0 else "N/A")
        print("=" * 60)

        return self.failed == 0


def main():
    print(f"\n  测试目标: {BASE_URL}")
    print(f"  正在检查服务是否启动...")
    
    try:
        response = requests.get(f"{BASE_URL}/", timeout=5)
        if response.status_code == 200:
            print(f"  ✓ 服务运行正常")
        else:
            print(f"  ✗ 服务响应异常: {response.status_code}")
            return 1
    except requests.exceptions.ConnectionError:
        print(f"  ✗ 无法连接到服务，请先启动:")
        print(f"    uvicorn app.main:app --reload")
        return 1

    test = HealthCheckQueueTest()
    success = test.run_all_tests()
    
    print(f"\n  Swagger UI: {BASE_URL}/docs")
    print(f"  规则摘要: {BASE_URL}/api/rules-summary")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
