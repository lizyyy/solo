#!/usr/bin/env python3
"""
波次拣货系统自检脚本
验证导入、筛选、处理和导出功能
"""
import sys
import os
import requests
import json
from typing import Dict, List

BASE_URL = "http://localhost:8000"


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'


def print_success(msg: str):
    print(f"{Colors.GREEN}✓ {msg}{Colors.ENDC}")


def print_error(msg: str):
    print(f"{Colors.RED}✗ {msg}{Colors.ENDC}")


def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.ENDC}")


def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.ENDC}")


class SelfTest:
    def __init__(self):
        self.session = requests.Session()
        self.test_data: Dict = {}

    def test_1_health_check(self) -> bool:
        """检查服务是否启动"""
        print_info("1. 健康检查...")
        try:
            response = self.session.get(f"{BASE_URL}/docs")
            if response.status_code == 200:
                print_success("API服务正常运行")
                return True
            else:
                print_error(f"API服务返回状态码: {response.status_code}")
                return False
        except Exception as e:
            print_error(f"无法连接到API服务: {e}")
            print_info("请先运行: uvicorn main:app --reload")
            return False

    def test_2_create_locations(self) -> bool:
        """创建库位数据"""
        print_info("2. 创建库位数据...")
        locations = [
            {"location_code": "A-01-01-01", "aisle": "A", "rack": "01", "level": 1, "position": 1, "sort_order": 1},
            {"location_code": "A-01-01-02", "aisle": "A", "rack": "01", "level": 1, "position": 2, "sort_order": 2},
            {"location_code": "A-01-02-01", "aisle": "A", "rack": "01", "level": 2, "position": 1, "sort_order": 3},
            {"location_code": "B-01-01-01", "aisle": "B", "rack": "01", "level": 1, "position": 1, "sort_order": 10},
        ]

        for loc in locations:
            response = self.session.post(f"{BASE_URL}/api/locations/", json=loc)
            if response.status_code == 200:
                print_success(f"创建库位: {loc['location_code']}")
            elif "已存在" in response.text:
                print_warning(f"库位已存在: {loc['location_code']}")
            else:
                print_error(f"创建库位失败: {response.text}")
                return False
        return True

    def test_3_create_sku_stocks(self) -> bool:
        """创建SKU库存"""
        print_info("3. 创建SKU库存...")
        skus = [
            {"sku_code": "SKU001", "sku_name": "商品A", "location_code": "A-01-01-01", "quantity": 50},
            {"sku_code": "SKU002", "sku_name": "商品B", "location_code": "A-01-01-02", "quantity": 30},
            {"sku_code": "SKU003", "sku_name": "商品C", "location_code": "A-01-02-01", "quantity": 5},
        ]

        for sku in skus:
            response = self.session.post(f"{BASE_URL}/api/sku-stocks/", json=sku)
            if response.status_code == 200:
                print_success(f"创建SKU库存: {sku['sku_code']} - {sku['quantity']}件")
            elif "已存在" in response.text:
                print_warning(f"SKU库存已存在: {sku['sku_code']}")
            else:
                print_error(f"创建SKU库存失败: {response.text}")
                return False
        return True

    def test_4_create_orders(self) -> bool:
        """创建订单（导入功能）"""
        print_info("4. 创建测试订单（导入功能）...")
        orders = [
            {
                "order_code": "ORD20240101001",
                "customer_name": "张三",
                "customer_phone": "13800138001",
                "shipping_address": "北京市朝阳区XXX路1号",
                "items": [
                    {"sku_code": "SKU001", "sku_name": "商品A", "ordered_quantity": 10},
                    {"sku_code": "SKU002", "sku_name": "商品B", "ordered_quantity": 5}
                ]
            },
            {
                "order_code": "ORD20240101002",
                "customer_name": "李四",
                "customer_phone": "13800138002",
                "shipping_address": "北京市海淀区XXX路2号",
                "items": [
                    {"sku_code": "SKU001", "sku_name": "商品A", "ordered_quantity": 20},
                    {"sku_code": "SKU003", "sku_name": "商品C", "ordered_quantity": 10}
                ]
            },
            {
                "order_code": "ORD20240101003",
                "customer_name": "王五",
                "customer_phone": "13800138003",
                "shipping_address": "北京市西城区XXX路3号",
                "items": [
                    {"sku_code": "SKU002", "sku_name": "商品B", "ordered_quantity": 15}
                ]
            }
        ]

        created_orders = []
        for order in orders:
            response = self.session.post(f"{BASE_URL}/api/orders/", json=order)
            if response.status_code == 200:
                result = response.json()
                created_orders.append(order["order_code"])
                print_success(f"创建订单: {order['order_code']} - {len(order['items'])}件商品")
            elif "已存在" in response.text:
                created_orders.append(order["order_code"])
                print_warning(f"订单已存在: {order['order_code']}")
            else:
                print_error(f"创建订单失败: {response.text}")
                return False

        self.test_data["order_codes"] = created_orders
        return True

    def test_5_filter_orders(self) -> bool:
        """筛选订单（筛选功能）"""
        print_info("5. 测试订单筛选功能...")

        response = self.session.get(f"{BASE_URL}/api/orders/", params={"status": "pending", "limit": 10})
        if response.status_code == 200:
            result = response.json()
            print_success(f"筛选到待处理订单: {result['total']}个")
            for order in result["orders"]:
                print(f"  - {order['order_code']} - {order['items_count']}件商品")
            return True
        else:
            print_error(f"筛选订单失败: {response.text}")
            return False

    def test_6_create_wave(self) -> bool:
        """创建波次（多订单合并拣货）"""
        print_info("6. 创建波次（多订单合并）...")

        wave_data = {
            "order_codes": self.test_data["order_codes"],
            "priority": 1
        }

        response = self.session.post(f"{BASE_URL}/api/waves/", json=wave_data)
        if response.status_code == 200:
            result = response.json()
            self.test_data["wave_id"] = result["wave_id"]
            self.test_data["wave_code"] = result["wave_code"]
            print_success(f"创建波次: {result['wave_code']}")
            print(f"  - 合并订单数: {result['total_orders']}")
            print(f"  - 商品SKU数: {result['total_skus']}")
            return True
        else:
            print_error(f"创建波次失败: {response.text}")
            return False

    def test_7_generate_pick_tasks(self) -> bool:
        """生成拣货任务"""
        print_info("7. 生成拣货任务...")

        wave_id = self.test_data["wave_id"]
        response = self.session.post(f"{BASE_URL}/api/waves/{wave_id}/generate-tasks/")
        if response.status_code == 200:
            result = response.json()
            self.test_data["task_ids"] = [t["task_id"] for t in result["tasks"]]
            print_success(f"生成拣货任务: {result['tasks_count']}个")
            for task in result["tasks"]:
                print(f"  - {task['task_code']}: {task['sku_code']} x{task['required_quantity']}")
            return True
        else:
            print_error(f"生成拣货任务失败: {response.text}")
            return False

    def test_8_sorted_tasks(self) -> bool:
        """库位路径排序"""
        print_info("8. 测试库位路径排序...")

        wave_id = self.test_data["wave_id"]
        response = self.session.get(f"{BASE_URL}/api/waves/{wave_id}/sorted-tasks/")
        if response.status_code == 200:
            result = response.json()
            print_success(f"拣货任务已按库位路径排序")
            for task in result["tasks"]:
                loc = task["location_code"] or "未分配库位"
                print(f"  - {task['task_code']}: {loc} - {task['sku_code']}")
            return True
        else:
            print_error(f"获取排序任务失败: {response.text}")
            return False

    def test_9_process_pick_tasks(self) -> bool:
        """处理拣货任务（缺货拆单）"""
        print_info("9. 处理拣货任务（测试缺货拆单）...")

        task_ids = self.test_data["task_ids"]
        test_quantities = [30, 20, 3]

        for i, task_id in enumerate(task_ids):
            process_data = {
                "actual_quantity": test_quantities[i] if i < len(test_quantities) else 0,
                "picker": "拣货员001"
            }

            response = self.session.post(
                f"{BASE_URL}/api/pick-tasks/{task_id}/process/",
                json=process_data
            )

            if response.status_code == 200:
                result = response.json()
                if result["is_shortage"]:
                    print_warning(f"任务 {task_id} 缺货！拆单 {result['split_orders_count']} 个")
                else:
                    print_success(f"任务 {task_id} 完成拣货")
            else:
                print_error(f"处理拣货任务失败: {response.text}")
                return False

        return True

    def test_10_create_review_diff(self) -> bool:
        """创建复核差异"""
        print_info("10. 测试复核差异记录...")

        wave_id = self.test_data["wave_id"]
        diff_data = {
            "wave_id": wave_id,
            "order_id": 1,
            "sku_code": "SKU001",
            "expected_quantity": 10,
            "actual_quantity": 8,
            "diff_type": "shortage"
        }

        response = self.session.post(f"{BASE_URL}/api/review-diffs/", json=diff_data)
        if response.status_code == 200:
            result = response.json()
            self.test_data["diff_id"] = result["diff_id"]
            print_success(f"创建复核差异: {result['diff_code']}")
            print(f"  - 差异数量: {result['diff_quantity']}")
            return True
        else:
            print_error(f"创建复核差异失败: {response.text}")
            return False

    def test_11_filter_diffs(self) -> bool:
        """筛选复核差异"""
        print_info("11. 测试复核差异筛选...")

        wave_id = self.test_data["wave_id"]
        response = self.session.get(
            f"{BASE_URL}/api/waves/{wave_id}/review-diffs/",
            params={"status": "pending"}
        )

        if response.status_code == 200:
            result = response.json()
            print_success(f"筛选到待处理差异: {result['diffs_count']}个")
            for diff in result["diffs"]:
                print(f"  - {diff['diff_code']}: {diff['sku_code']} 差{diff['diff_quantity']}")
            return True
        else:
            print_error(f"筛选差异失败: {response.text}")
            return False

    def test_12_resolve_diff(self) -> bool:
        """解决复核差异"""
        print_info("12. 解决复核差异...")

        diff_id = self.test_data["diff_id"]
        resolve_data = {
            "handler": "仓管员001",
            "remarks": "已补发货"
        }

        response = self.session.post(
            f"{BASE_URL}/api/review-diffs/{diff_id}/resolve/",
            json=resolve_data
        )

        if response.status_code == 200:
            result = response.json()
            print_success(f"差异已解决: {result['diff_code']}")
            return True
        else:
            print_error(f"解决差异失败: {response.text}")
            return False

    def test_13_complete_wave(self) -> bool:
        """完成波次并生成报告"""
        print_info("13. 完成波次并生成完成报告...")

        wave_id = self.test_data["wave_id"]
        response = self.session.post(f"{BASE_URL}/api/waves/{wave_id}/complete/")

        if response.status_code == 200:
            result = response.json()
            print_success(f"波次完成，报告已生成: {result['report_code']}")
            print(f"  - 总订单数: {result['total_orders']}")
            print(f"  - 完成订单: {result['completed_orders']}")
            print(f"  - 拆单数量: {result['split_orders']}")
            print(f"  - 缺货商品: {result['shortage_items']}")
            print(f"  - 复核差异: {result['review_diffs']}")
            return True
        else:
            print_error(f"完成波次失败: {response.text}")
            return False

    def test_14_get_wave_report(self) -> bool:
        """获取波次详细报告"""
        print_info("14. 获取波次详细报告...")

        wave_id = self.test_data["wave_id"]
        response = self.session.get(f"{BASE_URL}/api/waves/{wave_id}/report/")

        if response.status_code == 200:
            result = response.json()
            print_success(f"获取波次报告成功")
            print(f"  - 波次: {result['wave']['wave_code']}")
            print(f"  - 订单: {len(result['orders'])}个")
            print(f"  - 拣货任务: {len(result['pick_tasks'])}个")
            print(f"  - 复核差异: {len(result['review_diffs'])}个")
            return True
        else:
            print_error(f"获取报告失败: {response.text}")
            return False

    def test_15_export_report(self) -> bool:
        """导出Excel报告"""
        print_info("15. 测试导出Excel报告...")

        wave_id = self.test_data["wave_id"]
        response = self.session.get(f"{BASE_URL}/api/waves/{wave_id}/export/")

        if response.status_code == 200:
            filename = f"wave_{wave_id}_report.xlsx"
            with open(filename, "wb") as f:
                f.write(response.content)
            print_success(f"报告已导出: {filename}")
            print(f"  - 文件大小: {len(response.content)} bytes")
            return True
        else:
            print_error(f"导出报告失败: {response.text}")
            return False

    def test_16_wave_list_filter(self) -> bool:
        """波次列表筛选"""
        print_info("16. 测试波次列表筛选...")

        response = self.session.get(
            f"{BASE_URL}/api/waves/",
            params={"status": "completed", "limit": 10}
        )

        if response.status_code == 200:
            result = response.json()
            print_success(f"筛选到已完成波次: {result['total']}个")
            for wave in result["waves"]:
                print(f"  - {wave['wave_code']}: {wave['total_orders']}单")
            return True
        else:
            print_error(f"筛选波次列表失败: {response.text}")
            return False

    def test_17_multi_order_same_sku_shortage(self) -> bool:
        """多订单同一SKU缺货拆单场景（关键场景）"""
        print_info("17. 关键场景：多订单同一SKU缺货拆单...")

        order_codes = ["SHORTAGE-TEST-001", "SHORTAGE-TEST-002"]

        orders = [
            {
                "order_code": order_codes[0],
                "customer_name": "缺货测试客户A",
                "items": [{"sku_code": "SKU001", "sku_name": "商品A", "ordered_quantity": 10}]
            },
            {
                "order_code": order_codes[1],
                "customer_name": "缺货测试客户B",
                "items": [{"sku_code": "SKU001", "sku_name": "商品A", "ordered_quantity": 20}]
            }
        ]

        for order in orders:
            response = self.session.post(f"{BASE_URL}/api/orders/", json=order)
            if response.status_code not in [200, 400]:
                print_error(f"创建订单失败: {response.text}")
                return False

        print_success("创建测试订单: 订单1(10件) + 订单2(20件) = 合计30件")

        wave_data = {"order_codes": order_codes, "priority": 1}
        response = self.session.post(f"{BASE_URL}/api/waves/", json=wave_data)
        if response.status_code != 200:
            print_error(f"创建波次失败: {response.text}")
            return False
        wave_id = response.json()["wave_id"]
        print_success("创建波次成功")

        response = self.session.post(f"{BASE_URL}/api/waves/{wave_id}/generate-tasks/")
        if response.status_code != 200:
            print_error(f"生成拣货任务失败: {response.text}")
            return False
        task_id = response.json()["tasks"][0]["task_id"]
        print_success("生成拣货任务: 应拣 30 件")

        process_data = {"actual_quantity": 20, "picker": "测试拣货员"}
        response = self.session.post(
            f"{BASE_URL}/api/pick-tasks/{task_id}/process/",
            json=process_data
        )
        if response.status_code != 200:
            print_error(f"处理拣货任务失败: {response.text}")
            return False

        result = response.json()
        actual_picked = result["actual_quantity"]
        split_count = result["split_orders_count"]
        is_shortage = result["is_shortage"]

        print(f"  实际拣货: {actual_picked} 件")
        print(f"  是否缺货: {is_shortage}")
        print(f"  拆单数量: {split_count}")

        errors = []

        if actual_picked != 20:
            errors.append(f"实际拣货量记录错误: {actual_picked} (应为20)")

        if not is_shortage:
            errors.append("缺货标记错误: 应标记为缺货")

        if split_count == 0:
            errors.append("拆单错误: 缺货时应生成拆单")

        response = self.session.post(f"{BASE_URL}/api/waves/{wave_id}/complete/")
        if response.status_code != 200:
            print_error(f"完成波次失败: {response.text}")
            return False

        report = response.json()
        print_success("波次完成，报告已生成")
        print(f"  报告拆单数: {report['split_orders']}")
        print(f"  报告缺货商品数: {report['shortage_items']}")
        print(f"  报告已拣商品数: {report['picked_items']}")

        if report['split_orders'] != split_count:
            errors.append(f"报告拆单数错误: {report['split_orders']} (应为{split_count})")

        if report['shortage_items'] == 0:
            errors.append("报告缺货商品数错误: 应大于0")

        if report['picked_items'] != 20:
            errors.append(f"报告已拣商品数错误: {report['picked_items']} (应为20)")

        if errors:
            print_error("关键场景验证失败:")
            for err in errors:
                print(f"  - {err}")
            return False
        else:
            print_success("关键场景验证通过: 多订单同一SKU缺货拆单功能正常!")
            return True

    def test_18_error_response_format(self) -> bool:
        """错误响应格式统一验证"""
        print_info("18. 错误响应格式统一验证...")

        test_cases = [
            {
                "name": "订单缺少 items 字段",
                "method": "POST",
                "url": "/api/orders/",
                "data": {"order_code": "ERROR-TEST-001", "customer_name": "测试"},
                "expected_code": "MISSING_FIELDS"
            },
            {
                "name": "订单缺少 order_code 字段",
                "method": "POST",
                "url": "/api/orders/",
                "data": {"customer_name": "测试", "items": []},
                "expected_code": "MISSING_FIELDS"
            },
            {
                "name": "波次缺少 order_codes 字段",
                "method": "POST",
                "url": "/api/waves/",
                "data": {"priority": 1},
                "expected_code": "MISSING_FIELDS"
            },
            {
                "name": "拣货任务缺少 actual_quantity 字段",
                "method": "POST",
                "url": "/api/pick-tasks/1/process/",
                "data": {"picker": "测试"},
                "expected_code": "MISSING_FIELDS"
            },
        ]

        errors = []
        for case in test_cases:
            if case["method"] == "POST":
                response = self.session.post(f"{BASE_URL}{case['url']}", json=case["data"])
            else:
                response = self.session.get(f"{BASE_URL}{case['url']}")

            if response.status_code != 400:
                errors.append(f"{case['name']}: 期望状态码 400，实际 {response.status_code}")
                continue

            data = response.json()
            required_fields = ["error_code", "message", "details"]
            for field in required_fields:
                if field not in data:
                    errors.append(f"{case['name']}: 响应缺少 {field} 字段")

            if data.get("error_code") != case["expected_code"]:
                errors.append(f"{case['name']}: 期望 error_code={case['expected_code']}，实际 {data.get('error_code')}")

            print(f"  ✅ {case['name']}: error_code={data.get('error_code')}")

        if errors:
            print_error("错误响应格式验证失败:")
            for err in errors:
                print(f"  - {err}")
            return False
        else:
            print_success("错误响应格式验证通过: 所有接口缺字段统一返回 400/MISSING_FIELDS")
            return True

    def run_all_tests(self):
        """运行所有测试"""
        print("=" * 60)
        print("波次拣货缺货拆单复核差异后端API - 自检脚本")
        print("=" * 60)

        tests = [
            self.test_1_health_check,
            self.test_2_create_locations,
            self.test_3_create_sku_stocks,
            self.test_4_create_orders,
            self.test_5_filter_orders,
            self.test_6_create_wave,
            self.test_7_generate_pick_tasks,
            self.test_8_sorted_tasks,
            self.test_9_process_pick_tasks,
            self.test_10_create_review_diff,
            self.test_11_filter_diffs,
            self.test_12_resolve_diff,
            self.test_13_complete_wave,
            self.test_14_get_wave_report,
            self.test_15_export_report,
            self.test_16_wave_list_filter,
            self.test_17_multi_order_same_sku_shortage,
            self.test_18_error_response_format,
        ]

        passed = 0
        failed = 0

        for test in tests:
            if test():
                passed += 1
            else:
                failed += 1
                print_warning(f"测试中断于: {test.__name__}")
                break
            print()

        print("=" * 60)
        print(f"测试结果: 通过 {passed} / {len(tests)}")
        if failed == 0:
            print_success("所有测试通过！系统运行正常。")
            print_info("请查看生成的Excel报告文件验证导出功能。")
        else:
            print_error(f"{failed} 个测试失败，请检查错误信息。")
        print("=" * 60)


if __name__ == "__main__":
    tester = SelfTest()
    tester.run_all_tests()