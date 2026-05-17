import sys
import os
import time
import requests
from datetime import datetime

BASE_URL = "http://localhost:8000"

class colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'

def print_result(test_name, success, message=""):
    if success:
        print(f"{colors.GREEN}[PASS]{colors.ENDC} {test_name}")
    else:
        print(f"{colors.RED}[FAIL]{colors.ENDC} {test_name}: {message}")
    return success

def wait_for_server():
    print(f"{colors.BLUE}等待服务器启动...{colors.ENDC}")
    for i in range(30):
        try:
            response = requests.get(f"{BASE_URL}/docs")
            if response.status_code == 200:
                print(f"{colors.GREEN}服务器已启动{colors.ENDC}")
                return True
        except:
            pass
        time.sleep(1)
    print(f"{colors.RED}服务器启动超时{colors.ENDC}")
    return False

def test_exception_types():
    print(f"\n{colors.BLUE}=== 测试异常类型 ==={colors.ENDC}")
    try:
        response = requests.get(f"{BASE_URL}/exception-types/")
        result = response.json()
        assert len(result) > 0
        codes = [t['code'] for t in result]
        assert 'MEAL_SHORTAGE' in codes
        assert 'OVERTIME' in codes
        assert 'REASSIGNMENT' in codes
        return print_result("获取异常类型列表", True)
    except Exception as e:
        return print_result("获取异常类型列表", False, str(e))

def test_create_rider():
    print(f"\n{colors.BLUE}=== 测试骑手管理 ==={colors.ENDC}")
    try:
        rider_data = {
            "rider_no": "R001",
            "name": "张三",
            "phone": "13800138001",
            "station": "北京站"
        }
        response = requests.post(f"{BASE_URL}/riders/", json=rider_data)
        result = response.json()
        assert result['rider_no'] == "R001"
        assert result['name'] == "张三"
        return print_result("创建骑手", True)
    except Exception as e:
        return print_result("创建骑手", False, str(e))

def test_create_order():
    print(f"\n{colors.BLUE}=== 测试订单导入 ==={colors.ENDC}")
    results = []
    
    try:
        order_data = {
            "order_no": "ORD001",
            "rider_no": "R001",
            "customer_address": "北京市朝阳区",
            "customer_phone": "13900139001",
            "order_amount": 25.5,
            "exception_code": "MEAL_SHORTAGE",
            "status": "exception"
        }
        response = requests.post(f"{BASE_URL}/orders/", json=order_data)
        result = response.json()
        assert result['order_no'] == "ORD001"
        assert result['exception_name'] == "少餐"
        results.append(print_result("导入异常订单（少餐）", True))
    except Exception as e:
        results.append(print_result("导入异常订单（少餐）", False, str(e)))
    
    try:
        order_data = {
            "order_no": "ORD002",
            "rider_no": "R002",
            "customer_address": "北京市海淀区",
            "order_amount": 35.0,
            "exception_code": "REASSIGNMENT",
            "status": "exception"
        }
        response = requests.post(f"{BASE_URL}/orders/", json=order_data)
        result = response.json()
        assert result['order_no'] == "ORD002"
        assert result['exception_name'] == "改派"
        results.append(print_result("导入异常订单（改派）", True))
    except Exception as e:
        results.append(print_result("导入异常订单（改派）", False, str(e)))
    
    try:
        order_data = {
            "order_no": "ORD003",
            "rider_no": "R003",
            "order_amount": 45.0,
            "status": "normal"
        }
        response = requests.post(f"{BASE_URL}/orders/", json=order_data)
        result = response.json()
        assert result['order_no'] == "ORD003"
        assert result['status'] == "normal"
        results.append(print_result("导入正常订单", True))
    except Exception as e:
        results.append(print_result("导入正常订单", False, str(e)))
    
    try:
        order_data = {
            "order_no": "ORD001",
            "rider_no": "R001",
            "order_amount": 25.5
        }
        response = requests.post(f"{BASE_URL}/orders/", json=order_data)
        assert response.status_code == 400
        result = response.json()
        assert result['detail']['error_code'] == "ALREADY_PROCESSED"
        results.append(print_result("重复订单拦截", True))
    except Exception as e:
        results.append(print_result("重复订单拦截", False, str(e)))
    
    return all(results)

def test_appeal_material():
    print(f"\n{colors.BLUE}=== 测试申诉材料 ==={colors.ENDC}")
    results = []
    
    try:
        material_data = {
            "order_no": "ORD001",
            "material_type": "photo",
            "description": "餐品照片显示缺少一份主食",
            "uploaded_by": "admin"
        }
        response = requests.post(f"{BASE_URL}/appeals/", json=material_data)
        result = response.json()
        assert result['order_no'] == "ORD001"
        assert result['material_type'] == "photo"
        results.append(print_result("上传申诉材料", True))
    except Exception as e:
        results.append(print_result("上传申诉材料", False, str(e)))
    
    try:
        material_data = {
            "order_no": "ORD002",
            "material_type": "screenshot",
            "description": "改派沟通记录截图",
            "uploaded_by": "admin"
        }
        response = requests.post(f"{BASE_URL}/appeals/", json=material_data)
        result = response.json()
        assert result['order_no'] == "ORD002"
        results.append(print_result("上传改派申诉材料", True))
    except Exception as e:
        results.append(print_result("上传改派申诉材料", False, str(e)))
    
    return all(results)

def test_reassignment():
    print(f"\n{colors.BLUE}=== 测试改派功能 ==={colors.ENDC}")
    results = []
    
    try:
        reassignment_data = {
            "order_no": "ORD003",
            "rider_no": "R004",
            "from_rider_no": "R003",
            "reason": "骑手临时有事"
        }
        response = requests.post(f"{BASE_URL}/reassignments/", json=reassignment_data)
        result = response.json()
        assert result['order_no'] == "ORD003"
        assert result['status'] == "pending"
        results.append(print_result("创建改派记录", True))
    except Exception as e:
        results.append(print_result("创建改派记录", False, str(e)))
    
    return all(results)

def test_arbitration():
    print(f"\n{colors.BLUE}=== 测试仲裁功能 ==={colors.ENDC}")
    results = []
    
    try:
        arbitration_data = {
            "order_no": "ORD001",
            "result": "appeal_upheld",
            "reason": "证据充分，支持骑手申诉",
            "handled_by": "admin"
        }
        response = requests.post(f"{BASE_URL}/arbitrations/", json=arbitration_data)
        result = response.json()
        assert result['order_no'] == "ORD001"
        assert result['review_status'] == "completed"
        assert result['need_manual_review'] == False
        results.append(print_result("创建仲裁（无需人工复核）", True))
    except Exception as e:
        results.append(print_result("创建仲裁（无需人工复核）", False, str(e)))
    
    try:
        arbitration_data = {
            "order_no": "ORD002",
            "result": "pending_review",
            "reason": "改派异常需要复核",
            "handled_by": "admin"
        }
        response = requests.post(f"{BASE_URL}/arbitrations/", json=arbitration_data)
        assert response.status_code == 202
        result = response.json()
        assert result['detail']['error_code'] == "NEED_MANUAL_REVIEW"
        results.append(print_result("创建仲裁（需要人工复核）", True))
    except Exception as e:
        results.append(print_result("创建仲裁（需要人工复核）", False, str(e)))
    
    try:
        arbitration_data = {
            "order_no": "ORD001",
            "result": "appeal_upheld",
            "reason": "重复仲裁测试",
            "handled_by": "admin"
        }
        response = requests.post(f"{BASE_URL}/arbitrations/", json=arbitration_data)
        assert response.status_code == 400
        result = response.json()
        assert result['detail']['error_code'] == "DUPLICATE_ARBITRATION"
        results.append(print_result("重复仲裁拦截", True))
    except Exception as e:
        results.append(print_result("重复仲裁拦截", False, str(e)))
    
    try:
        arbitration_data = {
            "order_no": "ORD003",
            "result": "appeal_upheld",
            "reason": "无证据仲裁测试",
            "handled_by": "admin"
        }
        response = requests.post(f"{BASE_URL}/arbitrations/", json=arbitration_data)
        assert response.status_code == 400
        result = response.json()
        assert result['detail']['error_code'] == "INSUFFICIENT_EVIDENCE"
        results.append(print_result("证据不足拦截", True))
    except Exception as e:
        results.append(print_result("证据不足拦截", False, str(e)))
    
    return all(results)

def test_filter_orders():
    print(f"\n{colors.BLUE}=== 测试订单筛选 ==={colors.ENDC}")
    results = []
    
    try:
        filter_data = {
            "exception_code": "MEAL_SHORTAGE"
        }
        response = requests.post(f"{BASE_URL}/orders/filter/", json=filter_data)
        result = response.json()
        assert len(result) >= 1
        assert any(o['exception_name'] == "少餐" for o in result)
        results.append(print_result("按异常类型筛选", True))
    except Exception as e:
        results.append(print_result("按异常类型筛选", False, str(e)))
    
    try:
        filter_data = {
            "status": "arbitrated"
        }
        response = requests.post(f"{BASE_URL}/orders/filter/", json=filter_data)
        result = response.json()
        assert len(result) >= 1
        results.append(print_result("按状态筛选（已仲裁）", True))
    except Exception as e:
        results.append(print_result("按状态筛选（已仲裁）", False, str(e)))
    
    try:
        filter_data = {
            "rider_no": "R001"
        }
        response = requests.post(f"{BASE_URL}/orders/filter/", json=filter_data)
        result = response.json()
        assert len(result) >= 1
        results.append(print_result("按骑手筛选", True))
    except Exception as e:
        results.append(print_result("按骑手筛选", False, str(e)))
    
    return all(results)

def test_export_orders():
    print(f"\n{colors.BLUE}=== 测试订单导出 ==={colors.ENDC}")
    results = []
    
    try:
        response = requests.get(f"{BASE_URL}/orders/export/")
        assert response.status_code == 200
        assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in response.headers['content-type']
        filename = response.headers['content-disposition'].split('=')[1].strip('"')
        with open(filename, 'wb') as f:
            f.write(response.content)
        assert os.path.exists(filename)
        results.append(print_result(f"导出Excel文件: {filename}", True))
    except Exception as e:
        results.append(print_result("导出Excel文件", False, str(e)))
    
    return all(results)

def test_error_responses():
    print(f"\n{colors.BLUE}=== 测试错误响应 ==={colors.ENDC}")
    results = []
    
    try:
        order_data = {
            "order_no": "ORD999",
            "rider_no": "R999",
            "exception_code": "INVALID_CODE",
            "status": "exception"
        }
        response = requests.post(f"{BASE_URL}/orders/", json=order_data)
        assert response.status_code == 400
        result = response.json()
        assert result['detail']['error_code'] == "NOT_FOUND"
        results.append(print_result("异常类型不存在错误", True))
    except Exception as e:
        results.append(print_result("异常类型不存在错误", False, str(e)))
    
    try:
        material_data = {
            "order_no": "INVALID_ORDER",
            "material_type": "photo",
            "description": "测试",
            "uploaded_by": "admin"
        }
        response = requests.post(f"{BASE_URL}/appeals/", json=material_data)
        assert response.status_code == 404
        result = response.json()
        assert result['detail']['error_code'] == "NOT_FOUND"
        results.append(print_result("订单不存在错误", True))
    except Exception as e:
        results.append(print_result("订单不存在错误", False, str(e)))
    
    return all(results)

def main():
    print(f"{colors.BLUE}{'='*60}{colors.ENDC}")
    print(f"{colors.BLUE}异常单申诉改派仲裁证据API - 自检脚本{colors.ENDC}")
    print(f"{colors.BLUE}{'='*60}{colors.ENDC}")
    
    if not wait_for_server():
        return 1
    
    all_results = []
    
    all_results.append(test_exception_types())
    all_results.append(test_create_rider())
    all_results.append(test_create_order())
    all_results.append(test_appeal_material())
    all_results.append(test_reassignment())
    all_results.append(test_arbitration())
    all_results.append(test_filter_orders())
    all_results.append(test_export_orders())
    all_results.append(test_error_responses())
    
    print(f"\n{colors.BLUE}{'='*60}{colors.ENDC}")
    passed = sum(1 for r in all_results if r)
    total = len(all_results)
    
    if passed == total:
        print(f"{colors.GREEN}所有测试通过！({passed}/{total}){colors.ENDC}")
        print(f"{colors.GREEN}API功能验证完成，可以正常使用。{colors.ENDC}")
        return 0
    else:
        print(f"{colors.RED}部分测试失败！({passed}/{total}){colors.ENDC}")
        print(f"{colors.YELLOW}请检查失败的测试项。{colors.ENDC}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
