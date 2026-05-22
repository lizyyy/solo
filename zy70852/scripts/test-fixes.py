#!/usr/bin/env python3
import requests
import json
import os
import csv

BASE_URL = "http://localhost:3000/api"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def print_result(test_name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"     {details}")

def test1_health_check():
    """测试健康检查"""
    print_section("1. 健康检查测试")
    try:
        r = requests.get("http://localhost:3000/health", timeout=5)
        data = r.json()
        passed = data.get("status") == "ok"
        print_result("健康检查", passed, data.get("message", ""))
        return passed
    except Exception as e:
        print_result("健康检查", False, str(e))
        return False

def test2_create_batches():
    """测试创建批次"""
    print_section("2. 创建批次测试")
    results = []
    
    # 创建线路班次批次
    try:
        payload = {
            "batchType": "route_schedules",
            "sourceFile": "test_routes.json",
            "createdBy": "admin",
            "remark": "测试线路班次"
        }
        r = requests.post(f"{BASE_URL}/batches", json=payload, timeout=5)
        data = r.json()
        passed = data.get("success") == True and "batchId" in data.get("data", {})
        route_batch_id = data["data"]["batchId"] if passed else None
        print_result("创建线路班次批次", passed, f"batchId: {route_batch_id}")
        results.append(("route_batch", route_batch_id if passed else None))
    except Exception as e:
        print_result("创建线路班次批次", False, str(e))
        results.append(("route_batch", None))
    
    # 创建失物批次
    try:
        payload = {
            "batchType": "lost_items",
            "sourceFile": "test_items.csv",
            "createdBy": "admin",
            "remark": "测试失物数据"
        }
        r = requests.post(f"{BASE_URL}/batches", json=payload, timeout=5)
        data = r.json()
        passed = data.get("success") == True and "batchId" in data.get("data", {})
        item_batch_id = data["data"]["batchId"] if passed else None
        print_result("创建失物批次", passed, f"batchId: {item_batch_id}")
        results.append(("item_batch", item_batch_id if passed else None))
    except Exception as e:
        print_result("创建失物批次", False, str(e))
        results.append(("item_batch", None))
    
    return results

def test3_import_routes():
    """测试导入线路班次"""
    print_section("3. 线路班次导入测试")
    # 创建测试JSON文件
    test_routes = [
        {"route_no": "101", "shift_no": "M01", "driver_name": "张三", "driver_phone": "13800138001", 
         "vehicle_no": "京A12345", "departure_time": "2026-05-21 08:00:00", 
         "start_station": "北京站", "end_station": "中关村"},
        {"route_no": "102", "shift_no": "A01", "driver_name": "李四", "driver_phone": "13900139002", 
         "vehicle_no": "京B67890", "departure_time": "2026-05-21 09:00:00", 
         "start_station": "西站", "end_station": "东直门"}
    ]
    
    with open("uploads/test_routes.json", "w") as f:
        json.dump(test_routes, f)
    
    # 先读取批次列表获取batchId
    try:
        r = requests.get(f"{BASE_URL}/batches?page=1&pageSize=10", timeout=5)
        data = r.json()
        batches = data["data"]["list"]
        route_batch = next((b for b in batches if b["batch_type"] == "route_schedules"), None)
        if route_batch:
            batch_id = route_batch["id"]
            payload = {"batchId": batch_id, "operator": "admin"}
            r = requests.post(f"{BASE_URL}/upload/route-schedules", json=payload, timeout=10)
            data = r.json()
            passed = data.get("success") == True
            count = data["data"]["successCount"] if passed else 0
            print_result("导入线路班次JSON", passed, f"成功: {count} 条")
            return passed
        else:
            print_result("导入线路班次JSON", False, "未找到批次")
            return False
    except Exception as e:
        print_result("导入线路班次JSON", False, str(e))
        return False
    finally:
        if os.path.exists("uploads/test_routes.json"):
            os.remove("uploads/test_routes.json")

def test4_csv_import_field_mapping():
    """测试CSV导入字段映射修复"""
    print_section("4. CSV导入字段映射测试")
    all_passed = True
    
    # 创建测试CSV文件，使用完整字段名（item_description, item_category）
    csv_content = """item_no,item_name,item_description,item_category,found_time,found_location,route_no,shift_no,driver_name,driver_phone,finder_name,finder_phone
ITEM001,黑色钱包,牛皮长款钱包,钱包类,2026-05-20 10:30:00,101路公交车上,101,M01,张三,13800138001,王五,13700137003
ITEM002,黑色钱包,短款对折钱包,钱包类,2026-05-20 14:20:00,102路公交车上,102,A01,李四,13900139002,赵六,13600136004
ITEM003,雨伞,蓝色折叠伞,雨具类,2026-05-19 16:00:00,999路公交车,999,U01,周七,13500135005,钱八,13400134006"""
    
    with open("uploads/test_items.csv", "w") as f:
        f.write(csv_content)
    
    try:
        # 获取批次ID
        r = requests.get(f"{BASE_URL}/batches?page=1&pageSize=10", timeout=5)
        data = r.json()
        batches = data["data"]["list"]
        item_batch = next((b for b in batches if b["batch_type"] == "lost_items"), None)
        
        if item_batch:
            batch_id = item_batch["id"]
            payload = {"batchId": batch_id, "operator": "admin", "validateRoute": True}
            r = requests.post(f"{BASE_URL}/upload/lost-items", json=payload, timeout=10)
            data = r.json()
            
            import_success = data.get("success") == True
            print_result("导入失物CSV", import_success, f"成功: {data.get('data', {}).get('successCount', 0)} 条")
            
            # 检查是否有线路校验警告
            warnings = data.get("data", {}).get("warnings", [])
            has_warnings = len(warnings) > 0
            print_result("线路班次校验警告", has_warnings, f"检测到 {len(warnings)} 条警告")
            
            if not has_warnings:
                all_passed = False
            
            # 查询物品列表验证字段映射
            r = requests.get(f"{BASE_URL}/items?page=1&pageSize=10", timeout=5)
            data = r.json()
            items = data["data"]["list"]
            
            if len(items) > 0:
                first_item = items[0]
                has_desc = first_item.get("item_description") and len(first_item["item_description"]) > 0
                has_category = first_item.get("item_category") and len(first_item["item_category"]) > 0
                
                print_result("item_description字段映射", has_desc, f"值: {first_item.get('item_description', '空')}")
                print_result("item_category字段映射", has_category, f"值: {first_item.get('item_category', '空')}")
                
                if not (has_desc and has_category):
                    all_passed = False
            else:
                print_result("查询物品", False, "未找到导入的物品")
                all_passed = False
        else:
            print_result("导入失物CSV", False, "未找到批次")
            all_passed = False
    except Exception as e:
        print_result("CSV导入测试", False, str(e))
        all_passed = False
    finally:
        if os.path.exists("uploads/test_items.csv"):
            os.remove("uploads/test_items.csv")
    
    return all_passed

def test5_same_name_items():
    """测试同名物品检查（带历史记录）"""
    print_section("5. 同名物品处理测试")
    all_passed = True
    
    try:
        payload = {"operator": "admin"}
        r = requests.post(f"{BASE_URL}/tasks/check-same-name", json=payload, timeout=10)
        data = r.json()
        passed = data.get("success") == True
        groups = data["data"]["totalGroups"] if passed else 0
        affected = data["data"]["totalItemsAffected"] if passed else 0
        
        print_result("同名物品检查", passed, f"分组: {groups}, 影响: {affected} 件")
        
        # 查询第一个物品，验证has_same_name标记和历史记录
        r = requests.get(f"{BASE_URL}/items?page=1&pageSize=1", timeout=5)
        data = r.json()
        items = data["data"]["list"]
        
        if len(items) > 0:
            item_id = items[0]["id"]
            r = requests.get(f"{BASE_URL}/items/{item_id}", timeout=5)
            data = r.json()
            item = data["data"]
            
            has_same_name = item.get("has_same_name") == 1
            print_result("has_same_name标记", has_same_name, f"值: {item.get('has_same_name')}")
            
            has_history = len(item.get("history", [])) > 0
            same_name_history = any(h.get("action") == "same_name_check" for h in item.get("history", []))
            print_result("同名处理历史记录", same_name_history, f"历史记录数: {len(item.get('history', []))}")
            
            if not (has_same_name and same_name_history):
                all_passed = False
    except Exception as e:
        print_result("同名物品测试", False, str(e))
        all_passed = False
    
    return all_passed

def test6_sensitive_info_mask():
    """测试敏感信息脱敏接口"""
    print_section("6. 敏感信息脱敏测试")
    all_passed = True
    
    try:
        # 获取第一个物品ID
        r = requests.get(f"{BASE_URL}/items?page=1&pageSize=1", timeout=5)
        data = r.json()
        items = data["data"]["list"]
        item_id = items[0]["id"]
        
        # 调用敏感信息脱敏接口
        payload = {"operator": "admin", "fieldsToMask": ["driver_phone", "finder_phone", "driver_name", "finder_name"]}
        r = requests.post(f"{BASE_URL}/items/{item_id}/mask-sensitive", json=payload, timeout=10)
        data = r.json()
        
        passed = data.get("success") == True
        print_result("敏感信息脱敏接口", passed, f"脱敏字段: {data.get('data', {}).get('maskedFields', [])}")
        
        # 验证 sensitive_info_masked 标记和历史记录
        r = requests.get(f"{BASE_URL}/items/{item_id}", timeout=5)
        data = r.json()
        item = data["data"]
        
        mask_flag = item.get("sensitive_info_masked") == 1
        print_result("sensitive_info_masked标记", mask_flag, f"值: {item.get('sensitive_info_masked')}")
        
        mask_history = any(h.get("action") == "mask_sensitive_info" for h in item.get("history", []))
        print_result("脱敏处理历史记录", mask_history, "已记录审计日志")
        
        # 验证电话脱敏效果
        phone_masked = "*" in (item.get("driver_phone") or "")
        print_result("司机电话脱敏效果", phone_masked, f"值: {item.get('driver_phone')}")
        
        if not (passed and mask_flag and mask_history and phone_masked):
            all_passed = False
    except Exception as e:
        print_result("敏感信息脱敏测试", False, str(e))
        all_passed = False
    
    return all_passed

def test7_batch_mask():
    """测试批量敏感信息脱敏"""
    print_section("7. 批量敏感信息脱敏测试")
    all_passed = True
    
    try:
        # 获取前2个物品ID
        r = requests.get(f"{BASE_URL}/items?page=1&pageSize=2", timeout=5)
        data = r.json()
        items = data["data"]["list"]
        item_ids = [i["id"] for i in items if i.get("sensitive_info_masked") != 1]
        
        if len(item_ids) > 0:
            payload = {"itemIds": item_ids, "operator": "admin"}
            r = requests.post(f"{BASE_URL}/items/batch-mask-sensitive", json=payload, timeout=10)
            data = r.json()
            
            passed = data.get("success") == True
            success_count = data.get("data", {}).get("successCount", 0)
            print_result("批量敏感信息脱敏", passed, f"成功: {success_count}/{len(item_ids)}")
            
            if not passed:
                all_passed = False
        else:
            print_result("批量敏感信息脱敏", True, "所有物品已脱敏，跳过测试")
    except Exception as e:
        print_result("批量敏感信息脱敏", False, str(e))
        all_passed = False
    
    return all_passed

def test8_overdue_check():
    """测试逾期检查"""
    print_section("8. 逾期检查测试")
    all_passed = True
    
    try:
        payload = {"overdueDays": 1, "operator": "admin"}
        r = requests.post(f"{BASE_URL}/tasks/check-overdue", json=payload, timeout=10)
        data = r.json()
        
        passed = data.get("success") == True
        overdue_count = data.get("data", {}).get("totalOverdue", 0)
        print_result("逾期物品检查", passed, f"逾期: {overdue_count} 件")
    except Exception as e:
        print_result("逾期检查测试", False, str(e))
        all_passed = False
    
    return all_passed

def test9_process_flow():
    """测试物品处理流程（放行/退回）"""
    print_section("9. 物品处理流程测试")
    all_passed = True
    
    try:
        # 获取第一个物品ID
        r = requests.get(f"{BASE_URL}/items?page=1&pageSize=1", timeout=5)
        data = r.json()
        items = data["data"]["list"]
        item_id = items[0]["id"]
        
        # 标记完成（放行）
        payload = {"reason": "信息完整，失主证件齐全，予以放行", "operator": "admin"}
        r = requests.post(f"{BASE_URL}/items/{item_id}/complete", json=payload, timeout=10)
        data = r.json()
        
        passed = data.get("success") == True
        print_result("标记完成（放行）", passed)
        
        if passed:
            # 验证处理历史记录
            r = requests.get(f"{BASE_URL}/items/{item_id}", timeout=5)
            data = r.json()
            item = data["data"]
            
            complete_history = any(
                h.get("action") == "complete" and "放行" in (h.get("action_reason") or "") 
                for h in item.get("history", [])
            )
            print_result("放行原因历史记录", complete_history, "处理原因已记录")
            
            if not complete_history:
                all_passed = False
    except Exception as e:
        print_result("物品处理流程测试", False, str(e))
        all_passed = False
    
    return all_passed

def test10_voucher_trace():
    """测试凭证溯源闭环"""
    print_section("10. 凭证溯源闭环测试")
    all_passed = True
    
    try:
        # 获取一个已完成的物品
        r = requests.get(f"{BASE_URL}/items?status=completed&page=1&pageSize=1", timeout=5)
        data = r.json()
        items = data["data"]["list"]
        
        if len(items) > 0:
            item_id = items[0]["id"]
            
            # 开具凭证
            payload = {"issuer": "admin", "expireDays": 7}
            r = requests.post(f"{BASE_URL}/items/{item_id}/issue-voucher", json=payload, timeout=10)
            data = r.json()
            
            voucher_no = data.get("data", {}).get("voucherNo")
            print_result("开具领取凭证", voucher_no is not None, f"凭证号: {voucher_no}")
            
            if voucher_no:
                # 凭证溯源
                r = requests.get(f"{BASE_URL}/vouchers/{voucher_no}/trace", timeout=10)
                data = r.json()
                
                passed = data.get("success") == True
                trace = data.get("data", {})
                
                has_item = trace.get("item") is not None
                has_history = trace.get("processingHistory") and len(trace["processingHistory"]) > 0
                has_voucher = trace.get("voucher") is not None
                
                print_result("凭证溯源接口", passed)
                print_result("溯源包含物品信息", has_item)
                print_result("溯源包含处理历史", has_history, f"步骤数: {len(trace.get('processingHistory', []))}")
                print_result("溯源包含凭证信息", has_voucher)
                
                if not (passed and has_item and has_history and has_voucher):
                    all_passed = False
                
                # 领取物品
                payload = {
                    "receiverName": "失主王先生",
                    "receiverPhone": "13800138999",
                    "receiverIdCard": "110101199001011234",
                    "operator": "admin"
                }
                r = requests.post(f"{BASE_URL}/vouchers/{voucher_no}/pickup", json=payload, timeout=10)
                data = r.json()
                print_result("领取物品", data.get("success") == True)
        else:
            print_result("凭证溯源测试", False, "未找到已完成的物品")
            all_passed = False
    except Exception as e:
        print_result("凭证溯源测试", False, str(e))
        all_passed = False
    
    return all_passed

def test11_query_by_route_driver():
    """测试按线路/司机查询"""
    print_section("11. 历史查询测试")
    all_passed = True
    
    try:
        # 按线路查询
        r = requests.get(f"{BASE_URL}/query/by-route?routeNo=101&shiftNo=M01", timeout=5)
        data = r.json()
        passed = data.get("success") == True
        count = data.get("data", {}).get("total", 0)
        print_result("按线路查询", passed, f"找到: {count} 条")
        
        # 按司机查询
        r = requests.get(f"{BASE_URL}/query/by-driver?driverName=张三", timeout=5)
        data = r.json()
        passed2 = data.get("success") == True
        count2 = data.get("data", {}).get("total", 0)
        print_result("按司机查询", passed2, f"找到: {count2} 条")
        
        if not (passed and passed2):
            all_passed = False
    except Exception as e:
        print_result("历史查询测试", False, str(e))
        all_passed = False
    
    return all_passed

def main():
    print("\n" + "="*60)
    print("  公交失物招领后端服务 - 第二轮修复验证测试")
    print("="*60)
    
    results = []
    
    # 运行所有测试
    results.append(("健康检查", test1_health_check()))
    results.append(("创建批次", all(r[1] is not None for r in test2_create_batches())))
    results.append(("导入线路班次", test3_import_routes()))
    results.append(("CSV字段映射修复", test4_csv_import_field_mapping()))
    results.append(("同名物品处理", test5_same_name_items()))
    results.append(("敏感信息脱敏", test6_sensitive_info_mask()))
    results.append(("批量敏感信息脱敏", test7_batch_mask()))
    results.append(("逾期检查", test8_overdue_check()))
    results.append(("物品处理流程", test9_process_flow()))
    results.append(("凭证溯源闭环", test10_voucher_trace()))
    results.append(("历史查询接口", test11_query_by_route_driver()))
    
    # 总结
    print("\n" + "="*60)
    print("  测试总结")
    print("="*60)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status} {name}")
    
    print(f"\n总计: {passed_count}/{total_count} 测试通过")
    
    if passed_count == total_count:
        print("\n🎉 所有第二轮修复目标均已达成！")
        return 0
    else:
        print(f"\n⚠️  还有 {total_count - passed_count} 项测试未通过")
        return 1

if __name__ == "__main__":
    exit(main())
