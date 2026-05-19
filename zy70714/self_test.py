#!/usr/bin/env python3
import sys
import time
from datetime import datetime
import requests

BASE_URL = "http://localhost:8001"


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


def test_import_data():
    print_info("开始测试数据导入功能...")
    
    try:
        response = requests.post(f"{BASE_URL}/export-scopes/", json={
            "code": "BASIC_PROFILE",
            "name": "基本个人资料",
            "description": "包括姓名、邮箱、电话等基本信息",
            "data_categories": "个人识别信息"
        })
        assert response.status_code in [201, 409], f"创建范围失败: {response.text}"
        print_success("创建导出范围: BASIC_PROFILE")

        response = requests.post(f"{BASE_URL}/export-scopes/", json={
            "code": "TRANSACTION_HISTORY",
            "name": "交易历史",
            "description": "用户的所有交易记录",
            "data_categories": "交易数据"
        })
        assert response.status_code in [201, 409], f"创建范围失败: {response.text}"
        print_success("创建导出范围: TRANSACTION_HISTORY")

        response = requests.post(f"{BASE_URL}/export-scopes/", json={
            "code": "COMMUNICATION_LOG",
            "name": "通信日志",
            "description": "用户与客服的沟通记录",
            "data_categories": "通信数据"
        })
        assert response.status_code in [201, 409], f"创建范围失败: {response.text}"
        print_success("创建导出范围: COMMUNICATION_LOG")

        response = requests.post(f"{BASE_URL}/user-subjects/", json={
            "user_id": "USER001",
            "name": "张三",
            "email": "zhangsan@example.com"
        })
        assert response.status_code in [201, 409], f"创建用户失败: {response.text}"
        user_id = response.json()["id"]
        print_success(f"创建用户主体: USER001 (id={user_id})")

        response = requests.post(f"{BASE_URL}/consent-versions/", json={
            "user_subject_id": user_id,
            "version": "PRIVACY_v2.0_202401",
            "consent_type": "DATA_EXPORT",
            "agreed_at": datetime.utcnow().isoformat()
        })
        assert response.status_code == 201, f"创建同意版本失败: {response.text}"
        consent_id = response.json()["id"]
        print_success(f"创建同意版本: PRIVACY_v2.0_202401 (id={consent_id})")

        response = requests.post(f"{BASE_URL}/export-requests/", json={
            "request_id": "EXPORT-2024-001",
            "user_subject_id": user_id,
            "consent_version_id": consent_id,
            "scopes": ["BASIC_PROFILE", "TRANSACTION_HISTORY"],
            "requester_notes": "用户主动申请导出个人数据，已验证身份"
        })
        assert response.status_code == 201, f"创建导出申请失败: {response.text}"
        print_success("创建导出申请: EXPORT-2024-001")

        print_success("数据导入测试完成!\n")
        return {
            "user_id": user_id,
            "consent_id": consent_id,
            "request_id": "EXPORT-2024-001"
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
    
    try:
        response = requests.patch(f"{BASE_URL}/export-requests/{request_id}/status", json={
            "status": "pending_legal",
            "legal_notes": "提交法务审核"
        })
        assert response.status_code == 200, f"状态更新失败: {response.text}"
        assert response.json()["status"] == "pending_legal"
        print_success("状态更新: draft -> pending_legal")

        response = requests.post(f"{BASE_URL}/approvals/", json={
            "export_request_id": response.json()["id"],
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
        print_success("状态自动更新为: legal_approved")

        export_request_id = response.json()["id"]
        response = requests.post(f"{BASE_URL}/package-tasks/", json={
            "export_request_id": export_request_id,
            "task_id": "PKG-2024-001"
        })
        assert response.status_code == 201, f"创建打包任务失败: {response.text}"
        print_success("创建打包任务: PKG-2024-001")

        response = requests.patch(f"{BASE_URL}/export-requests/{request_id}/status", json={
            "status": "packaging"
        })
        assert response.status_code == 200
        print_success("状态更新: legal_approved -> packaging")

        response = requests.patch(f"{BASE_URL}/package-tasks/PKG-2024-001", json={
            "status": "completed",
            "package_url": "https://example.com/exports/EXPORT-2024-001.zip",
            "package_checksum": "sha256:abc123def456...",
            "started_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat()
        })
        assert response.status_code == 200, f"更新打包任务失败: {response.text}"
        print_success("打包任务完成")

        response = requests.patch(f"{BASE_URL}/export-requests/{request_id}/status", json={
            "status": "packaged"
        })
        assert response.status_code == 200
        print_success("状态更新: packaging -> packaged")

        response = requests.post(f"{BASE_URL}/delivery-records/", json={
            "export_request_id": export_request_id,
            "delivered_to": "zhangsan@example.com",
            "delivery_method": "encrypted_email",
            "tracking_number": "DELIVERY-0012345",
            "notes": "使用AES-256加密传输"
        })
        assert response.status_code == 201, f"创建交付记录失败: {response.text}"
        print_success("创建交付记录")

        response = requests.get(f"{BASE_URL}/export-requests/{request_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "delivered"
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
            "request_id": "EXPORT-2024-INVALID",
            "user_subject_id": test_data["user_id"],
            "consent_version_id": 99999,
            "scopes": ["BASIC_PROFILE"]
        })
        assert response.status_code == 422
        assert response.json()["error_code"] == "INVALID_CONSENT"
        print_success("无效同意版本检测: INVALID_CONSENT")

        response = requests.post(f"{BASE_URL}/export-requests/", json={
            "request_id": "EXPORT-2024-INVALID-SCOPE",
            "user_subject_id": test_data["user_id"],
            "consent_version_id": test_data["consent_id"],
            "scopes": ["INVALID_SCOPE"]
        })
        assert response.status_code == 422
        assert response.json()["error_code"] == "INVALID_SCOPES"
        print_success("无效范围检测: INVALID_SCOPES")

        response = requests.patch(f"{BASE_URL}/export-requests/EXPORT-2024-001/status", json={
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
        assert response.status_code == 200, f"导出审计失败: {response.text}"
        
        audit = response.json()
        assert "request" in audit
        assert "user_subject" in audit
        assert "consent_version" in audit
        assert "export_scopes" in audit
        assert "approvals" in audit
        assert "package_task" in audit
        assert "delivery_record" in audit

        print_success(f"导出审计记录包含:")
        print(f"  - 请求ID: {audit['request']['request_id']}")
        print(f"  - 用户: {audit['user_subject']['name']}")
        print(f"  - 同意版本: {audit['consent_version']['version']}")
        print(f"  - 导出范围: {len(audit['export_scopes'])} 个")
        print(f"  - 审批记录: {len(audit['approvals'])} 条")
        print(f"  - 打包任务: {audit['package_task']['task_id']}")
        print(f"  - 交付方式: {audit['delivery_record']['delivery_method']}")

        response = requests.get(f"{BASE_URL}/delivery-records/", params={"request_id": request_id})
        assert response.status_code == 200
        deliveries = response.json()
        assert len(deliveries) >= 1
        print_success(f"获取交付记录: {len(deliveries)} 条")

        print_success("审计导出功能测试完成!\n")
    except Exception as e:
        print_error(f"审计导出功能测试失败: {e}")
        raise


def test_idempotency(test_data):
    print_info("开始测试幂等性...")
    
    try:
        response = requests.post(f"{BASE_URL}/export-requests/", json={
            "request_id": "EXPORT-2024-IDEMPOTENT",
            "user_subject_id": test_data["user_id"],
            "consent_version_id": test_data["consent_id"],
            "scopes": ["BASIC_PROFILE"],
            "requester_notes": "用于幂等性测试"
        })
        assert response.status_code == 201
        
        response = requests.patch(f"{BASE_URL}/export-requests/EXPORT-2024-IDEMPOTENT/status", json={
            "status": "pending_legal"
        })
        assert response.status_code == 200
        
        response = requests.patch(f"{BASE_URL}/export-requests/EXPORT-2024-IDEMPOTENT/status", json={
            "status": "legal_approved"
        })
        assert response.status_code == 200
        
        export_request_id = response.json()["id"]
        
        response1 = requests.post(f"{BASE_URL}/package-tasks/", json={
            "export_request_id": export_request_id,
            "task_id": "PKG-2024-IDEMPOTENT"
        })
        assert response1.status_code == 201, f"第一次创建失败: {response1.text}"
        
        response2 = requests.post(f"{BASE_URL}/package-tasks/", json={
            "export_request_id": export_request_id,
            "task_id": "PKG-2024-IDEMPOTENT"
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
            requests.get(f"{BASE_URL}/docs")
            print_success("服务已启动")
        except:
            print_error("无法连接到服务，请先运行: uvicorn main:app --reload")
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
