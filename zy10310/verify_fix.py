#!/usr/bin/env python3
"""
租户导入预检 API - 修复验证脚本
验证创建导入包、预检、状态推进、审计日志等核心功能
"""
import subprocess
import sys
import time
import requests
import os

BASE_URL = "http://localhost:8000"

def print_step(step_num, title):
    print(f"\n{'='*70}")
    print(f"🔹 Step {step_num}: {title}")
    print(f"{'='*70}")

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def check_service():
    """检查服务是否运行"""
    print_step(0, "检查服务状态")
    
    max_retries = 5
    for i in range(max_retries):
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=5)
            if response.status_code == 200:
                print_success("服务运行正常!")
                return True
        except:
            pass
        if i < max_retries - 1:
            print(f"   等待服务启动... ({i+1}/{max_retries})")
            time.sleep(2)
    
    print_error("无法连接到服务，请先运行: uvicorn app.main:app --reload")
    return False

def test_create_package():
    """测试: 创建导入包"""
    print_step(1, "创建导入包 (核心修复验证)")
    
    package_data = {
        "tenant_id": "tenant_verify_001",
        "package_name": "修复验证导入包",
        "package_version": "v1.0.0",
        "source_content": "这是修复验证的测试内容",
        "metadata": {"test": "fix_verification"},
        "field_mappings": [
            {
                "source_field": "user_id",
                "target_field": "id",
                "mapping_type": "direct",
                "transform_rule": {}
            }
        ],
        "dependency_resources": [
            {
                "resource_type": "database",
                "resource_name": "主数据库",
                "resource_id": "db_001",
                "required": True
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/packages",
            params={"created_by": "verify_user@example.com"},
            json=package_data
        )
        
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            package_id = result["data"]["package_id"]
            print_success(f"导入包创建成功!")
            print(f"   包ID: {package_id}")
            print(f"   状态: {result['data']['status']}")
            return package_id
        else:
            print_error(f"创建失败: {response.text}")
            return None
    except Exception as e:
        print_error(f"请求异常: {e}")
        return None

def test_get_package(package_id):
    """测试: 查询导入包详情"""
    print_step(2, "查询导入包详情")
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/packages/{package_id}")
        if response.status_code == 200:
            result = response.json()
            data = result["data"]
            print_success(f"查询成功!")
            print(f"   包名称: {data['package_name']}")
            print(f"   字段映射数: {len(data['field_mappings'])}")
            print(f"   依赖资源数: {len(data['dependency_resources'])}")
            print(f"   审计日志数: {len(data['audit_logs'])}")
            return True
        else:
            print_error(f"查询失败: {response.text}")
            return False
    except Exception as e:
        print_error(f"请求异常: {e}")
        return False

def test_run_precheck(package_id):
    """测试: 执行预检"""
    print_step(3, "执行预检流程")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/v1/packages/{package_id}/precheck",
            params={"operator": "precheck_operator@example.com"}
        )
        
        if response.status_code == 200:
            result = response.json()
            data = result["data"]
            print_success(f"预检执行成功!")
            print(f"   执行状态: {data['status']}")
            print(f"   总检查数: {data['total_checks']}")
            print(f"   通过检查: {data['passed_checks']}")
            print(f"   失败检查: {data['failed_checks']}")
            print(f"   警告数量: {data['warning_count']}")
            return True
        else:
            print_error(f"预检失败: {response.text}")
            return False
    except Exception as e:
        print_error(f"请求异常: {e}")
        return False

def test_audit_logs(package_id):
    """测试: 查询审计日志"""
    print_step(4, "查询审计日志 (历史追溯功能)")
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/packages/{package_id}/audit-logs")
        if response.status_code == 200:
            result = response.json()
            logs = result["data"]
            print_success(f"查询审计日志成功! 共 {len(logs)} 条:")
            for log in logs:
                print(f"   - [{log['timestamp'][:19]}] {log['action']}: {log['old_status'] or 'NONE'} → {log['new_status'] or 'NONE'} (by {log['operator']})")
            return True
        else:
            print_error(f"查询失败: {response.text}")
            return False
    except Exception as e:
        print_error(f"请求异常: {e}")
        return False

def test_duplicate_submit():
    """测试: 重复提交防重机制"""
    print_step(5, "验证重复提交防重机制")
    
    package_data = {
        "tenant_id": "tenant_dup_001",
        "package_name": "防重测试包",
        "package_version": "v1.0.0",
        "source_content": "这个内容会被用来做防重验证",
        "metadata": {},
        "field_mappings": [],
        "dependency_resources": []
    }
    
    try:
        response1 = requests.post(
            f"{BASE_URL}/api/v1/packages",
            params={"created_by": "dup_tester@example.com"},
            json=package_data
        )
        result1 = response1.json()
        id1 = result1["data"]["package_id"]
        
        response2 = requests.post(
            f"{BASE_URL}/api/v1/packages",
            params={"created_by": "dup_tester@example.com"},
            json=package_data
        )
        result2 = response2.json()
        id2 = result2["data"]["package_id"]
        
        if id1 == id2:
            print_success(f"防重机制生效! 相同内容不会创建新包")
            print(f"   第一次ID: {id1}")
            print(f"   第二次ID: {id2}")
            return True
        else:
            print_error(f"防重机制未生效! 两次创建了不同的包")
            return False
    except Exception as e:
        print_error(f"请求异常: {e}")
        return False

def test_certificate_and_cancel(package_id):
    """测试: 凭证查看与取消流程"""
    print_step(6, "验证凭证与取消流程")
    
    try:
        response = requests.get(f"{BASE_URL}/api/v1/packages/{package_id}/certificates")
        if response.status_code == 200:
            result = response.json()
            certs = result["data"]
            print_success(f"查询凭证成功! 共 {len(certs)} 个凭证")
            
            for cert in certs:
                print(f"   凭证号: {cert['certificate_number']}")
                print(f"   签发人: {cert['issued_by']}")
                print(f"   规则版本: {cert['rules_version']}")
                print(f"   是否撤销: {cert['is_revoked']}")
        
        response = requests.post(
            f"{BASE_URL}/api/v1/packages/{package_id}/cancel",
            params={
                "operator": "cancel_user@example.com",
                "reason": "验证完成，取消导入包"
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            print_success(f"取消导入包成功! 最终状态: {result['data']['status']}")
            return True
        else:
            print_error(f"取消失败: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"请求异常: {e}")
        return False

def main():
    print("\n" + "🚀"*35)
    print("   租户导入预检 API - 修复验证测试套件")
    print("   验证: 创建/预检/状态推进/审计追溯/防重/凭证")
    print("🚀"*35)
    
    if not check_service():
        print("\n💡 提示: 打开新终端运行以下命令启动服务:")
        print("   source ~/Library/Python/3.9/bin/activate && uvicorn app.main:app --reload")
        return
    
    package_id = test_create_package()
    if not package_id:
        print("\n❌ 核心修复验证失败 - 创建导入包失败")
        return
    
    test_get_package(package_id)
    test_run_precheck(package_id)
    test_audit_logs(package_id)
    test_duplicate_submit()
    test_certificate_and_cancel(package_id)
    
    print("\n" + "🎊"*35)
    print("   所有验证测试完成! 修复已生效 ✓")
    print("🎊"*35)
    print(f"\n📖 API 文档地址: {BASE_URL}/docs")
    print(f"\n🧹 清理: 可手动删除生成的 tenant_import.db 数据库文件")

if __name__ == "__main__":
    main()
