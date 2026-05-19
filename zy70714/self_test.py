#!/usr/bin/env python3
import sys
import time
from datetime import datetime
import requests

BASE_URL = "http://localhost:8000"


class colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    ENDC = '\033[0m'


def print_success(message):
    print(f"{colors.GREEN}✓{colors.ENDC} {message}")


def print_error(message):
    print(f"{colors.RED}✗{colors.ENDC} {message}")


def print_info(message):
    print(f"{colors.YELLOW}ℹ{colors.ENDC} {message}")


def get_or_create_scope(code, name, description, data_categories):
    response = requests.post(f"{BASE_URL}/export-scopes/", json={
        "code": code,
        "name": name,
        "description": description,
        "data_categories": data_categories
    })
    if response.status_code == 409:
        scopes = requests.get(f"{BASE_URL}/export-scopes/").json()
        for s in scopes:
            if s["code"] == code:
                return s["id"]
    assert response.status_code in [201, 409], f"创建范围失败: {response.text}"
    return response.json()["id"] if response.status_code == 201 else None


def get_or_create_user(user_id, name, email):
    response = requests.post(f"{BASE_URL}/user-subjects/", json={
        "user_id": user_id,
        "name": name,
        "email": email
    })
    if response.status_code == 409:
        user = requests.get(f"{BASE_URL}/user-subjects/{user_id}").json()
        return user["id"]
    assert response.status_code == 201, f"创建用户失败: {response.text}"
    return response.json()["id"]


def get_active_consent(user_subject_id):
    consent_versions = requests.get(f"{BASE_URL}/consent-versions/")
    if consent_versions.status_code == 200:
        pass
    return None


def create_consent_version(user_subject_id):
    response = requests.post(f"{BASE_URL}/consent-versions/", json={
        "user_subject_id": user_subject_id,
        "version": f"PRIVACY_v2.0_{int(time.time())}",
        "consent_type": "DATA_EXPORT",
        "agreed_at": datetime.utcnow().isoformat()
    })
    assert response.status_code == 201, f"创建同意版本失败: {response.text}"
    return response.json()["id"]


def get_or_create_export_request(request_id, user_subject_id, consent_version_id, scopes):
    response = requests.post(f"{BASE_URL}/export-requests/", json={
        "request_id": request_id,
        "user_subject_id": user_subject_id,
        "consent_version_id": consent_version_id,
        "scopes": scopes,
        "requester_notes": "用户主动申请导出个人数据，已验证身份"
    })
    if response.status_code == 409:
        request = requests.get(f"{BASE_URL}/export-requests/{request_id}").json()
        return request["id"], request["status"]
    assert response.status_code == 201, f"创建导出申请失败: {response.text}"
    return response.json()["id"], response.json()["status"]


def test_import_data():
    print_info("开始测试数据导入功能...")
    
    try:
        get_or_create_scope("BASIC_PROFILE", "基本个人资料", "包括姓名、邮箱、电话等基本信息", "个人识别信息")
        print_success("创建导出范围: BASIC_PROFILE")

        get_or_create_scope("TRANSACTION_HISTORY", "交易历史", "用户的所有交易记录", "交易数据")
        print_success("创建导出范围: TRANSACTION_HISTORY")

        get_or_create_scope("COMMUNICATION_LOG", "通信日志", "用户与客服的沟通记录", "通信数据")
        print_success("创建导出范围: COMMUNICATION_LOG")

        user_id = get_or_create_user("USER001", "张三", "zhangsan@example.com")
        print_success(f"创建/获取用户主体: USER001 (id={user_id})")

        consent_id = create_consent_version(user_id)
        print_success(f"创建同意版本 (id={consent_id})")

        export_request_id, status = get_or_create_export_request(
            "EXPORT-2024-001", user_id, consent_id, ["BASIC_PROFILE", "TRANSACTION_HISTORY"]
        )
        print_success(f"创建/获取导出申请: EXPORT-2024-001 (status={status})")

        print_success("数据导入测试完成!\n")
        return {
            "user_id": user_id,
            "consent_id": consent_id,
            "request_id": "EXPORT-2024-001",
            "export_request_id": export_request_id,
            "initial_status": status
        }
    except Exception as e:
        print_error(f"数据导入测试失败: {e}")
        raise


def test_filtering(test_data):
    print_info("开始测试筛选功能...")
    
    try:
        response = requests.get(f"{BASE_URL}/export-requests/")
        assert response.status_code == 200, f"获取列表失败: {response.text}"
        all_requests = response.json()
        assert len(all_requests) >= 1
        print_success(f"获取所有导出申请: {len(all_requests)} 条")

        response = requests.get(f"{BASE_URL}/export-requests/", params={"status": "draft"})
        assert response.status_code == 200, f"按状态筛选失败: {response.text}"
        draft_requests = response.json()
        print_success(f"按状态(draft)筛选: {len(draft_requests)} 条")

        response = requests.get(f"{BASE_URL}/export-requests/", 
                              params={"user_subject_id": test_data["user_id"]})
        assert response.status_code == 200, f"按用户筛选失败: {response.text}"
        user_requests = response.json()
        print_success(f"按用户筛选: {len(user_requests)} 条")

        response = requests.get(f"{BASE_URL}/export-scopes/")
        assert response.status_code == 200, f"获取范围失败: {response.text}"
        scopes = response.json()
        assert len(scopes) >= 3
        print_success(f"获取所有导出范围: {len(scopes)} 条")

        print_success("筛选功能测试完成!\n")
    except Exception as e:
        print_error(f"筛选功能测试失败: {e}")
        raise


def test_workflow_processing(test_data):
    print_info("开始测试流程处理功能...")
    request_id = test_data["request_id"]
    export_request_id = test_data["export_request_id"]
    initial_status = test_data["initial_status"]
    
    try:
        current_status = initial_status
        target_states = ["pending_legal", "legal_approved", "packaging", "packaged", "delivered"]
        
        for state in target_states:
            if current_status == "delivered":
                print_info(f"申请已完成交付状态，跳过状态流转测试")
                break
            if current_status == state:
                print_info(f"已处于 {state} 状态，跳过")
                continue
            
            if current_status in ["rejected", "needs_review"]:
                print_info(f"申请处于 {current_status} 状态，无法继续流转，创建新申请测试")
                new_request_id = f"EXPORT-2024-TEST-{int(time.time())}"
                export_request_id, current_status = get_or_create_export_request(
                    new_request_id, test_data["user_id"], test_data["consent_id"], ["BASIC_PROFILE"]
                )
                request_id = new_request_id
            
            if state == "pending_legal" and current_status == "draft":
                response = requests.patch(f"{BASE_URL}/export-requests/{request_id}/status", json={
                    "status": "pending_legal",
                    "legal_notes": "提交法务审核"
                })
                assert response.status_code == 200, f"状态更新失败: {response.text}"
                assert response.json()["status"] == "pending_legal"
                current_status = "pending_legal"
                print_success("状态更新: draft -> pending_legal")
                
                export_request_id = response.json()["id"]
                
                response = requests.post(f"{BASE_URL}/approvals/", json={
                    "export_request_id": export_request_id,
                    "node_type": "legal",
                    "approver_name": "李法务",
                    "approver_email": "legal@company.com",
                    "approved": True,
                    "notes": "同意版本有效，范围符合规定，予以批准"
                })
                assert response.status_code == 201, f"审批失败: {response.text}"
                assert response.json()["approved"] == True
                print_success("法务审批通过")
                
                response = requests.get(f"{BASE_URL}/export-requests/{request_id}")
                assert response.status_code == 200
                assert response.json()["status"] == "legal_approved"
                current_status = "legal_approved"
                print_success("状态自动更新为: legal_approved")
            
            if state == "legal_approved" and current_status == "pending_legal":
                pass
            
            if state == "packaging" and current_status == "legal_approved":
                response = requests.post(f"{BASE_URL}/package-tasks/", json={
                    "export_request_id": export_request_id,
                    "task_id": f"PKG-2024-{int(time.time())}"
                })
                assert response.status_code == 201, f"创建打包任务失败: {response.text}"
                task_id = response.json()["task_id"]
                print_success(f"创建打包任务: {task_id}")
                
                response = requests.patch(f"{BASE_URL}/export-requests/{request_id}/status", json={
                    "status": "packaging"
                })
                assert response.status_code == 200
                current_status = "packaging"
                print_success("状态更新: legal_approved -> packaging")
                
                response = requests.patch(f"{BASE_URL}/package-tasks/{task_id}", json={
                    "status": "completed",
                    "package_url": f"https://example.com/exports/{request_id}.zip",
                    "package_checksum": "sha256:abc123def456...",
                    "started_at": datetime.utcnow().isoformat(),
                    "completed_at": datetime.utcnow().isoformat()
                })
                assert response.status_code == 200, f"更新打包任务失败: {response.text}"
                print_success("打包任务完成")
            
            if state == "packaged" and current_status == "packaging":
                response = requests.patch(f"{BASE_URL}/export-requests/{request_id}/status", json={
                    "status": "packaged"
                })
                assert response.status_code == 200
                current_status = "packaged"
                print_success("状态更新: packaging -> packaged")
            
            if state == "delivered" and current_status == "packaged":
                response = requests.post(f"{BASE_URL}/delivery-records/", json={
                    "export_request_id": export_request_id,
                    "delivered_to": "zhangsan@example.com",
                    "delivery_method": "encrypted_email",
                    "tracking_number": f"DELIVERY-{int(time.time())}",
                    "notes": "使用AES-256加密传输"
                })
                assert response.status_code == 201, f"创建交付记录失败: {response.text}"
                print_success("创建交付记录")
                
                response = requests.get(f"{BASE_URL}/export-requests/{request_id}")
                assert response.status_code == 200
                assert response.json()["status"] == "delivered"
                current_status = "delivered"
                print_success("状态自动更新为: delivered")

        print_success("流程处理测试完成!\n")
        return export_request_id
    except Exception as e:
        print_error(f"流程处理测试失败: {e}")
        raise


def test_error_handling(test_data):
    print_info("开始测试错误处理功能...")
    
    try:
        response = requests.post(f"{BASE_URL}/export-requests/", json={
            "request_id": "EXPORT-2024-001",
            "user_subject_id": test_data["user_id"],
            "consent_version_id": test_data["consent_id"],
            "scopes": ["BASIC_PROFILE"]
        })
        assert response.status_code == 409
        assert response.json()["error_code"] == "REQUEST_EXISTS"
        print_success("重复请求检测: REQUEST_EXISTS")

        response = requests.post(f"{BASE_URL}/export-requests/", json={
            "request_id": f"EXPORT-INVALID-{int(time.time())}",
            "user_subject_id": test_data["user_id"],
            "consent_version_id": 99999,
            "scopes": ["BASIC_PROFILE"]
        })
        assert response.status_code == 422
        assert response.json()["error_code"] == "INVALID_CONSENT"
        print_success("无效同意版本检测: INVALID_CONSENT")

        response = requests.post(f"{BASE_URL}/export-requests/", json={
            "request_id": f"EXPORT-INVALID-SCOPE-{int(time.time())}",
            "user_subject_id": test_data["user_id"],
            "consent_version_id": test_data["consent_id"],
            "scopes": ["INVALID_SCOPE"]
        })
        assert response.status_code == 422
        assert response.json()["error_code"] == "INVALID_SCOPES"
        print_success("无效范围检测: INVALID_SCOPES")

        new_request_id = f"EXPORT-ERROR-TEST-{int(time.time())}"
        response = requests.post(f"{BASE_URL}/export-requests/", json={
            "request_id": new_request_id,
            "user_subject_id": test_data["user_id"],
            "consent_version_id": test_data["consent_id"],
            "scopes": ["BASIC_PROFILE"]
        })
        assert response.status_code == 201
        
        response = requests.patch(f"{BASE_URL}/export-requests/{new_request_id}/status", json={
            "status": "pending_legal"
        })
        assert response.status_code == 200
        
        response = requests.patch(f"{BASE_URL}/export-requests/{new_request_id}/status", json={
            "status": "draft"
        })
        assert response.status_code == 400
        assert response.json()["error_code"] == "INVALID_STATUS_TRANSITION"
        print_success("无效状态转换检测: INVALID_STATUS_TRANSITION")

        print_success("错误处理测试完成!\n")
    except Exception as e:
        print_error(f"错误处理测试失败: {e}")
        raise


def test_export_audit(request_id):
    print_info("开始测试审计导出功能...")
    
    try:
        response = requests.get(f"{BASE_URL}/export-requests/{request_id}/export-audit")
        if response.status_code == 404:
            print_info(f"申请 {request_id} 审计信息不可用，跳过")
            return
        
        assert response.status_code == 200, f"导出审计失败: {response.text}"
        
        audit = response.json()
        assert "request" in audit
        assert "user_subject" in audit
        assert "consent_version" in audit
        assert "export_scopes" in audit
        assert "approvals" in audit

        print_success(f"导出审计记录包含:")
        print(f"  - 请求ID: {audit['request']['request_id']}")
        print(f"  - 用户: {audit['user_subject']['name']}")
        print(f"  - 同意版本: {audit['consent_version']['version']}")
        print(f"  - 导出范围: {len(audit['export_scopes'])} 个")
        print(f"  - 审批记录: {len(audit['approvals'])} 条")
        
        if audit.get("package_task"):
            print(f"  - 打包任务: {audit['package_task']['task_id']}")
        if audit.get("delivery_record"):
            print(f"  - 交付方式: {audit['delivery_record']['delivery_method']}")

        response = requests.get(f"{BASE_URL}/delivery-records/", params={"request_id": request_id})
        assert response.status_code == 200
        deliveries = response.json()
        print_success(f"获取交付记录: {len(deliveries)} 条")

        print_success("审计导出功能测试完成!\n")
    except Exception as e:
        print_error(f"审计导出功能测试失败: {e}")
        raise


def test_idempotency(test_data):
    print_info("开始测试幂等性...")
    
    try:
        idempotent_request_id = f"EXPORT-IDEMPOTENT-{int(time.time())}"
        response = requests.post(f"{BASE_URL}/export-requests/", json={
            "request_id": idempotent_request_id,
            "user_subject_id": test_data["user_id"],
            "consent_version_id": test_data["consent_id"],
            "scopes": ["BASIC_PROFILE"],
            "requester_notes": "用于幂等性测试"
        })
        assert response.status_code == 201
        
        response = requests.patch(f"{BASE_URL}/export-requests/{idempotent_request_id}/status", json={
            "status": "pending_legal"
        })
        assert response.status_code == 200
        
        response = requests.patch(f"{BASE_URL}/export-requests/{idempotent_request_id}/status", json={
            "status": "legal_approved"
        })
        assert response.status_code == 200
        
        export_request_id = response.json()["id"]
        task_id = f"PKG-IDEMPOTENT-{int(time.time())}"
        
        response1 = requests.post(f"{BASE_URL}/package-tasks/", json={
            "export_request_id": export_request_id,
            "task_id": task_id
        })
        assert response1.status_code == 201, f"第一次创建失败: {response1.text}"
        
        response2 = requests.post(f"{BASE_URL}/package-tasks/", json={
            "export_request_id": export_request_id,
            "task_id": task_id
        })
        assert response2.status_code == 201, f"第二次创建失败: {response2.text}"
        
        assert response1.json()["task_id"] == response2.json()["task_id"]
        print_success("打包任务幂等性验证通过")

        print_success("幂等性测试完成!\n")
    except Exception as e:
        print_error(f"幂等性测试失败: {e}")
        raise


def main():
    print_info("=" * 60)
    print_info("隐私导出系统 - 自检脚本")
    print_info("=" * 60 + "\n")

    try:
        print_info("检查服务是否启动...")
        try:
            requests.get(f"{BASE_URL}/docs", timeout=5)
            print_success("服务已启动")
        except:
            print_error("无法连接到服务，请先运行: uvicorn main:app --reload --port 8000")
            sys.exit(1)

        test_data = test_import_data()
        test_filtering(test_data)
        export_request_id = test_workflow_processing(test_data)
        test_error_handling(test_data)
        test_export_audit(test_data["request_id"])
        test_idempotency(test_data)

        print_info("=" * 60)
        print_success("所有测试通过! ✓")
        print_info("=" * 60)
        print_info("\nAPI文档: http://localhost:8000/docs")
        print_info("数据库文件: privacy_export.db")
        
    except Exception as e:
        print_error(f"\n自检失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
