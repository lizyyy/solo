#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def print_separator(title=""):
    print("\n" + "="*60)
    if title:
        print(f"  {title}")
        print("="*60)

def test_health():
    print_separator("1. 健康检查")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"连接失败: {e}")
        return False

def test_create_material():
    print_separator("2. 创建材料")
    payload = {
        "complaint_no": "CP2024001",
        "material_type": "complaint_form",
        "batch_no": 1,
        "submitted_by": "customer001",
        "material_report": {
            "file_name": "complaint_form.pdf",
            "file_size": 1024000,
            "upload_time": "2024-01-15T10:00:00Z"
        },
        "raw_input": {
            "form_data": "原始表单数据",
            "user_agent": "Mozilla/5.0...",
            "ip": "192.168.1.1"
        }
    }
    response = requests.post(f"{BASE_URL}/api/materials/", json=payload)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
    return result.get("id") if response.status_code == 200 else None

def test_create_more_materials():
    print_separator("3. 创建更多材料（模拟多批次补交）")
    materials = [
        {"complaint_no": "CP2024001", "material_type": "identity_proof", "batch_no": 1, "submitted_by": "customer001"},
        {"complaint_no": "CP2024001", "material_type": "service_contract", "batch_no": 1, "submitted_by": "customer001"},
        {"complaint_no": "CP2024001", "material_type": "payment_proof", "batch_no": 1, "submitted_by": "customer001"},
    ]
    
    ids = []
    for mat in materials:
        response = requests.post(f"{BASE_URL}/api/materials/", json=mat)
        print(f"创建 {mat['material_type']}: {response.status_code}")
        if response.status_code == 200:
            ids.append(response.json()["id"])
    return ids

def test_get_missing(complaint_no):
    print_separator(f"4. 查询缺项材料 - {complaint_no}")
    response = requests.get(f"{BASE_URL}/api/complaints/{complaint_no}/missing?complaint_type=service_complaint")
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"缺项摘要: 共需 {result['total_required']} 项，已完成 {result['completed_count']} 项，缺失 {result['missing_count']} 项")
    print("\n详细列表:")
    for item in result["missing_materials"]:
        status_icon = "✓" if item["status"] in ["approved", "completed"] else "✗" if item["status"] == "missing" else "○"
        print(f"  {status_icon} {item['material_name']} ({item['material_type']}): {item['status']}")
        if item.get("missing_description"):
            print(f"      说明: {item['missing_description']}")

def test_audit_material(material_id):
    print_separator(f"5. 审核材料 ID={material_id}")
    payload = {
        "auditor": "auditor001",
        "audit_comment": "材料审核通过，内容完整",
        "status": "approved",
        "processing_basis": "根据《投诉材料审核规范》第5条",
        "final_conclusion": "材料符合要求，予以通过"
    }
    response = requests.post(f"{BASE_URL}/api/materials/{material_id}/audit", json=payload)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")

def test_audit_with_rejection(material_id):
    print_separator(f"6. 驳回材料并要求补交 ID={material_id}")
    payload = {
        "auditor": "auditor001",
        "audit_comment": "身份证明文件不清晰，需要重新提交",
        "status": "needs_supplement",
        "processing_basis": "根据《投诉材料审核规范》第3条，身份证明需清晰可辨",
        "final_conclusion": "材料不完整，需补交"
    }
    response = requests.post(f"{BASE_URL}/api/materials/{material_id}/audit", json=payload)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"新状态: {result['status']}")
    print(f"审核意见: {result['audit_comment']}")
    return result["id"]

def test_retry_material(original_id):
    print_separator(f"7. 补交材料（基于原始ID={original_id}创建新批次）")
    payload = {
        "complaint_no": "CP2024001",
        "material_type": "identity_proof",
        "batch_no": 2,
        "submitted_by": "customer001",
        "material_report": {
            "file_name": "identity_proof_v2.pdf",
            "file_size": 2048000,
            "remark": "重新提交的清晰版本"
        },
        "raw_input": {
            "form_data": "第二次提交数据",
            "user_agent": "Mozilla/5.0...",
            "ip": "192.168.1.2"
        }
    }
    response = requests.post(f"{BASE_URL}/api/materials/{original_id}/retry", json=payload)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"新批次号: {result['batch_no']}")
    print(f"新材料ID: {result['id']}")
    return result["id"]

def test_correct_material(material_id):
    print_separator(f"8. 人工修正材料 ID={material_id}")
    payload = {
        "corrected_by": "admin001",
        "correction_reason": "系统导入时材料类型错误，需要修正",
        "new_values": {
            "material_type": "identity_proof",
            "missing_description": "材料类型已修正"
        }
    }
    response = requests.post(f"{BASE_URL}/api/materials/{material_id}/correct", json=payload)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"修正后材料类型: {result['material_type']}")
    return material_id

def test_get_corrections(material_id):
    print_separator(f"9. 查看修正历史 ID={material_id}")
    response = requests.get(f"{BASE_URL}/api/materials/{material_id}/corrections")
    print(f"状态码: {response.status_code}")
    corrections = response.json()
    print(f"共 {len(corrections)} 条修正记录:")
    for c in corrections:
        print(f"  - {c['created_at'][:19]} 由 {c['corrected_by']} 修正")
        print(f"    原因: {c['correction_reason']}")
        print(f"    变更: {json.dumps(c['old_values'], ensure_ascii=False)} -> {json.dumps(c['new_values'], ensure_ascii=False)}")

def test_trace_material(material_id):
    print_separator(f"10. 材料追溯链 ID={material_id}")
    response = requests.get(f"{BASE_URL}/api/materials/{material_id}/trace")
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"投诉编号: {result['complaint_no']}")
    print(f"材料类型: {result['material_type']}")
    print(f"总批次数: {result['total_batches']}")
    print("\n追溯链:")
    for idx, batch in enumerate(result["trace_chain"], 1):
        print(f"\n  批次 {batch['batch_no']} (ID={batch['id']}):")
        print(f"    状态: {batch['status']}")
        print(f"    原始输入: {json.dumps(batch['raw_input'], ensure_ascii=False)[:100]}...")
        print(f"    处理依据: {batch['processing_basis']}")
        print(f"    最终结论: {batch['final_conclusion']}")
        if batch["corrections"]:
            print(f"    修正次数: {len(batch['corrections'])}")

def test_list_materials(complaint_no=None):
    print_separator(f"11. 材料列表查询")
    params = {}
    if complaint_no:
        params["complaint_no"] = complaint_no
    response = requests.get(f"{BASE_URL}/api/materials/", params=params)
    print(f"状态码: {response.status_code}")
    materials = response.json()
    print(f"共找到 {len(materials)} 条记录:")
    for m in materials:
        print(f"  - ID={m['id']}: {m['material_type']} (批次{m['batch_no']}) - {m['status']}")

def test_export(complaint_no):
    print_separator(f"12. 导出材料报告")
    response = requests.get(f"{BASE_URL}/api/complaints/{complaint_no}/export")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        filename = f"export_{complaint_no}.xlsx"
        with open(filename, "wb") as f:
            f.write(response.content)
        print(f"导出成功，文件已保存为: {filename}")
        print(f"文件大小: {len(response.content)} 字节")

def run_all_tests():
    print("\n" + "#"*60)
    print("#" + " "*58 + "#")
    print("#" + "  投诉证据材料补交API - 完整自检流程".center(58) + "#")
    print("#" + " "*58 + "#")
    print("#"*60)
    
    if not test_health():
        print("\n❌ 服务未启动，请先运行: python main.py")
        return
    
    time.sleep(0.5)
    
    material_id = test_create_material()
    if not material_id:
        print("\n❌ 创建材料失败")
        return
    
    time.sleep(0.5)
    
    other_ids = test_create_more_materials()
    
    time.sleep(0.5)
    
    test_list_materials("CP2024001")
    
    time.sleep(0.5)
    
    test_get_missing("CP2024001")
    
    time.sleep(0.5)
    
    test_audit_material(material_id)
    
    time.sleep(0.5)
    
    if other_ids:
        original_id = test_audit_with_rejection(other_ids[0])
        time.sleep(0.5)
        new_id = test_retry_material(original_id)
        time.sleep(0.5)
        test_audit_material(new_id)
    
    time.sleep(0.5)
    
    test_correct_material(material_id)
    
    time.sleep(0.5)
    
    test_get_corrections(material_id)
    
    time.sleep(0.5)
    
    if 'new_id' in locals():
        test_trace_material(new_id)
    
    time.sleep(0.5)
    
    test_get_missing("CP2024001")
    
    time.sleep(0.5)
    
    test_export("CP2024001")
    
    print_separator("自检完成")
    print("✅ 所有测试用例执行完毕！")
    print("\n📋 已覆盖的功能:")
    print("  ✓ 创建材料")
    print("  ✓ 查询列表")
    print("  ✓ 缺项提醒")
    print("  ✓ 审核流转")
    print("  ✓ 批次补交")
    print("  ✓ 人工修正")
    print("  ✓ 修正历史")
    print("  ✓ 追溯链条")
    print("  ✓ 导出报告")
    print("\n🔗 API文档地址: http://localhost:8000/docs")

if __name__ == "__main__":
    run_all_tests()
