#!/usr/bin/env python3
"""镜像来源证明API自检脚本 - 验证导入、筛选、处理、导出功能"""

import os
import sys
import json
from datetime import datetime

os.environ['DATABASE_URL'] = "sqlite:///./test_provenance.db"

from fastapi.testclient import TestClient
from main import app
from database import init_db

client = TestClient(app)

TEST_DATA = {
    "image_tag": "myapp:v1.0.0",
    "image_digest": "sha256:abcdef1234567890",
    "pipeline_id": "pipeline-2024-001",
    "pipeline_name": "生产环境构建流水线",
    "pipeline_url": "https://ci.example.com/pipelines/123",
    "commit_hash": "a1b2c3d4e5f6",
    "commit_branch": "main",
    "commit_message": "feat: 增加用户认证功能",
    "commit_author": "张三",
    "commit_url": "https://github.com/example/repo/commit/a1b2c3d4e5f6",
    "signer": "CN=Production Signer",
    "signature": "-----BEGIN SIGNATURE-----\nMIIE...\n-----END SIGNATURE-----",
}

passed = 0
failed = 0


def print_section(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def test_case(name):
    def decorator(func):
        def wrapper(*args, **kwargs):
            global passed, failed
            try:
                print(f"\n▶  {name}...", end=" ", flush=True)
                result = func(*args, **kwargs)
                print("✅ PASS")
                passed += 1
                return result
            except AssertionError as e:
                print(f"❌ FAIL")
                print(f"   错误: {e}")
                failed += 1
            except Exception as e:
                print(f"❌ FAIL")
                print(f"   异常: {type(e).__name__}: {e}")
                failed += 1
        return wrapper
    return decorator


@test_case("创建镜像来源记录（导入）")
def test_create_provenance():
    response = client.post("/api/v1/provenance", json=TEST_DATA)
    assert response.status_code == 200, f"期望 200, 得到 {response.status_code}"
    data = response.json()
    assert data["image_tag"] == TEST_DATA["image_tag"]
    assert data["status"] == "signature_received"
    return data["id"]


@test_case("重复提交幂等性验证")
def test_duplicate_submission():
    response = client.post("/api/v1/provenance", json=TEST_DATA)
    assert response.status_code == 409, f"期望 409, 得到 {response.status_code}"
    data = response.json()
    assert data["error_code"] == "DUPLICATE_SUBMISSION"


@test_case("按镜像标签筛选")
def test_filter_by_image_tag():
    response = client.get("/api/v1/provenance", params={"image_tag": "myapp"})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("myapp" in item["image_tag"] for item in data["items"])


@test_case("按状态筛选")
def test_filter_by_status():
    response = client.get("/api/v1/provenance", params={"status": "signature_received"})
    assert response.status_code == 200
    data = response.json()
    assert all(item["status"] == "signature_received" for item in data["items"])


@test_case("获取单条记录详情")
def test_get_single_record(provenance_id):
    response = client.get(f"/api/v1/provenance/{provenance_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == provenance_id
    assert data["image_tag"] == TEST_DATA["image_tag"]


@test_case("签名验证（来源校验）")
def test_verify_signature(provenance_id):
    response = client.put(f"/api/v1/provenance/{provenance_id}/verify")
    assert response.status_code == 200
    data = response.json()
    assert data["signature_verified"] == True
    assert data["status"] == "verified"
    assert data["verification_time"] is not None


@test_case("已验证记录禁止重复验证")
def test_no_duplicate_verification(provenance_id):
    response = client.put(f"/api/v1/provenance/{provenance_id}/verify")
    assert response.status_code == 400
    data = response.json()
    assert data["error_code"] == "INVALID_STATUS"


@test_case("创建无签名记录用于例外测试")
def test_create_unsigned_record():
    unsigned_data = TEST_DATA.copy()
    unsigned_data["image_tag"] = "myapp:v1.0.1"
    unsigned_data["signature"] = None
    unsigned_data["signer"] = None
    response = client.post("/api/v1/provenance", json=unsigned_data)
    assert response.status_code == 200
    return response.json()["id"]


@test_case("无签名记录验证需要人工复核")
def test_unsigned_requires_manual_review(provenance_id):
    response = client.put(f"/api/v1/provenance/{provenance_id}/verify")
    assert response.status_code == 400
    data = response.json()
    assert data["error_code"] == "SIGNATURE_MISSING"
    assert data["details"]["requires_manual_review"] == True


@test_case("提交例外申请")
def test_request_exception(provenance_id):
    response = client.post(
        f"/api/v1/provenance/{provenance_id}/exception",
        json={"reason": "紧急发布，需要临时豁免", "requester": "李四"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["exception_requested"] == True
    assert data["status"] == "exception_pending"


@test_case("例外申请审批")
def test_approve_exception(provenance_id):
    response = client.post(
        f"/api/v1/provenance/{provenance_id}/exception/approve",
        json={"approved": True, "approver": "王五", "reason": "情况属实，批准例外"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["exception_approved"] == True
    assert data["status"] == "exception_approved"
    assert data["exception_approver"] == "王五"


@test_case("已批准例外禁止重复处理")
def test_no_duplicate_approval(provenance_id):
    response = client.post(
        f"/api/v1/provenance/{provenance_id}/exception/approve",
        json={"approved": True, "approver": "王五"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error_code"] == "ALREADY_PROCESSED"


@test_case("创建新记录用于测试'拒绝后不能再次审批'")
def test_create_record_for_reject_test():
    unsigned_data = TEST_DATA.copy()
    unsigned_data["image_tag"] = "myapp:v1.0.2"
    unsigned_data["signature"] = None
    unsigned_data["signer"] = None
    response = client.post("/api/v1/provenance", json=unsigned_data)
    assert response.status_code == 200
    return response.json()["id"]


@test_case("例外拒绝后禁止再次审批 - 验证幂等语义")
def test_no_reapproval_after_reject(provenance_id):
    # 提交例外申请
    response = client.post(
        f"/api/v1/provenance/{provenance_id}/exception",
        json={"reason": "紧急发布，需要临时豁免", "requester": "李四"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "exception_pending"
    
    # 第一次审批：拒绝
    response = client.post(
        f"/api/v1/provenance/{provenance_id}/exception/approve",
        json={"approved": False, "approver": "王五", "reason": "不符合豁免条件"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["exception_approved"] == False
    assert data["status"] == "exception_rejected"
    
    # 尝试再次审批（无论批准或拒绝都应该失败）
    response = client.post(
        f"/api/v1/provenance/{provenance_id}/exception/approve",
        json={"approved": True, "approver": "王五"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error_code"] == "ALREADY_PROCESSED"
    
    # 尝试再次拒绝也应该失败
    response = client.post(
        f"/api/v1/provenance/{provenance_id}/exception/approve",
        json={"approved": False, "approver": "其他人"},
    )
    assert response.status_code == 400
    assert response.json()["error_code"] == "ALREADY_PROCESSED"


@test_case("导出证明包")
def test_export_bundle(provenance_id):
    response = client.get(f"/api/v1/provenance/{provenance_id}/bundle")
    assert response.status_code == 200
    assert "application/json" in response.headers["content-type"]
    
    bundle = response.json()
    assert "bundle_id" in bundle
    assert "generated_at" in bundle
    assert bundle["image"]["tag"] is not None
    assert bundle["source_code"]["commit_hash"] is not None
    assert "signature" in bundle
    assert "exception" in bundle
    
    assert os.path.exists("bundles"), "bundles目录应被创建"
    bundle_files = [f for f in os.listdir("bundles") if f.endswith(".json")]
    assert len(bundle_files) >= 1, "应在bundles目录生成证明包文件"


@test_case("获取不存在的记录返回404")
def test_get_nonexistent_record():
    response = client.get("/api/v1/provenance/999999")
    assert response.status_code == 404
    data = response.json()
    assert data["error_code"] == "NOT_FOUND"


@test_case("分页功能验证")
def test_pagination():
    response = client.get("/api/v1/provenance", params={"page": 1, "page_size": 1})
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 1
    assert len(data["items"]) <= 1


def main():
    print("=" * 60)
    print("  镜像来源证明签名核对API - 自检脚本")
    print("=" * 60)
    
    cleanup()
    init_db()
    print("✅ 数据库已初始化")
    
    print_section("1. 导入功能测试")
    provenance_id_1 = test_create_provenance()
    test_duplicate_submission()
    
    print_section("2. 筛选功能测试")
    test_filter_by_image_tag()
    test_filter_by_status()
    test_get_single_record(provenance_id_1)
    test_pagination()
    
    print_section("3. 处理功能测试")
    test_verify_signature(provenance_id_1)
    test_no_duplicate_verification(provenance_id_1)
    
    provenance_id_2 = test_create_unsigned_record()
    test_unsigned_requires_manual_review(provenance_id_2)
    test_request_exception(provenance_id_2)
    test_approve_exception(provenance_id_2)
    test_no_duplicate_approval(provenance_id_2)
    
    provenance_id_3 = test_create_record_for_reject_test()
    test_no_reapproval_after_reject(provenance_id_3)
    
    print_section("4. 导出功能测试")
    test_export_bundle(provenance_id_1)
    
    print_section("5. 边界情况测试")
    test_get_nonexistent_record()
    
    cleanup()
    
    print_section("测试总结")
    total = passed + failed
    print(f"\n总测试数: {total}")
    print(f"通过: {passed} ✅")
    print(f"失败: {failed} ❌")
    print(f"通过率: {passed/total*100:.1f}%")
    
    if failed > 0:
        sys.exit(1)
    else:
        print("\n🎉 所有测试通过！")


def cleanup():
    if os.path.exists("test_provenance.db"):
        os.remove("test_provenance.db")
    if os.path.exists("bundles"):
        for f in os.listdir("bundles"):
            os.remove(os.path.join("bundles", f))


if __name__ == "__main__":
    main()
